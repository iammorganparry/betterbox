import { vi } from "vitest";
import drizzleMock from "../setup";

// Mock Unipile service
export const createMockUnipileService = () => ({
	sendMessage: vi.fn(),
	patchChat: vi.fn(),
	listChats: vi.fn(),
	listChatMessages: vi.fn(),
	getChat: vi.fn(),
	getMessage: vi.fn(),
	downloadAttachment: vi.fn(),
	healthCheck: vi.fn(),
});

// Mock database services
export const createMockUnipileChatService = () => ({
	getChatsByUser: vi.fn(),
	getChatWithDetails: vi.fn(),
	findChatByExternalId: vi.fn(),
	markChatAsRead: vi.fn(),
	updateLastMessageAt: vi.fn(),
	updateUnreadCount: vi.fn(),
});

export const createMockUnipileMessageService = () => ({
	getMessagesByChat: vi.fn(),
	getMessageWithDetails: vi.fn(),
	upsertMessage: vi.fn(),
	markMessageAsRead: vi.fn(),
	markMessageAsDeleted: vi.fn(),
});

export const createMockUnipileContactService = () => ({
	getContactsByUser: vi.fn(),
	upsertContact: vi.fn(),
	findContactByExternalId: vi.fn(),
});

export const createMockContactLimitService = () => ({
	getContactLimitStatus: vi.fn().mockResolvedValue({
		limit: 100,
		count: 50,
		isExceeded: false,
		remainingContacts: 50,
	}),
	applyContactLimitsToChats: vi
		.fn()
		.mockImplementation((userId, chats) => Promise.resolve(chats)),
	countUserContacts: vi.fn().mockResolvedValue(50),
	hasExceededLimit: vi.fn().mockResolvedValue(false),
});

// Create Drizzle-based service mocks
export const createMockDrizzleServices = (mockDb?: typeof drizzleMock) => {
	const db = mockDb || drizzleMock;

	return {
		// Import services dynamically to avoid circular dependencies
		UnipileChatService: class {
			constructor(public drizzleDb = db) {}
			findChatByExternalId = vi.fn();
			upsertChat = vi.fn();
			getChatsByAccount = vi.fn();
			getChatsByUser = vi.fn();
			getChatsByUserPaginated = vi.fn();
			updateLastMessageAt = vi.fn();
			findAttendeeByExternalId = vi.fn();
			upsertAttendee = vi.fn();
			getAttendeesByChat = vi.fn();
			getAttendeeCount = vi.fn();
			markChatAsDeleted = vi.fn();
			markAttendeeAsDeleted = vi.fn();
			getChatStats = vi.fn();
			searchChats = vi.fn();
			getChatWithDetails = vi.fn();
			bulkCreateAttendees = vi.fn();
			getRecentChats = vi.fn();
			markChatAsRead = vi.fn();
			updateUnreadCount = vi.fn();
		},

		ChatFolderService: class {
			constructor(public drizzleDb = db) {}
			createFolder = vi.fn();
			getFoldersByUser = vi.fn();
			getFolderById = vi.fn();
			updateFolder = vi.fn();
			deleteFolder = vi.fn();
			createDefaultFolder = vi.fn();
			assignChatToFolder = vi.fn();
			removeChatFromFolder = vi.fn();
			getChatFolders = vi.fn();
			getChatsInFolder = vi.fn();
			getFoldersWithChatCounts = vi.fn();
			isChatInFolder = vi.fn();
			bulkAssignChatsToFolder = vi.fn();
		},

		ContactLimitService: class {
			constructor(public drizzleDb = db) {}
			getContactLimit = vi.fn();
			getContactLimitStatus = vi.fn();
			countUserContacts = vi.fn();
			hasExceededLimit = vi.fn();
			applyContactLimitsToChats = vi.fn();
			obfuscateChat = vi.fn();
			getChatContactId = vi.fn();
		},

		SubscriptionService: class {
			constructor(public drizzleDb = db) {}
			getUserSubscription = vi.fn();
			createOrUpdateSubscription = vi.fn();
			createGoldTrial = vi.fn();
			updateSubscription = vi.fn();
			addPaymentMethod = vi.fn();
			getPaymentMethods = vi.fn();
			getActiveSubscriptions = vi.fn();
			deleteSubscription = vi.fn();
		},

		UnipileContactService: class {
			constructor(public drizzleDb = db) {}
			getContactsByUser = vi.fn();
			upsertContact = vi.fn();
			findContactByExternalId = vi.fn();
			getContactsByAccount = vi.fn();
			getContactById = vi.fn();
			searchContacts = vi.fn();
			markContactAsDeleted = vi.fn();
			bulkCreateContacts = vi.fn();
			updateContact = vi.fn();
			getContactStats = vi.fn();
		},

		UnipileMessageService: class {
			constructor(public drizzleDb = db) {}
			getMessagesByChat = vi.fn();
			getMessageWithDetails = vi.fn();
			upsertMessage = vi.fn();
			markMessageAsRead = vi.fn();
			markMessageAsDeleted = vi.fn();
			findMessageByExternalId = vi.fn();
			getLatestMessageForChats = vi.fn();
			getUnreadCount = vi.fn();
			searchMessages = vi.fn();
			bulkCreateMessages = vi.fn();
			updateMessage = vi.fn();
		},

		UnipileAccountService: class {
			constructor(public drizzleDb = db) {}
			upsertAccount = vi.fn();
			getAccountsByUser = vi.fn();
			getAccountById = vi.fn();
			findAccountByAccountId = vi.fn();
			updateAccountStatus = vi.fn();
			markAccountAsDeleted = vi.fn();
			getActiveAccounts = vi.fn();
		},

		UserService: class {
			constructor(public drizzleDb = db) {}
			create = vi.fn();
			findById = vi.fn();
			findByClerkId = vi.fn();
			findByEmail = vi.fn();
			update = vi.fn();
			delete = vi.fn();
		},
	};
};

// Create complete services mock for TRPC context
export const createMockServices = () => ({
	unipileChatService: createMockUnipileChatService(),
	unipileMessageService: createMockUnipileMessageService(),
	unipileContactService: createMockUnipileContactService(),
	contactLimitService: createMockContactLimitService(),
});

// Mock TRPC context
export const createMockTrpcContext = (userId = "test-user-123") => ({
	userId,
	services: createMockServices(),
});

// Common test data
export const mockChatData = {
	id: "chat-123",
	external_id: "external-chat-123",
	read_only: 0,
	unread_count: 2,
	provider: "linkedin",
	last_message_at: new Date("2024-01-01T12:00:00Z"),
	unipileAccount: {
		id: "account-123",
		user_id: "test-user-123",
		account_id: "linkedin-account-123",
		provider: "linkedin",
	},
	unipileChatAttendees: [
		{
			id: "attendee-1",
			is_self: 0,
			contact: {
				id: "contact-1",
				full_name: "John Doe",
				first_name: "John",
				last_name: "Doe",
				headline: "Software Engineer",
				profile_image_url: "https://example.com/avatar.jpg",
			},
		},
	],
	unipileMessages: [],
};

export const mockMessageData = {
	id: "message-123",
	content: "Hello, world!",
	is_outgoing: true,
	is_read: true,
	sent_at: new Date("2024-01-01T12:00:00Z"),
	sender_id: "linkedin-account-123",
	external_id: "external-message-123",
	external_chat_id: "external-chat-123",
	message_type: "text",
};

export const mockUnipileResponse = {
	sendMessage: {
		id: "message-456",
		chat_id: "external-chat-123",
		status: "sent" as const,
		timestamp: "2024-01-01T12:00:00Z",
		message: {
			id: "message-456",
			text: "Hello, world!",
			timestamp: "2024-01-01T12:00:00Z",
			sender_id: "linkedin-account-123",
			message_type: "MESSAGE",
			attendee_type: "MEMBER",
			attendee_distance: 1,
			seen: 1,
			hidden: 0,
			deleted: 0,
			edited: 0,
			is_event: 0,
			delivered: 1,
			behavior: 0,
			event_type: 0,
			replies: 0,
			subject: undefined,
			parent: undefined,
			sender_urn: "urn:li:person:123",
		},
	},
	patchChat: {
		success: true,
		message: "Chat updated successfully",
	},
};

// Environment mocks
export const mockEnv = {
	UNIPILE_API_KEY: "test-api-key",
	UNIPILE_DSN: "test-dsn",
};

// Mock the Unipile service creation
export const mockUnipileServiceModule = () => {
	const mockService = createMockUnipileService();

	vi.mock("~/services/unipile/unipile.service", () => ({
		createUnipileService: vi.fn(() => mockService),
	}));

	return mockService;
};

// Mock environment module
export const mockEnvModule = () => {
	vi.mock("~/env", () => ({
		env: mockEnv,
	}));

	return mockEnv;
};
