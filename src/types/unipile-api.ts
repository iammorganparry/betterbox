// Unipile API Response Types
// These match the structure returned by Unipile's API endpoints

export interface UnipileApiPagination {
	has_more: boolean;
	next_cursor?: string;
	prev_cursor?: string;
	total?: number;
}

// Updated to match actual API response structure
export interface UnipileApiResponse<T> {
	object: string; // e.g., "ChatList", "MessageList"
	items: T[];
	cursor?: string; // Direct cursor string for pagination
	status?: "success" | "error";
	message?: string;
}

// Legacy response format (keeping for backward compatibility)
export interface UnipileApiLegacyResponse<T> {
	data: T[];
	pagination?: UnipileApiPagination;
	status: "success" | "error";
	message?: string;
}

// Chat/Conversation types from Unipile API - Updated to match actual response
export interface UnipileApiChat {
	id: string;
	object: "Chat";
	account_id: string;
	account_type: "WHATSAPP" | "LINKEDIN" | "TELEGRAM" | "INSTAGRAM" | "FACEBOOK";
	provider_id: string; // Unipile's internal provider ID
	attendee_provider_id: string; // LinkedIn profile ID, WhatsApp number, etc.
	name?: string | null;
	type: number; // 0 for direct chats, 1 for group chats
	timestamp: string; // ISO date string - last activity
	unread_count: number;
	archived: number; // 0 or 1
	muted_until?: number | null; // Unix timestamp or -1
	read_only: number; // 0 or 1
	disabledFeatures: string[]; // e.g., ["reply", "reactions"]
	subject?: string; // For some message types
	organization_id?: string; // For organization messages
	mailbox_id?: string; // For organization messages
	content_type?: string; // e.g., "inmail", "sponsored", "linkedin_offer"
	folder: string[]; // e.g., ["INBOX", "INBOX_LINKEDIN_CLASSIC"]
	// Individual chat response includes lastMessage
	lastMessage?: UnipileApiMessage;
	// Legacy fields for backward compatibility (from list response)
	unread?: number; // 0 or 1 (from list response)
	mailbox_name?: string; // For organization messages (from list response)
	participants?: UnipileApiParticipant[];
	attendees?: UnipileApiParticipant[];
	last_message?: UnipileApiMessage;
	created_at?: string;
	updated_at?: string;
	metadata?: Record<string, unknown>;
}

export interface UnipileApiParticipant {
	id: string;
	name?: string;
	display_name?: string;
	first_name?: string;
	last_name?: string;
	username?: string;
	profile_picture_url?: string;
	avatar_url?: string;
	profile_url?: string;
	headline?: string;
	is_contact?: boolean;
	metadata?: Record<string, unknown>;
}

// Comprehensive User Profile response from GET /users/{identifier}
// Based on: https://developer.unipile.com/reference/userscontroller_getprofilebyidentifier
export interface UnipileApiUserProfile {
	object: "UserProfile";
	provider: "LINKEDIN" | "WHATSAPP" | "TELEGRAM" | "INSTAGRAM" | "FACEBOOK";
	provider_id: string;
	public_identifier: string;
	first_name: string;
	last_name: string;
	headline: string;
	summary?: string;
	contact_info?: {
		emails?: string[];
		phones?: string[];
		adresses?: string[]; // Note: API has typo "adresses" instead of "addresses"
		socials?: Array<{
			type: string;
			name: string;
		}>;
	};
	birthdate?: {
		month: number;
		day: number;
	};
	primary_locale?: {
		country: string;
		language: string;
	};
	location?: string;
	websites?: string[];
	profile_picture_url?: string;
	profile_picture_url_large?: string;
	background_picture_url?: string;
	hashtags?: string[];
	can_send_inmail?: boolean;
	is_open_profile?: boolean;
	is_premium?: boolean;
	is_influencer?: boolean;
	is_creator?: boolean;
	is_hiring?: boolean;
	is_open_to_work?: boolean;
	is_saved_lead?: boolean;
	is_crm_imported?: boolean;
	is_relationship?: boolean;
	is_self?: boolean;
	invitation?: {
		type: "SENT" | "RECEIVED" | "NONE";
		status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
	};
	work_experience?: Array<{
		position: string;
		company_id?: string;
		company: string;
		location?: string;
		description?: string;
		skills?: string[];
		current: boolean;
		status?: string;
		start?: string;
		end?: string;
	}>;
	volunteering_experience?: Array<{
		company: string;
		description?: string;
		role: string;
		cause?: string;
		start?: string;
		end?: string;
	}>;
	education?: Array<{
		degree?: string;
		school: string;
		school_id?: string;
		field_of_study?: string;
		start?: string;
		end?: string;
	}>;
	skills?: Array<{
		name: string;
		endorsement_count: number;
		endorsement_id: number;
		insights?: string[];
		endorsed: boolean;
	}>;
	languages?: Array<{
		name: string;
		proficiency?: string;
	}>;
	certifications?: Array<{
		name: string;
		organization?: string;
		url?: string;
	}>;
	projects?: Array<{
		name: string;
		description?: string;
		skills?: string[];
		start?: string;
		end?: string;
	}>;
	recommendations?: {
		received?: Array<{
			text: string;
			caption?: string;
			actor: {
				first_name: string;
				last_name: string;
				provider_id: string;
				headline?: string;
				public_identifier?: string;
				public_profile_url?: string;
				profile_picture_url?: string;
			};
		}>;
		given?: Array<{
			text: string;
			caption?: string;
			actor: {
				first_name: string;
				last_name: string;
				provider_id: string;
				headline?: string;
				public_identifier?: string;
				public_profile_url?: string;
				profile_picture_url?: string;
			};
		}>;
	};
	follower_count?: number;
	connections_count?: number;
	shared_connections_count?: number;
	network_distance?:
		| "FIRST_DEGREE"
		| "SECOND_DEGREE"
		| "THIRD_DEGREE"
		| "OUT_OF_NETWORK";
	public_profile_url?: string;
}

// Message types from Unipile API - Updated to match actual response
export interface UnipileApiMessage {
	object: "Message";
	id: string;
	account_id: string;
	chat_id: string;
	chat_provider_id: string;
	provider_id: string;
	sender_id: string;
	text?: string;
	timestamp: string;
	is_sender: number; // 0 or 1 - whether the message was sent by the account owner
	attachments?: UnipileApiAttachment[];
	quoted?: UnipileApiMessage; // Quoted/replied message
	reactions?: Array<{
		value: string;
		sender_id: string;
		is_sender: boolean;
	}>;
	seen: number; // 0 or 1
	seen_by?: Record<string, unknown>;
	hidden: number; // 0 or 1
	deleted: number; // 0 or 1
	edited: number; // 0 or 1
	is_event: number; // 0 or 1
	delivered: number; // 0 or 1
	behavior: number;
	event_type: number;
	original?: string;
	replies: number;
	reply_by?: string[];
	parent?: string;
	sender_attendee_id?: string;
	subject?: string;
	message_type: "MESSAGE" | "EVENT" | "SYSTEM";
	attendee_type: "MEMBER" | "ADMIN" | "GUEST";
	attendee_distance: number;
	sender_urn?: string;
	reply_to?: {
		id: string;
		provider_id: string;
		timestamp: string;
		sender_attendee_id: string;
		sender_id: string;
		text: string;
	};
	// Legacy fields for backward compatibility
	sender?: UnipileApiParticipant;
	recipient?: UnipileApiParticipant;
	type?: "text" | "file" | "image" | "video" | "audio" | "system" | "link";
	content?: string;
	metadata?: Record<string, unknown>;
	is_read?: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface UnipileApiAttachment {
	id: string;
	type: "img" | "video" | "audio" | "file" | "linkedin_post" | "video_meeting";
	file_size: number;
	unavailable?: boolean;
	mimetype?: string;
	url?: string;
	url_expires_at?: number;
	// Image/Video specific
	size?: {
		width: number;
		height: number;
	};
	sticker?: boolean; // For images
	gif?: boolean; // For videos
	// Audio specific
	duration?: number;
	voice_note?: boolean;
	// File specific
	file_name?: string;
	// Video meeting specific
	starts_at?: number;
	expires_at?: number;
	time_range?: number;
	// Legacy fields for backward compatibility
	filename?: string;
	mime_type?: string;
	metadata?: Record<string, unknown>;
}

// Account status types from Unipile API
export interface UnipileApiAccountStatus {
	account_id: string;
	provider: string;
	status: "connected" | "disconnected" | "error" | "pending";
	provider_data?: Record<string, unknown>;
	last_activity?: string;
	error_message?: string;
}

// Account status webhook payload from Unipile
// Based on: https://developer.unipile.com/docs/account-lifecycle#synchronization-status
export interface UnipileAccountStatusWebhook {
	AccountStatus: {
		account_id: string;
		account_type:
			| "LINKEDIN"
			| "WHATSAPP"
			| "INSTAGRAM"
			| "MESSENGER"
			| "TELEGRAM"
			| "X"
			| "GOOGLE"
			| "MICROSOFT"
			| "IMAP";
		message:
			| "OK"
			| "ERROR"
			| "STOPPED"
			| "CREDENTIALS"
			| "CONNECTING"
			| "DELETED"
			| "CREATION_SUCCESS"
			| "RECONNECTED"
			| "SYNC_SUCCESS";
	};
}

// Profile view types from Unipile API
export interface UnipileApiProfileView {
	id: string;
	viewer_profile_id?: string;
	viewer_name?: string;
	viewer_headline?: string;
	viewer_image_url?: string;
	viewed_at: string;
	provider: string;
	metadata?: Record<string, unknown>;
}

// Historical sync request types
export interface UnipileHistoricalSyncRequest {
	user_id: string;
	account_id: string;
	provider: string;
	dsn: string;
	api_key: string;
	limit?: number;
}

export interface UnipileHistoricalSyncResponse {
	user_id: string;
	account_id: string;
	provider: string;
	totalProcessed: number;
	message: string;
}

// Search functionality types
export interface UnipileSearchRequest {
	api: "classic" | "sales_navigator" | "recruiter";
	category: "people" | "companies" | "posts" | "jobs";
	keywords?: string;
	url?: string; // For copy-paste URL searches
	[key: string]: unknown; // Allow additional search parameters
}

export interface UnipileSearchResponse<T> {
	object: "LinkedinSearch";
	items: T[];
	config: {
		params: UnipileSearchRequest;
	};
	paging: {
		start: number;
		page_count: number;
		total_count: number;
	};
	cursor?: string;
}

// Enhanced message sync types for bulk operations
export interface UnipileBulkMessageData {
	account_id: string;
	provider: string;
	messages: UnipileApiMessage[];
}

// Chat attendee specific response - Updated to match actual API
export interface UnipileApiChatAttendee {
	object: "ChatAttendee";
	id: string;
	account_id: string;
	provider_id: string; // The attendee's provider-specific ID
	name?: string;
	is_self: number; // 0 or 1 - whether this attendee is the account owner
	hidden: number; // 0 or 1 - whether the attendee is hidden
	picture_url?: string;
	profile_url?: string;
	specifics: {
		provider: "LINKEDIN" | "WHATSAPP" | "TELEGRAM" | "INSTAGRAM" | "FACEBOOK";
		member_urn?: string; // LinkedIn member URN
		occupation?: string;
		network_distance?: "SELF" | "FIRST" | "SECOND" | "THIRD" | "OUT_OF_NETWORK";
		pending_invitation?: boolean;
		location?: string;
		headline?: string;
		contact_info?: {
			emails?: string[];
			phone_numbers?: string[];
			websites?: string[];
			social_handles?: Array<{
				type: string;
				name: string;
			}>;
		};
	};
	// Legacy fields for backward compatibility
	chat_id?: string;
	role?: string; // For group chats
	joined_at?: string;
	left_at?: string;
	display_name?: string;
	first_name?: string;
	last_name?: string;
	username?: string;
	profile_image_url?: string;
	is_contact?: boolean;
}

// Enhanced chat response with full attendee list
// Note: Individual chat responses don't actually include attendees
// This type is for potential future use or specific endpoints
export interface UnipileApiChatWithAttendees extends UnipileApiChat {
	attendees?: UnipileApiChatAttendee[];
	attendee_count?: number;
}

// Message sending types
export interface UnipileApiSendMessageRequest {
	chat_id: string;
	text?: string;
	attachments?: Array<{
		type: string;
		url?: string;
		filename?: string;
		data?: string; // Base64 encoded for uploads
	}>;
	metadata?: Record<string, unknown>;
}

export interface UnipileApiSendMessageResponse {
	id: string;
	chat_id: string;
	status: "sent" | "pending" | "failed";
	timestamp: string;
	message?: UnipileApiMessage;
	error?: string;
}

// Pagination cursor for efficient data retrieval
export interface UnipileApiCursor {
	account_id: string;
	limit: number;
	start: number;
	params?: Record<string, unknown>;
}

// PATCH chat request/response types for chat actions - Updated to match official API spec
export interface UnipileApiPatchChatRequest {
	/**
	 * Action to perform on the chat
	 * Currently only "setReadStatus" is supported by the API
	 */
	action: "setReadStatus";

	/**
	 * Boolean value for setReadStatus action
	 * - true: mark as read
	 * - false: mark as unread
	 */
	value: boolean;
}

export interface UnipileApiPatchChatResponse {
	/**
	 * Response object type - always "ChatPatched" according to API spec
	 */
	object: "ChatPatched";
}
