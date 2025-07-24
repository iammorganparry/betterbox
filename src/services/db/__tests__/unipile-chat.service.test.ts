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

describe('UnipileChatService - Chat Retrieval and Filtering', () => {
  let chatService: UnipileChatService

  beforeEach(() => {
    vi.clearAllMocks()
    chatService = new UnipileChatService(mockPrismaClient)
  })

  describe('getChatsByUser', () => {
    it('should return all chats for a user without provider filter', async () => {
      // Arrange
      const userId = 'test-user-id'
      const mockChats = [
        {
          id: 'chat1',
          external_id: 'ext-chat-1',
          provider: 'linkedin',
          unread_count: 5,
          last_message_at: new Date('2024-01-15'),
          is_deleted: false,
          unipile_account: { user_id: userId },
          UnipileChatAttendee: [
            {
              id: 'attendee1',
              is_self: 0,
              contact: { full_name: 'John Doe' }
            }
          ],
          UnipileMessage: [
            {
              id: 'msg1',
              content: 'Hello',
              is_outgoing: false
            }
          ]
        },
        {
          id: 'chat2',
          external_id: 'ext-chat-2',
          provider: 'email',
          unread_count: 0,
          last_message_at: new Date('2024-01-14'),
          is_deleted: false,
          unipile_account: { user_id: userId },
          UnipileChatAttendee: [],
          UnipileMessage: []
        }
      ]

      mockPrismaClient.unipileChat.findMany = vi.fn().mockResolvedValue(mockChats)

      // Act
      const result = await chatService.getChatsByUser(userId, undefined, {
        limit: 50,
        include_attendees: true,
        include_account: true,
        include_messages: true
      })

      // Assert
      expect(mockPrismaClient.unipileChat.findMany).toHaveBeenCalledWith({
        where: {
          unipile_account: { 
            user_id: userId,
            is_deleted: false
          },
          is_deleted: false
        },
        include: {
          unipile_account: true,
          UnipileChatAttendee: {
            where: { is_deleted: false },
            include: { contact: true }
          },
          UnipileMessage: {
            where: { is_deleted: false },
            orderBy: { sent_at: 'desc' },
            take: 5
          }
        },
        orderBy: { last_message_at: 'desc' },
        take: 50
      })
      expect(result).toEqual(mockChats)
    })

    it('should filter chats by provider when specified', async () => {
      // Arrange
      const userId = 'test-user-id'
      const provider = 'linkedin'
      const mockLinkedInChats = [
        {
          id: 'chat1',
          provider: 'linkedin',
          unread_count: 3,
          is_deleted: false,
          unipile_account: { user_id: userId }
        }
      ]

      mockPrismaClient.unipileChat.findMany = vi.fn().mockResolvedValue(mockLinkedInChats)

      // Act
      const result = await chatService.getChatsByUser(userId, provider, {
        limit: 25
      })

      // Assert
      expect(mockPrismaClient.unipileChat.findMany).toHaveBeenCalledWith({
        where: {
          unipile_account: { 
            user_id: userId,
            provider: provider,
            is_deleted: false
          },
          is_deleted: false
        },
        include: {},
        orderBy: { last_message_at: 'desc' },
        take: 25
      })
      expect(result).toEqual(mockLinkedInChats)
    })

    it('should return chats with mixed unread counts for proper filtering', async () => {
      // Arrange
      const userId = 'test-user-id'
      const mockMixedChats = [
        {
          id: 'unread-chat-1',
          provider: 'linkedin',
          unread_count: 10,
          is_deleted: false,
          unipile_account: { user_id: userId }
        },
        {
          id: 'read-chat-1',
          provider: 'linkedin',
          unread_count: 0,
          is_deleted: false,
          unipile_account: { user_id: userId }
        },
        {
          id: 'unread-chat-2',
          provider: 'email',
          unread_count: 2,
          is_deleted: false,
          unipile_account: { user_id: userId }
        },
        {
          id: 'read-chat-2',
          provider: 'email',
          unread_count: 0,
          is_deleted: false,
          unipile_account: { user_id: userId }
        }
      ]

      mockPrismaClient.unipileChat.findMany = vi.fn().mockResolvedValue(mockMixedChats)

      // Act
      const result = await chatService.getChatsByUser(userId, undefined, { limit: 50 })

      // Assert
      expect(result).toHaveLength(4)
      
      // Test that we get the expected mix of read/unread chats
      const unreadChats = result.filter(chat => chat.unread_count > 0)
      const readChats = result.filter(chat => chat.unread_count === 0)
      
      expect(unreadChats).toHaveLength(2)
      expect(readChats).toHaveLength(2)
      expect(unreadChats.map(c => c.id)).toEqual(['unread-chat-1', 'unread-chat-2'])
      expect(readChats.map(c => c.id)).toEqual(['read-chat-1', 'read-chat-2'])
    })

    it('should exclude deleted chats by default', async () => {
      // Arrange
      const userId = 'test-user-id'
      mockPrismaClient.unipileChat.findMany = vi.fn().mockResolvedValue([])

      // Act
      await chatService.getChatsByUser(userId, undefined, { limit: 50 })

      // Assert
      expect(mockPrismaClient.unipileChat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_deleted: false,
            unipile_account: expect.objectContaining({
              is_deleted: false
            })
          })
        })
      )
    })

    it('should order chats by last_message_at descending by default', async () => {
      // Arrange
      const userId = 'test-user-id'
      mockPrismaClient.unipileChat.findMany = vi.fn().mockResolvedValue([])

      // Act
      await chatService.getChatsByUser(userId, undefined, {
        limit: 50,
        order_by: 'last_message_at',
        order_direction: 'desc'
      })

      // Assert
      expect(mockPrismaClient.unipileChat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { last_message_at: 'desc' }
        })
      )
    })

    it('should handle custom ordering options', async () => {
      // Arrange
      const userId = 'test-user-id'
      mockPrismaClient.unipileChat.findMany = vi.fn().mockResolvedValue([])

      // Act
      await chatService.getChatsByUser(userId, undefined, {
        limit: 50,
        order_by: 'created_at',
        order_direction: 'asc'
      })

      // Assert
      expect(mockPrismaClient.unipileChat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'asc' }
        })
      )
    })

    it('should include attendees and messages when requested', async () => {
      // Arrange
      const userId = 'test-user-id'
      mockPrismaClient.unipileChat.findMany = vi.fn().mockResolvedValue([])

      // Act
      await chatService.getChatsByUser(userId, undefined, {
        limit: 50,
        include_attendees: true,
        include_messages: true,
        include_account: true
      })

      // Assert
      expect(mockPrismaClient.unipileChat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            unipile_account: true,
            UnipileChatAttendee: {
              where: { is_deleted: false },
              include: { contact: true }
            },
            UnipileMessage: {
              where: { is_deleted: false },
              orderBy: { sent_at: 'desc' },
              take: 5
            }
          }
        })
      )
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      const userId = 'test-user-id'
      const dbError = new Error('Database connection failed')
      mockPrismaClient.unipileChat.findMany = vi.fn().mockRejectedValue(dbError)

      // Act & Assert
      await expect(chatService.getChatsByUser(userId, undefined, { limit: 50 }))
        .rejects.toThrow('Database connection failed')
    })

    it('should return empty array when no chats exist for user', async () => {
      // Arrange
      const userId = 'user-with-no-chats'
      mockPrismaClient.unipileChat.findMany = vi.fn().mockResolvedValue([])

      // Act
      const result = await chatService.getChatsByUser(userId, undefined, { limit: 50 })

      // Assert
      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })
  })
})

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