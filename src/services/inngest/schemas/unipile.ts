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

// Message received event schema
export interface UnipileMessageReceivedEventData {
	account_id: string;
	provider: string;
	message: UnipileApiMessage;
	chat_id: string;
	sender?: UnipileApiParticipant;
	recipient?: UnipileApiParticipant;
	timestamp?: string;
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
};
