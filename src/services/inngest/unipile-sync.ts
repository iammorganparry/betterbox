import { inngest } from "../inngest";
import { createUnipileService } from "../unipile/unipile.service";
import type {
	Prisma,
	UnipileAccountStatus,
	UnipileContentType,
} from "../../../generated/prisma";
import type {
	UnipileApiResponse,
	UnipileApiChat,
	UnipileApiMessage,
	UnipileApiAccountStatus,
	UnipileHistoricalSyncRequest,
	UnipileApiParticipant,
	UnipileApiChatAttendee,
	UnipileApiUserProfile,
} from "~/types/unipile-api";
import type { AccountStatusEvent } from "~/types/realtime";
import { getUserChannelId } from "~/types/realtime";

// Import our new service classes
import { UnipileAccountService } from "../db/unipile-account.service";
import { UnipileChatService } from "../db/unipile-chat.service";
import { UnipileMessageService } from "../db/unipile-message.service";
import type { UnipileContactService } from "../db/unipile-contact.service";

/**
 * Helper function to safely fetch complete profile data for a contact
 * Handles errors gracefully and returns enriched data or fallback data
 */
async function fetchContactProfile(
	unipileService: ReturnType<typeof createUnipileService>,
	identifier: string,
	accountId: string,
	fallbackData?: {
		full_name?: string;
		headline?: string;
		profile_image_url?: string;
		provider_url?: string;
	},
): Promise<{
	full_name?: string;
	first_name?: string;
	last_name?: string;
	headline?: string;
	profile_image_url?: string;
	provider_url?: string;
	username?: string;
	fetched_from_profile: boolean;
	raw_profile?: UnipileApiUserProfile;
}> {
	try {
		console.log("🔍 Fetching complete profile for:", { identifier, accountId });

		const profileData = await unipileService.getProfile(identifier, accountId);

		console.log("✅ Profile data fetched successfully:", {
			identifier,
			hasFirstName: !!profileData.first_name,
			hasLastName: !!profileData.last_name,
			hasHeadline: !!profileData.headline,
			hasImage: !!profileData.profile_picture_url,
			hasPublicUrl: !!profileData.public_profile_url,
			hasSummary: !!profileData.summary,
			hasLocation: !!profileData.location,
			networkDistance: profileData.network_distance,
		});

		// Construct full name from first and last name
		const fullName =
			[profileData.first_name, profileData.last_name]
				.filter(Boolean)
				.join(" ") || fallbackData?.full_name;

		return {
			full_name: fullName,
			first_name: profileData.first_name,
			last_name: profileData.last_name,
			headline: profileData.headline || fallbackData?.headline,
			profile_image_url:
				profileData.profile_picture_url_large || // Prefer large version
				profileData.profile_picture_url ||
				fallbackData?.profile_image_url,
			provider_url:
				profileData.public_profile_url || fallbackData?.provider_url,
			username: profileData.public_identifier || profileData.provider_id,
			fetched_from_profile: true,
			raw_profile: profileData,
		};
	} catch (error) {
		console.warn("⚠️ Failed to fetch profile data, using fallback:", {
			identifier,
			error: error instanceof Error ? error.message : String(error),
		});

		return {
			...fallbackData,
			fetched_from_profile: false,
			raw_profile: undefined,
		};
	}
}

/**
 * Helper function to create enriched contact data from chat attendee with profile lookup
 */
async function createEnrichedContactFromAttendee(
	unipileService: ReturnType<typeof createUnipileService>,
	unipileAccountService: UnipileContactService,
	unipileAccountId: string,
	accountId: string,
	attendeeData: UnipileApiChatAttendee,
) {
	// Skip if this is the account owner
	if (attendeeData.is_self === 1) {
		return null;
	}

	// Fetch complete profile data
	const profileData = await fetchContactProfile(
		unipileService,
		attendeeData.provider_id,
		accountId,
		{
			full_name: attendeeData.name,
			headline: attendeeData.specifics?.headline,
			profile_image_url: attendeeData.picture_url,
			provider_url: attendeeData.profile_url,
		},
	);

	// Create contact with enriched data from profile fetch
	const enrichedContactInfo = {
		...(attendeeData.specifics?.contact_info || {}),
		// Add rich profile data if available
		...(profileData.raw_profile?.contact_info && {
			emails: profileData.raw_profile.contact_info.emails,
			phones: profileData.raw_profile.contact_info.phones,
			addresses: profileData.raw_profile.contact_info.adresses, // API has typo
			websites: profileData.raw_profile.websites,
			socials: profileData.raw_profile.contact_info.socials,
		}),
		...(profileData.raw_profile?.summary && {
			summary: profileData.raw_profile.summary,
		}),
	};

	// Map network distance from profile data or fallback to attendee data
	let networkDistance = attendeeData.specifics?.network_distance;
	if (profileData.raw_profile?.network_distance) {
		// Map the API network distance to our enum values
		switch (profileData.raw_profile.network_distance) {
			case "FIRST_DEGREE":
				networkDistance = "FIRST";
				break;
			case "SECOND_DEGREE":
				networkDistance = "SECOND";
				break;
			case "THIRD_DEGREE":
				networkDistance = "THIRD";
				break;
			case "OUT_OF_NETWORK":
				networkDistance = "OUT_OF_NETWORK";
				break;
		}
	}

	// Get current job position from work experience
	const currentJob = profileData.raw_profile?.work_experience?.find(
		(job) => job.current,
	);

	return await unipileAccountService.upsertContact(
		unipileAccountId,
		attendeeData.provider_id,
		{
			full_name: profileData.full_name,
			first_name: profileData.first_name,
			last_name: profileData.last_name,
			headline: profileData.headline,
			profile_image_url: profileData.profile_image_url,
			provider_url: profileData.provider_url,
			member_urn: profileData.username || attendeeData.specifics?.member_urn,
			is_connection: networkDistance !== "OUT_OF_NETWORK",
			network_distance: networkDistance,
			occupation: currentJob?.position || attendeeData.specifics?.occupation,
			location:
				profileData.raw_profile?.location || attendeeData.specifics?.location,
			pending_invitation: attendeeData.specifics?.pending_invitation || false,
			contact_info:
				Object.keys(enrichedContactInfo).length > 0
					? enrichedContactInfo
					: undefined,
			last_interaction: new Date(),
		},
	);
}

/**
 * Helper function to create enriched contact data from message sender with profile lookup
 */
async function createEnrichedContactFromSender(
	unipileService: ReturnType<typeof createUnipileService>,
	unipileContactService: UnipileContactService,
	unipileAccountId: string,
	accountId: string,
	senderId: string,
	senderUrn?: string,
) {
	// Fetch complete profile data using sender ID
	const profileData = await fetchContactProfile(
		unipileService,
		senderId,
		accountId,
		{
			full_name: senderUrn, // Use sender URN as fallback name
		},
	);

	// Create contact with enriched data
	const enrichedContactInfo = {
		// Add rich profile data if available
		...(profileData.raw_profile?.contact_info && {
			emails: profileData.raw_profile.contact_info.emails,
			phones: profileData.raw_profile.contact_info.phones,
			addresses: profileData.raw_profile.contact_info.adresses, // API has typo
			websites: profileData.raw_profile.websites,
			socials: profileData.raw_profile.contact_info.socials,
		}),
		...(profileData.raw_profile?.summary && {
			summary: profileData.raw_profile.summary,
		}),
	};

	// Map network distance from profile data
	let networkDistance:
		| "SELF"
		| "FIRST"
		| "SECOND"
		| "THIRD"
		| "OUT_OF_NETWORK"
		| "DISTANCE_1"
		| "DISTANCE_2"
		| "DISTANCE_3"
		| undefined = undefined;
	if (profileData.raw_profile?.network_distance) {
		switch (profileData.raw_profile.network_distance) {
			case "FIRST_DEGREE":
				networkDistance = "FIRST";
				break;
			case "SECOND_DEGREE":
				networkDistance = "SECOND";
				break;
			case "THIRD_DEGREE":
				networkDistance = "THIRD";
				break;
			case "OUT_OF_NETWORK":
				networkDistance = "OUT_OF_NETWORK";
				break;
		}
	}

	// Get current job position from work experience
	const currentJob = profileData.raw_profile?.work_experience?.find(
		(job) => job.current,
	);

	return await unipileContactService.upsertContact(unipileAccountId, senderId, {
		full_name: profileData.full_name,
		first_name: profileData.first_name,
		last_name: profileData.last_name,
		headline: profileData.headline,
		profile_image_url: profileData.profile_image_url,
		provider_url: profileData.provider_url,
		member_urn: profileData.username,
		is_connection: networkDistance !== "OUT_OF_NETWORK",
		network_distance: networkDistance,
		occupation: currentJob?.position,
		location: profileData.raw_profile?.location,
		contact_info:
			Object.keys(enrichedContactInfo).length > 0
				? enrichedContactInfo
				: undefined,
		last_interaction: new Date(),
	});
}

/**
 * Handle Unipile account status updates (real-time)
 */
export const unipileAccountStatusUpdate = inngest.createFunction(
	{ id: "unipile-account-status-update" },
	{ event: "unipile/account.status" },
	async ({ event, step, services }) => {
		const { data } = event;

		const { userService, unipileAccountService } = services;

		// Extract account data from Unipile webhook
		const {
			account_id,
			status,
			provider,
			provider_data,
			user_identifier,
		}: UnipileApiAccountStatus & { user_identifier: string } = data;

		// Find the user by their identifier (could be email or clerk_id)
		const user = await step.run("find-user", async () => {
			return await userService.findByClerkId(user_identifier);
		});

		if (!user) {
			throw new Error(`User not found for identifier: ${user_identifier}`);
		}

		// Upsert the Unipile account
		const account = await step.run("upsert-unipile-account", async () => {
			return await unipileAccountService.upsertUnipileAccount(
				user.id,
				account_id,
				provider,
				{ status: status as UnipileAccountStatus },
			);
		});

		// Publish realtime update to user's channel
		await step.run("publish-account-status", async () => {
			const accountStatusEvent: AccountStatusEvent = {
				account_id,
				provider,
				status,
				error_message:
					status === "error" ? "Account connection error" : undefined,
			};

			return step.sendEvent("realtime-account-status", {
				name: "realtime/publish",
				data: {
					channel: getUserChannelId(user.id),
					topic: "account:status",
					payload: accountStatusEvent,
				},
			});
		});

		return { account, message: "Account status updated successfully" };
	},
);

/**
 * Handle new messages from Unipile (real-time)
 */
export const unipileNewMessage = inngest.createFunction(
	{ id: "unipile-new-message" },
	{ event: "unipile/message.new" },
	async ({ event, step, services }) => {
		const { data } = event;
		const {
			unipileAccountService: accountService,
			unipileMessageService: messageService,
			unipileContactService: contactService,
			unipileChatService: chatService,
		} = services;

		const {
			account_id,
			provider,
			message,
			chat_id,
			sender,
			recipient,
			timestamp,
		} = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await accountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Determine if this is an outgoing message (sent by our user)
		const isOutgoing = sender?.id === account_id;

		// Upsert the message
		const savedMessage = await step.run("upsert-message", async () => {
			return await messageService.upsertMessage(
				unipileAccount.id,
				message.id,
				{
					content: message.text || message.content,
					is_read: message.is_read || false,
				},
				{
					external_chat_id: chat_id,
					sender_id: sender?.id,
					recipient_id: recipient?.id,
					message_type: message.type || "text",
					content: message.text || message.content,
					is_read: message.is_read || false,
					is_outgoing: isOutgoing,
					sent_at: timestamp ? new Date(timestamp) : new Date(),
				},
			);
		});

		// If this is a new contact, create enriched contact using profile data
		if (!isOutgoing && sender?.id) {
			await step.run("upsert-enriched-contact", async () => {
				// Create Unipile service instance for profile fetching if env vars are available
				if (!process.env.UNIPILE_API_KEY || !process.env.UNIPILE_DSN) {
					// Fallback to basic contact creation if Unipile config is missing
					return await contactService.upsertContact(
						unipileAccount.id,
						sender.id,
						{
							full_name: sender.display_name || sender.name,
							first_name: sender.first_name,
							last_name: sender.last_name,
							headline: sender.headline,
							profile_image_url:
								sender.profile_picture_url || sender.avatar_url,
							provider_url: sender.profile_url,
							last_interaction: new Date(),
						},
					);
				}

				const unipileService = createUnipileService({
					apiKey: process.env.UNIPILE_API_KEY,
					dsn: process.env.UNIPILE_DSN,
				});

				return await createEnrichedContactFromSender(
					unipileService,
					contactService,
					unipileAccount.id,
					account_id,
					sender.id,
					sender.display_name || sender.name,
				);
			});
		}

		return { message: savedMessage, account: unipileAccount };
	},
);

/**
 * Handle LinkedIn profile views from Unipile (real-time)
 */
export const unipileProfileView = inngest.createFunction(
	{ id: "unipile-profile-view" },
	{ event: "unipile/profile.view" },
	async ({ event, step, services }) => {
		const { data } = event;

		const { account_id, provider = "linkedin", viewer, viewed_at } = data;
		const {
			unipileAccountService: accountService,
			unipileContactService: contactService,
		} = services;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await accountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Create the profile view record (keeping raw Prisma for this specific model)
		const profileView = await step.run("create-profile-view", async () => {
			const { db } = await import("~/server/db");
			return await db.unipileProfileView.create({
				data: {
					user_id: unipileAccount.user_id,
					viewer_profile_id: viewer?.id,
					viewer_name: viewer?.display_name || viewer?.name,
					viewer_headline: viewer?.headline,
					viewer_image_url: viewer?.profile_picture_url || viewer?.avatar_url,
					viewed_at: viewed_at ? new Date(viewed_at) : new Date(),
					provider,
				},
			});
		});

		// Also upsert the viewer as a contact using enriched profile data
		if (viewer?.id) {
			await step.run("upsert-viewer-contact", async () => {
				// Create Unipile service instance for profile fetching if env vars are available
				if (!process.env.UNIPILE_API_KEY || !process.env.UNIPILE_DSN) {
					// Fallback to basic contact creation if Unipile config is missing
					return await contactService.upsertContact(
						unipileAccount.id,
						viewer.id,
						{
							full_name: viewer.display_name || viewer.name,
							first_name: viewer.first_name,
							last_name: viewer.last_name,
							headline: viewer.headline,
							profile_image_url:
								viewer.profile_picture_url || viewer.avatar_url,
							provider_url: viewer.profile_url,
							last_interaction: new Date(),
						},
					);
				}

				const unipileService = createUnipileService({
					apiKey: process.env.UNIPILE_API_KEY,
					dsn: process.env.UNIPILE_DSN,
				});

				return await createEnrichedContactFromSender(
					unipileService,
					contactService,
					unipileAccount.id,
					account_id,
					viewer.id,
					viewer.display_name || viewer.name,
				);
			});
		}

		return { profileView, message: "Profile view recorded successfully" };
	},
);

/**
 * Enhanced comprehensive inbox sync from Unipile API
 * This function syncs complete LinkedIn inbox including:
 * - All chats/conversations
 * - All messages in each chat
 * - All chat attendees/participants
 * - Contact information
 *
 * Development Mode Optimization:
 * When NODE_ENV === "development", limits are reduced for faster testing:
 * - Chat limit: 3 (instead of 1000)
 * - Messages per chat: 5 (instead of 100)
 * - Message batch size: 5 (instead of 50)
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
			limit = process.env.NODE_ENV === "development" ? 3 : 1000, // Only sync 3 chats in dev mode
		}: UnipileHistoricalSyncRequest = data;

		// Find the user and Unipile account
		const user = await step.run("find-user", async () => {
			return await userService.findByClerkId(user_id);
		});

		if (!user) {
			throw new Error(`User not found: ${user_id}`);
		}

		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await unipileAccountService.findUnipileAccount(
				user.id,
				account_id,
				provider,
			);
		});

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

		// Step 0: Test account connectivity first
		const connectivityTest = await step.run(
			"test-account-connectivity",
			async () => {
				return await unipileService.testAccountConnectivity(account_id);
			},
		);

		if (!connectivityTest.connected) {
			throw new Error(
				`Account connectivity test failed for ${account_id}: ${connectivityTest.error}`,
			);
		}

		console.log("✅ Account connectivity verified:", {
			account_id,
			provider,
			accountStatus: connectivityTest.accountInfo?.status,
		});

		// Development mode optimization for faster testing
		const isDevelopmentMode = process.env.NODE_ENV === "development";
		if (isDevelopmentMode) {
			console.log("🔧 Development mode detected - using reduced sync limits:", {
				chatLimit: limit,
				messageLimit: 5,
				messageBatchSize: 5,
			});
		}

		let totalChatsProcessed = 0;
		let totalMessagesProcessed = 0;
		let totalAttendeesProcessed = 0;
		let cursor: string | undefined;
		const pageSize = 50; // Smaller page size for comprehensive sync

		// Step 1: Sync all chats/conversations
		console.log("🚀 Starting chat sync for account:", {
			account_id,
			provider,
			user_id,
			limit,
			isDevelopmentMode,
		});

		while (totalChatsProcessed < limit) {
			const chatsResponse = await step.run(
				`fetch-chats-${Math.floor(totalChatsProcessed / pageSize)}`,
				async () => {
					console.log("📡 Fetching chats batch:", {
						account_id,
						limit: Math.min(pageSize, limit - totalChatsProcessed),
						cursor,
						provider,
						totalChatsProcessed,
					});

					const response = await unipileService.listChats({
						account_id,
						limit: Math.min(pageSize, limit - totalChatsProcessed),
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

						for (const chatData of chatsResponse.items) {
							try {
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
										provider: chatData.account_type.toLowerCase(),
										account_type: chatData.account_type,
										unread_count: chatData.unread_count || chatData.unread || 0,
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
										content_type: chatData.content_type as UnipileContentType,
										disabled_features: chatData.disabledFeatures
											? chatData.disabledFeatures
											: undefined,
									},
								);

								batchChats++;

								// Step 3: Sync attendees for this chat
								try {
									const attendeesResponse =
										await unipileService.listChatAttendees({
											chat_id: chatData.id,
											account_id,
											limit: 100, // Get all attendees
										});

									for (const attendeeData of attendeesResponse.items || []) {
										await unipileChatService.upsertAttendee(
											chat.id,
											attendeeData.provider_id, // Use provider_id as the external_id
											{
												name: attendeeData.name,
												display_name: attendeeData.name, // Use name as display_name
												first_name: undefined, // Not available in new API structure
												last_name: undefined, // Not available in new API structure
												username: attendeeData.specifics?.member_urn, // Use member_urn as username
												profile_image_url: attendeeData.picture_url,
												profile_url: attendeeData.profile_url,
												headline: attendeeData.specifics?.headline,
												is_contact:
													attendeeData.specifics?.network_distance !==
													"OUT_OF_NETWORK",
												is_self: attendeeData.is_self || 0,
												hidden: attendeeData.hidden || 0,
												member_urn: attendeeData.specifics?.member_urn,
												network_distance:
													attendeeData.specifics?.network_distance,
												occupation: attendeeData.specifics?.occupation,
												location: attendeeData.specifics?.location,
												pending_invitation:
													attendeeData.specifics?.pending_invitation || false,
												contact_info: attendeeData.specifics?.contact_info
													? attendeeData.specifics.contact_info
													: undefined,
											},
										);

										batchAttendees++;

										// Create enriched contact using profile data
										await createEnrichedContactFromAttendee(
											unipileService,
											unipileContactService,
											unipileAccount.id,
											account_id,
											attendeeData,
										);
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
									// Use smaller limits in development for faster testing
									const messageLimit =
										process.env.NODE_ENV === "development" ? 5 : 100; // Limit per chat
									const messageBatchSize =
										process.env.NODE_ENV === "development" ? 5 : 50;

									console.log("📨 Message sync config:", {
										messageLimit,
										messageBatchSize,
										isDevelopment: process.env.NODE_ENV === "development",
									});

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
											const isOutgoing = messageData.is_sender === 1;

											// Upsert message using the service
											const message = await unipileMessageService.upsertMessage(
												unipileAccount.id,
												messageData.id,
												{
													content: messageData.text || undefined,
													is_read: messageData.seen === 1,
													metadata:
														messageData.quoted || messageData.reactions
															? ({
																	quoted: messageData.quoted,
																	reactions: messageData.reactions,
																	subject: messageData.subject,
																	reply_to: messageData.reply_to,
																} as Prisma.InputJsonValue)
															: undefined,
												},
												{
													external_chat_id: chat.id,
													sender_id: messageData.sender_id || undefined,
													recipient_id: undefined, // Not available in new API structure
													message_type:
														messageData.message_type?.toLowerCase() || "text",
													content: messageData.text || undefined,
													is_read: messageData.seen === 1,
													is_outgoing: isOutgoing,
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
															? ({
																	quoted: messageData.quoted,
																	reactions: messageData.reactions,
																	subject: messageData.subject,
																	reply_to: messageData.reply_to,
																} as Prisma.InputJsonValue)
															: undefined,
												},
											);

											batchMessages++;

											// Sync message attachments if present
											if (messageData.attachments?.length) {
												for (const attachmentData of messageData.attachments) {
													await unipileMessageService.upsertAttachment(
														message.id,
														attachmentData.id,
														{
															url: attachmentData.url,
															filename:
																attachmentData.file_name ||
																attachmentData.filename,
															file_size: attachmentData.file_size,
															mime_type:
																attachmentData.mimetype ||
																attachmentData.mime_type,
															unavailable: attachmentData.unavailable || false,
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
														},
														{
															attachment_type: attachmentData.type,
														},
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

			cursor = chatsResponse.cursor;

			// Break if no more pages
			if (!cursor) {
				break;
			}
		}

		// Update sync status using the service
		await step.run("update-sync-status", async () => {
			return await unipileAccountService.updateAccountStatus(
				account_id,
				provider,
				"connected",
			);
		});

		return {
			user_id,
			account_id,
			provider,
			totalChatsProcessed,
			totalMessagesProcessed,
			totalAttendeesProcessed,
			message: "Complete inbox sync completed successfully",
		};
	},
);

/**
 * Handle Unipile account connection/update events (from hosted auth)
 */
export const unipileAccountConnected = inngest.createFunction(
	{ id: "unipile-account-connected" },
	{ event: "unipile/account.connected" },
	async ({ event, step, services }) => {
		const { data } = event;
		const { userService, unipileAccountService } = services;
		// Extract account data from webhook
		const { account_id, provider, status, user_identifier } = data;

		// Find the user by their identifier (should be the Clerk user ID we sent)
		const user = await step.run("find-user", async () => {
			return await userService.findByClerkId(user_identifier);
		});

		if (!user) {
			throw new Error(`User not found for identifier: ${user_identifier}`);
		}

		// Upsert the Unipile account using the service
		const account = await step.run("upsert-unipile-account", async () => {
			return await unipileAccountService.upsertUnipileAccount(
				user.id,
				account_id,
				provider,
				{ status: status || "connected" },
			);
		});

		// Trigger historical sync if this is a new connection
		if (status === "connected") {
			await step.sendEvent("trigger-historical-sync", {
				name: "unipile/sync.historical_messages",
				data: {
					user_id: user.id,
					account_id,
					provider,
					dsn: process.env.UNIPILE_DSN,
					api_key: process.env.UNIPILE_API_KEY,
					limit: process.env.NODE_ENV === "development" ? 3 : 1000, // Only sync 3 chats in dev mode
				},
			});
		}

		return { account, message: "Account connected successfully" };
	},
);

/**
 * Handle Unipile account disconnection events
 */
export const unipileAccountDisconnected = inngest.createFunction(
	{ id: "unipile-account-disconnected" },
	{ event: "unipile/account.disconnected" },
	async ({ event, step, services }) => {
		const { data } = event;
		const { userService, unipileAccountService } = services;
		// Extract account data from webhook
		const { account_id, provider, user_identifier } = data;

		// Find the user by their identifier (should be the Clerk user ID we sent)
		const user = await step.run("find-user", async () => {
			return await userService.findByClerkId(user_identifier);
		});

		if (!user) {
			throw new Error(`User not found for identifier: ${user_identifier}`);
		}

		// Mark account as deleted using the service
		const result = await step.run("disconnect-account", async () => {
			return await unipileAccountService.markAccountAsDeleted(
				user.id,
				account_id,
				provider,
			);
		});

		return {
			result,
			message: "Account disconnected successfully",
			user_id: user.id,
			account_id,
			provider,
		};
	},
);

/**
 * Bulk sync messages from Unipile (for webhook bulk sync events)
 * This function handles large message imports efficiently from webhooks
 */
export const unipileBulkMessageSync = inngest.createFunction(
	{
		id: "unipile-bulk-message-sync",
		// No batching for bulk sync as it's already processing in bulk
	},
	{ event: "unipile/messages.bulk_sync" },
	async ({ event, step, services }) => {
		const { data } = event;
		const {
			unipileAccountService: accountService,
			unipileMessageService: messageService,
			unipileContactService: contactService,
		} = services;
		const { account_id, provider, messages } = data;

		// Find the Unipile account using the service
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await accountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		let processedCount = 0;
		const batchSize = 100; // Increased batch size for bulk operations

		// Process messages in batches
		for (let i = 0; i < messages.length; i += batchSize) {
			const batch = messages.slice(i, i + batchSize);

			await step.run(
				`process-message-batch-${Math.floor(i / batchSize)}`,
				async () => {
					// Process messages and contacts in parallel batches
					const messagePromises = batch.map(
						async (messageData: UnipileApiMessage) => {
							const isOutgoing = messageData.is_sender === 1;

							// Upsert message using the service
							const message = await messageService.upsertMessage(
								unipileAccount.id,
								messageData.id,
								{
									content: messageData.text || undefined,
									is_read: messageData.seen === 1,
								},
								{
									external_chat_id: messageData.chat_id,
									sender_id: messageData.sender_id,
									recipient_id: undefined, // Not available in new API structure
									message_type:
										messageData.message_type?.toLowerCase() || "text",
									content: messageData.text || undefined,
									is_read: messageData.seen === 1,
									is_outgoing: isOutgoing,
									sent_at: messageData.timestamp
										? new Date(messageData.timestamp)
										: new Date(),
								},
							);

							// Create enriched contact if this is from someone else
							if (!isOutgoing && messageData.sender_id) {
								// Create Unipile service instance if env vars are available
								if (process.env.UNIPILE_API_KEY && process.env.UNIPILE_DSN) {
									const unipileService = createUnipileService({
										apiKey: process.env.UNIPILE_API_KEY,
										dsn: process.env.UNIPILE_DSN,
									});

									await createEnrichedContactFromSender(
										unipileService,
										contactService,
										unipileAccount.id,
										account_id,
										messageData.sender_id,
										messageData.sender_urn,
									);
								} else {
									// Fallback to basic contact creation
									await contactService.upsertContact(
										unipileAccount.id,
										messageData.sender_id,
										{
											full_name: messageData.sender_urn || undefined,
											last_interaction: new Date(),
										},
									);
								}
							}

							return message;
						},
					);

					await Promise.all(messagePromises);
					processedCount += batch.length;

					return processedCount;
				},
			);
		}

		return {
			processedCount,
			totalMessages: messages.length,
			message: "Bulk message sync completed successfully",
		};
	},
);
