import type { AxiosInstance } from "axios";
import axios from "axios";
import { createUnipileClient } from "~/lib/http";
import type {
	UnipileApiAttachment,
	UnipileApiChat,
	UnipileApiChatAttendee,
	UnipileApiChatWithAttendees,
	UnipileApiMessage,
	UnipileApiParticipant,
	UnipileApiPatchChatRequest,
	UnipileApiPatchChatResponse,
	UnipileApiResponse,
	UnipileApiSendMessageRequest,
	UnipileApiSendMessageResponse,
	UnipileApiUserProfile,
	UnipileSearchRequest,
	UnipileSearchResponse,
} from "~/types/unipile-api";

export interface UnipileClientConfig {
	apiKey: string;
	dsn: string;
}

export interface PaginationOptions {
	limit?: number;
	cursor?: string;
	start?: number;
}

export interface ListChatsOptions extends PaginationOptions {
	account_id: string;
	provider?: string;
}

export interface ListMessagesOptions extends PaginationOptions {
	chat_id: string;
	account_id?: string;
}

export interface ListAttendeesOptions extends PaginationOptions {
	chat_id: string;
	account_id?: string;
}

export interface SearchOptions extends PaginationOptions {
	account_id: string;
}

/**
 * Comprehensive Unipile API Service
 *
 * Provides methods for:
 * - Chat management
 * - Message handling
 * - Attendee management
 * - Search functionality
 * - Profile and company data
 */
export class UnipileService {
	private client: AxiosInstance;

	constructor(config: UnipileClientConfig) {
		this.client = createUnipileClient(config.apiKey, config.dsn);
	}

	/**
	 * CHAT OPERATIONS
	 */

	/**
	 * List all chats for an account
	 * API Reference: GET https://{subdomain}.unipile.com:{port}/api/v1/chats
	 */
	async listChats(
		options: ListChatsOptions,
	): Promise<UnipileApiResponse<UnipileApiChat>> {
		const params = new URLSearchParams();

		const response = await this.client.get<UnipileApiResponse<UnipileApiChat>>(
			`/chats?${params.toString()}`,
			{
				params: {
					account_id: options.account_id,
					limit: options.limit,
					cursor: options.cursor,
					start: options.start,
					account_type: options.provider,
				},
			},
		);

		console.log("📊 Chats response:", {
			object: response.data?.object,
			itemsLength: response.data?.items?.length || 0,
			cursor: response.data?.cursor,
		});

		return response.data;
	}

	/**
	 * Get a specific chat by ID
	 * API Reference: GET https://{subdomain}.unipile.com:{port}/api/v1/chats/{chat_id}
	 */
	async getChat(
		chatId: string,
		accountId: string,
	): Promise<UnipileApiChatWithAttendees> {
		const params = new URLSearchParams({ account_id: accountId });

		console.log("🔍 Fetching individual chat:", { chatId, accountId });

		const response = await this.client.get<UnipileApiChatWithAttendees>(
			`/chats/${chatId}?${params.toString()}`,
		);

		console.log("📨 Individual chat response:", {
			chatId: response.data?.id,
			hasLastMessage: !!response.data?.lastMessage,
			lastMessageTimestamp: response.data?.lastMessage?.timestamp,
			unreadCount: response.data?.unread_count,
		});

		return response.data;
	}

	/**
	 * MESSAGE OPERATIONS
	 */

	/**
	 * List all messages from a chat
	 */
	async listChatMessages(
		options: ListMessagesOptions,
	): Promise<UnipileApiResponse<UnipileApiMessage>> {
		const params = new URLSearchParams();

		if (options.account_id) params.set("account_id", options.account_id);
		if (options.limit) params.set("limit", options.limit.toString());
		if (options.cursor) params.set("cursor", options.cursor);
		if (options.start) params.set("start", options.start.toString());

		const response = await this.client.get<
			UnipileApiResponse<UnipileApiMessage>
		>(`/chats/${options.chat_id}/messages?${params.toString()}`);
		return response.data;
	}

	/**
	 * Get a specific message by ID
	 * API Reference: GET https://{subdomain}.unipile.com:{port}/api/v1/messages/{message_id}
	 */
	async getMessage(
		messageId: string,
		accountId?: string,
	): Promise<UnipileApiMessage> {
		const params = new URLSearchParams();
		if (accountId) params.set("account_id", accountId);

		console.log("🔍 Fetching individual message:", { messageId, accountId });

		const response = await this.client.get<UnipileApiMessage>(
			`/messages/${messageId}?${params.toString()}`,
		);

		console.log("📨 Individual message response:", {
			messageId: response.data?.id,
			hasText: !!response.data?.text,
			hasAttachments: !!response.data?.attachments?.length,
			hasQuoted: !!response.data?.quoted,
			hasReactions: !!response.data?.reactions?.length,
			messageType: response.data?.message_type,
			isSender: response.data?.is_sender,
			seen: response.data?.seen,
		});

		return response.data;
	}

	/**
	 * Send a message to a chat
	 */
	async sendMessage(
		request: UnipileApiSendMessageRequest,
		accountId: string,
	): Promise<UnipileApiSendMessageResponse> {
		// Create FormData for multipart/form-data request
		const formData = new FormData();

		// Add account_id to form data (not query params)
		formData.append("account_id", accountId);

		// Add text message if provided
		if (request.text) {
			formData.append("text", request.text);
		}

		// Handle attachments as binary data
		if (request.attachments?.length) {
			for (let i = 0; i < request.attachments.length; i++) {
				const attachment = request.attachments[i];
				if (!attachment) continue;

				// Convert base64 to binary blob for the API
				if (attachment.data) {
					try {
						// Remove data URL prefix if present (data:mime/type;base64,)
						const base64Data = attachment.data.includes(",")
							? attachment.data.split(",")[1] || attachment.data
							: attachment.data;

						// Convert base64 to binary
						const binaryString = atob(base64Data);
						const bytes = new Uint8Array(binaryString.length);
						for (let j = 0; j < binaryString.length; j++) {
							bytes[j] = binaryString.charCodeAt(j);
						}

						// Create blob with proper MIME type
						const blob = new Blob([bytes], {
							type: attachment.type || "application/octet-stream",
						});

						// Add to form data as binary file
						formData.append(
							"attachments",
							blob,
							attachment.filename || `attachment-${i}`,
						);
					} catch (error) {
						console.error(`Failed to process attachment ${i}:`, error);
						// Skip this attachment but continue with others
					}
				}
			}
		}

		// Debug logging
		console.log("🔍 Sending message to Unipile API:", {
			url: `/chats/${request.chat_id}/messages`,
			accountId,
			text: request.text,
			attachmentCount: request.attachments?.length || 0,
		});

		const response = await this.client.post<UnipileApiSendMessageResponse>(
			`/chats/${request.chat_id}/messages`,
			formData,
			{
				headers: {
					"Content-Type": "multipart/form-data",
				},
			},
		);
		return response.data;
	}

	/**
	 * Perform an action on a chat (mark as read, mute, archive, etc.)
	 * API Reference: PATCH https://{subdomain}.unipile.com:{port}/api/v1/chats/{chat_id}
	 */
	async patchChat(
		chatId: string,
		request: UnipileApiPatchChatRequest,
		accountId: string,
	): Promise<UnipileApiPatchChatResponse> {
		const params = new URLSearchParams({ account_id: accountId });

		console.log("🔄 Performing chat action:", {
			chatId,
			action: request.action,
			accountId,
			value: request.value,
			url: `/chats/${chatId}?${params.toString()}`,
			fullUrl: `${this.client.defaults.baseURL}/chats/${chatId}?${params.toString()}`,
		});

		try {
			const response = await this.client.patch<UnipileApiPatchChatResponse>(
				`/chats/${chatId}?${params.toString()}`,
				request,
			);

			console.log("✅ Chat action response:", {
				object: response.data?.object,
			});

			return response.data;
		} catch (error) {
			// Enhanced error logging for debugging
			const axiosError = axios.isAxiosError(error) ? error : null;
			console.error("❌ Unipile patchChat API Error:", {
				chatId,
				accountId,
				request,
				url: `/chats/${chatId}?${params.toString()}`,
				errorType: error?.constructor?.name,
				status: axiosError?.response?.status,
				statusText: axiosError?.response?.statusText,
				responseData: axiosError?.response?.data,
				responseHeaders: axiosError?.response?.headers,
				requestData: request,
				message: error instanceof Error ? error.message : String(error),
			});

			// Re-throw the error so it bubbles up properly
			throw error;
		}
	}

	/**
	 * ATTENDEE OPERATIONS
	 */

	/**
	 * List all attendees from a chat
	 * API Reference: GET https://{subdomain}.unipile.com:{port}/api/v1/chats/{chat_id}/attendees
	 */
	async listChatAttendees(
		options: ListAttendeesOptions,
	): Promise<UnipileApiResponse<UnipileApiChatAttendee>> {
		const params = new URLSearchParams();

		if (options.account_id) params.set("account_id", options.account_id);
		if (options.limit) params.set("limit", options.limit.toString());
		if (options.cursor) params.set("cursor", options.cursor);
		if (options.start) params.set("start", options.start.toString());

		console.log("🔍 Fetching chat attendees with params:", {
			chat_id: options.chat_id,
			...Object.fromEntries(params),
		});

		const response = await this.client.get<
			UnipileApiResponse<UnipileApiChatAttendee>
		>(`/chats/${options.chat_id}/attendees?${params.toString()}`);

		console.log("📊 Chat attendees response:", {
			object: response.data?.object,
			itemsLength: response.data?.items?.length || 0,
			cursor: response.data?.cursor,
			chatId: options.chat_id,
		});

		return response.data;
	}

	/**
	 * Download a chat attendee picture
	 */
	async getAttendeeProfilePicture(
		chatId: string,
		attendeeId: string,
		accountId?: string,
	): Promise<Blob> {
		const params = new URLSearchParams();
		if (accountId) params.set("account_id", accountId);

		const response = await this.client.get<Blob>(
			`/chats/${chatId}/attendees/${attendeeId}/picture?${params.toString()}`,
			{
				responseType: "blob",
			},
		);
		return response.data;
	}

	/**
	 * SEARCH OPERATIONS
	 */

	/**
	 * Perform LinkedIn search (people, companies, posts, jobs)
	 */
	async search<T = unknown>(
		request: UnipileSearchRequest,
		options: SearchOptions,
	): Promise<UnipileSearchResponse<T>> {
		const params = new URLSearchParams({ account_id: options.account_id });

		if (options.limit) params.set("limit", options.limit.toString());
		if (options.cursor) params.set("cursor", options.cursor);
		if (options.start) params.set("start", options.start.toString());

		const response = await this.client.post<UnipileSearchResponse<T>>(
			`/linkedin/search?${params.toString()}`,
			request,
		);
		return response.data;
	}

	/**
	 * Get LinkedIn search parameters for building search queries
	 */
	async getSearchParameters(
		type: string,
		keywords: string,
		accountId: string,
		limit = 100,
	): Promise<UnipileApiResponse<{ id: string; title: string }>> {
		const params = new URLSearchParams({
			account_id: accountId,
			type,
			keywords,
			limit: limit.toString(),
		});

		const response = await this.client.get<
			UnipileApiResponse<{ id: string; title: string }>
		>(`/linkedin/search/parameters?${params.toString()}`);
		return response.data;
	}

	/**
	 * PROFILE & COMPANY OPERATIONS
	 */

	/**
	 * Retrieve a LinkedIn profile
	 */
	async getProfile(
		identifier: string,
		accountId: string,
	): Promise<UnipileApiUserProfile> {
		const params = new URLSearchParams({ account_id: accountId });

		const response = await this.client.get<UnipileApiUserProfile>(
			`/users/${identifier}?${params.toString()}`,
		);
		return response.data;
	}

	/**
	 * Retrieve the current logged-in user's own LinkedIn profile
	 */
	async getOwnProfile(accountId: string): Promise<UnipileApiUserProfile> {
		const params = new URLSearchParams({ account_id: accountId });

		const response = await this.client.get<UnipileApiUserProfile>(
			`/users/me?${params.toString()}`,
		);
		return response.data;
	}

	/**
	 * Retrieve a LinkedIn company profile
	 */
	async getCompanyProfile(
		identifier: string,
		accountId: string,
	): Promise<Record<string, unknown>> {
		const params = new URLSearchParams({ account_id: accountId });

		const response = await this.client.get<Record<string, unknown>>(
			`/linkedin/company/${identifier}?${params.toString()}`,
		);
		return response.data;
	}

	/**
	 * ATTACHMENT OPERATIONS
	 */

	/**
	 * Download an attachment file content as Blob
	 */
	async downloadAttachment(
		attachmentId: string,
		accountId?: string,
	): Promise<Blob> {
		const params = new URLSearchParams();
		if (accountId) params.set("account_id", accountId);

		const response = await this.client.get<Blob>(
			`/attachments/${attachmentId}?${params.toString()}`,
			{
				responseType: "blob",
			},
		);
		return response.data;
	}

	/**
	 * Retrieve an attachment from a message as base64 string
	 * API Reference: GET https://{subdomain}.unipile.com:{port}/api/v1/messages/{message_id}/attachments/{attachment_id}
	 */
	async getMessageAttachment(
		messageId: string,
		attachmentId: string,
		accountId?: string,
	): Promise<{ content: string; mime_type?: string }> {
		const params = new URLSearchParams();
		if (accountId) params.set("account_id", accountId);

		console.log("📎 Downloading attachment:", {
			messageId,
			attachmentId,
			accountId,
		});

		try {
			const response = await this.client.get<string>(
				`/messages/${messageId}/attachments/${attachmentId}?${params.toString()}`,
				{
					responseType: "text",
				},
			);

			console.log("✅ Attachment downloaded successfully:", {
				messageId,
				attachmentId,
				contentLength: response.data?.length || 0,
				isBase64:
					response.data?.startsWith("data:") ||
					response.data?.match(/^[A-Za-z0-9+/=]+$/),
			});

			// The response should be a base64 string
			// Extract mime type if it's a data URL (data:mime/type;base64,content)
			let content = response.data;
			let mime_type: string | undefined;

			if (content.startsWith("data:")) {
				const matches = content.match(/^data:([^;]+);base64,(.+)$/);
				if (matches) {
					mime_type = matches[1];
					content = matches[2] || "";
				}
			}

			return {
				content,
				mime_type,
			};
		} catch (error) {
			console.error("❌ Failed to download attachment:", {
				messageId,
				attachmentId,
				accountId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * UTILITY METHODS
	 */

	/**
	 * Get account information
	 */
	async getAccountInfo(accountId: string): Promise<Record<string, unknown>> {
		const params = new URLSearchParams({ account_id: accountId });

		const response = await this.client.get<Record<string, unknown>>(
			`/accounts/${accountId}?${params.toString()}`,
		);
		return response.data;
	}

	/**
	 * Test account connectivity and verify it exists
	 */
	async testAccountConnectivity(accountId: string): Promise<{
		connected: boolean;
		accountInfo?: Record<string, unknown>;
		error?: string;
	}> {
		try {
			console.log("🔍 Testing account connectivity for:", accountId);

			const accountInfo = await this.getAccountInfo(accountId);

			console.log("✅ Account info retrieved:", {
				accountId,
				status: accountInfo.status,
				provider: accountInfo.provider,
			});

			return {
				connected: true,
				accountInfo,
			};
		} catch (error) {
			console.error("❌ Account connectivity test failed:", {
				accountId,
				error: error instanceof Error ? error.message : String(error),
			});

			return {
				connected: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Health check for the API
	 */
	async healthCheck(): Promise<{ status: string; timestamp: string }> {
		const response = await this.client.get<{
			status: string;
			timestamp: string;
		}>("/health");
		return response.data;
	}

	/**
	 * Get raw data from any endpoint (for advanced use cases)
	 */
	async getRawData(
		endpoint: string,
		accountId: string,
		additionalParams?: Record<string, string>,
	): Promise<unknown> {
		const params = new URLSearchParams({ account_id: accountId });

		if (additionalParams) {
			for (const [key, value] of Object.entries(additionalParams)) {
				params.set(key, value);
			}
		}

		const response = await this.client.get<unknown>(
			`${endpoint}?${params.toString()}`,
		);
		return response.data;
	}
}

/**
 * Factory function to create a Unipile service instance
 */
export function createUnipileService(
	config: UnipileClientConfig,
): UnipileService {
	return new UnipileService(config);
}

/**
 * Default service instance using environment variables
 */
export function createDefaultUnipileService(): UnipileService {
	if (!process.env.UNIPILE_API_KEY || !process.env.UNIPILE_DSN) {
		throw new Error(
			"UNIPILE_API_KEY and UNIPILE_DSN environment variables are required",
		);
	}

	return new UnipileService({
		apiKey: process.env.UNIPILE_API_KEY,
		dsn: process.env.UNIPILE_DSN,
	});
}
