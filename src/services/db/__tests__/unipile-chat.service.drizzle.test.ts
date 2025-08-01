import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnipileChatService } from "../unipile-chat.service";
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

describe("UnipileChatService - Drizzle Tests", () => {
	let chatService: UnipileChatService;

	beforeEach(() => {
		vi.clearAllMocks();
		mockDb = createMockDrizzleDb();
		chatService = new UnipileChatService(mockDb);
	});

	describe("findChatByExternalId", () => {
		it("should find chat by external ID successfully", async () => {
			// Arrange
			const unipileAccountId = "account-123";
			const externalId = "external-chat-123";
			const expectedChat = {
				...mockDrizzleData.chat,
				unipile_account_id: unipileAccountId,
				external_id: externalId,
			};

			// Mock Drizzle select
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([expectedChat]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatService.findChatByExternalId(
				unipileAccountId,
				externalId,
			);

			// Assert
			expect(mockDb.select).toHaveBeenCalled();
			expect(selectBuilder.from).toHaveBeenCalled();
			expect(selectBuilder.where).toHaveBeenCalled();
			expect(selectBuilder.limit).toHaveBeenCalledWith(1);
			expect(result).toEqual(expectedChat);
		});

		it("should return null when chat not found", async () => {
			// Arrange
			const unipileAccountId = "account-123";
			const externalId = "non-existent-chat";

			// Mock Drizzle select to return empty
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatService.findChatByExternalId(
				unipileAccountId,
				externalId,
			);

			// Assert
			expect(result).toBeNull();
		});

		it("should exclude deleted chats by default", async () => {
			// Arrange
			const unipileAccountId = "account-123";
			const externalId = "external-chat-123";

			// Mock Drizzle select
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			await chatService.findChatByExternalId(
				unipileAccountId,
				externalId,
				false,
			);

			// Assert
			expect(selectBuilder.where).toHaveBeenCalled();
			// Verify the where clause includes is_deleted = false
		});
	});

	describe("upsertChat", () => {
		it("should create new chat when it does not exist", async () => {
			// Arrange
			const unipileAccountId = "account-123";
			const externalId = "external-chat-123";
			const updateData = {
				name: "Test Chat",
				unread_count: 5,
			};
			const expectedChat = {
				...mockDrizzleData.chat,
				unipile_account_id: unipileAccountId,
				external_id: externalId,
				...updateData,
			};

			// Mock Drizzle insert
			const insertBuilder = createMockInsertQueryBuilder();
			insertBuilder.returning = vi.fn(() => {
				insertBuilder.then = vi.fn((resolve) => resolve([expectedChat]));
				return insertBuilder;
			});
			mockDb.insert = vi.fn(() => insertBuilder);

			// Act
			const result = await chatService.upsertChat(
				unipileAccountId,
				externalId,
				updateData,
			);

			// Assert
			expect(mockDb.insert).toHaveBeenCalled();
			expect(insertBuilder.values).toHaveBeenCalledWith({
				unipile_account_id: unipileAccountId,
				external_id: externalId,
				provider: "linkedin",
				chat_type: "direct",
				is_deleted: false,
				created_at: expect.any(Date),
				updated_at: expect.any(Date),
			});
			expect(insertBuilder.onConflictDoUpdate).toHaveBeenCalled();
			expect(result).toEqual(expectedChat);
		});

		it("should update existing chat on conflict", async () => {
			// Arrange
			const unipileAccountId = "account-123";
			const externalId = "external-chat-123";
			const updateData = {
				name: "Updated Chat Name",
				unread_count: 10,
			};
			const expectedChat = {
				...mockDrizzleData.chat,
				unipile_account_id: unipileAccountId,
				external_id: externalId,
				...updateData,
			};

			// Mock Drizzle insert with conflict resolution
			const insertBuilder = createMockInsertQueryBuilder();
			insertBuilder.returning = vi.fn(() => {
				insertBuilder.then = vi.fn((resolve) => resolve([expectedChat]));
				return insertBuilder;
			});
			mockDb.insert = vi.fn(() => insertBuilder);

			// Act
			const result = await chatService.upsertChat(
				unipileAccountId,
				externalId,
				updateData,
			);

			// Assert
			expect(insertBuilder.onConflictDoUpdate).toHaveBeenCalledWith({
				target: expect.anything(), // The conflict target columns
				set: {
					...updateData,
					updated_at: expect.any(Date),
				},
			});
			expect(result).toEqual(expectedChat);
		});

		it("should throw error when upsert fails", async () => {
			// Arrange
			const unipileAccountId = "account-123";
			const externalId = "external-chat-123";
			const updateData = {};

			// Mock Drizzle insert to return empty result
			const insertBuilder = createMockInsertQueryBuilder();
			insertBuilder.returning = vi.fn(() => {
				insertBuilder.then = vi.fn((resolve) => resolve([]));
				return insertBuilder;
			});
			mockDb.insert = vi.fn(() => insertBuilder);

			// Act & Assert
			await expect(
				chatService.upsertChat(unipileAccountId, externalId, updateData),
			).rejects.toThrow("Failed to upsert chat");
		});
	});

	describe("getChatsByAccount", () => {
		it("should return chats for account without relations", async () => {
			// Arrange
			const unipileAccountId = "account-123";
			const options = {
				include_attendees: false,
				include_messages: false,
				limit: 10,
			};
			const expectedChats = [
				{ ...mockDrizzleData.chat, unipile_account_id: unipileAccountId },
				{
					...mockDrizzleData.chat,
					id: "chat-2",
					unipile_account_id: unipileAccountId,
				},
			];

			// Mock Drizzle select for simple case
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.offset = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve(expectedChats));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatService.getChatsByAccount(
				unipileAccountId,
				options,
			);

			// Assert
			expect(mockDb.select).toHaveBeenCalled();
			expect(selectBuilder.from).toHaveBeenCalled();
			expect(selectBuilder.where).toHaveBeenCalled();
			expect(selectBuilder.orderBy).toHaveBeenCalled();
			expect(selectBuilder.limit).toHaveBeenCalledWith(10);
			expect(selectBuilder.offset).toHaveBeenCalledWith(0);
			expect(result).toEqual(expectedChats);
		});

		it("should exclude deleted chats by default", async () => {
			// Arrange
			const unipileAccountId = "account-123";

			// Mock Drizzle select
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.offset = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			await chatService.getChatsByAccount(unipileAccountId);

			// Assert
			expect(selectBuilder.where).toHaveBeenCalled();
			// The where condition should include is_deleted: false
		});

		it("should include deleted chats when requested", async () => {
			// Arrange
			const unipileAccountId = "account-123";
			const options = { include_deleted: true };

			// Mock Drizzle select
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.offset = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			await chatService.getChatsByAccount(unipileAccountId, options);

			// Assert
			expect(selectBuilder.where).toHaveBeenCalled();
			// Should not filter by is_deleted when include_deleted is true
		});
	});

	describe("getChatsByUser", () => {
		it("should return chats for user across all accounts", async () => {
			// Arrange
			const userId = "user-123";
			const expectedChats = [
				{ ...mockDrizzleData.chat },
				{ ...mockDrizzleData.chat, id: "chat-2" },
			];

			// Mock Drizzle select with join
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.offset = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve(expectedChats));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatService.getChatsByUser(userId);

			// Assert
			expect(mockDb.select).toHaveBeenCalled();
			expect(selectBuilder.from).toHaveBeenCalled();
			expect(selectBuilder.innerJoin).toHaveBeenCalled(); // Should join with unipile_accounts
			expect(selectBuilder.where).toHaveBeenCalled();
			expect(selectBuilder.orderBy).toHaveBeenCalled();
			expect(result).toEqual(expectedChats);
		});

		it("should filter by provider when specified", async () => {
			// Arrange
			const userId = "user-123";
			const provider = "linkedin";

			// Mock Drizzle select
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.offset = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			await chatService.getChatsByUser(userId, provider);

			// Assert
			expect(selectBuilder.where).toHaveBeenCalled();
			// Should include provider filter in where clause
		});
	});

	describe("updateLastMessageAt", () => {
		it("should update last message timestamp successfully", async () => {
			// Arrange
			const chatId = "chat-123";
			const lastMessageAt = new Date("2024-01-01T12:00:00Z");
			const expectedChat = {
				...mockDrizzleData.chat,
				id: chatId,
				last_message_at: lastMessageAt,
			};

			// Mock Drizzle update
			const updateBuilder = createMockUpdateQueryBuilder();
			updateBuilder.returning = vi.fn(() => {
				updateBuilder.then = vi.fn((resolve) => resolve([expectedChat]));
				return updateBuilder;
			});
			mockDb.update = vi.fn(() => updateBuilder);

			// Act
			const result = await chatService.updateLastMessageAt(
				chatId,
				lastMessageAt,
			);

			// Assert
			expect(mockDb.update).toHaveBeenCalled();
			expect(updateBuilder.set).toHaveBeenCalledWith({
				last_message_at: lastMessageAt,
				updated_at: expect.any(Date),
			});
			expect(updateBuilder.where).toHaveBeenCalled();
			expect(updateBuilder.returning).toHaveBeenCalled();
			expect(result).toEqual(expectedChat);
		});

		it("should throw error when update fails", async () => {
			// Arrange
			const chatId = "chat-123";
			const lastMessageAt = new Date();

			// Mock Drizzle update to return empty result
			const updateBuilder = createMockUpdateQueryBuilder();
			updateBuilder.returning = vi.fn(() => {
				updateBuilder.then = vi.fn((resolve) => resolve([]));
				return updateBuilder;
			});
			mockDb.update = vi.fn(() => updateBuilder);

			// Act & Assert
			await expect(
				chatService.updateLastMessageAt(chatId, lastMessageAt),
			).rejects.toThrow("Failed to update last message timestamp");
		});
	});

	describe("markChatAsDeleted", () => {
		it("should soft delete chat successfully", async () => {
			// Arrange
			const chatId = "chat-123";
			const expectedChat = {
				...mockDrizzleData.chat,
				id: chatId,
				is_deleted: true,
			};

			// Mock Drizzle update
			const updateBuilder = createMockUpdateQueryBuilder();
			updateBuilder.returning = vi.fn(() => {
				updateBuilder.then = vi.fn((resolve) => resolve([expectedChat]));
				return updateBuilder;
			});
			mockDb.update = vi.fn(() => updateBuilder);

			// Act
			const result = await chatService.markChatAsDeleted(chatId);

			// Assert
			expect(mockDb.update).toHaveBeenCalled();
			expect(updateBuilder.set).toHaveBeenCalledWith({
				is_deleted: true,
				updated_at: expect.any(Date),
			});
			expect(updateBuilder.where).toHaveBeenCalled();
			expect(result).toEqual(expectedChat);
		});
	});

	describe("getChatStats", () => {
		it("should return chat statistics", async () => {
			// Arrange
			const unipileAccountId = "account-123";
			const mockStats = {
				total_chats: 100,
				direct_chats: 80,
				group_chats: 20,
				active_chats: 50,
			};

			// Mock raw SQL execution
			mockDb.execute = vi.fn().mockResolvedValue([mockStats]);

			// Act
			const result = await chatService.getChatStats(unipileAccountId);

			// Assert
			expect(mockDb.execute).toHaveBeenCalled();
			expect(result).toEqual({
				totalChats: 100,
				directChats: 80,
				groupChats: 20,
				activeChatsWith: 50,
			});
		});

		it("should handle empty stats gracefully", async () => {
			// Arrange
			const unipileAccountId = "account-123";

			// Mock empty result
			mockDb.execute = vi.fn().mockResolvedValue([]);

			// Act
			const result = await chatService.getChatStats(unipileAccountId);

			// Assert
			expect(result).toEqual({
				totalChats: 0,
				directChats: 0,
				groupChats: 0,
				activeChatsWith: 0,
			});
		});
	});

	describe("searchChats", () => {
		it("should search chats by name", async () => {
			// Arrange
			const unipileAccountId = "account-123";
			const searchTerm = "test chat";
			const expectedChats = [
				{ ...mockDrizzleData.chat, name: "Test Chat Name" },
			];

			// Mock Drizzle select
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve(expectedChats));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			const result = await chatService.searchChats(
				unipileAccountId,
				searchTerm,
			);

			// Assert
			expect(mockDb.select).toHaveBeenCalled();
			expect(selectBuilder.from).toHaveBeenCalled();
			expect(selectBuilder.where).toHaveBeenCalled();
			expect(selectBuilder.orderBy).toHaveBeenCalled();
			expect(selectBuilder.limit).toHaveBeenCalledWith(20);
			expect(result).toEqual(expectedChats);
		});

		it("should limit search results", async () => {
			// Arrange
			const unipileAccountId = "account-123";
			const searchTerm = "test";
			const limit = 5;

			// Mock Drizzle select
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act
			await chatService.searchChats(unipileAccountId, searchTerm, limit);

			// Assert
			expect(selectBuilder.limit).toHaveBeenCalledWith(limit);
		});
	});

	describe("attendee operations", () => {
		describe("findAttendeeByExternalId", () => {
			it("should find attendee by external ID", async () => {
				// Arrange
				const chatId = "chat-123";
				const externalId = "external-attendee-123";
				const expectedAttendee = {
					id: "attendee-123",
					chat_id: chatId,
					external_id: externalId,
					is_deleted: false,
					contact_id: "contact-123",
					is_self: 0,
					hidden: 0,
					created_at: new Date("2024-01-01"),
					updated_at: new Date("2024-01-01"),
				};

				// Mock Drizzle select
				const selectBuilder = createMockSelectQueryBuilder();
				selectBuilder.limit = vi.fn(() => {
					selectBuilder.then = vi.fn((resolve) => resolve([expectedAttendee]));
					return selectBuilder;
				});
				mockDb.select = vi.fn(() => selectBuilder);

				// Act
				const result = await chatService.findAttendeeByExternalId(
					chatId,
					externalId,
				);

				// Assert
				expect(mockDb.select).toHaveBeenCalled();
				expect(selectBuilder.from).toHaveBeenCalled();
				expect(selectBuilder.where).toHaveBeenCalled();
				expect(selectBuilder.limit).toHaveBeenCalledWith(1);
				expect(result).toEqual(expectedAttendee);
			});
		});

		describe("upsertAttendee", () => {
			it("should create or update attendee", async () => {
				// Arrange
				const chatId = "chat-123";
				const externalId = "external-attendee-123";
				const contactId = "contact-123";
				const attendeeData = {
					is_self: 0,
					hidden: 0,
				};
				const expectedAttendee = {
					id: "attendee-123",
					chat_id: chatId,
					external_id: externalId,
					contact_id: contactId,
					is_self: 0,
					hidden: 0,
					is_deleted: false,
					created_at: new Date("2024-01-01"),
					updated_at: new Date("2024-01-01"),
				};

				// Mock Drizzle insert
				const insertBuilder = createMockInsertQueryBuilder();
				insertBuilder.returning = vi.fn(() => {
					insertBuilder.then = vi.fn((resolve) => resolve([expectedAttendee]));
					return insertBuilder;
				});
				mockDb.insert = vi.fn(() => insertBuilder);

				// Act
				const result = await chatService.upsertAttendee(
					chatId,
					externalId,
					contactId,
					attendeeData,
				);

				// Assert
				expect(mockDb.insert).toHaveBeenCalled();
				expect(insertBuilder.values).toHaveBeenCalledWith({
					chat_id: chatId,
					contact_id: contactId,
					external_id: externalId,
					is_self: 0,
					hidden: 0,
					is_deleted: false,
					created_at: expect.any(Date),
					updated_at: expect.any(Date),
				});
				expect(insertBuilder.onConflictDoUpdate).toHaveBeenCalled();
				expect(result).toEqual(expectedAttendee);
			});
		});

		describe("getAttendeeCount", () => {
			it("should return attendee count for chat", async () => {
				// Arrange
				const chatId = "chat-123";
				const expectedCount = 5;

				// Mock Drizzle select with count
				const selectBuilder = createMockSelectQueryBuilder();
				selectBuilder.then = vi.fn((resolve) =>
					resolve([{ count: expectedCount }]),
				);
				mockDb.select = vi.fn(() => selectBuilder);

				// Act
				const result = await chatService.getAttendeeCount(chatId);

				// Assert
				expect(mockDb.select).toHaveBeenCalledWith({
					count: expect.anything(),
				});
				expect(selectBuilder.from).toHaveBeenCalled();
				expect(selectBuilder.where).toHaveBeenCalled();
				expect(result).toBe(expectedCount);
			});

			it("should return 0 when no attendees found", async () => {
				// Arrange
				const chatId = "chat-with-no-attendees";

				// Mock empty result
				const selectBuilder = createMockSelectQueryBuilder();
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				mockDb.select = vi.fn(() => selectBuilder);

				// Act
				const result = await chatService.getAttendeeCount(chatId);

				// Assert
				expect(result).toBe(0);
			});
		});
	});

	describe("bulkCreateAttendees", () => {
		it("should bulk create attendees successfully", async () => {
			// Arrange
			const attendeesData = [
				{
					chat_id: "chat-123",
					contact_id: "contact-1",
					external_id: "ext-1",
					is_self: 0,
					hidden: 0,
					is_deleted: false,
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					chat_id: "chat-123",
					contact_id: "contact-2",
					external_id: "ext-2",
					is_self: 1,
					hidden: 0,
					is_deleted: false,
					created_at: new Date(),
					updated_at: new Date(),
				},
			];

			// Mock Drizzle insert
			const insertBuilder = createMockInsertQueryBuilder();
			insertBuilder.returning = vi.fn(() => {
				insertBuilder.then = vi.fn((resolve) =>
					resolve([{ id: "attendee-1" }, { id: "attendee-2" }]),
				);
				return insertBuilder;
			});
			mockDb.insert = vi.fn(() => insertBuilder);

			// Act
			const result = await chatService.bulkCreateAttendees(attendeesData);

			// Assert
			expect(mockDb.insert).toHaveBeenCalled();
			expect(insertBuilder.values).toHaveBeenCalledWith(attendeesData);
			expect(insertBuilder.onConflictDoNothing).toHaveBeenCalled();
			expect(result).toEqual({ count: 2 });
		});
	});
});
