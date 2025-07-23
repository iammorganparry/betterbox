import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TRPCError } from '@trpc/server'
import { inboxRouter } from '../inbox'
import { createUnipileService } from '~/services/unipile/unipile.service'

// Mock the UnipileService
vi.mock('~/services/unipile/unipile.service', () => ({
  createUnipileService: vi.fn(),
}))

// Mock environment variables
vi.mock('~/env', () => ({
  env: {
    UNIPILE_API_KEY: 'test-api-key',
    UNIPILE_DSN: 'test-dsn',
  },
}))

describe('inboxRouter - markChatAsRead', () => {
  let mockUnipileChatService: any
  let mockUnipileService: any
  let mockContext: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock the Unipile service
    mockUnipileService = {
      patchChat: vi.fn(),
    }
    ;(createUnipileService as any).mockReturnValue(mockUnipileService)

    // Mock the chat service
    mockUnipileChatService = {
      getChatWithDetails: vi.fn(),
      markChatAsRead: vi.fn(),
    }

    // Mock the context
    mockContext = {
      userId: 'test-user-id',
      services: {
        unipileChatService: mockUnipileChatService,
      },
    }
  })

  describe('markChatAsRead mutation', () => {
    it('should successfully mark a chat as read', async () => {
      // Arrange
      const input = { chatId: 'test-chat-id' }
      const mockChatDetails = {
        id: 'test-chat-id',
        external_id: 'external-chat-id',
        unread_count: 2,
        unipile_account: {
          id: 'account-1',
          user_id: 'test-user-id',
          account_id: 'linkedin-account-1',
        },
      }
      const mockUnipileResponse = {
        object: 'ChatAction',
        chat_id: 'external-chat-id',
        account_id: 'linkedin-account-1',
        action: 'mark_as_read',
        success: true,
        updated_fields: {
          unread_count: 0,
        },
      }
      const mockUpdatedChat = {
        ...mockChatDetails,
        unread_count: 0,
      }

      mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChatDetails)
      mockUnipileService.patchChat.mockResolvedValue(mockUnipileResponse)
      mockUnipileChatService.markChatAsRead.mockResolvedValue(mockUpdatedChat)

      // Create a caller instance
      const caller = inboxRouter.createCaller(mockContext)

      // Act
      const result = await caller.markChatAsRead(input)

      // Assert
      expect(mockUnipileChatService.getChatWithDetails).toHaveBeenCalledWith('test-chat-id')
      expect(mockUnipileService.patchChat).toHaveBeenCalledWith(
        'external-chat-id',
        { action: 'mark_as_read' },
        'linkedin-account-1'
      )
      expect(mockUnipileChatService.markChatAsRead).toHaveBeenCalledWith('test-chat-id')
      expect(result).toEqual({
        success: true,
        message: 'Chat marked as read',
        chat: mockUpdatedChat,
        unipileResponse: mockUnipileResponse,
      })
    })

    it('should throw NOT_FOUND error when chat does not exist', async () => {
      // Arrange
      const input = { chatId: 'non-existent-chat-id' }
      mockUnipileChatService.getChatWithDetails.mockResolvedValue(null)

      const caller = inboxRouter.createCaller(mockContext)

      // Act & Assert
      await expect(caller.markChatAsRead(input)).rejects.toThrow(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'Chat not found',
        })
      )
      expect(mockUnipileService.patchChat).not.toHaveBeenCalled()
      expect(mockUnipileChatService.markChatAsRead).not.toHaveBeenCalled()
    })

    it('should throw FORBIDDEN error when user does not own the chat', async () => {
      // Arrange
      const input = { chatId: 'test-chat-id' }
      const mockChatDetails = {
        id: 'test-chat-id',
        external_id: 'external-chat-id',
        unread_count: 2,
        unipile_account: {
          id: 'account-1',
          user_id: 'different-user-id', // Different from context user
          account_id: 'linkedin-account-1',
        },
      }

      mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChatDetails)

      const caller = inboxRouter.createCaller(mockContext)

      // Act & Assert
      await expect(caller.markChatAsRead(input)).rejects.toThrow(
        new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only mark your own chats as read',
        })
      )
      expect(mockUnipileService.patchChat).not.toHaveBeenCalled()
      expect(mockUnipileChatService.markChatAsRead).not.toHaveBeenCalled()
    })

    it('should return early success message when chat is already read', async () => {
      // Arrange
      const input = { chatId: 'test-chat-id' }
      const mockChatDetails = {
        id: 'test-chat-id',
        external_id: 'external-chat-id',
        unread_count: 0, // Already read
        unipile_account: {
          id: 'account-1',
          user_id: 'test-user-id',
          account_id: 'linkedin-account-1',
        },
      }

      mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChatDetails)

      const caller = inboxRouter.createCaller(mockContext)

      // Act
      const result = await caller.markChatAsRead(input)

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Chat is already marked as read',
      })
      expect(mockUnipileService.patchChat).not.toHaveBeenCalled()
      expect(mockUnipileChatService.markChatAsRead).not.toHaveBeenCalled()
    })

    it('should throw BAD_GATEWAY error when Unipile API fails', async () => {
      // Arrange
      const input = { chatId: 'test-chat-id' }
      const mockChatDetails = {
        id: 'test-chat-id',
        external_id: 'external-chat-id',
        unread_count: 2,
        unipile_account: {
          id: 'account-1',
          user_id: 'test-user-id',
          account_id: 'linkedin-account-1',
        },
      }
      const mockUnipileResponse = {
        object: 'ChatAction',
        chat_id: 'external-chat-id',
        account_id: 'linkedin-account-1',
        action: 'mark_as_read',
        success: false,
        message: 'Chat is read-only',
      }

      mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChatDetails)
      mockUnipileService.patchChat.mockResolvedValue(mockUnipileResponse)

      const caller = inboxRouter.createCaller(mockContext)

      // Act & Assert
      await expect(caller.markChatAsRead(input)).rejects.toThrow(
        new TRPCError({
          code: 'BAD_GATEWAY',
          message: 'Failed to mark chat as read in Unipile',
        })
      )
      expect(mockUnipileChatService.markChatAsRead).not.toHaveBeenCalled()
    })

    it('should handle Unipile service errors', async () => {
      // Arrange
      const input = { chatId: 'test-chat-id' }
      const mockChatDetails = {
        id: 'test-chat-id',
        external_id: 'external-chat-id',
        unread_count: 2,
        unipile_account: {
          id: 'account-1',
          user_id: 'test-user-id',
          account_id: 'linkedin-account-1',
        },
      }

      mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChatDetails)
      mockUnipileService.patchChat.mockRejectedValue(new Error('Network error'))

      const caller = inboxRouter.createCaller(mockContext)

      // Act & Assert
      await expect(caller.markChatAsRead(input)).rejects.toThrow(
        new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to mark chat as read',
        })
      )
      expect(mockUnipileChatService.markChatAsRead).not.toHaveBeenCalled()
    })

    it('should handle database service errors', async () => {
      // Arrange
      const input = { chatId: 'test-chat-id' }
      const mockChatDetails = {
        id: 'test-chat-id',
        external_id: 'external-chat-id',
        unread_count: 2,
        unipile_account: {
          id: 'account-1',
          user_id: 'test-user-id',
          account_id: 'linkedin-account-1',
        },
      }
      const mockUnipileResponse = {
        object: 'ChatAction',
        chat_id: 'external-chat-id',
        account_id: 'linkedin-account-1',
        action: 'mark_as_read',
        success: true,
        updated_fields: {
          unread_count: 0,
        },
      }

      mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChatDetails)
      mockUnipileService.patchChat.mockResolvedValue(mockUnipileResponse)
      mockUnipileChatService.markChatAsRead.mockRejectedValue(new Error('Database connection failed'))

      const caller = inboxRouter.createCaller(mockContext)

      // Act & Assert
      await expect(caller.markChatAsRead(input)).rejects.toThrow(
        new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to mark chat as read',
        })
      )
    })

    it('should validate input parameters', async () => {
      // Arrange
      const invalidInput = { chatId: '' } // Empty string should fail validation

      const caller = inboxRouter.createCaller(mockContext)

      // Act & Assert
      await expect(caller.markChatAsRead(invalidInput)).rejects.toThrow()
    })

    it('should create UnipileService with correct configuration', async () => {
      // Arrange
      const input = { chatId: 'test-chat-id' }
      const mockChatDetails = {
        id: 'test-chat-id',
        external_id: 'external-chat-id',
        unread_count: 2,
        unipile_account: {
          id: 'account-1',
          user_id: 'test-user-id',
          account_id: 'linkedin-account-1',
        },
      }

      mockUnipileChatService.getChatWithDetails.mockResolvedValue(mockChatDetails)
      mockUnipileService.patchChat.mockResolvedValue({
        success: true,
        object: 'ChatAction',
        chat_id: 'external-chat-id',
        account_id: 'linkedin-account-1',
        action: 'mark_as_read',
      })
      mockUnipileChatService.markChatAsRead.mockResolvedValue({
        ...mockChatDetails,
        unread_count: 0,
      })

      const caller = inboxRouter.createCaller(mockContext)

      // Act
      await caller.markChatAsRead(input)

      // Assert
      expect(createUnipileService).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        dsn: 'test-dsn',
      })
    })
  })
}) 