import { describe, it, expect, beforeEach } from "vitest";
import { mockStore } from "../data/store";
import { createMockAccount, createMockChat, createMockMessage, createMockAttendee, createMockAttachment } from "../data/factories";

describe("MockDataStore", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  describe("Account operations", () => {
    it("should create and retrieve accounts", () => {
      const account = createMockAccount({ account_id: "test-123" });
      const created = mockStore.createAccount(account);
      
      expect(created).toEqual(account);
      expect(mockStore.getAccount("test-123")).toEqual(account);
    });

    it("should return undefined for non-existent account", () => {
      expect(mockStore.getAccount("non-existent")).toBeUndefined();
    });

    it("should get all accounts", () => {
      const account1 = createMockAccount({ account_id: "test-1" });
      const account2 = createMockAccount({ account_id: "test-2" });
      
      mockStore.createAccount(account1);
      mockStore.createAccount(account2);
      
      const allAccounts = mockStore.getAllAccounts();
      expect(allAccounts).toHaveLength(2);
      expect(allAccounts).toContainEqual(account1);
      expect(allAccounts).toContainEqual(account2);
    });
  });

  describe("Chat operations", () => {
    it("should create and retrieve chats", () => {
      const chat = createMockChat("test-account");
      const created = mockStore.createChat(chat);
      
      expect(created).toEqual(chat);
      expect(mockStore.getChat(chat.id)).toEqual(chat);
    });

    it("should initialize empty arrays for new chats", () => {
      const chat = createMockChat("test-account");
      mockStore.createChat(chat);
      
      expect(mockStore.getMessages(chat.id)).toEqual([]);
      expect(mockStore.getAttendees(chat.id)).toEqual([]);
    });

    it("should get chats by account", () => {
      const chat1 = createMockChat("account-1");
      const chat2 = createMockChat("account-1");
      const chat3 = createMockChat("account-2");
      
      mockStore.createChat(chat1);
      mockStore.createChat(chat2);
      mockStore.createChat(chat3);
      
      const account1Chats = mockStore.getChatsByAccount("account-1");
      expect(account1Chats).toHaveLength(2);
      expect(account1Chats.map(c => c.id)).toContain(chat1.id);
      expect(account1Chats.map(c => c.id)).toContain(chat2.id);
    });

    it("should update chats", () => {
      const chat = createMockChat("test-account");
      mockStore.createChat(chat);
      
      const updated = mockStore.updateChat(chat.id, { name: "Updated Chat" });
      expect(updated?.name).toBe("Updated Chat");
      expect(mockStore.getChat(chat.id)?.name).toBe("Updated Chat");
    });

    it("should return undefined when updating non-existent chat", () => {
      const result = mockStore.updateChat("non-existent", { name: "Test" });
      expect(result).toBeUndefined();
    });
  });

  describe("Message operations", () => {
    it("should add and retrieve messages", () => {
      const chat = createMockChat("test-account");
      const message = createMockMessage("test-account", chat.id);
      
      mockStore.createChat(chat);
      const added = mockStore.addMessage(chat.id, message);
      
      expect(added).toEqual(message);
      expect(mockStore.getMessages(chat.id)).toContainEqual(message);
    });

    it("should update chat timestamp when adding message", () => {
      const chat = createMockChat("test-account");
      const message = createMockMessage("test-account", chat.id, {
        timestamp: "2023-01-01T12:00:00Z"
      });
      
      mockStore.createChat(chat);
      mockStore.addMessage(chat.id, message);
      
      const updatedChat = mockStore.getChat(chat.id);
      expect(updatedChat?.timestamp).toBe(message.timestamp);
      expect(updatedChat?.last_message).toEqual(message);
    });

    it("should get message by ID across all chats", () => {
      const chat1 = createMockChat("test-account");
      const chat2 = createMockChat("test-account");
      const message1 = createMockMessage("test-account", chat1.id, { id: "msg-1" });
      const message2 = createMockMessage("test-account", chat2.id, { id: "msg-2" });
      
      mockStore.createChat(chat1);
      mockStore.createChat(chat2);
      mockStore.addMessage(chat1.id, message1);
      mockStore.addMessage(chat2.id, message2);
      
      expect(mockStore.getMessage("msg-1")).toEqual(message1);
      expect(mockStore.getMessage("msg-2")).toEqual(message2);
      expect(mockStore.getMessage("non-existent")).toBeUndefined();
    });

    it("should return empty array for non-existent chat messages", () => {
      expect(mockStore.getMessages("non-existent")).toEqual([]);
    });
  });

  describe("Attendee operations", () => {
    it("should add and retrieve attendees", () => {
      const chat = createMockChat("test-account");
      const attendee = createMockAttendee("test-account");
      
      mockStore.createChat(chat);
      const added = mockStore.addAttendee(chat.id, attendee);
      
      expect(added).toEqual(attendee);
      expect(mockStore.getAttendees(chat.id)).toContainEqual(attendee);
    });

    it("should return empty array for non-existent chat attendees", () => {
      expect(mockStore.getAttendees("non-existent")).toEqual([]);
    });
  });

  describe("Attachment operations", () => {
    it("should add and retrieve attachments", () => {
      const attachment = createMockAttachment({ id: "att-1" });
      const messageId = "msg-123";
      
      const added = mockStore.addAttachment(messageId, attachment);
      
      expect(added).toEqual(attachment);
      expect(mockStore.getAttachments(messageId)).toContainEqual(attachment);
    });

    it("should return empty array for non-existent message attachments", () => {
      expect(mockStore.getAttachments("non-existent")).toEqual([]);
    });
  });

  describe("Pagination", () => {
    it("should paginate chats correctly", () => {
      const chats = Array.from({ length: 5 }, (_, i) => 
        createMockChat("test-account", { id: `chat-${i}` })
      );
      
      chats.forEach(chat => mockStore.createChat(chat));
      
      const firstPage = mockStore.paginateChats(chats, undefined, 2);
      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.has_more).toBe(true);
      expect(firstPage.cursor).toBeDefined();
      
      const secondPage = mockStore.paginateChats(chats, firstPage.cursor, 2);
      expect(secondPage.items).toHaveLength(2);
      expect(secondPage.has_more).toBe(true);
      
      const lastPage = mockStore.paginateChats(chats, secondPage.cursor, 2);
      expect(lastPage.items).toHaveLength(1);
      expect(lastPage.has_more).toBe(false);
      expect(lastPage.cursor).toBeUndefined();
    });

    it("should paginate messages correctly", () => {
      const messages = Array.from({ length: 5 }, (_, i) => 
        createMockMessage("test-account", "chat-123", { id: `msg-${i}` })
      );
      
      const firstPage = mockStore.paginateMessages(messages, undefined, 2);
      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.has_more).toBe(true);
      expect(firstPage.cursor).toBeDefined();
    });

    it("should handle pagination with invalid cursor", () => {
      const chats = [createMockChat("test-account")];
      const result = mockStore.paginateChats(chats, "invalid-cursor", 10);
      
      expect(result.items).toEqual(chats);
      expect(result.has_more).toBe(false);
    });
  });

  describe("Utility operations", () => {
    it("should clear all data", () => {
      const account = createMockAccount({ account_id: "test" });
      const chat = createMockChat("test");
      const message = createMockMessage("test", chat.id);
      const attendee = createMockAttendee("test");
      const attachment = createMockAttachment();
      
      mockStore.createAccount(account);
      mockStore.createChat(chat);
      mockStore.addMessage(chat.id, message);
      mockStore.addAttendee(chat.id, attendee);
      mockStore.addAttachment(message.id, attachment);
      
      mockStore.clear();
      
      expect(mockStore.getAllAccounts()).toHaveLength(0);
      expect(mockStore.getAllChats()).toHaveLength(0);
      expect(mockStore.getMessages(chat.id)).toHaveLength(0);
      expect(mockStore.getAttendees(chat.id)).toHaveLength(0);
      expect(mockStore.getAttachments(message.id)).toHaveLength(0);
    });
  });
});
