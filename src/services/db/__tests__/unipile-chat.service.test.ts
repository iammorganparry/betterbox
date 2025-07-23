import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnipileChatService } from '../unipile-chat.service'
import type { PrismaClient } from '../../../../generated/prisma'

// Mock Prisma client
const mockPrismaClient = {
  unipileChat: {
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  unipileChatAttendee: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
} as unknown as PrismaClient

describe('UnipileChatService - Mark as Read', () => {
  let chatService: UnipileChatService

  beforeEach(() => {
    vi.clearAllMocks()
    chatService = new UnipileChatService(mockPrismaClient)
  })

  describe('markChatAsRead', () => {
    it('should successfully mark a chat as read', async () => {
      // Arrange
      const chatId = 'test-chat-id'
      const mockUpdatedChat = {
        id: chatId,
        unread_count: 0,
        updated_at: new Date(),
        external_id: 'external-chat-1',
        provider: 'linkedin',
        chat_type: 'direct',
        name: null,
        last_message_at: new Date(),
        archived: 0,
        read_only: 0,
        muted_until: null,
        organization_id: null,
        mailbox_id: null,
        mailbox_name: null,
        content_type: null,
        disabled_features: null,
        is_deleted: false,
        created_at: new Date(),
        unipile_account_id: 'account-1',
        account_type: null,
      }

      mockPrismaClient.unipileChat.update = vi.fn().mockResolvedValue(mockUpdatedChat)

      // Act
      const result = await chatService.markChatAsRead(chatId)

      // Assert
      expect(mockPrismaClient.unipileChat.update).toHaveBeenCalledTimes(1)
      expect(mockPrismaClient.unipileChat.update).toHaveBeenCalledWith({
        where: { id: chatId },
        data: {
          unread_count: 0,
          updated_at: expect.any(Date),
        },
      })
      expect(result).toEqual(mockUpdatedChat)
      expect(result.unread_count).toBe(0)
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      const chatId = 'non-existent-chat-id'
      const dbError = new Error('Chat not found')
      
      mockPrismaClient.unipileChat.update = vi.fn().mockRejectedValue(dbError)

      // Act & Assert
      await expect(chatService.markChatAsRead(chatId)).rejects.toThrow('Chat not found')
      expect(mockPrismaClient.unipileChat.update).toHaveBeenCalledWith({
        where: { id: chatId },
        data: {
          unread_count: 0,
          updated_at: expect.any(Date),
        },
      })
    })
  })

  describe('updateUnreadCount', () => {
    it('should successfully update unread count to a specific value', async () => {
      // Arrange
      const chatId = 'test-chat-id'
      const unreadCount = 5
      const mockUpdatedChat = {
        id: chatId,
        unread_count: unreadCount,
        updated_at: new Date(),
        external_id: 'external-chat-1',
        provider: 'linkedin',
        chat_type: 'direct',
        name: null,
        last_message_at: new Date(),
        archived: 0,
        read_only: 0,
        muted_until: null,
        organization_id: null,
        mailbox_id: null,
        mailbox_name: null,
        content_type: null,
        disabled_features: null,
        is_deleted: false,
        created_at: new Date(),
        unipile_account_id: 'account-1',
        account_type: null,
      }

      mockPrismaClient.unipileChat.update = vi.fn().mockResolvedValue(mockUpdatedChat)

      // Act
      const result = await chatService.updateUnreadCount(chatId, unreadCount)

      // Assert
      expect(mockPrismaClient.unipileChat.update).toHaveBeenCalledTimes(1)
      expect(mockPrismaClient.unipileChat.update).toHaveBeenCalledWith({
        where: { id: chatId },
        data: {
          unread_count: unreadCount,
          updated_at: expect.any(Date),
        },
      })
      expect(result).toEqual(mockUpdatedChat)
      expect(result.unread_count).toBe(unreadCount)
    })

    it('should handle zero unread count', async () => {
      // Arrange
      const chatId = 'test-chat-id'
      const unreadCount = 0
      const mockUpdatedChat = {
        id: chatId,
        unread_count: 0,
        updated_at: new Date(),
        external_id: 'external-chat-1',
        provider: 'linkedin',
        chat_type: 'direct',
        name: null,
        last_message_at: new Date(),
        archived: 0,
        read_only: 0,
        muted_until: null,
        organization_id: null,
        mailbox_id: null,
        mailbox_name: null,
        content_type: null,
        disabled_features: null,
        is_deleted: false,
        created_at: new Date(),
        unipile_account_id: 'account-1',
        account_type: null,
      }

      mockPrismaClient.unipileChat.update = vi.fn().mockResolvedValue(mockUpdatedChat)

      // Act
      const result = await chatService.updateUnreadCount(chatId, unreadCount)

      // Assert
      expect(result.unread_count).toBe(0)
    })

    it('should handle negative unread count by setting it to the provided value', async () => {
      // Arrange
      const chatId = 'test-chat-id'
      const unreadCount = -1 // Edge case
      const mockUpdatedChat = {
        id: chatId,
        unread_count: -1,
        updated_at: new Date(),
        external_id: 'external-chat-1',
        provider: 'linkedin',
        chat_type: 'direct',
        name: null,
        last_message_at: new Date(),
        archived: 0,
        read_only: 0,
        muted_until: null,
        organization_id: null,
        mailbox_id: null,
        mailbox_name: null,
        content_type: null,
        disabled_features: null,
        is_deleted: false,
        created_at: new Date(),
        unipile_account_id: 'account-1',
        account_type: null,
      }

      mockPrismaClient.unipileChat.update = vi.fn().mockResolvedValue(mockUpdatedChat)

      // Act
      const result = await chatService.updateUnreadCount(chatId, unreadCount)

      // Assert
      expect(result.unread_count).toBe(-1)
      expect(mockPrismaClient.unipileChat.update).toHaveBeenCalledWith({
        where: { id: chatId },
        data: {
          unread_count: -1,
          updated_at: expect.any(Date),
        },
      })
    })

    it('should update the updated_at timestamp', async () => {
      // Arrange
      const chatId = 'test-chat-id'
      const unreadCount = 3
      const beforeUpdate = new Date()
      
      mockPrismaClient.unipileChat.update = vi.fn().mockImplementation(({ data }) => {
        return Promise.resolve({
          id: chatId,
          unread_count: unreadCount,
          updated_at: data.updated_at,
          external_id: 'external-chat-1',
          provider: 'linkedin',
          chat_type: 'direct',
          name: null,
          last_message_at: new Date(),
          archived: 0,
          read_only: 0,
          muted_until: null,
          organization_id: null,
          mailbox_id: null,
          mailbox_name: null,
          content_type: null,
          disabled_features: null,
          is_deleted: false,
          created_at: new Date(),
          unipile_account_id: 'account-1',
          account_type: null,
        })
      })

      // Act
      const result = await chatService.updateUnreadCount(chatId, unreadCount)

      // Assert
      expect(result.updated_at).toBeInstanceOf(Date)
      expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
    })
  })
}) 