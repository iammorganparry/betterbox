import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '~/server/db'
import { ChatFolderService } from '~/services/db/chat-folder.service'
import { UnipileChatService } from '~/services/db/unipile-chat.service'
import { UnipileAccountService } from '~/services/db/unipile-account.service'
import { UserService } from '~/services/db/user.service'

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
    // Initialize services
    chatFolderService = new ChatFolderService(db)
    chatService = new UnipileChatService(db)
    accountService = new UnipileAccountService(db)
    userService = new UserService(db)

    // Create test user
    const testUser = await userService.createUser({
      id: 'test-user-folders-123',
      email: 'folders@test.com',
      first_name: 'Test',
      last_name: 'User',
    })
    testUserId = testUser.id

    // Create test Unipile account
    const testAccount = await accountService.upsertAccount(testUserId, 'linkedin', 'test-account-123', {
      provider: 'linkedin',
      account_id: 'test-account-123',
      status: 'connected',
    })
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
    // Clean up test data
    try {
      // Delete folder assignments first (foreign key constraints)
      await db.chatFolderAssignment.deleteMany({
        where: {
          assigned_by_id: testUserId,
        },
      })

      // Delete folders
      await db.chatFolder.deleteMany({
        where: {
          user_id: testUserId,
        },
      })

      // Delete chats
      await db.unipileChat.deleteMany({
        where: {
          unipile_account_id: testAccountId,
        },
      })

      // Delete account
      await db.unipileAccount.deleteMany({
        where: {
          user_id: testUserId,
        },
      })

      // Delete user
      await db.user.deleteMany({
        where: {
          id: testUserId,
        },
      })
    } catch (error) {
      console.warn('Cleanup error:', error)
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
      expect(folders[0].name).toBe('Work Chats')
      expect(folders[0].color).toBe('#3b82f6')
      expect(folders[0].sort_order).toBe(1)
      expect(folders[1].name).toBe('Personal')
      expect(folders[1].color).toBe('#ef4444')
      expect(folders[1].sort_order).toBe(2)
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
      expect(allFolders[0].is_deleted).toBe(true)
    })

    it('should get folders with chat counts', async () => {
      // Create folders
      const workFolder = await chatFolderService.createFolder(testUserId, {
        name: 'Work',
      })
      testFolderId1 = workFolder.id

      const personalFolder = await chatFolderService.createFolder(testUserId, {
        name: 'Personal',
      })
      testFolderId2 = personalFolder.id

      // Assign chats to folders
      await chatFolderService.assignChatToFolder(testChatId1, workFolder.id, testUserId)
      await chatFolderService.assignChatToFolder(testChatId2, workFolder.id, testUserId)
      await chatFolderService.assignChatToFolder(testChatId1, personalFolder.id, testUserId)

      // Get folders with counts
      const foldersWithCounts = await chatFolderService.getFoldersWithChatCounts(testUserId)

      expect(foldersWithCounts).toHaveLength(2)
      
      const workFolderWithCount = foldersWithCounts.find(f => f.name === 'Work')
      const personalFolderWithCount = foldersWithCounts.find(f => f.name === 'Personal')

      expect(workFolderWithCount?.chat_count).toBe(2)
      expect(personalFolderWithCount?.chat_count).toBe(1)
    })
  })

  describe('Chat Folder Assignments', () => {
    beforeEach(async () => {
      // Create test folders
      const workFolder = await chatFolderService.createFolder(testUserId, {
        name: 'Work',
      })
      testFolderId1 = workFolder.id

      const personalFolder = await chatFolderService.createFolder(testUserId, {
        name: 'Personal',
      })
      testFolderId2 = personalFolder.id
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
      expect(assignment.created_at).toBeInstanceOf(Date)
    })

    it('should assign chat to multiple folders', async () => {
      // Assign to both folders
      await chatFolderService.assignChatToFolder(testChatId1, testFolderId1, testUserId)
      await chatFolderService.assignChatToFolder(testChatId1, testFolderId2, testUserId)

      // Verify chat is in both folders
      const chatFolders = await chatFolderService.getChatFolders(testChatId1)

      expect(chatFolders).toHaveLength(2)
      expect(chatFolders.map(cf => cf.folder_id)).toContain(testFolderId1)
      expect(chatFolders.map(cf => cf.folder_id)).toContain(testFolderId2)
    })

    it('should remove chat from folder', async () => {
      // Assign chat to folder
      await chatFolderService.assignChatToFolder(testChatId1, testFolderId1, testUserId)

      // Verify assignment exists
      const isInFolder = await chatFolderService.isChatInFolder(testChatId1, testFolderId1)
      expect(isInFolder).toBe(true)

      // Remove chat from folder
      const removedAssignment = await chatFolderService.removeChatFromFolder(
        testChatId1,
        testFolderId1
      )

      expect(removedAssignment.is_deleted).toBe(true)
      expect(removedAssignment.updated_at).toBeInstanceOf(Date)

      // Verify chat is no longer in folder
      const isStillInFolder = await chatFolderService.isChatInFolder(testChatId1, testFolderId1)
      expect(isStillInFolder).toBe(false)
    })

    it('should get all chats in a folder with details', async () => {
      // Assign chats to folder
      await chatFolderService.assignChatToFolder(testChatId1, testFolderId1, testUserId)
      await chatFolderService.assignChatToFolder(testChatId2, testFolderId1, testUserId)

      // Get chats in folder
      const chatsInFolder = await chatFolderService.getChatsInFolder(testFolderId1)

      expect(chatsInFolder).toHaveLength(2)
      expect(chatsInFolder[0].folder_id).toBe(testFolderId1)
      expect(chatsInFolder[0].chat).toBeDefined()
      expect(chatsInFolder[0].chat.id).toBeDefined()
      expect(chatsInFolder[0].chat.provider).toBe('linkedin')
      expect(chatsInFolder[1].folder_id).toBe(testFolderId1)
      expect(chatsInFolder[1].chat).toBeDefined()
    })

    it('should bulk assign multiple chats to folder', async () => {
      const chatIds = [testChatId1, testChatId2]

      const assignments = await chatFolderService.bulkAssignChatsToFolder(
        chatIds,
        testFolderId1,
        testUserId
      )

      expect(assignments).toHaveLength(2)
      expect(assignments.map(a => a.chat_id)).toContain(testChatId1)
      expect(assignments.map(a => a.chat_id)).toContain(testChatId2)
      expect(assignments.every(a => a.folder_id === testFolderId1)).toBe(true)
      expect(assignments.every(a => a.assigned_by_id === testUserId)).toBe(true)
    })

    it('should handle duplicate assignments gracefully', async () => {
      // First assignment
      await chatFolderService.assignChatToFolder(testChatId1, testFolderId1, testUserId)

      // Attempt duplicate assignment should fail
      await expect(
        chatFolderService.assignChatToFolder(testChatId1, testFolderId1, testUserId)
      ).rejects.toThrow()

      // But bulk assignment should skip duplicates
      const result = await chatFolderService.bulkAssignChatsToFolder(
        [testChatId1, testChatId2],
        testFolderId1,
        testUserId
      )

      // Should only have 2 assignments total (1 existing + 1 new)
      expect(result).toHaveLength(2)
    })
  })

  describe('Folder Ownership and Security', () => {
    let otherUserId: string
    let otherAccountId: string

    beforeEach(async () => {
      // Create another user for security tests
      const otherUser = await userService.createUser({
        id: 'other-user-folders-456',
        email: 'other@test.com',
        first_name: 'Other',
        last_name: 'User',
      })
      otherUserId = otherUser.id

      const otherAccount = await accountService.upsertAccount(
        otherUserId,
        'linkedin',
        'other-account-456',
        {
          provider: 'linkedin',
          account_id: 'other-account-456',
          status: 'connected',
        }
      )
      otherAccountId = otherAccount.id
    })

    afterEach(async () => {
      // Clean up other user's data
      try {
        await db.unipileAccount.deleteMany({
          where: { user_id: otherUserId },
        })
        await db.user.deleteMany({
          where: { id: otherUserId },
        })
      } catch (error) {
        console.warn('Cleanup error for other user:', error)
      }
    })

    it('should only return folders for the correct user', async () => {
      // Create folder for test user
      const testUserFolder = await chatFolderService.createFolder(testUserId, {
        name: 'Test User Folder',
      })
      testFolderId1 = testUserFolder.id

      // Create folder for other user
      const otherUserFolder = await chatFolderService.createFolder(otherUserId, {
        name: 'Other User Folder',
      })

      // Get folders for test user
      const testUserFolders = await chatFolderService.getFoldersByUser(testUserId)
      expect(testUserFolders).toHaveLength(1)
      expect(testUserFolders[0].name).toBe('Test User Folder')

      // Get folders for other user
      const otherUserFolders = await chatFolderService.getFoldersByUser(otherUserId)
      expect(otherUserFolders).toHaveLength(1)
      expect(otherUserFolders[0].name).toBe('Other User Folder')

      // Clean up other user's folder
      await db.chatFolder.deleteMany({
        where: { id: otherUserFolder.id },
      })
    })

    it('should not allow accessing folders from other users', async () => {
      // Create folder for other user
      const otherUserFolder = await chatFolderService.createFolder(otherUserId, {
        name: 'Other User Folder',
      })

      // Test user should not be able to access other user's folder
      const result = await chatFolderService.getFolderById(otherUserFolder.id, testUserId)
      expect(result).toBeNull()

      // Clean up
      await db.chatFolder.deleteMany({
        where: { id: otherUserFolder.id },
      })
    })

    it('should enforce user ownership when updating folders', async () => {
      // Create folder for other user
      const otherUserFolder = await chatFolderService.createFolder(otherUserId, {
        name: 'Other User Folder',
      })

      // Test user should not be able to update other user's folder
      await expect(
        chatFolderService.updateFolder(otherUserFolder.id, testUserId, {
          name: 'Hacked Name',
        })
      ).rejects.toThrow()

      // Clean up
      await db.chatFolder.deleteMany({
        where: { id: otherUserFolder.id },
      })
    })

    it('should enforce user ownership when deleting folders', async () => {
      // Create folder for other user
      const otherUserFolder = await chatFolderService.createFolder(otherUserId, {
        name: 'Other User Folder',
      })

      // Test user should not be able to delete other user's folder
      await expect(
        chatFolderService.deleteFolder(otherUserFolder.id, testUserId)
      ).rejects.toThrow()

      // Clean up
      await db.chatFolder.deleteMany({
        where: { id: otherUserFolder.id },
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent folder gracefully', async () => {
      const nonExistentFolderId = 'non-existent-folder-123'

      const result = await chatFolderService.getFolderById(nonExistentFolderId, testUserId)
      expect(result).toBeNull()
    })

    it('should handle non-existent assignment removal', async () => {
      await expect(
        chatFolderService.removeChatFromFolder('non-existent-chat', 'non-existent-folder')
      ).rejects.toThrow('Assignment not found')
    })

    it('should validate chat existence in folder operations', async () => {
      const folder = await chatFolderService.createFolder(testUserId, {
        name: 'Test Folder',
      })
      testFolderId1 = folder.id

      const isInFolder = await chatFolderService.isChatInFolder(
        'non-existent-chat',
        folder.id
      )
      expect(isInFolder).toBe(false)
    })
  })
}) 