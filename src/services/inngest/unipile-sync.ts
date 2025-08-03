import { inngest } from "../inngest";
import { createUnipileService } from "../unipile/unipile.service";

import { getCurrentSyncConfig, logSyncConfig } from "~/config/sync.config";
import type { AccountStatusEvent } from "~/types/realtime";
import { getUserChannelId } from "~/types/realtime";
import type {
	UnipileApiAccountStatus,
	UnipileApiChatAttendee,
	UnipileApiMessage,
	UnipileApiUserProfile,
	UnipileHistoricalSyncRequest,
} from "~/types/unipile-api";

import { unipileProfileViews } from "~/db/schema";
import type {
	unipileAccountTypeEnum,
	unipileProviderEnum,
} from "~/db/schema/enums";
import { env } from "~/env";
import type { UnipileContactService } from "../db/unipile-contact.service";

// Helper functions for type mapping using database enums
const VALID_PROVIDERS = [
	"linkedin",
	"whatsapp",
	"telegram",
	"instagram",
	"facebook",
] as const;
const VALID_ACCOUNT_TYPES = [
	"LINKEDIN",
	"WHATSAPP",
	"TELEGRAM",
	"INSTAGRAM",
	"FACEBOOK",
] as const;

type ValidProvider = (typeof VALID_PROVIDERS)[number];
type ValidAccountType = (typeof VALID_ACCOUNT_TYPES)[number];

const normalizeProvider = (provider: string): ValidProvider => {
	const normalized = provider.toLowerCase();
	if (VALID_PROVIDERS.includes(normalized as ValidProvider)) {
		return normalized as ValidProvider;
	}
	return "linkedin"; // default fallback
};

const normalizeAccountType = (provider: string): ValidAccountType => {
	const normalized = provider.toUpperCase();
	if (VALID_ACCOUNT_TYPES.includes(normalized as ValidAccountType)) {
		return normalized as ValidAccountType;
	}
	return "LINKEDIN"; // default fallback
};

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
 * Helper function to create contact data directly from chat attendee API data
 * This uses the rich attendee data without needing additional profile API calls
 */
async function createContactFromAttendee(
	unipileContactService: UnipileContactService,
	unipileAccountId: string,
	attendeeData: UnipileApiChatAttendee,
) {
	console.log("📝 Creating contact from attendee (detailed):", {
		provider_id: attendeeData.provider_id,
		name: attendeeData.name,
		picture_url: attendeeData.picture_url,
		profile_url: attendeeData.profile_url,
		is_self: attendeeData.is_self,
		hidden: attendeeData.hidden,
		specifics: {
			member_urn: attendeeData.specifics?.member_urn,
			headline: attendeeData.specifics?.headline,
			occupation: attendeeData.specifics?.occupation,
			location: attendeeData.specifics?.location,
			network_distance: attendeeData.specifics?.network_distance,
			pending_invitation: attendeeData.specifics?.pending_invitation,
			hasContactInfo: !!attendeeData.specifics?.contact_info,
		},
	});

	// Skip if this is the account owner
	if (attendeeData.is_self === 1) {
		console.log("⚠️ Skipping contact creation - is_self === 1");
		return null;
	}

	// Parse full name into first and last name
	const fullName = attendeeData.name || "";
	const nameParts = fullName.trim().split(" ");
	const firstName = nameParts.length > 0 ? nameParts[0] : undefined;
	const lastName =
		nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

	// Map network distance from attendee data to our enum values
	const networkDistance:
		| "SELF"
		| "FIRST"
		| "SECOND"
		| "THIRD"
		| "OUT_OF_NETWORK"
		| "DISTANCE_1"
		| "DISTANCE_2"
		| "DISTANCE_3"
		| undefined = attendeeData.specifics?.network_distance;

	// We can use the API values directly since our enum supports both formats
	// DISTANCE_1, DISTANCE_2, DISTANCE_3 are valid enum values

	// Create contact with rich attendee data
	const contactData = {
		full_name: fullName || undefined,
		first_name: firstName,
		last_name: lastName,
		headline: attendeeData.specifics?.headline,
		profile_image_url: attendeeData.picture_url,
		provider_url: attendeeData.profile_url,
		member_urn: attendeeData.specifics?.member_urn,
		is_connection: networkDistance !== "OUT_OF_NETWORK",
		network_distance: networkDistance,
		occupation: attendeeData.specifics?.occupation,
		location: attendeeData.specifics?.location,
		pending_invitation: attendeeData.specifics?.pending_invitation || false,
		contact_info: attendeeData.specifics?.contact_info
			? attendeeData.specifics.contact_info
			: undefined,
		last_interaction: new Date(),
	};

	console.log("📝 Contact data to be saved:", {
		provider_id: attendeeData.provider_id,
		contactData: {
			full_name: contactData.full_name,
			first_name: contactData.first_name,
			last_name: contactData.last_name,
			headline: contactData.headline,
			profile_image_url: contactData.profile_image_url,
			provider_url: contactData.provider_url,
			member_urn: contactData.member_urn,
			occupation: contactData.occupation,
			location: contactData.location,
			network_distance: contactData.network_distance,
		},
	});

	return await unipileContactService.upsertContact(
		unipileAccountId,
		attendeeData.provider_id,
		contactData,
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
				{ status: status as "error" | "connected" | "disconnected" },
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
export const unipileMessageReceived = inngest.createFunction(
	{
		id: "unipile-message-received",
		concurrency: {
			limit: 1,
			key: "event.data.chat_id",
		},
	},
	{ event: "unipile/message_received" },
	async ({ event, step, services }) => {
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

		// Determine if this is an outgoing message (sent by our user)
		// Check if sender is the account owner by comparing with account user_id
		const isOutgoing = sender?.attendee_provider_id === account_info?.user_id;

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
				// Skip if this is the account owner
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
			return await messageService.upsertMessage(unipileAccount.id, message_id, {
				chat_id: internalChat.id, // Link to internal chat record
				external_chat_id: chat_id, // Store external API chat ID
				sender_id: sender?.attendee_provider_id,
				recipient_id: undefined, // Not provided in this event structure
				message_type: message_type?.toLowerCase() || "text",
				content: messageContent,
				is_read: false, // New messages are unread by default
				is_outgoing: isOutgoing,
				sent_at: timestamp ? new Date(timestamp) : new Date(),
				is_event: is_event || 0,
				subject: subject,
				metadata: quoted
					? { quoted, provider_message_id }
					: { provider_message_id },
			});
		});

		// Step 4: Handle attachments if present
		if (attachments && attachments.length > 0) {
			await step.run("upsert-attachments", async () => {
				for (const attachment of attachments) {
					const attachmentIndex = attachments.indexOf(attachment);
					await messageService.upsertAttachment(
						savedMessage.id,
						attachment.id || `${savedMessage.id}_${attachmentIndex}`,
						{
							url: attachment.url,
							filename: attachment.filename || attachment.name,
							file_size: attachment.file_size || attachment.size,
							mime_type: attachment.mime_type || attachment.type,
							unavailable: attachment.unavailable || false,
						},
						{
							attachment_type:
								(attachment.type as
									| "file"
									| "img"
									| "video"
									| "audio"
									| "linkedin_post"
									| "video_meeting") || "file",
						},
					);
				}
			});
		}

		return {
			message: savedMessage,
			chat: internalChat,
			account: unipileAccount,
			contactsCreated: attendees?.length || 0,
		};
	},
);

/**
 * Handle message read events from Unipile (real-time)
 */
export const unipileMessageRead = inngest.createFunction(
	{
		id: "unipile-message-read",
		concurrency: {
			limit: 1,
			key: "event.data.message_id",
		},
	},
	{ event: "unipile/message_read" },
	async ({ event, step, services }) => {
		const { data } = event;
		const { unipileAccountService, unipileMessageService } = services;

		const { account_id, provider, message_id, read_by } = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await unipileAccountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Update message read status
		await step.run("update-message-read-status", async () => {
			return await unipileMessageService.upsertMessage(
				unipileAccount.id,
				message_id,
				{ is_read: true },
			);
		});

		return { message: "Message marked as read successfully" };
	},
);

/**
 * Handle message reactions from Unipile (real-time)
 */
export const unipileMessageReaction = inngest.createFunction(
	{
		id: "unipile-message-reaction",
		concurrency: {
			limit: 1,
			key: "event.data.message_id",
		},
	},
	{ event: "unipile/message_reaction" },
	async ({ event, step, services }) => {
		const { data } = event;
		const { unipileAccountService, unipileMessageService } = services;

		const { account_id, provider, message_id, reaction, reactor_id } = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await unipileAccountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Handle message reaction (you may need to implement this method)
		await step.run("handle-message-reaction", async () => {
			// This would need to be implemented in your message service
			console.log("Message reaction received:", {
				message_id,
				reaction,
				reactor_id,
			});
			// TODO: Implement reaction handling in message service
		});

		return { message: "Message reaction handled successfully" };
	},
);

/**
 * Handle message edits from Unipile (real-time)
 */
export const unipileMessageEdited = inngest.createFunction(
	{
		id: "unipile-message-edited",
		concurrency: {
			limit: 1,
			key: "event.data.message_id",
		},
	},
	{ event: "unipile/message_edited" },
	async ({ event, step, services }) => {
		const { data } = event;
		const { unipileAccountService, unipileMessageService } = services;

		const { account_id, provider, message_id, new_content, edited_at } = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await unipileAccountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Update message content
		await step.run("update-message-content", async () => {
			return await unipileMessageService.upsertMessage(
				unipileAccount.id,
				message_id,
				{
					content: new_content,
					edited: 1,
				},
			);
		});

		return { message: "Message edited successfully" };
	},
);

/**
 * Handle message deletions from Unipile (real-time)
 */
export const unipileMessageDeleted = inngest.createFunction(
	{ id: "unipile-message-deleted" },
	{ event: "unipile/message_deleted" },
	async ({ event, step, services }) => {
		const { data } = event;
		const { unipileAccountService, unipileMessageService } = services;

		const { account_id, provider, message_id, deleted_at, deleted_by } = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await unipileAccountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Mark message as deleted
		await step.run("mark-message-deleted", async () => {
			return await unipileMessageService.upsertMessage(
				unipileAccount.id,
				message_id,
				{
					is_deleted: true,
					deleted: 1,
				},
			);
		});

		return { message: "Message deleted successfully" };
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
		const syncConfig = getCurrentSyncConfig();

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
			return await services.db
				.insert(unipileProfileViews)
				.values({
					...data,
					user_id: unipileAccount.user_id,
					viewer_profile_id: viewer?.id,
					viewer_name: viewer?.display_name || viewer?.name,
					viewer_headline: viewer?.headline,
					viewer_image_url: viewer?.profile_picture_url || viewer?.avatar_url,
					viewed_at: viewed_at ? new Date(viewed_at) : new Date(),
					provider: normalizeProvider(provider),
				})
				.returning();
		});

		// Also upsert the viewer as a contact using enriched profile data
		if (viewer?.id) {
			await step.run("upsert-viewer-contact", async () => {
				// Create Unipile service instance for profile fetching if enabled
				if (!syncConfig.enableProfileEnrichment) {
					// Fallback to basic contact creation if profile enrichment is disabled
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

				if (!process.env.UNIPILE_API_KEY || !process.env.UNIPILE_DSN) {
					throw new Error(
						"Unipile credentials missing but profile enrichment is enabled",
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

import type { unipileContentTypeEnum } from "~/db/schema";
import type { UnipileAccountStatus } from "../db/unipile-account.service";
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

		// allow for 10 seconds to be added to the sync for unipile
		await step.sleep("sleep-10-seconds", 10000);

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

		// Log sync configuration
		const syncConfig = getCurrentSyncConfig();
		logSyncConfig();

		let totalChatsProcessed = 0;
		let totalMessagesProcessed = 0;
		let totalAttendeesProcessed = 0;
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
										// First create/upsert the contact (if not self)
										let contactId: string | null = null;
										if (attendeeData.is_self !== 1) {
											const contact = await createContactFromAttendee(
												unipileContactService,
												unipileAccount.id,
												attendeeData,
											);
											contactId = contact?.id || null;
										}

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
											const isOutgoing = messageData.is_sender === 1;

											// Upsert message using the service
											const message = await unipileMessageService.upsertMessage(
												unipileAccount.id,
												messageData.id,

												{
													chat_id: chat.id, // Link to internal chat record
													external_chat_id: chatData.id, // Store external API chat ID
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
				{ status: (status || "connected") as UnipileAccountStatus },
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
					dsn: process.env.UNIPILE_DSN || "",
					api_key: process.env.UNIPILE_API_KEY || "",
					limit: getCurrentSyncConfig().chat.maxChats,
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
		const syncConfig = getCurrentSyncConfig();
		const {
			unipileAccountService: accountService,
			unipileMessageService: messageService,
			unipileContactService: contactService,
			unipileChatService: chatService,
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

							// Find the internal chat record by external chat ID if available
							let internalChat = null;
							if (messageData.chat_id) {
								try {
									internalChat = await chatService.findChatByExternalId(
										unipileAccount.id,
										messageData.chat_id,
									);
								} catch (error) {
									console.warn(
										`Failed to find internal chat for external chat ID ${messageData.chat_id}:`,
										error,
									);
								}
							}

							// Upsert message using the service
							const message = await messageService.upsertMessage(
								unipileAccount.id,
								messageData.id,

								{
									...(internalChat ? { chat_id: internalChat.id } : {}), // Link to internal chat if found
									chat_id: internalChat?.id, // Link to internal chat record
									external_chat_id: messageData.chat_id, // Store external API chat ID
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
								// Create enriched contact if profile enrichment is enabled
								if (syncConfig.enableProfileEnrichment) {
									if (
										!process.env.UNIPILE_API_KEY ||
										!process.env.UNIPILE_DSN
									) {
										throw new Error(
											"Unipile credentials missing but profile enrichment is enabled",
										);
									}

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
									// Fallback to basic contact creation using available message data
									const sender = messageData.sender;
									const fullName =
										sender?.display_name ||
										sender?.name ||
										(sender?.first_name && sender?.last_name
											? `${sender.first_name} ${sender.last_name}`
											: undefined) ||
										messageData.sender_urn ||
										undefined;

									await contactService.upsertContact(
										unipileAccount.id,
										messageData.sender_id,
										{
											full_name: fullName,
											first_name: sender?.first_name,
											last_name: sender?.last_name,
											headline: sender?.headline,
											profile_image_url:
												sender?.profile_picture_url || sender?.avatar_url,
											provider_url: sender?.profile_url,
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
