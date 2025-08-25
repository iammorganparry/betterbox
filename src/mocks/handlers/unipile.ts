import { http, HttpResponse } from "msw";
import { z } from "zod";
import { mockStore } from "../data/store";
import {
	createMockAccount,
	createMockConversation,
	createHistoricalSyncData,
	createOutgoingMessage,
	createMockReply,
	MOCK_CONFIG,
} from "../data/factories";
import { webhookDispatcher, dispatchWebhookDelayed } from "./webhook";
import type {
	UnipileApiResponse,
	UnipileApiChat,
	UnipileApiMessage,
	UnipileApiChatAttendee,
	UnipileApiSendMessageRequest,
	UnipileApiSendMessageResponse,
	UnipileApiPatchChatRequest,
	UnipileApiPatchChatResponse,
	UnipileApiAccountStatus,
} from "~/types/unipile-api";

// Validation schemas
const listChatsSchema = z.object({
	account_id: z.string(),
	limit: z.coerce.number().optional().default(20),
	cursor: z.string().optional(),
	start: z.coerce.number().optional(),
	provider: z.string().optional(),
});

const listMessagesSchema = z.object({
	account_id: z.string().optional(),
	limit: z.coerce.number().optional().default(50),
	cursor: z.string().optional(),
	start: z.coerce.number().optional(),
});

const listAttendeesSchema = z.object({
	account_id: z.string().optional(),
	limit: z.coerce.number().optional().default(20),
	cursor: z.string().optional(),
	start: z.coerce.number().optional(),
});

const patchChatSchema = z.object({
	action: z.literal("setReadStatus"),
	value: z.boolean(),
});

const sendMessageSchema = z.object({
	text: z.string().optional(),
	attachments: z
		.array(
			z.object({
				type: z.string(),
				filename: z.string().optional(),
				data: z.string().optional(),
			}),
		)
		.optional(),
});

const syncAccountSchema = z.object({
	account_id: z.string(),
	limit: z.coerce
		.number()
		.optional()
		.default(MOCK_CONFIG.DEFAULT_MESSAGE_COUNT),
	chat_count: z.coerce
		.number()
		.optional()
		.default(MOCK_CONFIG.DEFAULT_CHAT_COUNT),
});

// Helper to create paginated response
function createPaginatedResponse<T>(
	items: T[],
	cursor?: string,
	hasMore = false,
): UnipileApiResponse<T> {
	return {
		object: "List",
		items,
		cursor: hasMore ? cursor : undefined,
		status: "success",
	};
}

// Initialize with some default data if needed
function ensureDefaultData(accountId: string = MOCK_CONFIG.DEFAULT_ACCOUNT_ID) {
	let account = mockStore.getAccount(accountId);
	if (!account) {
		account = createMockAccount({ account_id: accountId });
		mockStore.createAccount(account);

		// Create some initial conversations
		const { conversations } = createHistoricalSyncData(accountId, 3, 10);
		for (const { chat, attendees, messages } of conversations) {
			mockStore.createChat(chat);
			for (const attendee of attendees) {
				mockStore.addAttendee(chat.id, attendee);
			}
			for (const message of messages) {
				mockStore.addMessage(chat.id, message);
			}
		}
	}
	return account;
}

export const unipileHandlers = [
	// GET /chats - List all chats for an account
	http.get("*/chats", ({ request }) => {
		const url = new URL(request.url);
		const params = Object.fromEntries(url.searchParams);

		console.log("[Mock Unipile] GET /chats", params);

		const validation = listChatsSchema.safeParse(params);
		if (!validation.success) {
			return HttpResponse.json(
				{ error: "Invalid parameters", details: validation.error.issues },
				{ status: 400 },
			);
		}

		const { account_id, limit, cursor } = validation.data;
		ensureDefaultData(account_id);

		const chats = mockStore.getChatsByAccount(account_id);
		const paginated = mockStore.paginateChats(chats, cursor, limit);

		return HttpResponse.json(
			createPaginatedResponse(
				paginated.items,
				paginated.cursor,
				paginated.has_more,
			),
		);
	}),

	// GET /chats/:id - Get a specific chat by ID
	http.get("*/chats/:chatId", ({ request, params }) => {
		const url = new URL(request.url);
		const accountId = url.searchParams.get("account_id");
		const { chatId } = params;

		console.log("[Mock Unipile] GET /chats/:id", { chatId, accountId });

		if (!accountId || !chatId) {
			return HttpResponse.json(
				{ error: "Missing required parameters" },
				{ status: 400 },
			);
		}

		const chat = mockStore.getChat(chatId as string);
		if (!chat) {
			return HttpResponse.json({ error: "Chat not found" }, { status: 404 });
		}

		const attendees = mockStore.getAttendees(chatId as string);
		const messages = mockStore.getMessages(chatId as string);
		const lastMessage = messages[messages.length - 1];

		return HttpResponse.json({
			...chat,
			attendees,
			attendee_count: attendees.length,
			lastMessage,
			last_message: lastMessage,
		});
	}),

	// GET /chats/:id/messages - List messages in a chat
	http.get("*/chats/:chatId/messages", ({ request, params }) => {
		const url = new URL(request.url);
		const urlParams = Object.fromEntries(url.searchParams);
		const { chatId } = params;

		console.log("[Mock Unipile] GET /chats/:id/messages", {
			chatId,
			...urlParams,
		});

		const validation = listMessagesSchema.safeParse(urlParams);
		if (!validation.success) {
			return HttpResponse.json(
				{ error: "Invalid parameters", details: validation.error.issues },
				{ status: 400 },
			);
		}

		const { limit, cursor } = validation.data;
		const messages = mockStore.getMessages(chatId as string);
		const paginated = mockStore.paginateMessages(messages, cursor, limit);

		return HttpResponse.json(
			createPaginatedResponse(
				paginated.items,
				paginated.cursor,
				paginated.has_more,
			),
		);
	}),

	// GET /chats/:id/attendees - List attendees in a chat
	http.get("*/chats/:chatId/attendees", ({ request, params }) => {
		const url = new URL(request.url);
		const urlParams = Object.fromEntries(url.searchParams);
		const { chatId } = params;

		console.log("[Mock Unipile] GET /chats/:id/attendees", {
			chatId,
			...urlParams,
		});

		const validation = listAttendeesSchema.safeParse(urlParams);
		if (!validation.success) {
			return HttpResponse.json(
				{ error: "Invalid parameters", details: validation.error.issues },
				{ status: 400 },
			);
		}

		const attendees = mockStore.getAttendees(chatId as string);

		return HttpResponse.json(createPaginatedResponse(attendees));
	}),

	// POST /chats/:id/messages - Send a message
	http.post("*/chats/:chatId/messages", async ({ request, params }) => {
		const { chatId } = params;

		// Handle FormData (multipart/form-data)
		let requestData: UnipileApiSendMessageRequest & { account_id: string };

		if (request.headers.get("content-type")?.includes("multipart/form-data")) {
			const formData = await request.formData();
			requestData = {
				account_id: formData.get("account_id") as string,
				chat_id: chatId as string,
				text: (formData.get("text") as string) || undefined,
				attachments: [], // TODO: Handle file attachments from FormData
			};
		} else {
			// Handle JSON request
			const body = (await request.json()) as Partial<
				UnipileApiSendMessageRequest & { account_id: string }
			>;
			requestData = {
				chat_id: chatId as string,
				account_id: body.account_id || "",
				text: body.text,
				attachments: body.attachments,
			};
		}

		console.log("[Mock Unipile] POST /chats/:id/messages", {
			chatId,
			requestData,
		});

		const chat = mockStore.getChat(chatId as string);
		if (!chat) {
			return HttpResponse.json({ error: "Chat not found" }, { status: 404 });
		}

		// Create outgoing message
		const outgoingMessage = createOutgoingMessage(
			requestData.account_id,
			requestData,
		);
		mockStore.addMessage(chatId as string, outgoingMessage);

		// Dispatch webhook for outgoing message
		dispatchWebhookDelayed(
			() =>
				webhookDispatcher.messageReceived(
					outgoingMessage,
					requestData.account_id,
				),
			100,
		);

		// Generate random reply after delay
		const replyDelay =
			Math.random() *
				(MOCK_CONFIG.MESSAGE_DELAY_MS.max - MOCK_CONFIG.MESSAGE_DELAY_MS.min) +
			MOCK_CONFIG.MESSAGE_DELAY_MS.min;

		dispatchWebhookDelayed(async () => {
			const reply = createMockReply(
				requestData.account_id,
				chatId as string,
				outgoingMessage,
			);
			mockStore.addMessage(chatId as string, reply);
			return webhookDispatcher.messageReceived(reply, requestData.account_id);
		}, replyDelay);

		const response: UnipileApiSendMessageResponse = {
			object: "MessageSent",
			message_id: outgoingMessage.id,
		};

		return HttpResponse.json(response);
	}),

	// PATCH /chats/:id - Update chat (mark as read/unread)
	http.patch("*/chats/:chatId", async ({ request, params }) => {
		const url = new URL(request.url);
		const accountId = url.searchParams.get("account_id");
		const { chatId } = params;
		const body = await request.json();

		console.log("[Mock Unipile] PATCH /chats/:id", { chatId, accountId, body });

		const validation = patchChatSchema.safeParse(body);
		if (!validation.success) {
			return HttpResponse.json(
				{ error: "Invalid request body", details: validation.error.issues },
				{ status: 400 },
			);
		}

		const { action, value } = validation.data;
		const chat = mockStore.getChat(chatId as string);

		if (!chat) {
			return HttpResponse.json({ error: "Chat not found" }, { status: 404 });
		}

		if (action === "setReadStatus") {
			// Mark all messages as read/unread
			const messages = mockStore.getMessages(chatId as string);
			for (const message of messages) {
				message.seen = value ? 1 : 0;
				message.is_read = value;
			}

			// Update chat unread count
			mockStore.updateChat(chatId as string, {
				unread_count: value
					? 0
					: messages.filter((m) => m.is_sender === 0).length,
			});
		}

		const response: UnipileApiPatchChatResponse = {
			object: "ChatPatched",
		};

		return HttpResponse.json(response);
	}),

	// GET /messages/:id - Get a specific message
	http.get("*/messages/:messageId", ({ request, params }) => {
		const url = new URL(request.url);
		const accountId = url.searchParams.get("account_id");
		const { messageId } = params;

		console.log("[Mock Unipile] GET /messages/:id", { messageId, accountId });

		const message = mockStore.getMessage(messageId as string);
		if (!message) {
			return HttpResponse.json({ error: "Message not found" }, { status: 404 });
		}

		return HttpResponse.json(message);
	}),

	// GET /accounts/:id - Get account information
	http.get("*/accounts/:accountId", ({ params }) => {
		const { accountId } = params;

		console.log("[Mock Unipile] GET /accounts/:id", { accountId });

		let account = mockStore.getAccount(accountId as string);
		if (!account) {
			account = ensureDefaultData(accountId as string);
		}

		return HttpResponse.json(account);
	}),

	// POST /account/sync - Trigger historical sync (simulate the sync process)
	http.post("*/account/sync", async ({ request }) => {
		const body = await request.json();

		console.log("[Mock Unipile] POST /account/sync", body);

		const validation = syncAccountSchema.safeParse(body);
		if (!validation.success) {
			return HttpResponse.json(
				{ error: "Invalid request body", details: validation.error.issues },
				{ status: 400 },
			);
		}

		const { account_id, limit, chat_count } = validation.data;

		// Emit account status: pending
		dispatchWebhookDelayed(async () => {
			const account = ensureDefaultData(account_id);
			return webhookDispatcher.accountStatus(account, "pending");
		}, 100);

		// Generate sync data in background
		setTimeout(async () => {
			try {
				const { account, conversations } = createHistoricalSyncData(
					account_id,
					chat_count,
					limit,
				);

				// Store the data
				for (const { chat, attendees, messages } of conversations) {
					mockStore.createChat(chat);
					for (const attendee of attendees) {
						mockStore.addAttendee(chat.id, attendee);
					}
					for (const message of messages) {
						mockStore.addMessage(chat.id, message);
					}
				}

				// Emit bulk sync events
				const allMessages = conversations.flatMap((c) => c.messages);
				const chunks = [];
				for (
					let i = 0;
					i < allMessages.length;
					i += MOCK_CONFIG.SYNC_BATCH_SIZE
				) {
					chunks.push(allMessages.slice(i, i + MOCK_CONFIG.SYNC_BATCH_SIZE));
				}

				for (const [index, chunk] of chunks.entries()) {
					setTimeout(() => {
						webhookDispatcher.bulkMessageSync(account_id, "LINKEDIN", chunk);
					}, index * 200);
				}

				// Finally emit account status: connected
				setTimeout(
					() => {
						webhookDispatcher.accountStatus(account, "connected");
					},
					chunks.length * 200 + 500,
				);
			} catch (error) {
				console.error("[Mock Unipile] Sync simulation failed:", error);
				const account =
					mockStore.getAccount(account_id) || createMockAccount({ account_id });
				webhookDispatcher.accountStatus(account, "error");
			}
		}, 1000);

		return HttpResponse.json(
			{ status: "accepted", message: "Sync started" },
			{ status: 202 },
		);
	}),

	// GET /health - Health check
	http.get("*/health", () => {
		console.log("[Mock Unipile] GET /health");

		return HttpResponse.json({
			status: "ok",
			timestamp: new Date().toISOString(),
		});
	}),

	// Catch-all for unimplemented endpoints
	http.all("*/api/*", ({ request }) => {
		console.warn(
			`[Mock Unipile] Unhandled request: ${request.method} ${request.url}`,
		);

		return HttpResponse.json(
			{
				error: "Endpoint not implemented in mock",
				method: request.method,
				url: request.url,
			},
			{ status: 501 },
		);
	}),
];
