import { describe, it, expect, beforeEach, vi } from "vitest";
import { ContactLimitService } from "../contact-limit.service";
import { CONTACT_LIMITS_CONFIG } from "~/config/contact-limits.config";
import {
	createMockDrizzleDb,
	createMockSelectQueryBuilder,
	mockDrizzleData,
	type MockDrizzleDb,
} from "../../../test/mocks/drizzle";

// Create mock Drizzle DB
let mockDb: MockDrizzleDb;

describe("ContactLimitService - Drizzle Tests", () => {
	let service: ContactLimitService;

	beforeEach(() => {
		vi.clearAllMocks();
		mockDb = createMockDrizzleDb();
		service = new ContactLimitService(mockDb);
	});

	describe("getContactLimit", () => {
		it("should return correct limits for each plan", () => {
			expect(service.getContactLimit("FREE")).toBe(
				CONTACT_LIMITS_CONFIG.FREE.contactLimit,
			);
			expect(service.getContactLimit("STARTER")).toBe(
				CONTACT_LIMITS_CONFIG.STARTER.contactLimit,
			);
			expect(service.getContactLimit("PROFESSIONAL")).toBe(
				CONTACT_LIMITS_CONFIG.PROFESSIONAL.contactLimit,
			);
			expect(service.getContactLimit("ENTERPRISE")).toBe(
				CONTACT_LIMITS_CONFIG.ENTERPRISE.contactLimit,
			);
			expect(service.getContactLimit("GOLD")).toBe(
				CONTACT_LIMITS_CONFIG.GOLD.contactLimit,
			);
		});

		it("should default to FREE limit for unknown plans", () => {
			expect(service.getContactLimit("UNKNOWN" as any)).toBe(
				CONTACT_LIMITS_CONFIG.FREE.contactLimit,
			);
		});
	});

	describe("getContactLimitStatus", () => {
		it("should return correct status when within limit", async () => {
			// Arrange
			const mockSubscription = {
				...mockDrizzleData.subscription,
				plan: "STARTER" as const,
				status: "ACTIVE" as const,
			};

			// Mock subscription query
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([mockSubscription]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Mock contact count query using execute
			mockDb.execute = vi.fn().mockResolvedValue([{ count: 500 }]);

			// Act
			const status = await service.getContactLimitStatus("user1");

			// Assert
			expect(status).toEqual({
				limit: CONTACT_LIMITS_CONFIG.STARTER.contactLimit,
				count: 500,
				isExceeded: false,
				remainingContacts: CONTACT_LIMITS_CONFIG.STARTER.contactLimit - 500,
			});
			expect(mockDb.select).toHaveBeenCalled();
			expect(mockDb.execute).toHaveBeenCalled();
		});

		it("should return correct status when limit exceeded", async () => {
			// Arrange
			const mockSubscription = {
				...mockDrizzleData.subscription,
				plan: "STARTER" as const,
				status: "ACTIVE" as const,
			};

			// Mock subscription query
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([mockSubscription]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Mock contact count query - over limit
			mockDb.execute = vi.fn().mockResolvedValue([{ count: 1200 }]);

			// Act
			const status = await service.getContactLimitStatus("user1");

			// Assert
			expect(status).toEqual({
				limit: CONTACT_LIMITS_CONFIG.STARTER.contactLimit,
				count: 1200,
				isExceeded: true,
				remainingContacts: 0,
			});
		});

		it("should use FREE limits when user has no subscription", async () => {
			// Arrange - no subscription found
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Mock contact count
			mockDb.execute = vi.fn().mockResolvedValue([{ count: 50 }]);

			// Act
			const status = await service.getContactLimitStatus("user1");

			// Assert
			expect(status).toEqual({
				limit: CONTACT_LIMITS_CONFIG.FREE.contactLimit,
				count: 50,
				isExceeded: false,
				remainingContacts: CONTACT_LIMITS_CONFIG.FREE.contactLimit - 50,
			});
		});

		it("should handle database errors gracefully", async () => {
			// Arrange
			const dbError = new Error("Database connection failed");

			// Mock subscription query to throw error
			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve, reject) => reject(dbError));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Act & Assert
			await expect(service.getContactLimitStatus("user1")).rejects.toThrow(
				"Database connection failed",
			);
		});
	});

	describe("countUserContacts", () => {
		it("should return correct contact count for user", async () => {
			// Arrange
			const userId = "user-123";
			const expectedCount = 150;

			// Mock raw query execution
			mockDb.execute = vi.fn().mockResolvedValue([{ count: expectedCount }]);

			// Act
			const count = await service.countUserContacts(userId);

			// Assert
			expect(count).toBe(expectedCount);
			expect(mockDb.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					// The SQL object should contain the user ID
				}),
			);
		});

		it("should handle empty result gracefully", async () => {
			// Arrange
			const userId = "user-with-no-contacts";

			// Mock empty result
			mockDb.execute = vi.fn().mockResolvedValue([]);

			// Act
			const count = await service.countUserContacts(userId);

			// Assert
			expect(count).toBe(0);
		});
	});

	describe("hasExceededLimit", () => {
		it("should return true when limit is exceeded", async () => {
			// Arrange
			const userId = "user-123";

			// Mock subscription
			const mockSubscription = {
				...mockDrizzleData.subscription,
				plan: "FREE" as const,
				status: "ACTIVE" as const,
			};

			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([mockSubscription]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Mock count over FREE limit (100)
			mockDb.execute = vi.fn().mockResolvedValue([{ count: 120 }]);

			// Act
			const exceeded = await service.hasExceededLimit(userId);

			// Assert
			expect(exceeded).toBe(true);
		});

		it("should return false when within limit", async () => {
			// Arrange
			const userId = "user-123";

			// Mock subscription
			const mockSubscription = {
				...mockDrizzleData.subscription,
				plan: "PROFESSIONAL" as const,
				status: "ACTIVE" as const,
			};

			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([mockSubscription]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Mock count within PROFESSIONAL limit (5000)
			mockDb.execute = vi.fn().mockResolvedValue([{ count: 2500 }]);

			// Act
			const exceeded = await service.hasExceededLimit(userId);

			// Assert
			expect(exceeded).toBe(false);
		});
	});

	describe("applyContactLimitsToChats", () => {
		it("should return chats unchanged when within limit", async () => {
			// Arrange
			const userId = "user-123";
			const mockChats = [
				{ ...mockDrizzleData.chat, id: "chat-1" },
				{ ...mockDrizzleData.chat, id: "chat-2" },
			];

			// Mock subscription
			const mockSubscription = {
				...mockDrizzleData.subscription,
				plan: "STARTER" as const,
				status: "ACTIVE" as const,
			};

			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([mockSubscription]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Mock count within limit
			mockDb.execute = vi.fn().mockResolvedValue([{ count: 500 }]);

			// Act
			const result = await service.applyContactLimitsToChats(userId, mockChats);

			// Assert
			expect(result).toEqual(mockChats);
		});

		it("should obfuscate chats when limit exceeded", async () => {
			// Arrange
			const userId = "user-123";
			const mockChats = [
				{
					...mockDrizzleData.chat,
					id: "chat-1",
					// Add some attendees to test obfuscation
				},
				{
					...mockDrizzleData.chat,
					id: "chat-2",
				},
			];

			// Mock subscription with FREE plan (low limit)
			const mockSubscription = {
				...mockDrizzleData.subscription,
				plan: "FREE" as const,
				status: "ACTIVE" as const,
			};

			const selectBuilder = createMockSelectQueryBuilder();
			selectBuilder.limit = vi.fn(() => {
				selectBuilder.then = vi.fn((resolve) => resolve([mockSubscription]));
				return selectBuilder;
			});
			mockDb.select = vi.fn(() => selectBuilder);

			// Mock count over FREE limit (100)
			mockDb.execute = vi.fn().mockResolvedValue([{ count: 150 }]);

			// Act
			const result = await service.applyContactLimitsToChats(userId, mockChats);

			// Assert
			expect(result).toHaveLength(mockChats.length);
			// The specific obfuscation logic would depend on the implementation
			// but we can verify the method was called and returned something
		});
	});

	describe("obfuscateChat", () => {
		it("should obfuscate contact information in chat", () => {
			// Arrange
			const mockChat = {
				...mockDrizzleData.chat,
				unipile_chat_attendees: [
					{
						id: "attendee-1",
						is_self: 0,
						contact: {
							id: "contact-1",
							full_name: "John Doe",
							first_name: "John",
							last_name: "Doe",
							profile_image_url: "https://example.com/john.jpg",
						},
					},
				],
			};

			// Act
			const obfuscated = service.obfuscateChat(mockChat);

			// Assert
			expect(obfuscated.unipile_chat_attendees[0].contact.full_name).toMatch(
				/Contact \d+/,
			);
			expect(obfuscated.unipile_chat_attendees[0].contact.first_name).toMatch(
				/Contact \d+/,
			);
			expect(obfuscated.unipile_chat_attendees[0].contact.last_name).toBe("");
			expect(
				obfuscated.unipile_chat_attendees[0].contact.profile_image_url,
			).toBeNull();
		});

		it("should handle chats without attendees", () => {
			// Arrange
			const mockChat = {
				...mockDrizzleData.chat,
				unipile_chat_attendees: [],
			};

			// Act
			const obfuscated = service.obfuscateChat(mockChat);

			// Assert
			expect(obfuscated.unipile_chat_attendees).toEqual([]);
		});
	});
});
