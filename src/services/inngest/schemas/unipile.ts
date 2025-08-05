import type {
	UnipileApiAccountStatus,
	UnipileApiMessage,
	UnipileApiParticipant,
	UnipileHistoricalSyncRequest,
} from "~/types/unipile-api";

// Account status update event schema
export interface UnipileAccountStatusEventData extends UnipileApiAccountStatus {
	user_identifier: string;
}

// Message received event schema (based on actual Unipile webhook)
export interface UnipileMessageReceivedEventData {
	account_id: string;
	account_info: {
		feature: string;
		type: string;
		user_id: string;
	};
	account_type: string; // This is the provider (LINKEDIN, etc.)
	attachments: Array<{
		id?: string;
		url?: string;
		filename?: string;
		name?: string;
		file_size?: number;
		size?: number;
		mime_type?: string;
		type?: string;
		unavailable?: boolean;
	}>;
	attendees: Array<{
		attendee_id: string;
		attendee_name: string;
		attendee_profile_url: string;
		attendee_provider_id: string;
	}>;
	chat_content_type: string | null;
	chat_id: string;
	event: string;
	folder: string[];
	is_event: number;
	is_group: boolean;
	message: string; // The actual message content
	message_id: string;
	message_type: string;
	provider_chat_id: string;
	provider_message_id: string;
	quoted: Record<string, unknown> | null;
	sender: {
		attendee_id: string;
		attendee_name: string;
		attendee_profile_url: string;
		attendee_provider_id: string;
	};
	subject: string | null;
	timestamp: string;
	webhook_name: string;
}

// Message read event schema
export interface UnipileMessageReadEventData {
	account_id: string;
	provider: string;
	message_id: string;
	read_by?: string;
	read_at?: string;
}

// Message reaction event schema
export interface UnipileMessageReactionEventData {
	account_id: string;
	provider: string;
	message_id: string;
	reaction: string;
	reactor_id: string;
	reaction_at?: string;
}

// Message edited event schema
export interface UnipileMessageEditedEventData {
	account_id: string;
	provider: string;
	message_id: string;
	new_content: string;
	edited_at?: string;
	edited_by?: string;
}

// Message deleted event schema
export interface UnipileMessageDeletedEventData {
	account_id: string;
	provider: string;
	message_id: string;
	deleted_at?: string;
	deleted_by?: string;
}

// Profile view event schema
export interface UnipileProfileViewEventData {
	account_id: string;
	provider?: string;
	viewer?: {
		id: string;
		name?: string;
		display_name?: string;
		first_name?: string;
		last_name?: string;
		headline?: string;
		profile_picture_url?: string;
		avatar_url?: string;
		profile_url?: string;
	};
	viewed_at?: string;
}

// Historical sync event schema
export interface UnipileHistoricalSyncEventData
	extends UnipileHistoricalSyncRequest {}

// Account connected event schema
export interface UnipileAccountConnectedEventData {
	account_id: string;
	provider: string;
	status?: string;
	user_identifier: string;
}

// Account disconnected event schema
export interface UnipileAccountDisconnectedEventData {
	account_id: string;
	provider: string;
	user_identifier: string;
}

// Bulk message sync event schema
export interface UnipileBulkMessageSyncEventData {
	account_id: string;
	provider: string;
	messages: UnipileApiMessage[];
}

// Combined schemas type for Inngest
export type UnipileSchemas = {
	"unipile/account.status": {
		data: UnipileAccountStatusEventData;
	};
	"unipile/message_received": {
		data: UnipileMessageReceivedEventData;
	};
	"unipile/message_read": {
		data: UnipileMessageReadEventData;
	};
	"unipile/message_reaction": {
		data: UnipileMessageReactionEventData;
	};
	"unipile/message_edited": {
		data: UnipileMessageEditedEventData;
	};
	"unipile/message_deleted": {
		data: UnipileMessageDeletedEventData;
	};
	"unipile/profile.view": {
		data: UnipileProfileViewEventData;
	};
	"unipile/sync.historical_messages": {
		data: UnipileHistoricalSyncEventData;
	};
	"unipile/account.connected": {
		data: UnipileAccountConnectedEventData;
	};
	"unipile/account.disconnected": {
		data: UnipileAccountDisconnectedEventData;
	};
	"unipile/messages.bulk_sync": {
		data: UnipileBulkMessageSyncEventData;
	};
	"unipile/profile_views.sync_scheduled": {
		data: {
			scheduledAt: string;
		};
	};
};
