import { vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";

// Mock Drizzle query result interface
interface DrizzleResult<T = unknown> {
	rows: T[];
	rowCount: number;
	command: string;
}

// Mock Drizzle select query builder
export const createMockSelectQueryBuilder = <T = unknown>() => {
	const mockBuilder = {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
		rightJoin: vi.fn().mockReturnThis(),
		fullJoin: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		groupBy: vi.fn().mockReturnThis(),
		having: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		offset: vi.fn().mockReturnThis(),
		execute: vi.fn(),
	};

	// Make it chainable and executable - extends promise-like behavior
	const chainableBuilder = Object.assign(mockBuilder, {
		then: vi.fn(
			(resolve?: (value: T[]) => void, reject?: (reason: unknown) => void) => {
				return Promise.resolve([] as T[]).then(resolve, reject);
			},
		),
	});

	return chainableBuilder;
};

// Mock Drizzle insert query builder
export const createMockInsertQueryBuilder = <T = unknown>() => {
	const mockBuilder = {
		into: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		onConflictDoUpdate: vi.fn().mockReturnThis(),
		onConflictDoNothing: vi.fn().mockReturnThis(),
		returning: vi.fn().mockReturnThis(),
		execute: vi.fn(),
	};

	// Make it chainable and executable - extends promise-like behavior
	const chainableBuilder = Object.assign(mockBuilder, {
		then: vi.fn(
			(resolve?: (value: T[]) => void, reject?: (reason: unknown) => void) => {
				return Promise.resolve([] as T[]).then(resolve, reject);
			},
		),
	});

	return chainableBuilder;
};

// Mock Drizzle update query builder
export const createMockUpdateQueryBuilder = <T = unknown>() => {
	const mockBuilder = {
		set: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		returning: vi.fn().mockReturnThis(),
		execute: vi.fn(),
	};

	// Make it chainable and executable - extends promise-like behavior
	const chainableBuilder = Object.assign(mockBuilder, {
		then: vi.fn(
			(resolve?: (value: T[]) => void, reject?: (reason: unknown) => void) => {
				return Promise.resolve([] as T[]).then(resolve, reject);
			},
		),
	});

	return chainableBuilder;
};

// Mock Drizzle delete query builder
export const createMockDeleteQueryBuilder = <T = unknown>() => {
	const mockBuilder = {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		returning: vi.fn().mockReturnThis(),
		execute: vi.fn(),
	};

	// Make it chainable and executable - extends promise-like behavior
	const chainableBuilder = Object.assign(mockBuilder, {
		then: vi.fn(
			(resolve?: (value: T[]) => void, reject?: (reason: unknown) => void) => {
				return Promise.resolve([] as T[]).then(resolve, reject);
			},
		),
	});

	return chainableBuilder;
};

// Mock Drizzle relational query API
export const createMockRelationalQuery = () => ({
	findFirst: vi.fn(),
	findMany: vi.fn(),
	findUnique: vi.fn(),
});

// Create comprehensive Drizzle DB mock
export const createMockDrizzleDb = () => {
	const mockDb = {
		// Core query methods
		select: vi.fn(() => createMockSelectQueryBuilder()),
		selectDistinct: vi.fn(() => createMockSelectQueryBuilder()),
		insert: vi.fn(() => createMockInsertQueryBuilder()),
		update: vi.fn(() => createMockUpdateQueryBuilder()),
		delete: vi.fn(() => createMockDeleteQueryBuilder()),

		// Raw query execution
		execute: vi.fn(),

		// Transaction support
		transaction: vi.fn(),

		// Relational query API
		query: {
			// Table-specific relational queries (will be extended per table)
			users: createMockRelationalQuery(),
			profiles: createMockRelationalQuery(),
			posts: createMockRelationalQuery(),
			messages: createMockRelationalQuery(),
			subscriptions: createMockRelationalQuery(),
			chatFolders: createMockRelationalQuery(),
			chatFolderAssignments: createMockRelationalQuery(),
			unipileAccounts: createMockRelationalQuery(),
			unipileChats: createMockRelationalQuery(),
			unipileChatAttendees: createMockRelationalQuery(),
			unipileContacts: createMockRelationalQuery(),
			unipileMessages: createMockRelationalQuery(),
			unipileMessageAttachments: createMockRelationalQuery(),
			unipileMessageReactions: createMockRelationalQuery(),
		},

		// Batch operations
		batch: vi.fn(),

		// Connection info
		$client: {
			execute: vi.fn(),
			query: vi.fn(),
		},
	};

	return mockDb;
};

// Helper to create a mock DB with specific method implementations
export const createMockDrizzleDbWithImplementations = (
	implementations: Record<string, unknown> = {},
) => {
	const mockDb = createMockDrizzleDb();

	// Apply custom implementations
	for (const key of Object.keys(implementations)) {
		if (key.includes(".")) {
			// Handle nested property like 'query.users.findMany'
			const parts = key.split(".");
			let current: Record<string, unknown> = mockDb as Record<string, unknown>;
			for (let i = 0; i < parts.length - 1; i++) {
				current = current[parts[i]] as Record<string, unknown>;
			}
			current[parts[parts.length - 1]] = implementations[key];
		} else {
			(mockDb as Record<string, unknown>)[key] = implementations[key];
		}
	}

	return mockDb;
};

// Mock for specific table operations
export const createTableOperationsMock = (tableName: string) => ({
	[`${tableName}.select`]: vi.fn(() => createMockSelectQueryBuilder()),
	[`${tableName}.insert`]: vi.fn(() => createMockInsertQueryBuilder()),
	[`${tableName}.update`]: vi.fn(() => createMockUpdateQueryBuilder()),
	[`${tableName}.delete`]: vi.fn(() => createMockDeleteQueryBuilder()),
});

// Helper functions for common test scenarios
export const createMockDbWithData = <T>(data: T[]) => {
	const mockDb = createMockDrizzleDb();

	// Mock select to return the data
	const selectBuilder = createMockSelectQueryBuilder();
	const chainableSelectBuilder = Object.assign(selectBuilder, {
		then: vi.fn((resolve?: (value: T[]) => void) => resolve?.(data)),
	});
	mockDb.select = vi.fn(() => chainableSelectBuilder);

	// Mock relational queries
	for (const queryApi of Object.values(mockDb.query)) {
		queryApi.findMany = vi.fn().mockResolvedValue(data);
		queryApi.findFirst = vi.fn().mockResolvedValue(data[0] || null);
		queryApi.findUnique = vi.fn().mockResolvedValue(data[0] || null);
	}

	return mockDb;
};

// Mock successful insert/update operations
export const createMockDbWithSuccessfulWrites = <T>(returnData: T) => {
	const mockDb = createMockDrizzleDb();

	// Mock insert
	const insertBuilder = createMockInsertQueryBuilder();
	const chainableInsertBuilder = Object.assign(insertBuilder, {
		then: vi.fn((resolve?: (value: T[]) => void) => resolve?.([returnData])),
	});
	mockDb.insert = vi.fn(() => chainableInsertBuilder);

	// Mock update
	const updateBuilder = createMockUpdateQueryBuilder();
	const chainableUpdateBuilder = Object.assign(updateBuilder, {
		then: vi.fn((resolve?: (value: T[]) => void) => resolve?.([returnData])),
	});
	mockDb.update = vi.fn(() => chainableUpdateBuilder);

	return mockDb;
};

// Common mock data for tests
export const mockDrizzleData = {
	// User data
	user: {
		id: "user-123",
		first_name: "John",
		last_name: "Doe",
		email: "john.doe@example.com",
		created_at: new Date("2024-01-01"),
		updated_at: new Date("2024-01-01"),
	},

	// Chat data
	chat: {
		id: "chat-123",
		external_id: "external-chat-123",
		unipile_account_id: "account-123",
		provider: "linkedin" as const,
		chat_type: "direct" as const,
		name: null,
		read_only: 0,
		unread_count: 2,
		last_message_at: new Date("2024-01-01T12:00:00Z"),
		is_deleted: false,
		created_at: new Date("2024-01-01"),
		updated_at: new Date("2024-01-01"),
		account_type: null,
		banner_image_url: null,
		profile_image_url: null,
		disabled_features: null,
		auto_accept: null,
		auto_accept_config: null,
		notification_subscription: null,
	},

	// Folder data
	folder: {
		id: "folder-123",
		user_id: "user-123",
		name: "Work Chats",
		color: "#3b82f6",
		sort_order: 1,
		is_default: false,
		is_deleted: false,
		created_at: new Date("2024-01-01"),
		updated_at: new Date("2024-01-01"),
	},

	// Contact data
	contact: {
		id: "contact-123",
		external_id: "external-contact-123",
		unipile_account_id: "account-123",
		full_name: "Jane Smith",
		first_name: "Jane",
		last_name: "Smith",
		email: "jane.smith@example.com",
		headline: "Software Engineer",
		profile_image_url: "https://example.com/avatar.jpg",
		provider_url: "https://linkedin.com/in/janesmith",
		is_deleted: false,
		created_at: new Date("2024-01-01"),
		updated_at: new Date("2024-01-01"),
		company_name: null,
		location: null,
		about: null,
		distance_network: null,
		note: null,
		sync_meta: null,
	},

	// Message data
	message: {
		id: "message-123",
		external_id: "external-message-123",
		external_chat_id: "external-chat-123",
		unipile_account_id: "account-123",
		content: "Hello, world!",
		message_type: "text" as const,
		is_outgoing: true,
		is_read: true,
		sent_at: new Date("2024-01-01T12:00:00Z"),
		sender_id: "linkedin-account-123",
		sender_urn: "urn:li:person:123",
		is_deleted: false,
		created_at: new Date("2024-01-01"),
		updated_at: new Date("2024-01-01"),
		subject: null,
		parent_id: null,
		seen: null,
		hidden: null,
		edited: null,
		is_event: null,
		delivered: null,
		behavior: null,
		event_type: null,
		replies: null,
	},

	// Account data
	account: {
		id: "account-123",
		user_id: "user-123",
		provider: "linkedin" as const,
		account_id: "linkedin-account-123",
		status: "CONNECTED" as const,
		is_deleted: false,
		created_at: new Date("2024-01-01"),
		updated_at: new Date("2024-01-01"),
	},

	// Subscription data
	subscription: {
		id: "sub-123",
		user_id: "user-123",
		stripe_customer_id: "cus_123",
		stripe_subscription_id: "sub_123",
		plan: "STARTER" as const,
		status: "ACTIVE" as const,
		created_at: new Date("2024-01-01"),
		updated_at: new Date("2024-01-01"),
	},
};

// Type for the mock DB instance
export type MockDrizzleDb = ReturnType<typeof createMockDrizzleDb>;

// Global mock setup function that can be used in test files
export const setupDrizzleMocks = () => {
	const mockDb = createMockDrizzleDb();

	// Reset all mocks before each test
	beforeEach(() => {
		vi.clearAllMocks();
	});

	return mockDb;
};
