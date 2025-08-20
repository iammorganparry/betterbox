import type { GetFunctionInput } from "inngest";
import { inngest } from "../../inngest";
import {
	type ProcessedAttachmentData,
	type WebhookAttachment,
	createEnrichedContactFromSender,
	createUnipileService,
	env,
	getCurrentSyncConfig,
	normalizeAccountType,
	normalizeProvider,
} from "./shared";

export const _handleMessageReceived = async ({
	event,
	step,
	services,
}: GetFunctionInput<typeof inngest, "unipile/message_received">) => {
	const { data } = event;
	const syncConfig = getCurrentSyncConfig();
	const {
		unipileAccountService: accountService,
		unipileMessageService: messageService,
		unipileContactService: contactService,
		unipileChatService: chatService,
	} = services;

	// Extract data from the real event structure
	const {
		account_id,
		account_type: provider, // account_type is the provider
		account_info,
		message_id,
		provider_message_id,
		message: messageContent, // message content is directly in 'message' field
		chat_id,
		provider_chat_id,
		sender,
		attendees,
		timestamp,
		attachments,
		message_type,
		is_event,
		subject,
		quoted,
		chat_content_type,
		folder,
		is_group,
	} = data;

	// Find the Unipile account
	const unipileAccount = await step.run("find-unipile-account", async () => {
		return await accountService.findUnipileAccountByProvider(
			account_id,
			provider.toLowerCase(),
			{ include_user: true },
		);
	});

	if (!unipileAccount) {
		throw new Error(`Unipile account not found: ${account_id} (${provider})`);
	}

	// Real-time events don't include is_sender field, so we compare sender with account user
	const isOutgoing = sender?.attendee_provider_id === account_info?.user_id;

	console.log("🔍 Real-time message processing:", {
		messageId: message_id,
		senderProviderId: sender?.attendee_provider_id,
		accountUserId: account_info?.user_id,
		isOutgoing,
		messageContent:
			messageContent?.substring(0, 50) +
			(messageContent && messageContent.length > 50 ? "..." : ""),
		hasAttachments: !!(attachments && attachments.length > 0),
		attachmentCount: attachments?.length || 0,
		attachmentTypes: attachments?.map((att) => att.type) || [],
	});

	// Step 1: Upsert the chat (create if doesn't exist)
	const internalChat = await step.run("upsert-chat", async () => {
		// Try to find existing chat first
		let existingChat = await chatService.findChatByExternalId(
			unipileAccount.id,
			chat_id,
		);

		if (!existingChat) {
			// Create new chat if it doesn't exist
			existingChat = await chatService.upsertChat(
				unipileAccount.id,
				chat_id,
				{
					name: is_group
						? "Group Chat"
						: sender?.attendee_name || "Unknown Contact",
					chat_type: is_group ? "group" : "direct",
					last_message_at: timestamp ? new Date(timestamp) : new Date(),
				},
				{
					provider: normalizeProvider(provider),
					account_type: normalizeAccountType(provider),
					unread_count: 0,
					archived: 0,
					read_only: 0,
					content_type:
						chat_content_type === "inmail" ||
						chat_content_type === "sponsored" ||
						chat_content_type === "linkedin_offer"
							? chat_content_type
							: null,
				},
			);
		}

		return existingChat;
	});

	// Step 2: Create/upsert contacts for all attendees (except self)
	await step.run("upsert-attendees-and-contacts", async () => {
		for (const attendee of attendees || []) {
			// Skip if this is the account owner (same logic as message sender check)
			if (attendee.attendee_provider_id === account_info?.user_id) {
				continue;
			}

			// Create or update contact
			let contact = null;
			if (syncConfig.enableProfileEnrichment) {
				const unipileService = createUnipileService({
					apiKey: env.UNIPILE_API_KEY,
					dsn: env.UNIPILE_DSN,
				});

				try {
					contact = await createEnrichedContactFromSender(
						unipileService,
						contactService,
						unipileAccount.id,
						account_id,
						attendee.attendee_provider_id,
						attendee.attendee_name,
					);
				} catch (error) {
					console.warn(
						"Failed to create enriched contact, falling back to basic:",
						error,
					);
					// Fallback to basic contact creation
					contact = await contactService.upsertContact(
						unipileAccount.id,
						attendee.attendee_provider_id,
						{
							full_name: attendee.attendee_name,
							provider_url: attendee.attendee_profile_url,
							last_interaction: new Date(),
						},
					);
				}
			} else {
				// Basic contact creation
				contact = await contactService.upsertContact(
					unipileAccount.id,
					attendee.attendee_provider_id,
					{
						full_name: attendee.attendee_name,
						provider_url: attendee.attendee_profile_url,
						last_interaction: new Date(),
					},
				);
			}

			// Create chat attendee record
			await chatService.upsertAttendee(
				internalChat.id,
				attendee.attendee_provider_id,
				contact?.id || null,
				{
					is_self:
						attendee.attendee_provider_id === account_info?.user_id ? 1 : 0,
					hidden: 0,
				},
			);
		}
	});

	// Step 3: Upsert the message
	const savedMessage = await step.run("upsert-message", async () => {
		// Determine message type based on content and attachments
		let inferredMessageType = message_type?.toLowerCase() || "text";
		if (!messageContent && attachments && attachments.length > 0) {
			// If no text content but has attachments, use the first attachment type as message type
			const firstAttachment = attachments[0];
			if (firstAttachment?.type === "img") {
				inferredMessageType = "image";
			} else if (firstAttachment?.type === "video") {
				inferredMessageType = "video";
			} else if (firstAttachment?.type === "audio") {
				inferredMessageType = "audio";
			} else {
				inferredMessageType = "attachment";
			}
		}

		return await messageService.upsertMessage(unipileAccount.id, message_id, {
			chat_id: internalChat.id, // Link to internal chat record
			external_chat_id: chat_id, // Store external API chat ID
			sender_id: sender?.attendee_provider_id,
			recipient_id: undefined, // Not provided in this event structure
			message_type: inferredMessageType,
			content: messageContent || null, // Allow null content for attachment-only messages
			is_read: false, // New messages are unread by default
			is_outgoing: isOutgoing,
			sent_at: timestamp ? new Date(timestamp) : new Date(),
			is_event: is_event || 0,
			subject: subject,
			metadata: quoted
				? {
						quoted,
						provider_message_id,
						attachments_count: attachments?.length || 0,
					}
				: {
						provider_message_id,
						attachments_count: attachments?.length || 0,
					},
		});
	});

	// Step 4: Handle attachments if present
	if (attachments && attachments.length > 0) {
		await step.run("upsert-attachments", async () => {
			const unipileService = createUnipileService({
				apiKey: env.UNIPILE_API_KEY,
				dsn: env.UNIPILE_DSN,
			});
			console.log(
				"📎 Processing",
				attachments.length,
				"attachments for message",
				message_id,
			);

			for (const attachment of attachments as WebhookAttachment[]) {
				try {
					const attachmentIndex = attachments.indexOf(attachment);
					const attachmentId =
						attachment.id || `${savedMessage.id}_${attachmentIndex}`;

					console.log("📎 Processing attachment:", {
						attachmentId,
						type: attachment.type,
						filename: attachment.filename || attachment.name,
						hasUrl: !!attachment.url,
						fileSize: attachment.file_size || attachment.size,
						mimeType: attachment.mime_type,
						unavailable: attachment.unavailable,
					});

					// Debug: Log the full attachment object to understand its structure
					console.log(
						"🔍 Full attachment object:",
						JSON.stringify(attachment, null, 2),
					);

					// Process attachment data from webhook (contains all necessary metadata)
					// Try different field name combinations based on various API responses
					const attachmentData: ProcessedAttachmentData = {
						id: attachment.id || attachment.attachment_id,
						type: (attachment.type || attachment.attachment_type) as
							| "img"
							| "video"
							| "audio"
							| "file"
							| "linkedin_post"
							| "video_meeting"
							| undefined,
						url:
							attachment.url ||
							attachment.content_url ||
							attachment.download_url ||
							attachment.media_url ||
							attachment.src ||
							attachment.href,
						filename:
							attachment.filename || attachment.file_name || attachment.name,
						file_size: attachment.file_size || attachment.size,
						mime_type: attachment.mime_type || attachment.mimetype,
						unavailable: attachment.unavailable,
						// Note: Additional metadata like width/height may not be available in webhook
						// These would typically come from the listChatMessages API during historical sync
					};

					console.log("📎 Using webhook attachment data:", {
						url: !!attachmentData.url,
						filename: attachmentData.filename,
						fileSize: attachmentData.file_size,
						mimeType: attachmentData.mime_type,
						type: attachmentData.type,
						unavailable: attachmentData.unavailable,
					});

					// Check if we have any usable attachment data
					if (
						!attachmentData.url &&
						!attachmentData.filename &&
						!attachmentData.file_size
					) {
						console.warn("⚠️ No usable attachment data found:", {
							attachmentId,
							webhookFields: Object.keys(attachment),
							hasAnyUrl: !!(
								attachment.url ||
								attachment.content_url ||
								attachment.download_url ||
								attachment.media_url ||
								attachment.src ||
								attachment.href
							),
							hasAnyFilename: !!(
								attachment.filename ||
								attachment.file_name ||
								attachment.name
							),
							hasAnySize: !!(attachment.file_size || attachment.size),
						});
					}

					// Download attachment content if attachment ID is available
					let attachmentContent: string | null = null;
					let finalMimeType = attachmentData.mime_type;
					let r2Key: string | undefined;
					let r2Url: string | undefined;

					if (attachmentData.id && !attachmentData.unavailable) {
						try {
							console.log("📎 Downloading attachment content:", {
								messageId: message_id,
								attachmentId: attachmentData.id,
							});

							const downloadResult = await unipileService.getMessageAttachment(
								message_id,
								attachmentData.id,
								account_id,
							);

							attachmentContent = downloadResult.content;
							// Use mime type from download if available, fallback to metadata
							finalMimeType =
								downloadResult.mime_type || attachmentData.mime_type;

							console.log("✅ Attachment content downloaded:", {
								attachmentId: attachmentData.id,
								contentSize: attachmentContent?.length || 0,
								mimeType: finalMimeType,
							});

							// Upload to R2 if we have content
							if (attachmentContent && finalMimeType) {
								try {
									const r2Service = services.r2Service;

									// Convert base64 to Uint8Array
									const binaryData = Uint8Array.from(atob(attachmentContent), c => c.charCodeAt(0));

									// Generate R2 key
									r2Key = r2Service.generateAttachmentKey(
										savedMessage.id,
										attachmentData.filename,
										finalMimeType,
									);

									// Upload to R2
									r2Url = await r2Service.upload(
										r2Key,
										binaryData,
										finalMimeType,
										{
											originalFilename: attachmentData.filename || 'attachment',
											messageId: savedMessage.id,
											attachmentId: attachmentData.id,
										},
									);

									console.log("✅ Uploaded attachment to R2:", {
										attachmentId: attachmentData.id,
										r2Key,
										r2Url,
									});
								} catch (r2Error) {
									console.warn("⚠️ Failed to upload attachment to R2:", {
										attachmentId: attachmentData.id,
										error: r2Error instanceof Error ? r2Error.message : String(r2Error),
									});
									// Continue without R2 - we'll still save the original content
								}
							}
						} catch (error) {
							console.warn("⚠️ Failed to download attachment content:", {
								attachmentId: attachmentData.id,
								error: error instanceof Error ? error.message : String(error),
							});
							// Continue without content - we'll still save the metadata
						}
					}

					// Debug: Log what we're about to save to database
					console.log("💾 Saving attachment to database:", {
						messageId: savedMessage.id,
						attachmentId,
						data: {
							url: attachmentData.url,
							filename: attachmentData.filename,
							file_size: attachmentData.file_size,
							mime_type: finalMimeType,
							content: attachmentContent
								? `base64 content (length: ${attachmentContent.length})`
								: null,
							unavailable: attachmentData.unavailable || false,
						},
						metadata: {
							attachment_type: attachmentData.type || "file",
						},
					});

					await messageService.upsertAttachment(
						savedMessage.id,
						attachmentId,
						{
							url: attachmentData.url,
							filename: attachmentData.filename,
							file_size: attachmentData.file_size,
							mime_type: finalMimeType,
							content: r2Url ? undefined : attachmentContent, // Only store base64 if no R2 URL
							unavailable: attachmentData.unavailable || false,
							width: attachmentData.width,
							height: attachmentData.height,
							duration: attachmentData.duration,
							sticker: attachmentData.sticker || false,
							gif: attachmentData.gif || false,
							voice_note: attachmentData.voice_note || false,
							starts_at: attachmentData.starts_at
								? BigInt(attachmentData.starts_at)
								: undefined,
							expires_at: attachmentData.expires_at
								? BigInt(attachmentData.expires_at)
								: undefined,
							url_expires_at: attachmentData.url_expires_at
								? BigInt(attachmentData.url_expires_at)
								: undefined,
							time_range: attachmentData.time_range,
							// R2 fields
							r2_key: r2Key,
							r2_url: r2Url,
							r2_uploaded_at: r2Url ? new Date() : undefined,
						},
						{
							attachment_type:
								(attachmentData.type as
									| "file"
									| "img"
									| "video"
									| "audio"
									| "linkedin_post"
									| "video_meeting") || "file",
						},
					);

					console.log("✅ Successfully processed attachment", attachmentId);
				} catch (error) {
					console.error("❌ Failed to process attachment:", {
						attachmentId: attachment.id,
						error: error instanceof Error ? error.message : String(error),
					});
					// Continue processing other attachments even if one fails
				}
			}

			console.log("✅ Completed processing", attachments.length, "attachments");
		});
	}

	return {
		message: savedMessage,
		chat: internalChat,
		account: unipileAccount,
		contactsCreated: attendees?.length || 0,
	};
};

/**
 * Handle new messages from Unipile (real-time)
 */
export const unipileMessageReceived = inngest.createFunction(
	{
		id: "unipile-message-received",
		concurrency: {
			limit: 1,
			key: "event.data.chat_id",
		},
	},
	{ event: "unipile/message_received" },
	_handleMessageReceived,
);
