import { vi } from 'vitest'

// Mock functions that can be imported and used in tests
export const mockDeleteMessage = vi.fn()
export const mockRefetchMessages = vi.fn()
export const mockRefetchChats = vi.fn()
export const mockRefetchChatDetails = vi.fn()
export const mockGetChatDetails = vi.fn()
export const mockGetChatMessages = vi.fn()
export const mockGetChats = vi.fn()
export const mockMarkChatAsRead = vi.fn()

// Mock data
export const mockChatDetails = {
  id: 'chat-1',
  external_id: 'external-chat-1',
  unread_count: 2,
  unipile_account: {
    id: 'account-1',
    user_id: 'user-1',
    account_id: 'linkedin-account-1',
  },
  UnipileChatAttendee: [{
    id: 'attendee-1',
    is_self: 0,
    contact: {
      id: 'contact-1',
      full_name: 'John Doe',
      headline: 'Software Engineer',
      profile_image_url: 'https://example.com/avatar.jpg',
    },
  }],
}

export const mockChatDetailsRead = {
  ...mockChatDetails,
  unread_count: 0,
}

export const mockChatsData = [
  {
    id: 'chat-1',
    unread_count: 2,
    provider: 'linkedin',
    last_message_at: new Date('2024-01-01T10:00:00Z'),
    UnipileChatAttendee: [{
      id: 'attendee-1',
      is_self: 0,
      contact: {
        id: 'contact-1',
        full_name: 'John Doe',
        headline: 'Software Engineer',
        profile_image_url: 'https://example.com/avatar.jpg',
      },
    }],
  },
  {
    id: 'chat-2',
    unread_count: 0,
    provider: 'linkedin',
    last_message_at: new Date('2024-01-01T09:00:00Z'),
    UnipileChatAttendee: [{
      id: 'attendee-2',
      is_self: 0,
      contact: {
        id: 'contact-2',
        full_name: 'Jane Smith',
        headline: 'Product Manager',
        profile_image_url: 'https://example.com/avatar2.jpg',
      },
    }],
  },
]

export const mockMessages = [
  {
    id: 'message-1',
    content: 'Hello, this is a test message',
    is_outgoing: true,
    is_read: true,
    sent_at: new Date('2024-01-01T10:00:00Z'),
    sender_id: 'user-1',
  },
  {
    id: 'message-2',
    content: 'This is another message',
    is_outgoing: false,
    is_read: true,
    sent_at: new Date('2024-01-01T10:05:00Z'),
    sender_id: 'user-2',
  },
]

// Default mock implementations
export const defaultMockImplementations = {
  getChats: () => ({
    data: mockChatsData,
    isLoading: false,
    refetch: mockRefetchChats,
  }),
  getChatDetails: () => ({
    data: mockChatDetails,
    isLoading: false,
    refetch: mockRefetchChatDetails,
  }),
  getChatMessages: () => ({
    data: mockMessages,
    isLoading: false,
    refetch: mockRefetchMessages,
  }),
  deleteMessage: () => ({
    mutate: mockDeleteMessage,
  }),
  markChatAsRead: () => ({
    mutate: mockMarkChatAsRead,
  }),
}

// Reset function to clear all mocks
export const resetApiMocks = () => {
  mockDeleteMessage.mockReset()
  mockRefetchMessages.mockReset()
  mockRefetchChats.mockReset()
  mockRefetchChatDetails.mockReset()
  mockGetChatDetails.mockReset()
  mockGetChatMessages.mockReset()
  mockGetChats.mockReset()
  mockMarkChatAsRead.mockReset()
  
  // Reset to default implementations
  mockGetChats.mockReturnValue(defaultMockImplementations.getChats())
  mockGetChatDetails.mockReturnValue(defaultMockImplementations.getChatDetails())
  mockGetChatMessages.mockReturnValue(defaultMockImplementations.getChatMessages())
}

// Helper function to trigger mutation callbacks
export const triggerMutationCallback = (
  mockFn: ReturnType<typeof vi.fn>,
  callbackType: 'onSuccess' | 'onError' | 'onSettled',
  data?: any
) => {
  const lastCall = mockFn.mock.calls[mockFn.mock.calls.length - 1]
  if (lastCall && lastCall[1] && lastCall[1][callbackType]) {
    lastCall[1][callbackType](data)
  }
} 