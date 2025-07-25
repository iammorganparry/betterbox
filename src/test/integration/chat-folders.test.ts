import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ChatFolderService } from '~/services/db/chat-folder.service'
import { UnipileChatService } from '~/services/db/unipile-chat.service'
import { UnipileAccountService } from '~/services/db/unipile-account.service'
import { UserService } from '~/services/db/user.service'
import { db } from '~/server/db'

// Mock the database connection with proper state tracking
vi.mock('~/server/db', () => {
  // State stores to track mock data
  const mockUsers = new Map()
  const mockAccounts = new Map()
  const mockChats = new Map()
  const mockFolders = new Map()
  const mockAssignments = new Map()
  
  // Helper function to generate IDs
  const generateId = () => Math.random().toString(36).substring(2)
  
  return {
    db: {
      user: {
        create: vi.fn().mockImplementation(({ data }) => {
          const user = {
            id: data.id || generateId(),
            email: data.email,
            first_name: data.first_name,
            last_name: data.last_name,
            created_at: new Date(),
            updated_at: new Date()
          }
          mockUsers.set(user.id, user)
          return Promise.resolve(user)
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const user = mockUsers.get(where?.id)
          return Promise.resolve(user || null)
        }),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          const user = Array.from(mockUsers.values()).find(u => {
            if (where?.id && u.id !== where.id) return false
            if (where?.email && u.email !== where.email) return false
            return true
          })
          return Promise.resolve(user || null)
        }),
        delete: vi.fn().mockImplementation(({ where }) => {
          const user = mockUsers.get(where?.id)
          if (user) mockUsers.delete(where.id)
          return Promise.resolve(user)
        }),
        deleteMany: vi.fn().mockImplementation(() => {
          const count = mockUsers.size
          mockUsers.clear()
          return Promise.resolve({ count })
        }),
      },
      unipileAccount: {
        upsert: vi.fn().mockImplementation(({ where, create, update }) => {
          const existingAccount = Array.from(mockAccounts.values()).find(a => 
            a.user_id === where?.user_id_account_id?.user_id && 
            a.account_id === where?.user_id_account_id?.account_id
          )
          
          if (existingAccount) {
            const updatedAccount = { ...existingAccount, ...update, updated_at: new Date() }
            mockAccounts.set(existingAccount.id, updatedAccount)
            return Promise.resolve(updatedAccount)
          } else {
            const newAccount = {
              id: generateId(),
              ...create,
              created_at: new Date(),
              updated_at: new Date(),
              is_deleted: false
            }
            mockAccounts.set(newAccount.id, newAccount)
            return Promise.resolve(newAccount)
          }
        }),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          const account = Array.from(mockAccounts.values()).find(a => {
            if (where?.user_id && a.user_id !== where.user_id) return false
            if (where?.account_id && a.account_id !== where.account_id) return false
            if (where?.is_deleted === false && a.is_deleted) return false
            return true
          })
          return Promise.resolve(account || null)
        }),
        findMany: vi.fn().mockImplementation(({ where = {} }) => {
          const accounts = Array.from(mockAccounts.values()).filter(a => {
            if (where?.user_id && a.user_id !== where.user_id) return false
            if (where?.is_deleted === false && a.is_deleted) return false
            return true
          })
          return Promise.resolve(accounts)
        }),
        deleteMany: vi.fn().mockImplementation(() => {
          const count = mockAccounts.size
          mockAccounts.clear()
          return Promise.resolve({ count })
        }),
      },
      chatFolder: {
        create: vi.fn().mockImplementation(({ data }) => {
          const folder = {
            id: generateId(),
            ...data,
            created_at: new Date(),
            updated_at: new Date(),
            is_deleted: false
          }
          mockFolders.set(folder.id, folder)
          return Promise.resolve(folder)
        }),
        findMany: vi.fn().mockImplementation(({ where = {}, include }) => {
          const folders = Array.from(mockFolders.values()).filter(f => {
            if (where?.user_id && f.user_id !== where.user_id) return false
            if (where?.is_deleted === false && f.is_deleted) return false
            return true
          })
          
          // Handle _count include for getFoldersWithChatCounts
          if (include?._count) {
            return Promise.resolve(folders.map(folder => ({
              ...folder,
              _count: {
                ChatFolderAssignment: Array.from(mockAssignments.values()).filter(a => 
                  a.folder_id === folder.id && !a.is_deleted
                ).length
              }
            })).sort((a, b) => a.sort_order - b.sort_order))
          }
          
          return Promise.resolve(folders.sort((a, b) => a.sort_order - b.sort_order))
        }),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          const folder = Array.from(mockFolders.values()).find(f => {
            if (where?.id && f.id !== where.id) return false
            if (where?.user_id && f.user_id !== where.user_id) return false
            if (where?.is_deleted === false && f.is_deleted) return false
            return true
          })
          return Promise.resolve(folder || null)
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const folder = mockFolders.get(where?.id)
          return Promise.resolve(folder || null)
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const folder = Array.from(mockFolders.values()).find(f => {
            if (where?.id && f.id !== where.id) return false
            if (where?.user_id && f.user_id !== where.user_id) return false
            return true
          })
          if (folder) {
            const updatedFolder = { ...folder, ...data, updated_at: new Date() }
            mockFolders.set(folder.id, updatedFolder)
            return Promise.resolve(updatedFolder)
          }
          throw new Error('Folder not found')
        }),
        delete: vi.fn().mockImplementation(({ where }) => {
          const folder = mockFolders.get(where?.id)
          if (folder) mockFolders.delete(where.id)
          return Promise.resolve(folder)
        }),
        deleteMany: vi.fn().mockImplementation(() => {
          const count = mockFolders.size
          mockFolders.clear()
          return Promise.resolve({ count })
        }),
      },
      chatFolderAssignment: {
        create: vi.fn().mockImplementation(({ data }) => {
          const assignment = {
            id: generateId(),
            ...data,
            created_at: new Date(),
            updated_at: new Date(),
            is_deleted: false
          }
          mockAssignments.set(assignment.id, assignment)
          return Promise.resolve(assignment)
        }),
        createMany: vi.fn().mockImplementation(({ data }) => {
          const assignments = data.map((item: any) => {
            const assignment = {
              id: generateId(),
              ...item,
              created_at: new Date(),
              updated_at: new Date(),
              is_deleted: false
            }
            mockAssignments.set(assignment.id, assignment)
            return assignment
          })
          return Promise.resolve({ count: assignments.length })
        }),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          const assignment = Array.from(mockAssignments.values()).find(a => {
            if (where?.id && a.id !== where.id) return false
            if (where?.chat_id && a.chat_id !== where.chat_id) return false
            if (where?.folder_id && a.folder_id !== where.folder_id) return false
            if (where?.is_deleted === false && a.is_deleted) return false
            return true
          })
          return Promise.resolve(assignment || null)
        }),
        findMany: vi.fn().mockImplementation(({ where = {}, include, select }) => {
          
          const assignments = Array.from(mockAssignments.values()).filter(a => {
            if (where?.chat_id) {
              // Handle { in: [...] } case
              if (typeof where.chat_id === 'object' && where.chat_id.in) {
                if (!where.chat_id.in.includes(a.chat_id)) {
                  return false
                }
              } else if (a.chat_id !== where.chat_id) {
                return false
              }
            }
            if (where?.folder_id && a.folder_id !== where.folder_id) return false
            if (where?.assigned_by_id && a.assigned_by_id !== where.assigned_by_id) return false
            if (where?.is_deleted === false && a.is_deleted) return false
            return true
          })
          
          // Handle select parameter for bulkAssignChatsToFolder
          if (select) {
            return Promise.resolve(assignments.map(a => {
              const result: any = {}
              if (select.chat_id) result.chat_id = a.chat_id
              if (select.id) result.id = a.id
              return result
            }))
          }
          
          // Handle include parameter for getChatsInFolder and getChatFolders
          if (include) {
            return Promise.resolve(assignments.map(a => {
              const result = { ...a }
              if (include.chat) {
                const chat = mockChats.get(a.chat_id)
                result.chat = chat ? { ...chat } : null
              }
              if (include.folder) {
                const folder = mockFolders.get(a.folder_id)
                result.folder = folder ? { ...folder } : null
              }
              return result
            }))
          }
          
          return Promise.resolve(assignments)
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const assignment = mockAssignments.get(where?.id)
          if (assignment) {
            const updatedAssignment = { ...assignment, ...data, updated_at: new Date() }
            mockAssignments.set(assignment.id, updatedAssignment)
            return Promise.resolve(updatedAssignment)
          }
          throw new Error('Assignment not found')
        }),
        updateMany: vi.fn().mockImplementation(({ where, data }) => {
          let count = 0
          for (const [id, assignment] of mockAssignments.entries()) {
            let matches = true
            if (where?.chat_id?.in && !where.chat_id.in.includes(assignment.chat_id)) matches = false
            if (where?.folder_id && assignment.folder_id !== where.folder_id) matches = false
            if (where?.is_deleted !== undefined && assignment.is_deleted !== where.is_deleted) matches = false
            
            if (matches) {
              const updatedAssignment = { ...assignment, ...data, updated_at: new Date() }
              mockAssignments.set(id, updatedAssignment)
              count++
            }
          }
          return Promise.resolve({ count })
        }),
        delete: vi.fn().mockImplementation(({ where }) => {
          const assignment = mockAssignments.get(where?.id)
          if (assignment) mockAssignments.delete(where.id)
          return Promise.resolve(assignment)
        }),
        deleteMany: vi.fn().mockImplementation(() => {
          const count = mockAssignments.size
          mockAssignments.clear()
          return Promise.resolve({ count })
        }),
      },
      unipileChat: {
        create: vi.fn().mockImplementation(({ data }) => {
          const chat = {
            id: generateId(),
            ...data,
            created_at: new Date(),
            updated_at: new Date()
          }
          mockChats.set(chat.id, chat)
          return Promise.resolve(chat)
        }),
        upsert: vi.fn().mockImplementation(({ where, create, update }) => {
          const existingChat = Array.from(mockChats.values()).find(c => 
            c.external_id === where?.unipile_account_id_external_id?.external_id &&
            c.unipile_account_id === where?.unipile_account_id_external_id?.unipile_account_id
          )
          
          if (existingChat) {
            const updatedChat = { ...existingChat, ...update, updated_at: new Date() }
            mockChats.set(existingChat.id, updatedChat)
            return Promise.resolve(updatedChat)
          } else {
            const newChat = {
              id: generateId(),
              ...create,
              created_at: new Date(),
              updated_at: new Date()
            }
            mockChats.set(newChat.id, newChat)
            return Promise.resolve(newChat)
          }
        }),
        findMany: vi.fn().mockImplementation(({ where = {} }) => {
          const chats = Array.from(mockChats.values()).filter(c => {
            if (where?.unipile_account_id && c.unipile_account_id !== where.unipile_account_id) return false
            return true
          })
          return Promise.resolve(chats)
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const chat = mockChats.get(where?.id)
          return Promise.resolve(chat || null)
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const chat = mockChats.get(where?.id)
          if (chat) {
            const updatedChat = { ...chat, ...data, updated_at: new Date() }
            mockChats.set(chat.id, updatedChat)
            return Promise.resolve(updatedChat)
          }
          throw new Error('Chat not found')
        }),
        delete: vi.fn().mockImplementation(({ where }) => {
          const chat = mockChats.get(where?.id)
          if (chat) mockChats.delete(where.id)
          return Promise.resolve(chat)
        }),
        deleteMany: vi.fn().mockImplementation(() => {
          const count = mockChats.size
          mockChats.clear()
          return Promise.resolve({ count })
        }),
      },
      // Add cleanup method for tests
      _clearAllMocks: () => {
        mockUsers.clear()
        mockAccounts.clear()
        mockChats.clear()
        mockFolders.clear()
        mockAssignments.clear()
      }
    }
  }
})

describe('Chat Folders Integration Tests', () => {
  let chatFolderService: ChatFolderService
  let chatService: UnipileChatService
  let accountService: UnipileAccountService
  let userService: UserService
  
  // Test data IDs
  let testUserId: string
  let testAccountId: string
  let testChatId1: string
  let testChatId2: string
  let testFolderId1: string
  let testFolderId2: string

  beforeEach(async () => {
    // Clear mocks before each test
    ;(db as any)._clearAllMocks?.()
    
    // Initialize services
    chatFolderService = new ChatFolderService(db)
    chatService = new UnipileChatService(db)
    accountService = new UnipileAccountService(db)
    userService = new UserService(db)

    // Create test user
    const testUser = await userService.create({
      id: 'test-user-folders-123',
      email: 'folders@test.com',
      first_name: 'Test',
      last_name: 'User',
    })
    testUserId = testUser.id

    // Create test Unipile account
    const testAccount = await accountService.upsertUnipileAccount(
      testUserId, 
      'test-account-123', 
      'linkedin', 
      {
        status: 'connected',
      },
      {
        account_id: 'test-account-123',
        provider: 'linkedin',
        status: 'connected',
      }
    )
    testAccountId = testAccount.id

    // Create test chats
    const testChat1 = await chatService.upsertChat(testAccountId, 'ext-chat-1', {
      provider: 'linkedin',
      chat_type: 'direct',
      last_message_at: new Date(),
      unread_count: 5,
    })
    testChatId1 = testChat1.id

    const testChat2 = await chatService.upsertChat(testAccountId, 'ext-chat-2', {
      provider: 'linkedin',
      chat_type: 'direct',
      last_message_at: new Date(),
      unread_count: 0,
    })
    testChatId2 = testChat2.id
  })

  afterEach(async () => {
    // Clean up mock data
    try {
      ;(db as any)._clearAllMocks?.()
    } catch (error) {
      console.warn('Error during test cleanup:', error)
    }
  })

  describe('Folder Management', () => {
    it('should create and retrieve folders successfully', async () => {
      // Create folders
      const workFolder = await chatFolderService.createFolder(testUserId, {
        name: 'Work Chats',
        color: '#3b82f6',
        sort_order: 1,
      })
      testFolderId1 = workFolder.id

      const personalFolder = await chatFolderService.createFolder(testUserId, {
        name: 'Personal',
        color: '#ef4444',
        sort_order: 2,
      })
      testFolderId2 = personalFolder.id

      // Retrieve folders
      const folders = await chatFolderService.getFoldersByUser(testUserId)

      expect(folders).toHaveLength(2)
      expect(folders[0]!.name).toBe('Work Chats')
      expect(folders[0]!.color).toBe('#3b82f6')
      expect(folders[0]!.sort_order).toBe(1)
      expect(folders[1]!.name).toBe('Personal')
      expect(folders[1]!.color).toBe('#ef4444')
      expect(folders[1]!.sort_order).toBe(2)
    })

    it('should create default folder for new user', async () => {
      const defaultFolder = await chatFolderService.createDefaultFolder(testUserId)
      testFolderId1 = defaultFolder.id

      expect(defaultFolder.name).toBe('All Chats')
      expect(defaultFolder.is_default).toBe(true)
      expect(defaultFolder.sort_order).toBe(0)
      expect(defaultFolder.user_id).toBe(testUserId)
    })

    it('should update folder properties', async () => {
      // Create folder
      const folder = await chatFolderService.createFolder(testUserId, {
        name: 'Original Name',
        color: '#000000',
        sort_order: 1,
      })
      testFolderId1 = folder.id

      // Update folder
      const updatedFolder = await chatFolderService.updateFolder(
        folder.id,
        testUserId,
        {
          name: 'Updated Name',
          color: '#ffffff',
          sort_order: 5,
        }
      )

      expect(updatedFolder.name).toBe('Updated Name')
      expect(updatedFolder.color).toBe('#ffffff')
      expect(updatedFolder.sort_order).toBe(5)
      expect(updatedFolder.updated_at).toBeInstanceOf(Date)
    })

    it('should soft delete folders', async () => {
      // Create folder
      const folder = await chatFolderService.createFolder(testUserId, {
        name: 'To Delete',
      })
      testFolderId1 = folder.id

      // Delete folder
      const deletedFolder = await chatFolderService.deleteFolder(folder.id, testUserId)

      expect(deletedFolder.is_deleted).toBe(true)
      expect(deletedFolder.updated_at).toBeInstanceOf(Date)

      // Verify folder is not returned in normal queries
      const folders = await chatFolderService.getFoldersByUser(testUserId)
      expect(folders).toHaveLength(0)

      // Verify folder can be retrieved when including deleted
      const allFolders = await chatFolderService.getFoldersByUser(testUserId, {
        include_deleted: true,
      })
      expect(allFolders).toHaveLength(1)
      expect(allFolders[0]!.is_deleted).toBe(true)
    })

    it('should get folders with chat counts', async () => {
      // Create folder
      const folder = await chatFolderService.createFolder(testUserId, {
        name: 'Test Folder',
      })
      testFolderId1 = folder.id

      // Assign chats to folder
      await chatFolderService.assignChatToFolder(testChatId1, folder.id, testUserId)
      await chatFolderService.assignChatToFolder(testChatId2, folder.id, testUserId)

      // Get folders with counts
      const foldersWithCounts = await chatFolderService.getFoldersWithChatCounts(testUserId)

      expect(foldersWithCounts).toHaveLength(1)
      expect(foldersWithCounts[0]!.name).toBe('Test Folder')
      expect(foldersWithCounts[0]!.chat_count).toBe(2)
    })
  })

  describe('Chat Folder Assignments', () => {
    beforeEach(async () => {
      // Create a test folder for assignment tests
      const folder = await chatFolderService.createFolder(testUserId, {
        name: 'Test Folder',
      })
      testFolderId1 = folder.id
    })

    it('should assign chat to folder successfully', async () => {
      const assignment = await chatFolderService.assignChatToFolder(
        testChatId1,
        testFolderId1,
        testUserId
      )

      expect(assignment.chat_id).toBe(testChatId1)
      expect(assignment.folder_id).toBe(testFolderId1)
      expect(assignment.assigned_by_id).toBe(testUserId)
      expect(assignment.is_deleted).toBe(false)
    })

    it('should assign chat to multiple folders', async () => {
      // Create second folder
      const folder2 = await chatFolderService.createFolder(testUserId, {
        name: 'Test Folder 2',
      })
      testFolderId2 = folder2.id

      // Assign to both folders
      await chatFolderService.assignChatToFolder(testChatId1, testFolderId1, testUserId)
      await chatFolderService.assignChatToFolder(testChatId1, testFolderId2, testUserId)

      // Verify assignments
      const assignments = await chatFolderService.getChatFolders(testChatId1)
      expect(assignments).toHaveLength(2)
    })

    it('should remove chat from folder', async () => {
      // First assign
      await chatFolderService.assignChatToFolder(testChatId1, testFolderId1, testUserId)

      // Then remove
      const removedAssignment = await chatFolderService.removeChatFromFolder(
        testChatId1,
        testFolderId1
      )

      expect(removedAssignment.is_deleted).toBe(true)

      // Verify chat is not in folder anymore
      const isInFolder = await chatFolderService.isChatInFolder(testChatId1, testFolderId1)
      expect(isInFolder).toBe(false)
    })

    it('should get all chats in a folder with details', async () => {
      // Assign both chats to folder
      await chatFolderService.assignChatToFolder(testChatId1, testFolderId1, testUserId)
      await chatFolderService.assignChatToFolder(testChatId2, testFolderId1, testUserId)

      // Get chats in folder
      const chatsInFolder = await chatFolderService.getChatsInFolder(testFolderId1)

      expect(chatsInFolder).toHaveLength(2)
      expect(chatsInFolder.map((c: any) => c.chat.id)).toContain(testChatId1)
      expect(chatsInFolder.map((c: any) => c.chat.id)).toContain(testChatId2)
    })

    it('should bulk assign multiple chats to folder', async () => {
      const assignments = await chatFolderService.bulkAssignChatsToFolder(
        [testChatId1, testChatId2],
        testFolderId1,
        testUserId
      )

      expect(assignments).toHaveLength(2)
      expect(assignments[0]!.folder_id).toBe(testFolderId1)
      expect(assignments[1]!.folder_id).toBe(testFolderId1)
    })

    it('should handle duplicate assignments gracefully', async () => {
      // First assignment
      await chatFolderService.assignChatToFolder(testChatId1, testFolderId1, testUserId)

      // Duplicate assignment should update existing
      const secondAssignment = await chatFolderService.assignChatToFolder(
        testChatId1,
        testFolderId1,
        testUserId
      )

      expect(secondAssignment.chat_id).toBe(testChatId1)
      expect(secondAssignment.folder_id).toBe(testFolderId1)
      expect(secondAssignment.is_deleted).toBe(false)

      // Should still only have one assignment
      const assignments = await chatFolderService.getChatFolders(testChatId1)
      expect(assignments).toHaveLength(1)
    })
  })

  describe('Folder Ownership and Security', () => {
    it('should only return folders for the correct user', async () => {
      // Create folders for test user
      await chatFolderService.createFolder(testUserId, {
        name: 'Test User Folder',
      })

      // Create another user and folder
      const otherUser = await userService.create({
        id: 'other-user-123',
        email: 'other@test.com',
        first_name: 'Other',
        last_name: 'User',
      })

      await chatFolderService.createFolder(otherUser.id, {
        name: 'Other User Folder',
      })

      // Get folders for test user
      const testUserFolders = await chatFolderService.getFoldersByUser(testUserId)
      expect(testUserFolders).toHaveLength(1)
      expect(testUserFolders[0]!.name).toBe('Test User Folder')

      // Get folders for other user
      const otherUserFolders = await chatFolderService.getFoldersByUser(otherUser.id)
      expect(otherUserFolders).toHaveLength(1)
      expect(otherUserFolders[0]!.name).toBe('Other User Folder')
    })

    it('should not allow accessing folders from other users', async () => {
      // Create folder for another user
      const otherUser = await userService.create({
        id: 'other-user-123',
        email: 'other@test.com',
        first_name: 'Other',
        last_name: 'User',
      })

      const otherUserFolder = await chatFolderService.createFolder(otherUser.id, {
        name: 'Other User Folder',
      })

      // Try to access other user's folder
      const folder = await chatFolderService.getFolderById(otherUserFolder.id, testUserId)
      expect(folder).toBeNull()
    })

    it('should enforce user ownership when updating folders', async () => {
      // Create folder for another user
      const otherUser = await userService.create({
        id: 'other-user-123',
        email: 'other@test.com',
        first_name: 'Other',
        last_name: 'User',
      })

      const otherUserFolder = await chatFolderService.createFolder(otherUser.id, {
        name: 'Other User Folder',
      })

      // Try to update other user's folder - should throw
      await expect(
        chatFolderService.updateFolder(otherUserFolder.id, testUserId, {
          name: 'Hacked Name',
        })
      ).rejects.toThrow()
    })

    it('should enforce user ownership when deleting folders', async () => {
      // Create folder for another user
      const otherUser = await userService.create({
        id: 'other-user-123',
        email: 'other@test.com',
        first_name: 'Other',
        last_name: 'User',
      })

      const otherUserFolder = await chatFolderService.createFolder(otherUser.id, {
        name: 'Other User Folder',
      })

      // Try to delete other user's folder - should throw
      await expect(
        chatFolderService.deleteFolder(otherUserFolder.id, testUserId)
      ).rejects.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent folder gracefully', async () => {
      const folder = await chatFolderService.getFolderById('non-existent-id', testUserId)
      expect(folder).toBeNull()
    })

    it('should handle non-existent assignment removal', async () => {
      await expect(() =>
        chatFolderService.removeChatFromFolder('non-existent-chat', 'non-existent-folder')
      ).rejects.toThrow('Assignment not found')
    })

    it('should validate chat existence in folder operations', async () => {
      const folder = await chatFolderService.createFolder(testUserId, {
        name: 'Test Folder',
      })

      const isInFolder = await chatFolderService.isChatInFolder('non-existent-chat', folder.id)
      expect(isInFolder).toBe(false)
    })
  })
}) 