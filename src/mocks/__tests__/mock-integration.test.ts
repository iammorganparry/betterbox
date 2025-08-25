import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { server } from "../server";
import { mockStore } from "../data/store";
import {
	createMockAccount,
	createMockConversation,
	MOCK_CONFIG,
} from "../data/factories";
import type { UnipileApiChat } from "../../types/unipile-api";
// Setup MSW for tests
beforeAll(() => {
	server.listen({ onUnhandledRequest: "error" });
});

afterAll(() => {
	server.close();
});

beforeEach(() => {
	server.resetHandlers();
	mockStore.clear();
});

describe("Mock Unipile Integration", () => {
	const testAccountId = "test-account-123";
	const baseURL = "http://localhost:3000/api/v1";

	it("should handle chat listing", async () => {
		// Setup test data
		const account = createMockAccount({ account_id: testAccountId });
		mockStore.createAccount(account);

		const { chat, attendees, messages } = createMockConversation(testAccountId);
		mockStore.createChat(chat);
		for (const attendee of attendees) {
			mockStore.addAttendee(chat.id, attendee);
		}
		for (const message of messages) {
			mockStore.addMessage(chat.id, message);
		}

		// Test the endpoint
		const response = await fetch(
			`${baseURL}/chats?account_id=${testAccountId}&limit=10`,
		);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.object).toBe("List");
		expect(data.items).toHaveLength(1);
		expect(data.items[0].id).toBe(chat.id);
	});

	it("should handle message sending and auto-reply", async () => {
		// Setup test data
		const account = createMockAccount({ account_id: testAccountId });
		mockStore.createAccount(account);

		const { chat, attendees } = createMockConversation(testAccountId, 0); // No initial messages
		mockStore.createChat(chat);
		for (const attendee of attendees) {
			mockStore.addAttendee(chat.id, attendee);
		}

		const initialMessageCount = mockStore.getMessages(chat.id).length;

		// Send a message
		const messagePayload = {
			text: "Hello, this is a test message!",
			account_id: testAccountId,
		};

		const response = await fetch(`${baseURL}/chats/${chat.id}/messages`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(messagePayload),
		});

		const result = await response.json();

		expect(response.status).toBe(200);
		expect(result.object).toBe("MessageSent");
		expect(result.message_id).toBeDefined();

		// Check that the outgoing message was stored
		const messages = mockStore.getMessages(chat.id);
		expect(messages.length).toBe(initialMessageCount + 1);

		const outgoingMessage = messages.find((m) => m.is_sender === 1);
		expect(outgoingMessage).toBeDefined();
		expect(outgoingMessage?.text).toBe(messagePayload.text);
	});

	it("should handle account sync simulation", async () => {
		const syncPayload = {
			account_id: testAccountId,
			limit: 5,
			chat_count: 2,
		};

		const response = await fetch(`${baseURL}/account/sync`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(syncPayload),
		});

		expect(response.status).toBe(202);

		const result = await response.json();
		expect(result.status).toBe("accepted");
		expect(result.message).toBe("Sync started");

		// Wait a moment for the background sync to start
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Check that the account was created
		const account = mockStore.getAccount(testAccountId);
		expect(account).toBeDefined();
		expect(account?.account_id).toBe(testAccountId);
	});

	it("should handle health check", async () => {
		const response = await fetch(`${baseURL}/health`);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.status).toBe("ok");
		expect(data.timestamp).toBeDefined();
	});

	it("should handle chat read status updates", async () => {
		// Setup test data
		const account = createMockAccount({ account_id: testAccountId });
		mockStore.createAccount(account);

		const { chat, attendees, messages } = createMockConversation(testAccountId);
		mockStore.createChat(chat);
		for (const attendee of attendees) {
			mockStore.addAttendee(chat.id, attendee);
		}
		for (const message of messages) {
			mockStore.addMessage(chat.id, message);
		}

		// Mark chat as read
		const response = await fetch(
			`${baseURL}/chats/${chat.id}?account_id=${testAccountId}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "setReadStatus",
					value: true,
				}),
			},
		);

		expect(response.status).toBe(200);

		const result = await response.json();
		expect(result.object).toBe("ChatPatched");

		// Check that messages were marked as read
		const updatedMessages = mockStore.getMessages(chat.id);
		for (const message of updatedMessages) {
			expect(message.seen).toBe(1);
			expect(message.is_read).toBe(true);
		}
	});

	it("should handle pagination correctly", async () => {
		// Setup test data with multiple chats
		const account = createMockAccount({ account_id: testAccountId });
		mockStore.createAccount(account);

		// Create 5 chats
		const chats: UnipileApiChat[] = [];
		for (let i = 0; i < 5; i++) {
			const { chat, attendees, messages } =
				createMockConversation(testAccountId);
			mockStore.createChat(chat);
			for (const attendee of attendees) {
				mockStore.addAttendee(chat.id, attendee);
			}
			for (const message of messages) {
				mockStore.addMessage(chat.id, message);
			}
			chats.push(chat);
		}

		// Test pagination with limit of 2
		const response = await fetch(
			`${baseURL}/chats?account_id=${testAccountId}&limit=2`,
		);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.items).toHaveLength(2);
		expect(data.cursor).toBeDefined();

		// Test next page
		const response2 = await fetch(
			`${baseURL}/chats?account_id=${testAccountId}&limit=2&cursor=${data.cursor}`,
		);
		const data2 = await response2.json();

		expect(response2.status).toBe(200);
		expect(data2.items).toHaveLength(2);

		// Ensure we got different chats
		const firstPageIds = data.items.map((chat: { id: string }) => chat.id);
		const secondPageIds = data2.items.map((chat: { id: string }) => chat.id);

		expect(firstPageIds).not.toEqual(secondPageIds);
	});
});
