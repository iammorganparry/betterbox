import { vi } from 'vitest'

// Mock functions that can be imported and used in tests
export const mockDeleteMessage = vi.fn()
export const mockRefetchMessages = vi.fn()
export const mockGetChatDetails = vi.fn()
export const mockGetChatMessages = vi.fn()

// Mock data
export const mockChatDetails = {
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
  getChatDetails: () => ({
    data: mockChatDetails,
    isLoading: false,
  }),
  getChatMessages: () => ({
    data: mockMessages,
    isLoading: false,
    refetch: mockRefetchMessages,
  }),
  deleteMessage: () => ({
    mutate: mockDeleteMessage,
  }),
}

// Reset function to clear all mocks
export const resetApiMocks = () => {
  mockDeleteMessage.mockReset()
  mockRefetchMessages.mockReset()
  mockGetChatDetails.mockReset()
  mockGetChatMessages.mockReset()
  
  // Reset to default implementations
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