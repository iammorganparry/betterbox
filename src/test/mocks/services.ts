import { vi } from 'vitest'

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
})

// Mock database services
export const createMockUnipileChatService = () => ({
  getChatsByUser: vi.fn(),
  getChatWithDetails: vi.fn(),
  findChatByExternalId: vi.fn(),
  markChatAsRead: vi.fn(),
  updateLastMessageAt: vi.fn(),
  updateUnreadCount: vi.fn(),
})

export const createMockUnipileMessageService = () => ({
  getMessagesByChat: vi.fn(),
  getMessageWithDetails: vi.fn(),
  upsertMessage: vi.fn(),
  markMessageAsRead: vi.fn(),
  markMessageAsDeleted: vi.fn(),
})

export const createMockUnipileContactService = () => ({
  getContactsByUser: vi.fn(),
  upsertContact: vi.fn(),
  findContactByExternalId: vi.fn(),
})

export const createMockContactLimitService = () => ({
  getContactLimitStatus: vi.fn().mockResolvedValue({
    limit: 100,
    count: 50,
    isExceeded: false,
    remainingContacts: 50,
  }),
  applyContactLimitsToChats: vi.fn().mockImplementation((userId, chats) => Promise.resolve(chats)),
  countUserContacts: vi.fn().mockResolvedValue(50),
  hasExceededLimit: vi.fn().mockResolvedValue(false),
})

// Create complete services mock for TRPC context
export const createMockServices = () => ({
  unipileChatService: createMockUnipileChatService(),
  unipileMessageService: createMockUnipileMessageService(),
  unipileContactService: createMockUnipileContactService(),
  contactLimitService: createMockContactLimitService(),
})

// Mock TRPC context
export const createMockTrpcContext = (userId = 'test-user-123') => ({
  userId,
  services: createMockServices(),
})

// Common test data
export const mockChatData = {
  id: 'chat-123',
  external_id: 'external-chat-123',
  read_only: 0,
  unread_count: 2,
  provider: 'linkedin',
  last_message_at: new Date('2024-01-01T12:00:00Z'),
  unipile_account: {
    id: 'account-123',
    user_id: 'test-user-123',
    account_id: 'linkedin-account-123',
    provider: 'linkedin',
  },
  UnipileChatAttendee: [
    {
      id: 'attendee-1',
      is_self: 0,
      contact: {
        id: 'contact-1',
        full_name: 'John Doe',
        first_name: 'John',
        last_name: 'Doe',
        headline: 'Software Engineer',
        profile_image_url: 'https://example.com/avatar.jpg',
      },
    },
  ],
}

export const mockMessageData = {
  id: 'message-123',
  content: 'Hello, world!',
  is_outgoing: true,
  is_read: true,
  sent_at: new Date('2024-01-01T12:00:00Z'),
  sender_id: 'linkedin-account-123',
  external_id: 'external-message-123',
  external_chat_id: 'external-chat-123',
  message_type: 'text',
}

export const mockUnipileResponse = {
  sendMessage: {
    id: 'message-456',
    chat_id: 'external-chat-123',
    status: 'sent' as const,
    timestamp: '2024-01-01T12:00:00Z',
    message: {
      id: 'message-456',
      text: 'Hello, world!',
      timestamp: '2024-01-01T12:00:00Z',
      sender_id: 'linkedin-account-123',
      message_type: 'MESSAGE',
      attendee_type: 'MEMBER',
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
      sender_urn: 'urn:li:person:123',
    },
  },
  patchChat: {
    success: true,
    message: 'Chat updated successfully',
  },
}

// Environment mocks
export const mockEnv = {
  UNIPILE_API_KEY: 'test-api-key',
  UNIPILE_DSN: 'test-dsn',
}

// Mock the Unipile service creation
export const mockUnipileServiceModule = () => {
  const mockService = createMockUnipileService()
  
  vi.mock('~/services/unipile/unipile.service', () => ({
    createUnipileService: vi.fn(() => mockService),
  }))
  
  return mockService
}

// Mock environment module
export const mockEnvModule = () => {
  vi.mock('~/env', () => ({
    env: mockEnv,
  }))
  
  return mockEnv
} 