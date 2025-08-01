import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatFolderService } from "../chat-folder.service";
import {
	createMockDrizzleDb,
	createMockSelectQueryBuilder,
	createMockInsertQueryBuilder,
	createMockUpdateQueryBuilder,
	mockDrizzleData,
	type MockDrizzleDb,
} from "../../../test/mocks/drizzle";

// Create mock Drizzle DB
let mockDb: MockDrizzleDb;

describe("ChatFolderService - Drizzle Tests", () => {
	let chatFolderService: ChatFolderService;

	beforeEach(() => {
		vi.clearAllMocks();
		mockDb = createMockDrizzleDb();
		chatFolderService = new ChatFolderService(mockDb);
	});

	describe("createFolder", () => {
		it("should create a new folder successfully", async () => {
			// Arrange
			const userId = "user-123";
			const folderData = {
				name: "Work Chats",
				color: "#3b82f6",
				sort_order: 1,
			};
			const expectedFolder = {
				id: "folder-123",
				user_id: userId,
				name: "Work Chats",
				color: "#3b82f6",
				sort_order: 1,
				is_default: false,
				is_deleted: false,
				created_at: new Date("2024-01-01"),
				updated_at: new Date("2024-01-01"),
			};

			// Mock Drizzle insert
			const insertBuilder = createMockInsertQueryBuilder();
			insertBuilder.returning = vi.fn(() => {
				insertBuilder.then = vi.fn((resolve) => resolve([expectedFolder]));
				return insertBuilder;
			});
			mockDb.insert = vi.fn(() => insertBuilder);

			// Act
			const result = await chatFolderService.createFolder(userId, folderData);

			// Assert
			expect(mockDb.insert).toHaveBeenCalled();
			expect(insertBuilder.values).toHaveBeenCalledWith({
				user_id: userId,
				name: "Work Chats",
				color: "#3b82f6",
				sort_order: 1,
				is_default: false,
			});
			expect(insertBuilder.returning).toHaveBeenCalled();
			expect(result).toEqual(expectedFolder);
		});

		it("should create a default folder when specified", async () => {
			// Arrange
			const userId = "user-123";
			const folderData = {
				name: "All Chats",
				is_default: true,
			};
			const expectedFolder = {
				id: "folder-123",
				user_id: userId,
				name: "All Chats",
				color: undefined,
				sort_order: 0,
				is_default: true,
				is_deleted: false,
				created_at: new Date("2024-01-01"),
				updated_at: new Date("2024-01-01"),
			};

			// Mock Drizzle insert
			const insertBuilder = createMockInsertQueryBuilder();
			insertBuilder.returning = vi.fn(() => {
				insertBuilder.then = vi.fn((resolve) => resolve([expectedFolder]));
				return insertBuilder;
			});
			mockDb.insert = vi.fn(() => insertBuilder);

			// Act
			const result = await chatFolderService.createFolder(userId, folderData);

			// Assert
			expect(mockDb.insert).toHaveBeenCalled();
			expect(insertBuilder.values).toHaveBeenCalledWith({
				user_id: userId,
				name: "All Chats",
				color: undefined,
				sort_order: 0,
				is_default: true,
			});
			expect(result).toEqual(expectedFolder);
		});

		it("should handle database errors gracefully", async () => {
			// Arrange
			const userId = "user-123";
			const folderData = { name: "Test Folder" };
			const dbError = new Error("Database constraint violation");

			// Mock Drizzle insert to throw error
			const insertBuilder = createMockInsertQueryBuilder();
			insertBuilder.returning = vi.fn(() => {
				insertBuilder.then = vi.fn((resolve, reject) => reject(dbError));
				return insertBuilder;
			});
			mockDb.insert = vi.fn(() => insertBuilder);

			// Act & Assert
			await expect(
				chatFolderService.createFolder(userId, folderData),
			).rejects.toThrow("Database constraint violation");
		});
	});

	describe("getFoldersByUser", () => {
		it("should return all folders for a user with default options", async () => {
			// Arrange
			const userId = "user-123";
			const expectedFolders = [
				{
					id: "folder-1",
					user_id: userId,
					name: "All Chats",
					is_default: true,
					sort_order: 0,
					is_deleted: false,
					color: null,
					created_at: new Date("2024-01-01"),
					updated_at: new Date("2024-01-01"),
				},
				{
					id: "folder-2",
					user_id: userId,
					name: "Work",
					is_default: false,
					sort_order: 1,
					is_deleted: false,
					color: "#3b82f6",
					created_at: new Date("2024-01-01"),
					updated_at: new Date("2024-01-01"),
				},
			];

			// Mock Drizzle select
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.orderBy = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve(expectedFolders));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatFolderService.getFoldersByUser(userId);

			// Assert
			expect(mockDb.select).toHaveBeenCalled();
			expect(selectBuilder.from).toHaveBeenCalled();
			expect(selectBuilder.where).toHaveBeenCalled();
			expect(selectBuilder.orderBy).toHaveBeenCalled();
			expect(result).toEqual(expectedFolders);
		});

		it("should include deleted folders when requested", async () => {
			// Arrange
			const userId = "user-123";
			const options = { include_deleted: true };
			const expectedFolders = [
				{
					id: "folder-1",
					user_id: userId,
					name: "Deleted Folder",
					is_deleted: true,
					sort_order: 0,
					color: null,
					is_default: false,
					created_at: new Date("2024-01-01"),
					updated_at: new Date("2024-01-01"),
				},
			];

			// Mock Drizzle select
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.orderBy = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve(expectedFolders));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatFolderService.getFoldersByUser(userId, options);

			// Assert
			expect(mockDb.select).toHaveBeenCalled();
			expect(result).toEqual(expectedFolders);
		});

		it("should return empty array when user has no folders", async () => {
			// Arrange
			const userId = "user-with-no-folders";

			// Mock Drizzle select to return empty array
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.orderBy = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatFolderService.getFoldersByUser(userId);

			// Assert
			expect(result).toEqual([]);
			expect(result).toHaveLength(0);
		});
	});

	describe("getFolderById", () => {
		it("should return folder when it exists and belongs to user", async () => {
			// Arrange
			const folderId = "folder-123";
			const userId = "user-123";
			const expectedFolder = {
				id: folderId,
				user_id: userId,
				name: "Work Folder",
				is_deleted: false,
				color: "#3b82f6",
				sort_order: 1,
				is_default: false,
				created_at: new Date("2024-01-01"),
				updated_at: new Date("2024-01-01"),
			};

			// Mock Drizzle select
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([expectedFolder]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatFolderService.getFolderById(folderId, userId);

			// Assert
			expect(mockDb.select).toHaveBeenCalled();
			expect(selectBuilder.from).toHaveBeenCalled();
			expect(selectBuilder.where).toHaveBeenCalled();
			expect(selectBuilder.limit).toHaveBeenCalledWith(1);
			expect(result).toEqual(expectedFolder);
		});

		it("should return null when folder does not exist", async () => {
			// Arrange
			const folderId = "non-existent-folder";
			const userId = "user-123";

			// Mock Drizzle select to return empty array
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatFolderService.getFolderById(folderId, userId);

			// Assert
			expect(result).toBeNull();
		});
	});

	describe("updateFolder", () => {
		it("should update folder successfully", async () => {
			// Arrange
			const folderId = "folder-123";
			const userId = "user-123";
			const updateData = {
				name: "Updated Folder Name",
				color: "#ef4444",
				sort_order: 5,
			};
			const updatedFolder = {
				id: folderId,
				user_id: userId,
				...updateData,
				is_default: false,
				is_deleted: false,
				created_at: new Date("2024-01-01"),
				updated_at: new Date("2024-01-01"),
			};

			// Mock Drizzle update
			const updateBuilder = createMockUpdateQueryBuilder();
			updateBuilder.returning = vi.fn(() => {
				updateBuilder.then = vi.fn((resolve) => resolve([updatedFolder]));
				return updateBuilder;
			});
			mockDb.update = vi.fn(() => updateBuilder);

			// Act
			const result = await chatFolderService.updateFolder(
				folderId,
				userId,
				updateData,
			);

			// Assert
			expect(mockDb.update).toHaveBeenCalled();
			expect(updateBuilder.set).toHaveBeenCalledWith({
				...updateData,
				updated_at: expect.any(Date),
			});
			expect(updateBuilder.where).toHaveBeenCalled();
			expect(updateBuilder.returning).toHaveBeenCalled();
			expect(result).toEqual(updatedFolder);
		});
	});

	describe("deleteFolder", () => {
		it("should soft delete folder successfully", async () => {
			// Arrange
			const folderId = "folder-123";
			const userId = "user-123";
			const deletedFolder = {
				id: folderId,
				user_id: userId,
				name: "Deleted Folder",
				color: "#3b82f6",
				sort_order: 1,
				is_default: false,
				is_deleted: true,
				created_at: new Date("2024-01-01"),
				updated_at: new Date("2024-01-01"),
			};

			// Mock Drizzle update
			const updateBuilder = createMockUpdateQueryBuilder();
			updateBuilder.returning = vi.fn(() => {
				updateBuilder.then = vi.fn((resolve) => resolve([deletedFolder]));
				return updateBuilder;
			});
			mockDb.update = vi.fn(() => updateBuilder);

			// Act
			const result = await chatFolderService.deleteFolder(folderId, userId);

			// Assert
			expect(mockDb.update).toHaveBeenCalled();
			expect(updateBuilder.set).toHaveBeenCalledWith({
				is_deleted: true,
				updated_at: expect.any(Date),
			});
			expect(updateBuilder.where).toHaveBeenCalled();
			expect(updateBuilder.returning).toHaveBeenCalled();
			expect(result).toEqual(deletedFolder);
		});
	});

	describe("createDefaultFolder", () => {
		it('should create default "All Chats" folder', async () => {
			// Arrange
			const userId = "user-123";
			const expectedFolder = {
				id: "folder-default-123",
				user_id: userId,
				name: "All Chats",
				is_default: true,
				sort_order: 0,
				color: undefined,
				is_deleted: false,
				created_at: new Date("2024-01-01"),
				updated_at: new Date("2024-01-01"),
			};

			// Mock Drizzle insert
			const insertBuilder = createMockInsertQueryBuilder();
			insertBuilder.returning = vi.fn(() => {
				insertBuilder.then = vi.fn((resolve) => resolve([expectedFolder]));
				return insertBuilder;
			});
			mockDb.insert = vi.fn(() => insertBuilder);

			// Act
			const result = await chatFolderService.createDefaultFolder(userId);

			// Assert
			expect(mockDb.insert).toHaveBeenCalled();
			expect(insertBuilder.values).toHaveBeenCalledWith({
				user_id: userId,
				name: "All Chats",
				color: undefined,
				sort_order: 0,
				is_default: true,
			});
			expect(result).toEqual(expectedFolder);
		});
	});
});

describe("ChatFolderService - Folder Assignments (Drizzle)", () => {
	let chatFolderService: ChatFolderService;

	beforeEach(() => {
		vi.clearAllMocks();
		mockDb = createMockDrizzleDb();
		chatFolderService = new ChatFolderService(mockDb);
	});

	describe("assignChatToFolder", () => {
		it("should create new assignment when none exists", async () => {
			// Arrange
			const chatId = "chat-123";
			const folderId = "folder-123";
			const assignedById = "user-123";
			const expectedAssignment = {
				id: "assignment-123",
				chat_id: chatId,
				folder_id: folderId,
				assigned_by_id: assignedById,
				is_deleted: false,
				created_at: new Date("2024-01-01"),
				updated_at: new Date("2024-01-01"),
			};

			// Mock no existing assignment
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Mock insert for new assignment
			const insertBuilder = createMockInsertQueryBuilder();
			insertBuilder.returning = vi.fn(() => {
				insertBuilder.then = vi.fn((resolve) => resolve([expectedAssignment]));
				return insertBuilder;
			});
			mockDb.insert = vi.fn(() => insertBuilder);

			// Act
			const result = await chatFolderService.assignChatToFolder(
				chatId,
				folderId,
				assignedById,
			);

			// Assert
			expect(mockDb.select).toHaveBeenCalled(); // Check for existing assignment
			expect(mockDb.insert).toHaveBeenCalled(); // Create new assignment
			expect(insertBuilder.values).toHaveBeenCalledWith({
				chat_id: chatId,
				folder_id: folderId,
				assigned_by_id: assignedById,
			});
			expect(result).toEqual(expectedAssignment);
		});

		it("should update existing assignment (restore if soft-deleted)", async () => {
			// Arrange
			const chatId = "chat-123";
			const folderId = "folder-123";
			const assignedById = "user-123";
			const existingAssignment = {
				id: "assignment-123",
				chat_id: chatId,
				folder_id: folderId,
				assigned_by_id: "old-user",
				is_deleted: true,
				created_at: new Date("2024-01-01"),
				updated_at: new Date("2024-01-01"),
			};
			const updatedAssignment = {
				...existingAssignment,
				assigned_by_id: assignedById,
				is_deleted: false,
				updated_at: new Date("2024-01-01"),
			};

			// Mock existing assignment found
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([existingAssignment]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Mock update
			const updateBuilder = createMockUpdateQueryBuilder();
			updateBuilder.returning = vi.fn(() => {
				updateBuilder.then = vi.fn((resolve) => resolve([updatedAssignment]));
				return updateBuilder;
			});
			mockDb.update = vi.fn(() => updateBuilder);

			// Act
			const result = await chatFolderService.assignChatToFolder(
				chatId,
				folderId,
				assignedById,
			);

			// Assert
			expect(mockDb.select).toHaveBeenCalled(); // Check for existing
			expect(mockDb.update).toHaveBeenCalled(); // Update existing
			expect(updateBuilder.set).toHaveBeenCalledWith({
				is_deleted: false,
				assigned_by_id: assignedById,
				updated_at: expect.any(Date),
			});
			expect(result).toEqual(updatedAssignment);
		});
	});

	describe("isChatInFolder", () => {
		it("should return true when chat is in folder", async () => {
			// Arrange
			const chatId = "chat-123";
			const folderId = "folder-123";
			const existingAssignment = {
				id: "assignment-123",
				chat_id: chatId,
				folder_id: folderId,
				is_deleted: false,
				assigned_by_id: "user-123",
				created_at: new Date("2024-01-01"),
				updated_at: new Date("2024-01-01"),
			};

			// Mock select to find assignment
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([existingAssignment]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatFolderService.isChatInFolder(chatId, folderId);

			// Assert
			expect(mockDb.select).toHaveBeenCalled();
			expect(selectBuilder.from).toHaveBeenCalled();
			expect(selectBuilder.where).toHaveBeenCalled();
			expect(selectBuilder.limit).toHaveBeenCalledWith(1);
			expect(result).toBe(true);
		});

		it("should return false when chat is not in folder", async () => {
			// Arrange
			const chatId = "chat-123";
			const folderId = "folder-123";

			// Mock select to return no assignment
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatFolderService.isChatInFolder(chatId, folderId);

			// Assert
			expect(result).toBe(false);
		});
	});
});
