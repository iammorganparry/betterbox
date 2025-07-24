import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatFolderService } from '../chat-folder.service'
import type { PrismaClient } from '../../../../generated/prisma'

// Mock Prisma client
const mockPrismaClient = {
  chatFolder: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  chatFolderAssignment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
} as unknown as PrismaClient

describe('ChatFolderService - Folder Management', () => {
  let chatFolderService: ChatFolderService

  beforeEach(() => {
    vi.clearAllMocks()
    chatFolderService = new ChatFolderService(mockPrismaClient)
  })

  describe('createFolder', () => {
    it('should create a new folder successfully', async () => {
      // Arrange
      const userId = 'user-123'
      const folderData = {
        name: 'Work Chats',
        color: '#3b82f6',
        sort_order: 1,
      }
      const expectedFolder = {
        id: 'folder-123',
        user_id: userId,
        name: 'Work Chats',
        color: '#3b82f6',
        sort_order: 1,
        is_default: false,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      }

      mockPrismaClient.chatFolder.create = vi.fn().mockResolvedValue(expectedFolder)

      // Act
      const result = await chatFolderService.createFolder(userId, folderData)

      // Assert
      expect(mockPrismaClient.chatFolder.create).toHaveBeenCalledWith({
        data: {
          user_id: userId,
          name: 'Work Chats',
          color: '#3b82f6',
          sort_order: 1,
          is_default: false,
        },
      })
      expect(result).toEqual(expectedFolder)
    })

    it('should create a default folder when specified', async () => {
      // Arrange
      const userId = 'user-123'
      const folderData = {
        name: 'All Chats',
        is_default: true,
      }

      mockPrismaClient.chatFolder.create = vi.fn().mockResolvedValue({})

      // Act
      await chatFolderService.createFolder(userId, folderData)

      // Assert
      expect(mockPrismaClient.chatFolder.create).toHaveBeenCalledWith({
        data: {
          user_id: userId,
          name: 'All Chats',
          color: undefined,
          sort_order: 0,
          is_default: true,
        },
      })
    })

    it('should use default values when not provided', async () => {
      // Arrange
      const userId = 'user-123'
      const folderData = {
        name: 'Simple Folder',
      }

      mockPrismaClient.chatFolder.create = vi.fn().mockResolvedValue({})

      // Act
      await chatFolderService.createFolder(userId, folderData)

      // Assert
      expect(mockPrismaClient.chatFolder.create).toHaveBeenCalledWith({
        data: {
          user_id: userId,
          name: 'Simple Folder',
          color: undefined,
          sort_order: 0,
          is_default: false,
        },
      })
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      const userId = 'user-123'
      const folderData = { name: 'Test Folder' }
      const dbError = new Error('Database constraint violation')

      mockPrismaClient.chatFolder.create = vi.fn().mockRejectedValue(dbError)

      // Act & Assert
      await expect(chatFolderService.createFolder(userId, folderData))
        .rejects.toThrow('Database constraint violation')
    })
  })

  describe('getFoldersByUser', () => {
    it('should return all folders for a user with default options', async () => {
      // Arrange
      const userId = 'user-123'
      const expectedFolders = [
        {
          id: 'folder-1',
          user_id: userId,
          name: 'All Chats',
          is_default: true,
          sort_order: 0,
          is_deleted: false,
        },
        {
          id: 'folder-2',
          user_id: userId,
          name: 'Work',
          is_default: false,
          sort_order: 1,
          is_deleted: false,
        },
      ]

      mockPrismaClient.chatFolder.findMany = vi.fn().mockResolvedValue(expectedFolders)

      // Act
      const result = await chatFolderService.getFoldersByUser(userId)

      // Assert
      expect(mockPrismaClient.chatFolder.findMany).toHaveBeenCalledWith({
        where: {
          user_id: userId,
          is_deleted: false,
        },
        orderBy: {
          sort_order: 'asc',
        },
      })
      expect(result).toEqual(expectedFolders)
    })

    it('should include deleted folders when requested', async () => {
      // Arrange
      const userId = 'user-123'
      const options = { include_deleted: true }

      mockPrismaClient.chatFolder.findMany = vi.fn().mockResolvedValue([])

      // Act
      await chatFolderService.getFoldersByUser(userId, options)

      // Assert
      expect(mockPrismaClient.chatFolder.findMany).toHaveBeenCalledWith({
        where: {
          user_id: userId,
          is_deleted: undefined,
        },
        orderBy: {
          sort_order: 'asc',
        },
      })
    })

    it('should order by name when specified', async () => {
      // Arrange
      const userId = 'user-123'
      const options = {
        order_by: 'name' as const,
        order_direction: 'desc' as const,
      }

      mockPrismaClient.chatFolder.findMany = vi.fn().mockResolvedValue([])

      // Act
      await chatFolderService.getFoldersByUser(userId, options)

      // Assert
      expect(mockPrismaClient.chatFolder.findMany).toHaveBeenCalledWith({
        where: {
          user_id: userId,
          is_deleted: false,
        },
        orderBy: {
          name: 'desc',
        },
      })
    })

    it('should return empty array when user has no folders', async () => {
      // Arrange
      const userId = 'user-with-no-folders'

      mockPrismaClient.chatFolder.findMany = vi.fn().mockResolvedValue([])

      // Act
      const result = await chatFolderService.getFoldersByUser(userId)

      // Assert
      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })
  })

  describe('getFolderById', () => {
    it('should return folder when it exists and belongs to user', async () => {
      // Arrange
      const folderId = 'folder-123'
      const userId = 'user-123'
      const expectedFolder = {
        id: folderId,
        user_id: userId,
        name: 'Work Folder',
        is_deleted: false,
      }

      mockPrismaClient.chatFolder.findFirst = vi.fn().mockResolvedValue(expectedFolder)

      // Act
      const result = await chatFolderService.getFolderById(folderId, userId)

      // Assert
      expect(mockPrismaClient.chatFolder.findFirst).toHaveBeenCalledWith({
        where: {
          id: folderId,
          user_id: userId,
          is_deleted: false,
        },
      })
      expect(result).toEqual(expectedFolder)
    })

    it('should return null when folder does not exist', async () => {
      // Arrange
      const folderId = 'non-existent-folder'
      const userId = 'user-123'

      mockPrismaClient.chatFolder.findFirst = vi.fn().mockResolvedValue(null)

      // Act
      const result = await chatFolderService.getFolderById(folderId, userId)

      // Assert
      expect(result).toBeNull()
    })

    it('should return null when folder belongs to different user', async () => {
      // Arrange
      const folderId = 'folder-123'
      const userId = 'user-123'

      mockPrismaClient.chatFolder.findFirst = vi.fn().mockResolvedValue(null)

      // Act
      const result = await chatFolderService.getFolderById(folderId, userId)

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('updateFolder', () => {
    it('should update folder successfully', async () => {
      // Arrange
      const folderId = 'folder-123'
      const userId = 'user-123'
      const updateData = {
        name: 'Updated Folder Name',
        color: '#ef4444',
        sort_order: 5,
      }
      const updatedFolder = {
        id: folderId,
        user_id: userId,
        ...updateData,
        updated_at: new Date(),
      }

      mockPrismaClient.chatFolder.update = vi.fn().mockResolvedValue(updatedFolder)

      // Act
      const result = await chatFolderService.updateFolder(folderId, userId, updateData)

      // Assert
      expect(mockPrismaClient.chatFolder.update).toHaveBeenCalledWith({
        where: {
          id: folderId,
          user_id: userId,
        },
        data: {
          ...updateData,
          updated_at: expect.any(Date),
        },
      })
      expect(result).toEqual(updatedFolder)
    })

    it('should update only provided fields', async () => {
      // Arrange
      const folderId = 'folder-123'
      const userId = 'user-123'
      const updateData = { name: 'New Name Only' }

      mockPrismaClient.chatFolder.update = vi.fn().mockResolvedValue({})

      // Act
      await chatFolderService.updateFolder(folderId, userId, updateData)

      // Assert
      expect(mockPrismaClient.chatFolder.update).toHaveBeenCalledWith({
        where: {
          id: folderId,
          user_id: userId,
        },
        data: {
          name: 'New Name Only',
          updated_at: expect.any(Date),
        },
      })
    })
  })

  describe('deleteFolder', () => {
    it('should soft delete folder successfully', async () => {
      // Arrange
      const folderId = 'folder-123'
      const userId = 'user-123'
      const deletedFolder = {
        id: folderId,
        user_id: userId,
        is_deleted: true,
        updated_at: new Date(),
      }

      mockPrismaClient.chatFolder.update = vi.fn().mockResolvedValue(deletedFolder)

      // Act
      const result = await chatFolderService.deleteFolder(folderId, userId)

      // Assert
      expect(mockPrismaClient.chatFolder.update).toHaveBeenCalledWith({
        where: {
          id: folderId,
          user_id: userId,
        },
        data: {
          is_deleted: true,
          updated_at: expect.any(Date),
        },
      })
      expect(result).toEqual(deletedFolder)
    })
  })

  describe('createDefaultFolder', () => {
    it('should create default "All Chats" folder', async () => {
      // Arrange
      const userId = 'user-123'
      const expectedFolder = {
        id: 'folder-default-123',
        user_id: userId,
        name: 'All Chats',
        is_default: true,
        sort_order: 0,
      }

      mockPrismaClient.chatFolder.create = vi.fn().mockResolvedValue(expectedFolder)

      // Act
      const result = await chatFolderService.createDefaultFolder(userId)

      // Assert
      expect(mockPrismaClient.chatFolder.create).toHaveBeenCalledWith({
        data: {
          user_id: userId,
          name: 'All Chats',
          color: undefined,
          sort_order: 0,
          is_default: true,
        },
      })
      expect(result).toEqual(expectedFolder)
    })
  })
})

describe('ChatFolderService - Folder Assignments', () => {
  let chatFolderService: ChatFolderService

  beforeEach(() => {
    vi.clearAllMocks()
    chatFolderService = new ChatFolderService(mockPrismaClient)
  })

  describe('assignChatToFolder', () => {
    it('should assign chat to folder successfully', async () => {
      // Arrange
      const chatId = 'chat-123'
      const folderId = 'folder-123'
      const assignedById = 'user-123'
      const expectedAssignment = {
        id: 'assignment-123',
        chat_id: chatId,
        folder_id: folderId,
        assigned_by_id: assignedById,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      }

      mockPrismaClient.chatFolderAssignment.create = vi.fn().mockResolvedValue(expectedAssignment)

      // Act
      const result = await chatFolderService.assignChatToFolder(chatId, folderId, assignedById)

      // Assert
      expect(mockPrismaClient.chatFolderAssignment.create).toHaveBeenCalledWith({
        data: {
          chat_id: chatId,
          folder_id: folderId,
          assigned_by_id: assignedById,
        },
      })
      expect(result).toEqual(expectedAssignment)
    })

    it('should handle duplicate assignment errors', async () => {
      // Arrange
      const chatId = 'chat-123'
      const folderId = 'folder-123'
      const assignedById = 'user-123'
      const duplicateError = new Error('Unique constraint violation')

      mockPrismaClient.chatFolderAssignment.create = vi.fn().mockRejectedValue(duplicateError)

      // Act & Assert
      await expect(
        chatFolderService.assignChatToFolder(chatId, folderId, assignedById)
      ).rejects.toThrow('Unique constraint violation')
    })
  })

  describe('removeChatFromFolder', () => {
    it('should remove chat from folder successfully', async () => {
      // Arrange
      const chatId = 'chat-123'
      const folderId = 'folder-123'
      const existingAssignment = {
        id: 'assignment-123',
        chat_id: chatId,
        folder_id: folderId,
        is_deleted: false,
      }
      const updatedAssignment = {
        ...existingAssignment,
        is_deleted: true,
        updated_at: new Date(),
      }

      mockPrismaClient.chatFolderAssignment.findFirst = vi.fn().mockResolvedValue(existingAssignment)
      mockPrismaClient.chatFolderAssignment.update = vi.fn().mockResolvedValue(updatedAssignment)

      // Act
      const result = await chatFolderService.removeChatFromFolder(chatId, folderId)

      // Assert
      expect(mockPrismaClient.chatFolderAssignment.findFirst).toHaveBeenCalledWith({
        where: {
          chat_id: chatId,
          folder_id: folderId,
          is_deleted: false,
        },
      })
      expect(mockPrismaClient.chatFolderAssignment.update).toHaveBeenCalledWith({
        where: {
          id: 'assignment-123',
        },
        data: {
          is_deleted: true,
          updated_at: expect.any(Date),
        },
      })
      expect(result).toEqual(updatedAssignment)
    })

    it('should throw error when assignment not found', async () => {
      // Arrange
      const chatId = 'chat-123'
      const folderId = 'folder-123'

      mockPrismaClient.chatFolderAssignment.findFirst = vi.fn().mockResolvedValue(null)

      // Act & Assert
      await expect(
        chatFolderService.removeChatFromFolder(chatId, folderId)
      ).rejects.toThrow('Assignment not found')
    })
  })

  describe('getChatFolders', () => {
    it('should return all folders for a chat', async () => {
      // Arrange
      const chatId = 'chat-123'
      const expectedAssignments = [
        {
          id: 'assignment-1',
          chat_id: chatId,
          folder_id: 'folder-1',
          is_deleted: false,
          folder: {
            id: 'folder-1',
            name: 'Work',
            color: '#3b82f6',
          },
        },
        {
          id: 'assignment-2',
          chat_id: chatId,
          folder_id: 'folder-2',
          is_deleted: false,
          folder: {
            id: 'folder-2',
            name: 'Important',
            color: '#ef4444',
          },
        },
      ]

      mockPrismaClient.chatFolderAssignment.findMany = vi.fn().mockResolvedValue(expectedAssignments)

      // Act
      const result = await chatFolderService.getChatFolders(chatId)

      // Assert
      expect(mockPrismaClient.chatFolderAssignment.findMany).toHaveBeenCalledWith({
        where: {
          chat_id: chatId,
          is_deleted: false,
        },
        include: {
          folder: true,
        },
      })
      expect(result).toEqual(expectedAssignments)
    })

    it('should return empty array when chat has no folder assignments', async () => {
      // Arrange
      const chatId = 'chat-with-no-folders'

      mockPrismaClient.chatFolderAssignment.findMany = vi.fn().mockResolvedValue([])

      // Act
      const result = await chatFolderService.getChatFolders(chatId)

      // Assert
      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })
  })

  describe('getChatsInFolder', () => {
    it('should return all chats in a folder with details', async () => {
      // Arrange
      const folderId = 'folder-123'
      const expectedAssignments = [
        {
          id: 'assignment-1',
          folder_id: folderId,
          chat_id: 'chat-1',
          is_deleted: false,
          chat: {
            id: 'chat-1',
            external_id: 'ext-chat-1',
            provider: 'linkedin',
            unread_count: 2,
            UnipileChatAttendee: [
              {
                id: 'attendee-1',
                is_self: 0,
                contact: {
                  id: 'contact-1',
                  full_name: 'John Doe',
                },
              },
            ],
            UnipileMessage: [
              {
                id: 'msg-1',
                content: 'Hello',
                sent_at: new Date(),
              },
            ],
          },
        },
      ]

      mockPrismaClient.chatFolderAssignment.findMany = vi.fn().mockResolvedValue(expectedAssignments)

      // Act
      const result = await chatFolderService.getChatsInFolder(folderId)

      // Assert
      expect(mockPrismaClient.chatFolderAssignment.findMany).toHaveBeenCalledWith({
        where: {
          folder_id: folderId,
          is_deleted: false,
        },
        include: {
          chat: {
            include: {
              UnipileChatAttendee: {
                include: {
                  contact: true,
                },
              },
              UnipileMessage: {
                take: 1,
                orderBy: {
                  sent_at: 'desc',
                },
              },
            },
          },
        },
      })
      expect(result).toEqual(expectedAssignments)
    })
  })

  describe('getFoldersWithChatCounts', () => {
    it('should return folders with chat counts', async () => {
      // Arrange
      const userId = 'user-123'
      const mockFoldersWithCounts = [
        {
          id: 'folder-1',
          user_id: userId,
          name: 'All Chats',
          is_default: true,
          sort_order: 0,
          is_deleted: false,
          _count: {
            ChatFolderAssignment: 10,
          },
        },
        {
          id: 'folder-2',
          user_id: userId,
          name: 'Work',
          is_default: false,
          sort_order: 1,
          is_deleted: false,
          _count: {
            ChatFolderAssignment: 5,
          },
        },
      ]

      const expectedResult = [
        {
          ...mockFoldersWithCounts[0],
          chat_count: 10,
        },
        {
          ...mockFoldersWithCounts[1],
          chat_count: 5,
        },
      ]

      mockPrismaClient.chatFolder.findMany = vi.fn().mockResolvedValue(mockFoldersWithCounts)

      // Act
      const result = await chatFolderService.getFoldersWithChatCounts(userId)

      // Assert
      expect(mockPrismaClient.chatFolder.findMany).toHaveBeenCalledWith({
        where: {
          user_id: userId,
          is_deleted: false,
        },
        include: {
          _count: {
            select: {
              ChatFolderAssignment: {
                where: {
                  is_deleted: false,
                },
              },
            },
          },
        },
        orderBy: {
          sort_order: 'asc',
        },
      })
      expect(result).toEqual(expectedResult)
    })
  })

  describe('isChatInFolder', () => {
    it('should return true when chat is in folder', async () => {
      // Arrange
      const chatId = 'chat-123'
      const folderId = 'folder-123'
      const existingAssignment = {
        id: 'assignment-123',
        chat_id: chatId,
        folder_id: folderId,
        is_deleted: false,
      }

      mockPrismaClient.chatFolderAssignment.findFirst = vi.fn().mockResolvedValue(existingAssignment)

      // Act
      const result = await chatFolderService.isChatInFolder(chatId, folderId)

      // Assert
      expect(mockPrismaClient.chatFolderAssignment.findFirst).toHaveBeenCalledWith({
        where: {
          chat_id: chatId,
          folder_id: folderId,
          is_deleted: false,
        },
      })
      expect(result).toBe(true)
    })

    it('should return false when chat is not in folder', async () => {
      // Arrange
      const chatId = 'chat-123'
      const folderId = 'folder-123'

      mockPrismaClient.chatFolderAssignment.findFirst = vi.fn().mockResolvedValue(null)

      // Act
      const result = await chatFolderService.isChatInFolder(chatId, folderId)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('bulkAssignChatsToFolder', () => {
    it('should assign multiple chats to folder successfully', async () => {
      // Arrange
      const chatIds = ['chat-1', 'chat-2', 'chat-3']
      const folderId = 'folder-123'
      const assignedById = 'user-123'
      const expectedAssignments = chatIds.map((chatId) => ({
        id: `assignment-${chatId}`,
        chat_id: chatId,
        folder_id: folderId,
        assigned_by_id: assignedById,
        is_deleted: false,
      }))

      mockPrismaClient.chatFolderAssignment.createMany = vi.fn().mockResolvedValue({ count: 3 })
      mockPrismaClient.chatFolderAssignment.findMany = vi.fn().mockResolvedValue(expectedAssignments)

      // Act
      const result = await chatFolderService.bulkAssignChatsToFolder(chatIds, folderId, assignedById)

      // Assert
      expect(mockPrismaClient.chatFolderAssignment.createMany).toHaveBeenCalledWith({
        data: [
          { chat_id: 'chat-1', folder_id: folderId, assigned_by_id: assignedById },
          { chat_id: 'chat-2', folder_id: folderId, assigned_by_id: assignedById },
          { chat_id: 'chat-3', folder_id: folderId, assigned_by_id: assignedById },
        ],
        skipDuplicates: true,
      })
      expect(mockPrismaClient.chatFolderAssignment.findMany).toHaveBeenCalledWith({
        where: {
          chat_id: { in: chatIds },
          folder_id: folderId,
          is_deleted: false,
        },
      })
      expect(result).toEqual(expectedAssignments)
    })

    it('should handle empty chat list', async () => {
      // Arrange
      const chatIds: string[] = []
      const folderId = 'folder-123'
      const assignedById = 'user-123'

      mockPrismaClient.chatFolderAssignment.createMany = vi.fn().mockResolvedValue({ count: 0 })
      mockPrismaClient.chatFolderAssignment.findMany = vi.fn().mockResolvedValue([])

      // Act
      const result = await chatFolderService.bulkAssignChatsToFolder(chatIds, folderId, assignedById)

      // Assert
      expect(mockPrismaClient.chatFolderAssignment.createMany).toHaveBeenCalledWith({
        data: [],
        skipDuplicates: true,
      })
      expect(result).toEqual([])
    })

    it('should skip duplicates when assigning chats', async () => {
      // Arrange
      const chatIds = ['chat-1', 'chat-2']
      const folderId = 'folder-123'
      const assignedById = 'user-123'

      mockPrismaClient.chatFolderAssignment.createMany = vi.fn().mockResolvedValue({ count: 1 }) // Only 1 created due to duplicate
      mockPrismaClient.chatFolderAssignment.findMany = vi.fn().mockResolvedValue([
        { id: 'assignment-1', chat_id: 'chat-1', folder_id: folderId, assigned_by_id: assignedById, is_deleted: false },
      ])

      // Act
      const result = await chatFolderService.bulkAssignChatsToFolder(chatIds, folderId, assignedById)

      // Assert
      expect(mockPrismaClient.chatFolderAssignment.createMany).toHaveBeenCalledWith({
        data: expect.any(Array),
        skipDuplicates: true,
      })
      expect(result).toHaveLength(1)
    })
  })
}) 