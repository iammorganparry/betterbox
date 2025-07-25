import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { inboxRouter } from "../inbox";

// Mock services
const mockChatFolderService = {
	getFoldersWithChatCounts: vi.fn(),
	createFolder: vi.fn(),
	updateFolder: vi.fn(),
	deleteFolder: vi.fn(),
	getFolderById: vi.fn(),
	assignChatToFolder: vi.fn(),
	removeChatFromFolder: vi.fn(),
	getChatsInFolder: vi.fn(),
	getChatFolders: vi.fn(),
	isChatInFolder: vi.fn(),
};

const mockUnipileChatService = {
	getChatWithDetails: vi.fn(),
};

// Create mock context
const createMockContext = (userId: string | null = "user-123") => ({
	db: {} as any,
	auth: { userId },
	userId,
	services: {
		chatFolderService: mockChatFolderService,
		unipileChatService: mockUnipileChatService,
	},
	headers: new Headers(),
});

describe("inboxRouter - Folder Management", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getFolders", () => {
		it("should return user folders with chat counts", async () => {
			// Arrange
			const ctx = createMockContext();
			const expectedFolders = [
				{
					id: "folder-1",
					user_id: "user-123",
					name: "All Chats",
					is_default: true,
					sort_order: 0,
					chat_count: 15,
				},
				{
					id: "folder-2",
					user_id: "user-123",
					name: "Work",
					is_default: false,
					sort_order: 1,
					chat_count: 8,
				},
				{
					id: "folder-3",
					user_id: "user-123",
					name: "Personal",
					is_default: false,
					sort_order: 2,
					chat_count: 3,
				},
			];

			mockChatFolderService.getFoldersWithChatCounts.mockResolvedValue(
				expectedFolders,
			);

			const caller = inboxRouter.createCaller(ctx);

			// Act
			const result = await caller.getFolders();

			// Assert
			expect(
				mockChatFolderService.getFoldersWithChatCounts,
			).toHaveBeenCalledWith("user-123");
			expect(result).toEqual(expectedFolders);
		});

		it("should return empty array when user has no folders", async () => {
			// Arrange
			const ctx = createMockContext();
			mockChatFolderService.getFoldersWithChatCounts.mockResolvedValue([]);

			const caller = inboxRouter.createCaller(ctx);

			// Act
			const result = await caller.getFolders();

			// Assert
			expect(result).toEqual([]);
			expect(result).toHaveLength(0);
		});

		it("should throw INTERNAL_SERVER_ERROR when database operation fails", async () => {
			// Arrange
			const ctx = createMockContext();
			mockChatFolderService.getFoldersWithChatCounts.mockRejectedValue(
				new Error("Database error"),
			);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.getFolders()).rejects.toThrow(
				"Failed to fetch folders",
			);
		});

		it("should throw UNAUTHORIZED when user not authenticated", async () => {
			// Arrange
			const ctx = createMockContext(null);
			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.getFolders()).rejects.toThrow("UNAUTHORIZED");
		});
	});

	describe("createFolder", () => {
		it("should create folder successfully", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = {
				name: "Important Clients",
				color: "#ef4444",
			};
			const expectedFolder = {
				id: "folder-new-123",
				user_id: "user-123",
				name: "Important Clients",
				color: "#ef4444",
				sort_order: 0,
				is_default: false,
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			};

			mockChatFolderService.createFolder.mockResolvedValue(expectedFolder);

			const caller = inboxRouter.createCaller(ctx);

			// Act
			const result = await caller.createFolder(input);

			// Assert
			expect(mockChatFolderService.createFolder).toHaveBeenCalledWith(
				"user-123",
				input,
			);
			expect(result).toEqual(expectedFolder);
		});

		it("should create folder without color", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = { name: "Simple Folder" };

			mockChatFolderService.createFolder.mockResolvedValue({});

			const caller = inboxRouter.createCaller(ctx);

			// Act
			await caller.createFolder(input);

			// Assert
			expect(mockChatFolderService.createFolder).toHaveBeenCalledWith(
				"user-123",
				input,
			);
		});

		it("should validate folder name length", async () => {
			// Arrange
			const ctx = createMockContext();
			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert - Test empty name
			await expect(caller.createFolder({ name: "" })).rejects.toThrow();

			// Test name too long
			const longName = "a".repeat(51); // 51 characters
			await expect(caller.createFolder({ name: longName })).rejects.toThrow();
		});

		it("should handle duplicate folder name error", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = { name: "Existing Folder" };
			const duplicateError = new Error("Unique constraint violation");

			mockChatFolderService.createFolder.mockRejectedValue(duplicateError);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.createFolder(input)).rejects.toThrow(
				"Failed to create folder",
			);
		});
	});

	describe("updateFolder", () => {
		it("should update folder successfully", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = {
				folderId: "folder-123",
				name: "Updated Name",
				color: "#10b981",
				sort_order: 5,
			};
			const updatedFolder = {
				id: "folder-123",
				user_id: "user-123",
				name: "Updated Name",
				color: "#10b981",
				sort_order: 5,
				updated_at: new Date(),
			};

			mockChatFolderService.updateFolder.mockResolvedValue(updatedFolder);

			const caller = inboxRouter.createCaller(ctx);

			// Act
			const result = await caller.updateFolder(input);

			// Assert
			expect(mockChatFolderService.updateFolder).toHaveBeenCalledWith(
				"folder-123",
				"user-123",
				{
					name: "Updated Name",
					color: "#10b981",
					sort_order: 5,
				},
			);
			expect(result).toEqual(updatedFolder);
		});

		it("should update folder with partial data", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = {
				folderId: "folder-123",
				name: "New Name Only",
			};

			mockChatFolderService.updateFolder.mockResolvedValue({});

			const caller = inboxRouter.createCaller(ctx);

			// Act
			await caller.updateFolder(input);

			// Assert
			expect(mockChatFolderService.updateFolder).toHaveBeenCalledWith(
				"folder-123",
				"user-123",
				{
					name: "New Name Only",
				},
			);
		});

		it("should validate folder name when provided", async () => {
			// Arrange
			const ctx = createMockContext();
			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(
				caller.updateFolder({
					folderId: "folder-123",
					name: "", // Empty name
				}),
			).rejects.toThrow();

			await expect(
				caller.updateFolder({
					folderId: "folder-123",
					name: "a".repeat(51), // Too long
				}),
			).rejects.toThrow();
		});

		it("should handle folder not found error", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = {
				folderId: "non-existent-folder",
				name: "New Name",
			};
			const notFoundError = new Error("Folder not found");

			mockChatFolderService.updateFolder.mockRejectedValue(notFoundError);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.updateFolder(input)).rejects.toThrow(
				"Failed to update folder",
			);
		});
	});

	describe("deleteFolder", () => {
		it("should delete folder successfully", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = { folderId: "folder-123" };
			const deletedFolder = {
				id: "folder-123",
				user_id: "user-123",
				is_deleted: true,
				updated_at: new Date(),
			};

			mockChatFolderService.deleteFolder.mockResolvedValue(deletedFolder);

			const caller = inboxRouter.createCaller(ctx);

			// Act
			const result = await caller.deleteFolder(input);

			// Assert
			expect(mockChatFolderService.deleteFolder).toHaveBeenCalledWith(
				"folder-123",
				"user-123",
			);
			expect(result).toEqual(deletedFolder);
		});

		it("should handle folder not found error", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = { folderId: "non-existent-folder" };
			const notFoundError = new Error("Folder not found");

			mockChatFolderService.deleteFolder.mockRejectedValue(notFoundError);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.deleteFolder(input)).rejects.toThrow(
				"Failed to delete folder",
			);
		});
	});
});

describe("inboxRouter - Chat Folder Assignments", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("assignChatToFolder", () => {
		it("should assign chat to folder successfully", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = {
				chatId: "chat-123",
				folderId: "folder-123",
			};
			const mockChat = {
				id: "chat-123",
				external_id: "ext-chat-123",
				unipile_account: {
					user_id: "user-123",
				},
			};
			const mockFolder = {
				id: "folder-123",
				user_id: "user-123",
				name: "Work Folder",
			};
			const expectedAssignment = {
				id: "assignment-123",
				chat_id: "chat-123",
				folder_id: "folder-123",
				assigned_by_id: "user-123",
				created_at: new Date(),
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChat);
			mockChatFolderService.getFolderById.mockResolvedValue(mockFolder);
			mockChatFolderService.isChatInFolder.mockResolvedValue(false);
			mockChatFolderService.assignChatToFolder.mockResolvedValue(
				expectedAssignment,
			);

			const caller = inboxRouter.createCaller(ctx);

			// Act
			const result = await caller.assignChatToFolder(input);

			// Assert
			expect(mockUnipileChatService.getChatWithDetails).toHaveBeenCalledWith(
				"chat-123",
			);
			expect(mockChatFolderService.getFolderById).toHaveBeenCalledWith(
				"folder-123",
				"user-123",
			);
			expect(mockChatFolderService.isChatInFolder).toHaveBeenCalledWith(
				"chat-123",
				"folder-123",
			);
			expect(mockChatFolderService.assignChatToFolder).toHaveBeenCalledWith(
				"chat-123",
				"folder-123",
				"user-123",
			);
			expect(result).toEqual({
				assignment: expectedAssignment,
				wasAlreadyInFolder: false,
				message: "Chat assigned to folder successfully",
			});
		});

		it("should throw NOT_FOUND when chat does not exist", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = {
				chatId: "non-existent-chat",
				folderId: "folder-123",
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(null);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.assignChatToFolder(input)).rejects.toThrow(
				new TRPCError({
					code: "NOT_FOUND",
					message: "Chat not found",
				}),
			);
			expect(mockChatFolderService.getFolderById).not.toHaveBeenCalled();
			expect(mockChatFolderService.assignChatToFolder).not.toHaveBeenCalled();
		});

		it("should throw FORBIDDEN when user does not own the chat", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = {
				chatId: "chat-123",
				folderId: "folder-123",
			};
			const mockChat = {
				id: "chat-123",
				unipile_account: {
					user_id: "other-user-456", // Different user
				},
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChat);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.assignChatToFolder(input)).rejects.toThrow(
				new TRPCError({
					code: "FORBIDDEN",
					message: "You can only assign your own chats",
				}),
			);
			expect(mockChatFolderService.getFolderById).not.toHaveBeenCalled();
			expect(mockChatFolderService.assignChatToFolder).not.toHaveBeenCalled();
		});

		it("should throw NOT_FOUND when folder does not exist", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = {
				chatId: "chat-123",
				folderId: "non-existent-folder",
			};
			const mockChat = {
				id: "chat-123",
				unipile_account: {
					user_id: "user-123",
				},
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChat);
			mockChatFolderService.getFolderById.mockResolvedValue(null);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.assignChatToFolder(input)).rejects.toThrow(
				new TRPCError({
					code: "NOT_FOUND",
					message: "Folder not found",
				}),
			);
			expect(mockChatFolderService.assignChatToFolder).not.toHaveBeenCalled();
		});

		it("should handle duplicate assignment error", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = {
				chatId: "chat-123",
				folderId: "folder-123",
			};
			const mockChat = {
				id: "chat-123",
				unipile_account: { user_id: "user-123" },
			};
			const mockFolder = {
				id: "folder-123",
				user_id: "user-123",
			};
			const duplicateError = new Error("Unique constraint violation");

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChat);
			mockChatFolderService.getFolderById.mockResolvedValue(mockFolder);
			mockChatFolderService.assignChatToFolder.mockRejectedValue(
				duplicateError,
			);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.assignChatToFolder(input)).rejects.toThrow(
				"Failed to assign chat to folder",
			);
		});
	});

	describe("removeChatFromFolder", () => {
		it("should remove chat from folder successfully", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = {
				chatId: "chat-123",
				folderId: "folder-123",
			};
			const updatedAssignment = {
				id: "assignment-123",
				chat_id: "chat-123",
				folder_id: "folder-123",
				is_deleted: true,
				updated_at: new Date(),
			};

			mockChatFolderService.removeChatFromFolder.mockResolvedValue(
				updatedAssignment,
			);

			const caller = inboxRouter.createCaller(ctx);

			// Act
			const result = await caller.removeChatFromFolder(input);

			// Assert
			expect(mockChatFolderService.removeChatFromFolder).toHaveBeenCalledWith(
				"chat-123",
				"folder-123",
			);
			expect(result).toEqual(updatedAssignment);
		});

		it("should handle assignment not found error", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = {
				chatId: "chat-123",
				folderId: "folder-123",
			};
			const notFoundError = new Error("Assignment not found");

			mockChatFolderService.removeChatFromFolder.mockRejectedValue(
				notFoundError,
			);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.removeChatFromFolder(input)).rejects.toThrow(
				"Failed to remove chat from folder",
			);
		});
	});

	describe("getChatsInFolder", () => {
		it("should return chats in folder successfully", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = { folderId: "folder-123" };
			const mockFolder = {
				id: "folder-123",
				user_id: "user-123",
				name: "Work Folder",
			};
			const expectedAssignments = [
				{
					id: "assignment-1",
					folder_id: "folder-123",
					chat: {
						id: "chat-1",
						external_id: "ext-chat-1",
						provider: "linkedin",
						unread_count: 2,
						UnipileChatAttendee: [
							{
								id: "attendee-1",
								contact: {
									full_name: "John Doe",
								},
							},
						],
						UnipileMessage: [
							{
								id: "msg-1",
								content: "Hello",
							},
						],
					},
				},
				{
					id: "assignment-2",
					folder_id: "folder-123",
					chat: {
						id: "chat-2",
						external_id: "ext-chat-2",
						provider: "linkedin",
						unread_count: 0,
						UnipileChatAttendee: [],
						UnipileMessage: [],
					},
				},
			];

			mockChatFolderService.getFolderById.mockResolvedValue(mockFolder);
			mockChatFolderService.getChatsInFolder.mockResolvedValue(
				expectedAssignments,
			);

			const caller = inboxRouter.createCaller(ctx);

			// Act
			const result = await caller.getChatsInFolder(input);

			// Assert
			expect(mockChatFolderService.getFolderById).toHaveBeenCalledWith(
				"folder-123",
				"user-123",
			);
			expect(mockChatFolderService.getChatsInFolder).toHaveBeenCalledWith(
				"folder-123",
			);
			expect(result).toEqual(expectedAssignments);
		});

		it("should throw NOT_FOUND when folder does not exist", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = { folderId: "non-existent-folder" };

			mockChatFolderService.getFolderById.mockResolvedValue(null);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.getChatsInFolder(input)).rejects.toThrow(
				new TRPCError({
					code: "NOT_FOUND",
					message: "Folder not found",
				}),
			);
			expect(mockChatFolderService.getChatsInFolder).not.toHaveBeenCalled();
		});

		it("should return empty array when folder has no chats", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = { folderId: "empty-folder-123" };
			const mockFolder = {
				id: "empty-folder-123",
				user_id: "user-123",
				name: "Empty Folder",
			};

			mockChatFolderService.getFolderById.mockResolvedValue(mockFolder);
			mockChatFolderService.getChatsInFolder.mockResolvedValue([]);

			const caller = inboxRouter.createCaller(ctx);

			// Act
			const result = await caller.getChatsInFolder(input);

			// Assert
			expect(result).toEqual([]);
			expect(result).toHaveLength(0);
		});
	});

	describe("getChatFolders", () => {
		it("should return folders for a chat successfully", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = { chatId: "chat-123" };
			const mockChat = {
				id: "chat-123",
				unipile_account: {
					user_id: "user-123",
				},
			};
			const expectedAssignments = [
				{
					id: "assignment-1",
					chat_id: "chat-123",
					folder: {
						id: "folder-1",
						name: "Work",
						color: "#3b82f6",
					},
				},
				{
					id: "assignment-2",
					chat_id: "chat-123",
					folder: {
						id: "folder-2",
						name: "Important",
						color: "#ef4444",
					},
				},
			];

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChat);
			mockChatFolderService.getChatFolders.mockResolvedValue(
				expectedAssignments,
			);

			const caller = inboxRouter.createCaller(ctx);

			// Act
			const result = await caller.getChatFolders(input);

			// Assert
			expect(mockUnipileChatService.getChatWithDetails).toHaveBeenCalledWith(
				"chat-123",
			);
			expect(mockChatFolderService.getChatFolders).toHaveBeenCalledWith(
				"chat-123",
			);
			expect(result).toEqual(expectedAssignments);
		});

		it("should throw NOT_FOUND when chat does not exist", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = { chatId: "non-existent-chat" };

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(null);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.getChatFolders(input)).rejects.toThrow(
				new TRPCError({
					code: "NOT_FOUND",
					message: "Chat not found",
				}),
			);
			expect(mockChatFolderService.getChatFolders).not.toHaveBeenCalled();
		});

		it("should throw FORBIDDEN when user does not own the chat", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = { chatId: "chat-123" };
			const mockChat = {
				id: "chat-123",
				unipile_account: {
					user_id: "other-user-456", // Different user
				},
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChat);

			const caller = inboxRouter.createCaller(ctx);

			// Act & Assert
			await expect(caller.getChatFolders(input)).rejects.toThrow(
				new TRPCError({
					code: "FORBIDDEN",
					message: "You can only view your own chats",
				}),
			);
			expect(mockChatFolderService.getChatFolders).not.toHaveBeenCalled();
		});

		it("should return empty array when chat has no folder assignments", async () => {
			// Arrange
			const ctx = createMockContext();
			const input = { chatId: "unorganized-chat-123" };
			const mockChat = {
				id: "unorganized-chat-123",
				unipile_account: {
					user_id: "user-123",
				},
			};

			mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChat);
			mockChatFolderService.getChatFolders.mockResolvedValue([]);

			const caller = inboxRouter.createCaller(ctx);

			// Act
			const result = await caller.getChatFolders(input);

			// Assert
			expect(result).toEqual([]);
			expect(result).toHaveLength(0);
		});
	});
});
