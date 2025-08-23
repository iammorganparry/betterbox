import type { unipileContentTypeEnum } from "~/db/schema";
import type { UnipileAccountStatus } from "../../db/unipile-account.service";
import { inngest } from "../../inngest";
import {
	type UnipileHistoricalSyncRequest,
	createContactFromAttendee,
	createUnipileService,
	getCurrentSyncConfig,
	isCompanyMessage,
	isOrganizationUrn,
	normalizeAccountType,
	normalizeProvider,
} from "./shared";

/**
 * Enhanced comprehensive inbox sync from Unipile API
 * This function syncs complete LinkedIn inbox including:
 * - All chats/conversations
 * - All messages in each chat
 * - All chat attendees/participants
 * - Contact information
 *
 * Configuration:
 * Sync limits and behavior are controlled by the global sync configuration
 * in ~/config/sync.config.ts. This allows easy modification of limits
 * for both development and production environments.
 */
export const unipileHistoricalMessageSync = inngest.createFunction(
	{ id: "unipile-historical-message-sync" },
	{ event: "unipile/sync.historical_messages" },
	async ({ event, step, services }) => {
		const { data } = event;
		const {
			userService,
			unipileAccountService,
			unipileChatService,
			unipileMessageService,
			unipileContactService,
		} = services;

		const {
			user_id,
			account_id,
			provider,
			dsn,
			api_key,
			limit = getCurrentSyncConfig().chat.maxChats, // Use config for chat limit
		}: UnipileHistoricalSyncRequest = data;

		try {
			// allow for 10 seconds to be added to the sync for unipile
			await step.sleep("sleep-10-seconds", 10000);

			// Find the user and Unipile account
			const user = await step.run("find-user", async () => {
				return await userService.findByClerkId(user_id);
			});

			if (!user) {
				throw new Error(`User not found: ${user_id}`);
			}

			const unipileAccount = await step.run(
				"find-unipile-account",
				async () => {
					return await unipileAccountService.findUnipileAccount(
						user.id,
						account_id,
						provider,
					);
				},
			);

			if (!unipileAccount) {
				throw new Error(
					`Unipile account not found for user ${user_id}: ${account_id} (${provider})`,
				);
			}

			// Create Unipile service instance
			const unipileService = createUnipileService({
				apiKey: api_key,
				dsn,
			});

			// Step 0: Start sync tracking
			await step.run("start-sync-tracking", async () => {
				return await unipileAccountService.startSync(account_id, provider);
			});

			// Step 1: Test account connectivity first
			const connectivityTest = await step.run(
				"test-account-connectivity",
				async () => {
					return await unipileService.testAccountConnectivity(account_id);
				},
			);

			if (!connectivityTest.connected) {
				// Fail sync if connectivity test fails
				await step.run("fail-sync", async () => {
					return await unipileAccountService.failSync(
						account_id,
						provider,
						`Account connectivity test failed: ${connectivityTest.error}`,
					);
				});
				throw new Error(
					`Account connectivity test failed for ${account_id}: ${connectivityTest.error}`,
				);
			}

			console.log("✅ Account connectivity verified:", {
				account_id,
				provider,
				accountStatus: connectivityTest.accountInfo?.status,
			});

			// Log sync configuration
			const syncConfig = getCurrentSyncConfig();

			let totalChatsProcessed = 0;
			let totalMessagesProcessed = 0;
			let totalAttendeesProcessed = 0;
			let skippedCompanyChats = 0;
			const skippedCompanyMessages = 0;
			let cursor: string | undefined;
			const pageSize = syncConfig.chat.pageSize;

			// Step 1: Sync all chats/conversations
			console.log("🚀 Starting chat sync for account:", {
				account_id,
				provider,
				user_id,
				limit,
				environment: syncConfig.environment,
				isDev: syncConfig.environment === "development",
			});

			if (syncConfig.environment === "development") {
				console.log("🔧 DEV MODE: Will fetch maximum", limit, "chats and stop");
			}

			while (totalChatsProcessed < limit) {
				const batchSize = Math.min(pageSize, limit - totalChatsProcessed);
				const chatsResponse = await step.run(
					`fetch-chats-${Math.floor(totalChatsProcessed / pageSize)}`,
					async () => {
						console.log("📡 Fetching chats batch:", {
							account_id,
							limit: batchSize,
							cursor,
							provider,
							totalChatsProcessed,
							remainingChats: limit - totalChatsProcessed,
						});

						const response = await unipileService.listChats({
							account_id,
							limit: batchSize,
							cursor,
							provider: "LINKEDIN",
						});

						console.log("📨 Chat response received:", {
							object: response.object,
							itemsLength: response.items?.length || 0,
							cursor: response.cursor,
							accountId: account_id,
						});

						return response;
					},
				);

				if (!chatsResponse.items || chatsResponse.items.length === 0) {
					console.log("⚠️ No chats returned, breaking sync loop");
					break; // No more chats
				}

				// Step 2: Process each chat batch
				const { processedChats, processedMessages, processedAttendees } =
					await step.run(
						`process-chat-batch-${Math.floor(totalChatsProcessed / pageSize)}`,
						async () => {
							let batchChats = 0;
							let batchMessages = 0;
							let batchAttendees = 0;

							// Process only the chats we actually need (respect the limit)
							const chatsToProcess = chatsResponse.items.slice(
								0,
								limit - totalChatsProcessed,
							);
							console.log(
								`📊 Processing ${chatsToProcess.length} chats (${totalChatsProcessed}/${limit} total)`,
							);

							for (const chatData of chatsToProcess) {
								try {
									// Check if this is a company page message and should be filtered
									// Note: listChats API doesn't include attendees, so we filter based on available data
									const isCompanyChat =
										// Organization-specific fields
										!!chatData.organization_id ||
										// Company-specific content types
										["inmail", "sponsored", "linkedin_offer"].includes(
											chatData.content_type || "",
										) ||
										// Check last message sender URN pattern
										isOrganizationUrn(chatData.lastMessage?.sender_urn) ||
										isOrganizationUrn(chatData.lastMessage?.sender_id);

									if (isCompanyChat && !syncConfig.includeCompanyMessages) {
										if (syncConfig.enableDetailedLogging) {
											console.log("🚫 Skipping company chat:", {
												chatId: chatData.id,
												chatName: chatData.name,
												organizationId: chatData.organization_id,
												contentType: chatData.content_type,
												lastMessageSender:
													chatData.lastMessage?.sender_urn ||
													chatData.lastMessage?.sender_id,
												lastMessageSenderIsOrg: isOrganizationUrn(
													chatData.lastMessage?.sender_urn ||
														chatData.lastMessage?.sender_id,
												),
											});
										}
										skippedCompanyChats++;
										// Skip entire chat processing
										continue;
									}

									// Upsert the chat using the service
									const chat = await unipileChatService.upsertChat(
										unipileAccount.id,
										chatData.id,
										{
											name: chatData.name,
											chat_type: chatData.type === 0 ? "direct" : "group",
											last_message_at: chatData.lastMessage?.timestamp
												? new Date(chatData.lastMessage.timestamp)
												: chatData.timestamp
													? new Date(chatData.timestamp)
													: undefined,
										},
										{
											provider: normalizeProvider(chatData.account_type),
											account_type: normalizeAccountType(chatData.account_type),
											unread_count:
												chatData.unread_count || chatData.unread || 0,
											archived: chatData.archived || 0,
											read_only: chatData.read_only || 0,
											muted_until:
												chatData.muted_until === -1
													? -1n
													: chatData.muted_until
														? BigInt(chatData.muted_until)
														: undefined,
											organization_id: chatData.organization_id,
											mailbox_id: chatData.mailbox_id,
											mailbox_name: chatData.mailbox_name,
											content_type:
												chatData.content_type as (typeof unipileContentTypeEnum.enumValues)[number],
											disabled_features: chatData.disabledFeatures
												? chatData.disabledFeatures
												: undefined,
										},
									);

									batchChats++;

									// Break if we've reached our limit
									if (totalChatsProcessed + batchChats >= limit) {
										console.log(
											`🚫 Reached chat limit (${limit}), stopping processing`,
										);
										break;
									}

									// Step 3: Sync attendees for this chat
									try {
										const attendeesResponse =
											await unipileService.listChatAttendees({
												chat_id: chatData.id,
												account_id,
												limit: syncConfig.attendee.maxPerChat,
											});

										for (const attendeeData of attendeesResponse.items || []) {
											// Handle all attendees - create contact if not self, sync profile if self
											let contactId: string | null = null;
											const contact = await createContactFromAttendee(
												unipileContactService,
												unipileAccount.id,
												attendeeData,
												unipileService,
												account_id,
											);
											contactId = contact?.id || null;

											// Then create the attendee with a reference to the contact
											await unipileChatService.upsertAttendee(
												chat.id,
												attendeeData.provider_id, // Use provider_id as the external_id
												contactId, // Reference to the contact
												{
													is_self: attendeeData.is_self || 0,
													hidden: attendeeData.hidden || 0,
												},
											);

											batchAttendees++;
										}
									} catch (attendeeError) {
										console.warn(
											`Failed to fetch attendees for chat ${chatData.id}:`,
											attendeeError,
										);
									}

									// Step 4: Sync messages for this chat
									try {
										let messageCursor: string | undefined;
										let chatMessagesProcessed = 0;
										// Use config for message sync limits
										const messageLimit = syncConfig.message.maxPerChat;
										const messageBatchSize = syncConfig.message.batchSize;

										if (syncConfig.enableDetailedLogging) {
											console.log("📨 Message sync config:", {
												messageLimit,
												messageBatchSize,
												environment: syncConfig.environment,
											});
										}

										while (chatMessagesProcessed < messageLimit) {
											const messagesResponse =
												await unipileService.listChatMessages({
													chat_id: chatData.id,
													account_id,
													limit: messageBatchSize,
													cursor: messageCursor,
												});

											if (
												!messagesResponse.items ||
												messagesResponse.items.length === 0
											) {
												break;
											}

											for (const messageData of messagesResponse.items) {
												// Use is_sender field when available, fallback to sender ID matching
												const isOutgoing =
													messageData.is_sender === 1 ||
													messageData.sender_id === account_id ||
													messageData.sender_id === unipileAccount.account_id;

												// Upsert message using the service
												const message =
													await unipileMessageService.upsertMessage(
														unipileAccount.id,
														messageData.id,
														{
															chat_id: chat.id, // Link to internal chat record
															external_chat_id: chatData.id, // Store external API chat ID
															sender_id: messageData.sender_id || undefined,
															recipient_id: undefined, // Not available in new API structure
															message_type:
																messageData.message_type?.toLowerCase() ||
																"text",
															content: messageData.text || undefined,
															is_read: messageData.seen === 1,
															// Only update is_outgoing if we have reliable data (is_sender field)
															...(messageData.is_sender !== undefined && {
																is_outgoing: messageData.is_sender === 1,
															}),
															sent_at: messageData.timestamp
																? new Date(messageData.timestamp)
																: new Date(),
															sender_urn: messageData.sender_urn,
															attendee_type: messageData.attendee_type,
															attendee_distance: messageData.attendee_distance,
															seen: messageData.seen || 0,
															hidden: messageData.hidden || 0,
															deleted: messageData.deleted || 0,
															edited: messageData.edited || 0,
															is_event: messageData.is_event || 0,
															delivered: messageData.delivered || 0,
															behavior: messageData.behavior || 0,
															event_type: messageData.event_type || 0,
															replies: messageData.replies || 0,
															subject: messageData.subject,
															parent: messageData.parent,
															metadata:
																messageData.quoted || messageData.reactions
																	? {
																			quoted: messageData.quoted,
																			reactions: messageData.reactions,
																			subject: messageData.subject,
																			reply_to: messageData.reply_to,
																		}
																	: undefined,
														},
													);

												batchMessages++;

												// Sync message attachments if present
												if (messageData.attachments?.length) {
													console.log(
														"📎 Processing",
														messageData.attachments.length,
														"attachments for historical message",
														messageData.id,
													);

													for (const attachmentData of messageData.attachments) {
														console.log(
															"📎 Processing historical attachment:",
															{
																attachmentId: attachmentData.id,
																type: attachmentData.type,
																filename:
																	attachmentData.file_name ||
																	attachmentData.filename,
																hasUrl: !!attachmentData.url,
																fileSize: attachmentData.file_size,
																mimeType: attachmentData.mimetype,
																unavailable: attachmentData.unavailable,
															},
														);

														// Download attachment content if attachment ID is available
														let attachmentContent: string | null = null;
														let finalMimeType =
															attachmentData.mimetype ||
															attachmentData.mime_type;
														let r2Key: string | undefined;
														let r2Url: string | undefined;

														if (
															attachmentData.id &&
															!attachmentData.unavailable
														) {
															try {
																console.log(
																	"📎 Downloading historical attachment content:",
																	{
																		messageId: messageData.id,
																		attachmentId: attachmentData.id,
																	},
																);

																const downloadResult =
																	await unipileService.getMessageAttachment(
																		messageData.id,
																		attachmentData.id,
																		account_id,
																	);

																attachmentContent = downloadResult.content;
																// Use mime type from download if available, fallback to metadata
																finalMimeType =
																	downloadResult.mime_type || finalMimeType;

																console.log(
																	"✅ Historical attachment content downloaded:",
																	{
																		attachmentId: attachmentData.id,
																		contentSize: attachmentContent?.length || 0,
																		mimeType: finalMimeType,
																	},
																);

																// Upload to R2 if we have content
																if (attachmentContent && finalMimeType) {
																	try {
																		const r2Service = services.r2Service;

																		// Convert base64 to Uint8Array
																		const binaryData = Uint8Array.from(
																			atob(attachmentContent),
																			(c) => c.charCodeAt(0),
																		);

																		// Generate R2 key
																		r2Key = r2Service.generateAttachmentKey(
																			message.id,
																			attachmentData.file_name ||
																				attachmentData.filename,
																			finalMimeType,
																		);

																		// Upload to R2
																		r2Url = await r2Service.upload(
																			r2Key,
																			binaryData,
																			finalMimeType,
																			{
																				originalFilename:
																					attachmentData.file_name ||
																					attachmentData.filename ||
																					"attachment",
																				messageId: message.id,
																				attachmentId: attachmentData.id,
																			},
																		);

																		console.log(
																			"✅ Uploaded historical attachment to R2:",
																			{
																				attachmentId: attachmentData.id,
																				r2Key,
																				r2Url,
																			},
																		);
																	} catch (r2Error) {
																		console.warn(
																			"⚠️ Failed to upload historical attachment to R2:",
																			{
																				attachmentId: attachmentData.id,
																				error:
																					r2Error instanceof Error
																						? r2Error.message
																						: String(r2Error),
																			},
																		);
																		// Continue without R2 - we'll still save the original content
																	}
																}
															} catch (error) {
																console.warn(
																	"⚠️ Failed to download historical attachment content:",
																	{
																		attachmentId: attachmentData.id,
																		error:
																			error instanceof Error
																				? error.message
																				: String(error),
																	},
																);
																// Continue without content - we'll still save the metadata
															}
														}

														await unipileMessageService.upsertAttachment(
															message.id,
															attachmentData.id,
															{
																url: attachmentData.url,
																filename:
																	attachmentData.file_name ||
																	attachmentData.filename,
																file_size: attachmentData.file_size,
																mime_type: finalMimeType,
																content: r2Url ? undefined : attachmentContent, // Only store base64 if no R2 URL
																unavailable:
																	attachmentData.unavailable || false,
																url_expires_at: attachmentData.url_expires_at
																	? BigInt(attachmentData.url_expires_at)
																	: undefined,
																width: attachmentData.size?.width,
																height: attachmentData.size?.height,
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
																time_range: attachmentData.time_range,
																// R2 fields
																r2_key: r2Key,
																r2_url: r2Url,
																r2_uploaded_at: r2Url ? new Date() : undefined,
															},
															{
																attachment_type: attachmentData.type,
															},
														);

														console.log(
															"✅ Successfully processed historical attachment",
															attachmentData.id,
														);
													}
												}
											}

											chatMessagesProcessed += messagesResponse.items.length;
											messageCursor = messagesResponse.cursor;

											if (!messageCursor) {
												break;
											}
										}
									} catch (messageError) {
										console.warn(
											`Failed to fetch messages for chat ${chatData.id}:`,
											messageError,
										);
									}
								} catch (chatError) {
									console.warn(
										`Failed to process chat ${chatData.id}:`,
										chatError,
									);
								}
							}

							return {
								processedChats: batchChats,
								processedMessages: batchMessages,
								processedAttendees: batchAttendees,
							};
						},
					);

				totalChatsProcessed += processedChats;
				totalMessagesProcessed += processedMessages;
				totalAttendeesProcessed += processedAttendees;

				// Update sync progress
				await step.run(
					`update-sync-progress-${Math.floor(totalChatsProcessed / pageSize)}`,
					async () => {
						return await unipileAccountService.updateSyncProgress(
							account_id,
							provider,
							{
								chats_processed: totalChatsProcessed,
								messages_processed: totalMessagesProcessed,
								attendees_processed: totalAttendeesProcessed,
								skipped_company_chats: skippedCompanyChats,
								skipped_company_messages: skippedCompanyMessages,
								total_chats: limit,
								current_step: `Processing batch ${Math.floor(totalChatsProcessed / pageSize) + 1}`,
							},
						);
					},
				);

				console.log(
					`📊 Batch complete: ${totalChatsProcessed}/${limit} chats processed`,
				);

				// Break if we've reached our limit
				if (totalChatsProcessed >= limit) {
					console.log(
						`✅ Reached chat limit (${totalChatsProcessed}/${limit}), stopping sync`,
					);
					break;
				}

				// In dev mode, ALWAYS stop after the first page regardless of cursor availability
				if (syncConfig.environment === "development") {
					console.log("🔧 DEV MODE: Stopping after first page as configured");
					break;
				}

				// Break if no more pages
				if (!chatsResponse.cursor) {
					console.log("✅ No more pages available, stopping sync");
					break;
				}

				cursor = chatsResponse.cursor;
				console.log(`➡️ Continuing with cursor: ${cursor}`);
			}

			// Complete sync tracking
			await step.run("complete-sync", async () => {
				return await unipileAccountService.completeSync(account_id, provider, {
					total_chats_processed: totalChatsProcessed,
					total_messages_processed: totalMessagesProcessed,
					total_attendees_processed: totalAttendeesProcessed,
					skipped_company_chats: skippedCompanyChats,
					skipped_company_messages: skippedCompanyMessages,
				});
			});

			// Log final summary
			console.log("✅ Historical sync completed:", {
				account_id,
				provider,
				chatsProcessed: totalChatsProcessed,
				messagesProcessed: totalMessagesProcessed,
				attendeesProcessed: totalAttendeesProcessed,
				skippedCompanyChats,
				skippedCompanyMessages,
				totalTime: Date.now(),
			});

			return {
				user_id,
				account_id,
				provider,
				totalChatsProcessed,
				totalMessagesProcessed,
				totalAttendeesProcessed,
				skippedCompanyChats,
				skippedCompanyMessages,
				message: "Complete inbox sync completed successfully",
			};
		} catch (error) {
			// Fail sync on any error
			try {
				await step.run("fail-sync-on-error", async () => {
					return await unipileAccountService.failSync(
						account_id,
						provider,
						error instanceof Error ? error.message : String(error),
					);
				});
			} catch (failError) {
				console.error("Failed to update sync status on error:", failError);
			}

			// Re-throw the original error
			throw error;
		}
	},
);
