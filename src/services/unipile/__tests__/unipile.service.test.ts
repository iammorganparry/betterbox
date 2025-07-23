import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnipileService } from '../unipile.service'
import type { UnipileApiPatchChatRequest, UnipileApiPatchChatResponse } from '~/types/unipile-api'

// Mock the HTTP client
vi.mock('~/lib/http', () => ({
  createUnipileClient: vi.fn(() => ({
    patch: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  })),
}))

describe('UnipileService - patchChat', () => {
  let unipileService: UnipileService
  let mockClient: any

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Create service instance
    unipileService = new UnipileService({
      apiKey: 'test-api-key',
      dsn: 'test-dsn',
    })
    
    // Get the mock client
    mockClient = (unipileService as any).client
  })

  describe('patchChat', () => {
    it('should successfully mark a chat as read', async () => {
      // Arrange
      const chatId = 'test-chat-id'
      const accountId = 'test-account-id'
      const request: UnipileApiPatchChatRequest = {
        action: 'mark_as_read',
      }
      
      const expectedResponse: UnipileApiPatchChatResponse = {
        object: 'ChatAction',
        chat_id: chatId,
        account_id: accountId,
        action: 'mark_as_read',
        success: true,
        updated_fields: {
          unread_count: 0,
        },
      }

      mockClient.patch.mockResolvedValue({ data: expectedResponse })

      // Act
      const result = await unipileService.patchChat(chatId, request, accountId)

      // Assert
      expect(mockClient.patch).toHaveBeenCalledTimes(1)
      expect(mockClient.patch).toHaveBeenCalledWith(
        `/chats/${chatId}?account_id=${accountId}`,
        request
      )
      expect(result).toEqual(expectedResponse)
    })

    it('should handle mute action with duration value', async () => {
      // Arrange
      const chatId = 'test-chat-id'
      const accountId = 'test-account-id'
      const request: UnipileApiPatchChatRequest = {
        action: 'mute',
        value: 3600, // 1 hour in seconds
      }
      
      const expectedResponse: UnipileApiPatchChatResponse = {
        object: 'ChatAction',
        chat_id: chatId,
        account_id: accountId,
        action: 'mute',
        success: true,
        updated_fields: {
          muted_until: Date.now() + 3600000, // 1 hour from now
        },
      }

      mockClient.patch.mockResolvedValue({ data: expectedResponse })

      // Act
      const result = await unipileService.patchChat(chatId, request, accountId)

      // Assert
      expect(mockClient.patch).toHaveBeenCalledWith(
        `/chats/${chatId}?account_id=${accountId}`,
        request
      )
      expect(result).toEqual(expectedResponse)
    })

    it('should handle archive action', async () => {
      // Arrange
      const chatId = 'test-chat-id'
      const accountId = 'test-account-id'
      const request: UnipileApiPatchChatRequest = {
        action: 'archive',
      }
      
      const expectedResponse: UnipileApiPatchChatResponse = {
        object: 'ChatAction',
        chat_id: chatId,
        account_id: accountId,
        action: 'archive',
        success: true,
        updated_fields: {
          archived: 1,
        },
      }

      mockClient.patch.mockResolvedValue({ data: expectedResponse })

      // Act
      const result = await unipileService.patchChat(chatId, request, accountId)

      // Assert
      expect(result).toEqual(expectedResponse)
    })

    it('should handle API errors gracefully', async () => {
      // Arrange
      const chatId = 'test-chat-id'
      const accountId = 'test-account-id'
      const request: UnipileApiPatchChatRequest = {
        action: 'mark_as_read',
      }

      const error = new Error('API Error: Chat not found')
      mockClient.patch.mockRejectedValue(error)

      // Act & Assert
      await expect(
        unipileService.patchChat(chatId, request, accountId)
      ).rejects.toThrow('API Error: Chat not found')
    })

    it('should handle unsuccessful response from Unipile', async () => {
      // Arrange
      const chatId = 'test-chat-id'
      const accountId = 'test-account-id'
      const request: UnipileApiPatchChatRequest = {
        action: 'mark_as_read',
      }
      
      const failedResponse: UnipileApiPatchChatResponse = {
        object: 'ChatAction',
        chat_id: chatId,
        account_id: accountId,
        action: 'mark_as_read',
        success: false,
        message: 'Chat is read-only',
      }

      mockClient.patch.mockResolvedValue({ data: failedResponse })

      // Act
      const result = await unipileService.patchChat(chatId, request, accountId)

      // Assert
      expect(result.success).toBe(false)
      expect(result.message).toBe('Chat is read-only')
    })

    it('should properly encode URL parameters', async () => {
      // Arrange
      const chatId = 'test-chat-id'
      const accountId = 'test account with spaces'
      const request: UnipileApiPatchChatRequest = {
        action: 'mark_as_read',
      }
      
      const expectedResponse: UnipileApiPatchChatResponse = {
        object: 'ChatAction',
        chat_id: chatId,
        account_id: accountId,
        action: 'mark_as_read',
        success: true,
      }

      mockClient.patch.mockResolvedValue({ data: expectedResponse })

      // Act
      await unipileService.patchChat(chatId, request, accountId)

      // Assert
      expect(mockClient.patch).toHaveBeenCalledWith(
        `/chats/${chatId}?account_id=test+account+with+spaces`,
        request
      )
    })
  })
}) 