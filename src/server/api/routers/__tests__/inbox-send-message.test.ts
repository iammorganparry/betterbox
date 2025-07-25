import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Unipile service at the top level
const mockUnipileService = {
	sendMessage: vi.fn(),
	patchChat: vi.fn(),
	listChats: vi.fn(),
	listChatMessages: vi.fn(),
	getChat: vi.fn(),
	getMessage: vi.fn(),
	downloadAttachment: vi.fn(),
	healthCheck: vi.fn(),
};

vi.mock("~/services/unipile/unipile.service", () => ({
	createUnipileService: vi.fn(() => mockUnipileService),
}));

// Mock environment variables
vi.mock("~/env", () => ({
	env: {
		UNIPILE_API_KEY: "test-api-key",
		UNIPILE_DSN: "test-dsn",
	},
}));

import { inboxRouter } from "../inbox";
import {
	createMockTrpcContext,
	mockChatData,
	mockMessageData,
	mockUnipileResponse,
} from "~/test/mocks/services";

describe("inboxRouter.sendMessage", () => {
	let mockContext: ReturnType<typeof createMockTrpcContext>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockContext = createMockTrpcContext();
	});

	it("should send a message successfully", async () => {
		// Arrange
		mockContext.services.unipileChatService.getChatWithDetails.mockResolvedValue(
			mockChatData,
		);
		mockUnipileService.sendMessage.mockResolvedValue(
			mockUnipileResponse.sendMessage,
		);
		mockContext.services.unipileMessageService.upsertMessage.mockResolvedValue(
			mockMessageData,
		);
		mockContext.services.unipileChatService.updateLastMessageAt.mockResolvedValue(
			{},
		);

		const caller = inboxRouter.createCaller(mockContext as any);

		// Act
		const result = await caller.sendMessage({
			chatId: "chat-123",
			content: "Hello, world!",
		});

		// Assert
		expect(result).toEqual({
			success: true,
			message: "Message sent successfully",
			messageId: "message-456",
			chatId: "chat-123",
			unipileResponse: mockUnipileResponse.sendMessage,
			savedMessage: mockMessageData,
		});

		expect(
			mockContext.services.unipileChatService.getChatWithDetails,
		).toHaveBeenCalledWith("chat-123");
		expect(mockUnipileService.sendMessage).toHaveBeenCalledWith(
			{
				chat_id: "external-chat-123",
				text: "Hello, world!",
				attachments: undefined,
			},
			"linkedin-account-123",
		);
		expect(
			mockContext.services.unipileMessageService.upsertMessage,
		).toHaveBeenCalled();
		expect(
			mockContext.services.unipileChatService.updateLastMessageAt,
		).toHaveBeenCalledWith("chat-123", expect.any(Date));
	});

	it("should send a message with attachments", async () => {
		// Arrange
		mockContext.services.unipileChatService.getChatWithDetails.mockResolvedValue(
			mockChatData,
		);
		mockUnipileService.sendMessage.mockResolvedValue(
			mockUnipileResponse.sendMessage,
		);
		mockContext.services.unipileMessageService.upsertMessage.mockResolvedValue(
			mockMessageData,
		);
		mockContext.services.unipileChatService.updateLastMessageAt.mockResolvedValue(
			{},
		);

		const caller = inboxRouter.createCaller(mockContext as any);

		const attachments = [
			{
				type: "image",
				filename: "test.jpg",
				data: "base64data",
			},
		];

		// Act
		await caller.sendMessage({
			chatId: "chat-123",
			content: "Hello with attachment!",
			attachments,
		});

		// Assert
		expect(mockUnipileService.sendMessage).toHaveBeenCalledWith(
			{
				chat_id: "external-chat-123",
				text: "Hello with attachment!",
				attachments,
			},
			"linkedin-account-123",
		);
	});

	it("should throw NOT_FOUND error when chat does not exist", async () => {
		// Arrange
		mockContext.services.unipileChatService.getChatWithDetails.mockResolvedValue(
			null,
		);

		const caller = inboxRouter.createCaller(mockContext as any);

		// Act & Assert
		await expect(
			caller.sendMessage({
				chatId: "nonexistent-chat",
				content: "Hello, world!",
			}),
		).rejects.toThrow(
			expect.objectContaining({
				code: "NOT_FOUND",
				message: "Chat not found",
			}),
		);
	});

	it("should throw FORBIDDEN error when user does not own the chat", async () => {
		// Arrange
		const otherUserChat = {
			...mockChatData,
			unipile_account: {
				...mockChatData.unipile_account,
				user_id: "other-user-456",
			},
		};
		mockContext.services.unipileChatService.getChatWithDetails.mockResolvedValue(
			otherUserChat,
		);

		const caller = inboxRouter.createCaller(mockContext as any);

		// Act & Assert
		await expect(
			caller.sendMessage({
				chatId: "chat-123",
				content: "Hello, world!",
			}),
		).rejects.toThrow(
			expect.objectContaining({
				code: "FORBIDDEN",
				message: "You can only send messages to your own chats",
			}),
		);
	});

	it("should throw FORBIDDEN error when chat is read-only", async () => {
		// Arrange
		const readOnlyChat = {
			...mockChatData,
			read_only: 1,
		};
		mockContext.services.unipileChatService.getChatWithDetails.mockResolvedValue(
			readOnlyChat,
		);

		const caller = inboxRouter.createCaller(mockContext as any);

		// Act & Assert
		await expect(
			caller.sendMessage({
				chatId: "chat-123",
				content: "Hello, world!",
			}),
		).rejects.toThrow(
			expect.objectContaining({
				code: "FORBIDDEN",
				message: "Cannot send messages to a read-only chat",
			}),
		);
	});

	it("should throw BAD_GATEWAY error when Unipile returns failed status", async () => {
		// Arrange
		mockContext.services.unipileChatService.getChatWithDetails.mockResolvedValue(
			mockChatData,
		);
		mockUnipileService.sendMessage.mockResolvedValue({
			...mockUnipileResponse.sendMessage,
			status: "failed",
			error: "Network error",
		});

		const caller = inboxRouter.createCaller(mockContext as any);

		// Act & Assert
		await expect(
			caller.sendMessage({
				chatId: "chat-123",
				content: "Hello, world!",
			}),
		).rejects.toThrow(
			expect.objectContaining({
				code: "BAD_GATEWAY",
				message: "Network error",
			}),
		);
	});

	it("should validate message content length", async () => {
		// Arrange
		const caller = inboxRouter.createCaller(mockContext as any);

		// Act & Assert - Empty message
		await expect(
			caller.sendMessage({
				chatId: "chat-123",
				content: "",
			}),
		).rejects.toThrow("Message content cannot be empty");

		// Act & Assert - Too long message
		const longMessage = "a".repeat(2001);
		await expect(
			caller.sendMessage({
				chatId: "chat-123",
				content: longMessage,
			}),
		).rejects.toThrow("Message content too long");
	});

	it("should handle case when Unipile does not return message data", async () => {
		// Arrange
		mockContext.services.unipileChatService.getChatWithDetails.mockResolvedValue(
			mockChatData,
		);
		mockUnipileService.sendMessage.mockResolvedValue({
			id: "message-456",
			chat_id: "external-chat-123",
			status: "sent" as const,
			timestamp: "2024-01-01T12:00:00Z",
			// No message data returned
		});
		mockContext.services.unipileMessageService.upsertMessage.mockResolvedValue({
			...mockMessageData,
			id: "local-generated-id",
			external_id: expect.stringMatching(/^local-/),
		});
		mockContext.services.unipileChatService.updateLastMessageAt.mockResolvedValue(
			{},
		);

		const caller = inboxRouter.createCaller(mockContext as any);

		// Act
		const result = await caller.sendMessage({
			chatId: "chat-123",
			content: "Hello, world!",
		});

		// Assert - should now always save a message locally
		expect(result.savedMessage).toBeDefined();
		expect(
			mockContext.services.unipileMessageService.upsertMessage,
		).toHaveBeenCalledWith(
			"unipile-account-internal-id",
			expect.stringMatching(/^local-/), // Should generate a local ID
			expect.objectContaining({
				content: "Hello, world!",
				is_read: true,
			}),
			expect.objectContaining({
				content: "Hello, world!",
				is_outgoing: true,
				is_read: true,
			}),
		);
		expect(
			mockContext.services.unipileChatService.updateLastMessageAt,
		).toHaveBeenCalled();
	});

	it("should handle database errors gracefully", async () => {
		// Arrange
		mockContext.services.unipileChatService.getChatWithDetails.mockRejectedValue(
			new Error("Database connection failed"),
		);

		const caller = inboxRouter.createCaller(mockContext as any);

		// Act & Assert
		await expect(
			caller.sendMessage({
				chatId: "chat-123",
				content: "Hello, world!",
			}),
		).rejects.toThrow(
			expect.objectContaining({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to send message",
			}),
		);
	});

	it("should throw INTERNAL_SERVER_ERROR when Unipile network request fails", async () => {
		// Arrange
		mockContext.services.unipileChatService.getChatWithDetails.mockResolvedValue(
			mockChatData,
		);
		// Mock a network error (axios rejection)
		mockUnipileService.sendMessage.mockRejectedValue(
			new Error("Network Error"),
		);

		const caller = inboxRouter.createCaller(mockContext as any);

		// Act & Assert
		await expect(
			caller.sendMessage({
				chatId: "chat-123",
				content: "Hello, world!",
			}),
		).rejects.toThrow(
			expect.objectContaining({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to send message",
			}),
		);
	});
});
