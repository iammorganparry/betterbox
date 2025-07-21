// Unipile API Response Types
// These match the structure returned by Unipile's API endpoints

export interface UnipileApiPagination {
	has_more: boolean;
	next_cursor?: string;
	prev_cursor?: string;
	total?: number;
}

export interface UnipileApiResponse<T> {
	data: T[];
	pagination?: UnipileApiPagination;
	status: "success" | "error";
	message?: string;
}

// Chat/Conversation types from Unipile API
export interface UnipileApiChat {
	id: string;
	account_id: string;
	provider: string;
	name?: string;
	type: "direct" | "group" | "broadcast";
	participants?: UnipileApiParticipant[];
	last_message?: UnipileApiMessage;
	created_at: string;
	updated_at: string;
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
}

// Message types from Unipile API
export interface UnipileApiMessage {
	id: string;
	chat_id: string;
	sender?: UnipileApiParticipant;
	recipient?: UnipileApiParticipant;
	type: "text" | "file" | "image" | "video" | "audio" | "system" | "link";
	text?: string;
	content?: string;
	attachments?: UnipileApiAttachment[];
	metadata?: Record<string, unknown>;
	is_read: boolean;
	timestamp: string;
	created_at: string;
	updated_at: string;
}

export interface UnipileApiAttachment {
	id: string;
	type: "file" | "image" | "video" | "audio" | "document";
	url: string;
	filename?: string;
	size?: number;
	mime_type?: string;
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
