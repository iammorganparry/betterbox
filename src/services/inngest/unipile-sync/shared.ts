import { createUnipileService } from "../../unipile/unipile.service";
import { getCurrentSyncConfig } from "~/config/sync.config";
import type { AccountStatusEvent } from "~/types/realtime";
import { getUserChannelId } from "~/types/realtime";
import type {
	UnipileApiAccountStatus,
	UnipileApiAttachment,
	UnipileApiChatAttendee,
	UnipileApiMessage,
	UnipileApiUserProfile,
	UnipileHistoricalSyncRequest,
} from "~/types/unipile-api";
import type {
	unipileAccountTypeEnum,
	unipileProviderEnum,
} from "~/db/schema/enums";
import { env } from "~/env";
import type { UnipileContactService } from "../../db/unipile-contact.service";
import { UserLinkedInProfileService } from "../../db/user-linkedin-profile.service";

// Webhook-specific attachment type (different from API response)
export interface WebhookAttachment {
	id?: string;
	type?: string;
	url?: string;
	filename?: string;
	name?: string;
	file_name?: string;
	file_size?: number;
	size?: number;
	mime_type?: string;
	mimetype?: string;
	unavailable?: boolean;
	// Additional possible fields from LinkedIn
	attachment_id?: string;
	attachment_type?: string;
	content_url?: string;
	download_url?: string;
	media_url?: string;
	src?: string;
	href?: string;
}

// Combined attachment data type for processing
export interface ProcessedAttachmentData {
	id?: string;
	type?: "img" | "video" | "audio" | "file" | "linkedin_post" | "video_meeting";
	url?: string;
	filename?: string;
	file_size?: number;
	mime_type?: string;
	unavailable?: boolean;
	width?: number;
	height?: number;
	duration?: number;
	sticker?: boolean;
	gif?: boolean;
	voice_note?: boolean;
	starts_at?: number;
	expires_at?: number;
	url_expires_at?: number;
	time_range?: number;
}

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

export const normalizeProvider = (provider: string): ValidProvider => {
	const normalized = provider.toLowerCase();
	if (VALID_PROVIDERS.includes(normalized as ValidProvider)) {
		return normalized as ValidProvider;
	}
	return "linkedin"; // default fallback
};

export const normalizeAccountType = (provider: string): ValidAccountType => {
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
export async function fetchContactProfile(
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
export async function createContactFromAttendee(
	unipileContactService: UnipileContactService,
	unipileAccountId: string,
	attendeeData: UnipileApiChatAttendee,
	unipileService: ReturnType<typeof createUnipileService>,
	providerAccountId: string,
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

	// Handle the account owner - sync their LinkedIn profile
	if (attendeeData.is_self === 1) {
		console.log("👤 Syncing LinkedIn profile for account owner");

		try {
			const userLinkedInProfileService = new UserLinkedInProfileService();
			const currentProfile =
				await userLinkedInProfileService.getUserLinkedInProfile(
					unipileAccountId,
				);

			// Check if profile needs sync (hasn't been synced in 24 hours or never synced)
			if (
				userLinkedInProfileService.needsProfileSync(
					currentProfile?.linkedin_profile_synced_at || null,
				)
			) {
				console.log("🔄 Fetching LinkedIn profile for account owner");

				const ownProfile =
					await unipileService.getOwnProfile(providerAccountId);
				await userLinkedInProfileService.updateUserLinkedInProfile(
					unipileAccountId,
					ownProfile,
				);

				console.log("✅ LinkedIn profile synced successfully");
			} else {
				console.log("⏳ LinkedIn profile sync skipped - recently synced");
			}
		} catch (error) {
			console.error(
				"❌ Failed to sync LinkedIn profile for account owner:",
				error,
			);
		}

		// Skip contact creation for account owner
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
export async function createEnrichedContactFromSender(
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

// Re-export commonly used types and functions
export {
	createUnipileService,
	getCurrentSyncConfig,
	getUserChannelId,
	env,
	type AccountStatusEvent,
	type UnipileApiAccountStatus,
	type UnipileApiAttachment,
	type UnipileApiChatAttendee,
	type UnipileApiMessage,
	type UnipileApiUserProfile,
	type UnipileHistoricalSyncRequest,
	type UnipileContactService,
	UserLinkedInProfileService,
};
