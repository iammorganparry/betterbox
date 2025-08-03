import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Create mock functions that will be used throughout tests
const mockPatchChat = vi.fn();
const mockSendMessage = vi.fn();
const mockListChats = vi.fn();
const mockListChatMessages = vi.fn();
const mockGetChat = vi.fn();
const mockGetMessage = vi.fn();
const mockDownloadAttachment = vi.fn();
const mockHealthCheck = vi.fn();

// Mock the Unipile service module BEFORE any imports
vi.mock("~/services/unipile/unipile.service", () => ({
	createUnipileService: vi.fn(() => ({
		patchChat: mockPatchChat,
		sendMessage: mockSendMessage,
		listChats: mockListChats,
		listChatMessages: mockListChatMessages,
		getChat: mockGetChat,
		getMessage: mockGetMessage,
		downloadAttachment: mockDownloadAttachment,
		healthCheck: mockHealthCheck,
	})),
}));

// Mock environment variables
vi.mock("~/env", () => ({
	env: {
		UNIPILE_API_KEY: "test-api-key",
		UNIPILE_DSN: "test-dsn",
	},
}));

import type { ContactLimitService } from "~/services/db/contact-limit.service";
import type { UnipileChatService } from "~/services/db/unipile-chat.service";
// Import types after mocks
import type { UnipileService } from "~/services/unipile/unipile.service";

// Import the router AFTER mocks are set up
import { inboxRouter } from "../inbox";

describe("inboxRouter - getChats", () => {
	let mockUnipileChatService: Partial<UnipileChatService>;
	let mockContactLimitService: Partial<ContactLimitService>;
	let mockContext: {
		userId: string;
		services: {
			unipileChatService: Partial<UnipileChatService>;
			contactLimitService: Partial<ContactLimitService>;
		};
	};

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset Unipile service mocks
		mockPatchChat.mockReset();
		mockSendMessage.mockReset();
		mockListChats.mockReset();
		mockListChatMessages.mockReset();
		mockGetChat.mockReset();
		mockGetMessage.mockReset();
		mockDownloadAttachment.mockReset();
		mockHealthCheck.mockReset();

		// Mock the chat service
		mockUnipileChatService = {
			getChatsByUserPaginated: vi.fn(),
			getChatWithDetails: vi.fn(),
		};

		// Mock the contact limit service
		mockContactLimitService = {
			getContactLimitStatus: vi.fn().mockResolvedValue({
				limit: 100,
				count: 50,
				isExceeded: false,
				remainingContacts: 50,
			}),
			applyContactLimitsToChats: vi
				.fn()
				.mockImplementation((userId, chats) => Promise.resolve(chats)),
		};

		// Mock the context
		mockContext = {
			userId: "test-user-id",
			services: {
				unipileChatService: mockUnipileChatService,
				contactLimitService: mockContactLimitService,
			},
		};
	});

	describe("getChats query", () => {
		it("should return chats for authenticated user with default parameters", async () => {
			// Arrange
			const expectedChats = [
				{
					id: "chat1",
					provider: "linkedin",
					unread_count: 2,
					last_message_at: new Date("2024-01-15"),
					unipileChatAttendees: [
						{
							id: "attendee1",
							is_self: 0,
							contact: {
								id: "contact1",
								full_name: "John Doe",
								profile_image_url: "https://example.com/image.jpg",
							},
						},
					],
					unipileMessages: [
						{
							id: "msg1",
							content: "Hello there",
							is_outgoing: false,
							sent_at: new Date("2024-01-15"),
						},
					],
				},
				{
					id: "chat2",
					provider: "linkedin",
					unread_count: 0,
					last_message_at: new Date("2024-01-14"),
					unipileChatAttendees: [
						{
							id: "attendee2",
							is_self: 0,
							contact: {
								id: "contact2",
								full_name: "Jane Smith",
								profile_image_url: null,
							},
						},
					],
					unipileMessages: [
						{
							id: "msg2",
							content: "Thanks for connecting",
							is_outgoing: true,
							sent_at: new Date("2024-01-14"),
						},
					],
				},
			];

			mockUnipileChatService.getChatsByUserPaginated.mockResolvedValue({
				chats: expectedChats,
				hasMore: false,
			});

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.getChats({});

			// Assert
			expect(
				mockUnipileChatService.getChatsByUserPaginated,
			).toHaveBeenCalledWith(
				"test-user-id",
				undefined, // no provider filter
				{
					limit: 50,
					include_attendees: true,
					include_account: true,
					include_messages: true,
					order_by: "last_message_at",
					order_direction: "desc",
				},
			);
			expect(result.chats).toEqual(expectedChats);
		});

		it("should filter by provider when specified", async () => {
			// Arrange
			const expectedChats = [
				{
					id: "chat1",
					provider: "linkedin",
					unread_count: 1,
				},
			];

			mockUnipileChatService.getChatsByUserPaginated.mockResolvedValue({
				chats: expectedChats,
				hasMore: false,
			});

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.getChats({ provider: "linkedin" });

			// Assert
			expect(
				mockUnipileChatService.getChatsByUserPaginated,
			).toHaveBeenCalledWith(
				"test-user-id",
				"linkedin",
				expect.objectContaining({
					limit: 50,
				}),
			);
			expect(result.chats).toEqual(expectedChats);
		});

		it("should respect custom limit parameter", async () => {
			// Arrange
			mockUnipileChatService.getChatsByUserPaginated.mockResolvedValue({
				chats: [],
				hasMore: false,
			});

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			await caller.getChats({ limit: 25 });

			// Assert
			expect(
				mockUnipileChatService.getChatsByUserPaginated,
			).toHaveBeenCalledWith(
				"test-user-id",
				undefined,
				expect.objectContaining({
					limit: 25,
				}),
			);
		});

		it("should throw INTERNAL_SERVER_ERROR when database operation fails", async () => {
			// Arrange
			mockUnipileChatService.getChatsByUserPaginated.mockRejectedValue(
				new Error("Database error"),
			);

			const caller = inboxRouter.createCaller(mockContext);

			// Act & Assert
			await expect(caller.getChats({})).rejects.toThrow(
				"Failed to fetch chats",
			);
		});

		it("should validate limit parameter bounds", async () => {
			// Arrange
			const caller = inboxRouter.createCaller(mockContext);

			// Act & Assert - Test minimum bound
			await expect(caller.getChats({ limit: 0 })).rejects.toThrow();

			// Test maximum bound
			await expect(caller.getChats({ limit: 101 })).rejects.toThrow();
		});

		it("should handle chats with various unread counts for filtering tests", async () => {
			// Arrange
			const mixedChats = [
				{ id: "chat1", unread_count: 5, provider: "linkedin" }, // unread
				{ id: "chat2", unread_count: 0, provider: "linkedin" }, // read
				{ id: "chat3", unread_count: 1, provider: "email" }, // unread
				{ id: "chat4", unread_count: 0, provider: "email" }, // read
			];

			mockUnipileChatService.getChatsByUserPaginated.mockResolvedValue({
				chats: mixedChats,
				hasMore: false,
			});

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.getChats({});

			// Assert
			expect(result.chats).toHaveLength(4);
			expect(result.chats.filter((chat) => chat.unread_count > 0)).toHaveLength(
				2,
			); // 2 unread
			expect(
				result.chats.filter((chat) => chat.unread_count === 0),
			).toHaveLength(2); // 2 read
		});
	});
});

describe("inboxRouter - markChatAsRead", () => {
	let mockUnipileChatService: Partial<UnipileChatService>;
	let mockContactLimitService: Partial<ContactLimitService>;
	let mockContext: {
		userId: string;
		services: {
			unipileChatService: Partial<UnipileChatService>;
			contactLimitService: Partial<ContactLimitService>;
		};
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock the chat service
		mockUnipileChatService = {
			getChatWithDetails: vi.fn(),
			markChatAsRead: vi.fn(),
		};

		// Mock the contact limit service
		mockContactLimitService = {
			getContactLimitStatus: vi.fn().mockResolvedValue({
				limit: 100,
				count: 50,
				isExceeded: false,
				remainingContacts: 50,
			}),
			applyContactLimitsToChats: vi
				.fn()
				.mockImplementation((userId, chats) => Promise.resolve(chats)),
		};

		// Mock the context
		mockContext = {
			userId: "test-user-id",
			services: {
				unipileChatService: mockUnipileChatService,
				contactLimitService: mockContactLimitService,
			},
		};
	});

	describe("markChatAsRead mutation", () => {
		it("should successfully mark a chat as read", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };
			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unread_count: 2,
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};
			const mockUnipileResponse = {
				object: "ChatPatched",
				chat_id: "external-chat-id",
				account_id: "linkedin-account-1",
				action: "mark_as_read",
				success: true,
				updated_fields: {
					unread_count: 0,
				},
			};
			const mockUpdatedChat = {
				...mockChatDetails,
				unread_count: 0,
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(
				mockChatDetails,
			);
			mockUnipileService.patchChat.mockResolvedValue(mockUnipileResponse);
			mockUnipileChatService.markChatAsRead.mockResolvedValue(mockUpdatedChat);

			// Create a caller instance
			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.markChatAsRead(input);

			// Assert
			expect(mockUnipileChatService.getChatWithDetails).toHaveBeenCalledWith(
				"test-chat-id",
			);
			expect(mockUnipileService.patchChat).toHaveBeenCalledWith(
				"external-chat-id",
				{ action: "setReadStatus", value: true },
				"linkedin-account-1",
			);
			expect(mockUnipileChatService.markChatAsRead).toHaveBeenCalledWith(
				"test-chat-id",
			);
			expect(result).toEqual({
				success: true,
				message: "Chat marked as read",
				chat: mockUpdatedChat,
				unipileResponse: mockUnipileResponse,
			});
		});

		it("should throw NOT_FOUND error when chat does not exist", async () => {
			// Arrange
			const input = { chatId: "non-existent-chat-id" };
			mockUnipileChatService.getChatWithDetails.mockResolvedValue(null);

			const caller = inboxRouter.createCaller(mockContext);

			// Act & Assert
			await expect(caller.markChatAsRead(input)).rejects.toThrow(
				new TRPCError({
					code: "NOT_FOUND",
					message: "Chat not found",
				}),
			);
			expect(mockUnipileService.patchChat).not.toHaveBeenCalled();
			expect(mockUnipileChatService.markChatAsRead).not.toHaveBeenCalled();
		});

		it("should throw FORBIDDEN error when user does not own the chat", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };
			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unread_count: 2,
				unipileAccount: {
					id: "account-1",
					user_id: "different-user-id", // Different from context user
					account_id: "linkedin-account-1",
				},
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(
				mockChatDetails,
			);

			const caller = inboxRouter.createCaller(mockContext);

			// Act & Assert
			await expect(caller.markChatAsRead(input)).rejects.toThrow(
				new TRPCError({
					code: "FORBIDDEN",
					message: "You can only mark your own chats as read",
				}),
			);
			expect(mockUnipileService.patchChat).not.toHaveBeenCalled();
			expect(mockUnipileChatService.markChatAsRead).not.toHaveBeenCalled();
		});

		it("should return early success message when chat is already read", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };
			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unread_count: 0, // Already read
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(
				mockChatDetails,
			);

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.markChatAsRead(input);

			// Assert
			expect(result).toEqual({
				success: true,
				message: "Chat is already marked as read",
			});
			expect(mockUnipileService.patchChat).not.toHaveBeenCalled();
			expect(mockUnipileChatService.markChatAsRead).not.toHaveBeenCalled();
		});

		it("should handle concurrent mark-as-read requests gracefully", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };
			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unread_count: 3,
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(
				mockChatDetails,
			);
			mockUnipileService.patchChat.mockResolvedValue({
				success: true,
				object: "ChatPatched",
			});
			mockUnipileChatService.markChatAsRead.mockResolvedValue({
				...mockChatDetails,
				unread_count: 0,
			});

			const caller = inboxRouter.createCaller(mockContext);

			// Act - Simulate concurrent requests
			const promise1 = caller.markChatAsRead(input);
			const promise2 = caller.markChatAsRead(input);

			const [result1, result2] = await Promise.all([promise1, promise2]);

			// Assert - Both should succeed
			expect(result1.success).toBe(true);
			expect(result2.success).toBe(true);
		});

		it("should handle chats with high unread counts", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };
			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unread_count: 999, // High unread count
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(
				mockChatDetails,
			);
			mockUnipileService.patchChat.mockResolvedValue({
				success: true,
				object: "ChatPatched",
			});
			mockUnipileChatService.markChatAsRead.mockResolvedValue({
				...mockChatDetails,
				unread_count: 0,
			});

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			const result = await caller.markChatAsRead(input);

			// Assert
			expect(result.success).toBe(true);
			expect(mockUnipileService.patchChat).toHaveBeenCalledWith(
				"external-chat-id",
				{ action: "setReadStatus", value: true },
				"linkedin-account-1",
			);
		});

		it("should throw BAD_GATEWAY error when Unipile API fails", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };
			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unread_count: 2,
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};
			const mockUnipileResponse = {
				object: "ChatPatched",
				chat_id: "external-chat-id",
				account_id: "linkedin-account-1",
				action: "mark_as_read",
				success: false,
				message: "Chat is read-only",
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(
				mockChatDetails,
			);
			mockUnipileService.patchChat.mockResolvedValue(mockUnipileResponse);
			// Don't mock markChatAsRead as it shouldn't be called due to Unipile failure

			const caller = inboxRouter.createCaller(mockContext);

			// Act & Assert
			await expect(caller.markChatAsRead(input)).rejects.toThrow(
				expect.objectContaining({
					code: "BAD_GATEWAY",
					message: expect.stringContaining("Chat is read-only"),
				}),
			);
			expect(mockUnipileChatService.markChatAsRead).not.toHaveBeenCalled();
		});

		it("should handle Unipile service errors", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };
			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unread_count: 2,
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(
				mockChatDetails,
			);
			mockUnipileService.patchChat.mockRejectedValue(
				new Error("Network error"),
			);

			const caller = inboxRouter.createCaller(mockContext);

			// Act & Assert
			await expect(caller.markChatAsRead(input)).rejects.toThrow(
				expect.objectContaining({
					code: "INTERNAL_SERVER_ERROR",
					message: expect.stringContaining("Failed to mark chat as read"),
				}),
			);
			expect(mockUnipileChatService.markChatAsRead).not.toHaveBeenCalled();
		});

		it("should handle database service errors", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };
			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unread_count: 2,
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};
			const mockUnipileResponse = {
				object: "ChatPatched",
				chat_id: "external-chat-id",
				account_id: "linkedin-account-1",
				action: "mark_as_read",
				success: true,
				updated_fields: {
					unread_count: 0,
				},
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(
				mockChatDetails,
			);
			mockUnipileService.patchChat.mockResolvedValue(mockUnipileResponse);
			mockUnipileChatService.markChatAsRead.mockRejectedValue(
				new Error("Database connection failed"),
			);

			const caller = inboxRouter.createCaller(mockContext);

			// Act & Assert
			await expect(caller.markChatAsRead(input)).rejects.toThrow(
				expect.objectContaining({
					code: "INTERNAL_SERVER_ERROR",
					message: expect.stringContaining("Failed to mark chat as read"),
				}),
			);
		});

		it("should validate input parameters", async () => {
			// Arrange
			const invalidInput = { chatId: "" }; // Empty string should fail validation

			const caller = inboxRouter.createCaller(mockContext);

			// Act & Assert
			await expect(caller.markChatAsRead(invalidInput)).rejects.toThrow();
		});

		it("should create UnipileService with correct configuration", async () => {
			// Arrange
			const input = { chatId: "test-chat-id" };
			const mockChatDetails = {
				id: "test-chat-id",
				external_id: "external-chat-id",
				unread_count: 2,
				unipileAccount: {
					id: "account-1",
					user_id: "test-user-id",
					account_id: "linkedin-account-1",
				},
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(
				mockChatDetails,
			);
			mockUnipileService.patchChat.mockResolvedValue({
				success: true,
				object: "ChatPatched",
				chat_id: "external-chat-id",
				account_id: "linkedin-account-1",
				action: "mark_as_read",
			});
			mockUnipileChatService.markChatAsRead.mockResolvedValue({
				...mockChatDetails,
				unread_count: 0,
			});

			const caller = inboxRouter.createCaller(mockContext);

			// Act
			await caller.markChatAsRead(input);

			// Assert
			expect(mockUnipileService.patchChat).toHaveBeenCalledWith(
				"external-chat-id",
				{ action: "setReadStatus", value: true },
				"linkedin-account-1",
			);
		});
	});
});
