import type {
	UnipileApiMessage,
	UnipileApiAccountStatus,
	UnipileHistoricalSyncRequest,
	UnipileApiParticipant,
} from "~/types/unipile-api";

// Account status update event schema
export interface UnipileAccountStatusEventData extends UnipileApiAccountStatus {
	user_identifier: string;
}

// New message event schema
export interface UnipileNewMessageEventData {
	account_id: string;
	provider: string;
	message: UnipileApiMessage;
	chat_id: string;
	sender?: UnipileApiParticipant;
	recipient?: UnipileApiParticipant;
	timestamp?: string;
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
	"unipile/message.new": {
		data: UnipileNewMessageEventData;
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
