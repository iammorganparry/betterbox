import type {
  UnipileApiAccountStatus,
  UnipileApiChat,
  UnipileApiMessage,
  UnipileApiChatAttendee,
  UnipileApiAttachment,
} from "~/types/unipile-api";

// In-memory data stores
class MockDataStore {
  private accounts = new Map<string, UnipileApiAccountStatus>();
  private chats = new Map<string, UnipileApiChat>();
  private messages = new Map<string, UnipileApiMessage[]>();
  private attendees = new Map<string, UnipileApiChatAttendee[]>();
  private attachments = new Map<string, UnipileApiAttachment[]>();

  // Account operations
  createAccount(account: UnipileApiAccountStatus): UnipileApiAccountStatus {
    this.accounts.set(account.account_id, account);
    return account;
  }

  getAccount(accountId: string): UnipileApiAccountStatus | undefined {
    return this.accounts.get(accountId);
  }

  getAllAccounts(): UnipileApiAccountStatus[] {
    return Array.from(this.accounts.values());
  }

  // Chat operations
  createChat(chat: UnipileApiChat): UnipileApiChat {
    this.chats.set(chat.id, chat);
    if (!this.messages.has(chat.id)) {
      this.messages.set(chat.id, []);
    }
    if (!this.attendees.has(chat.id)) {
      this.attendees.set(chat.id, []);
    }
    return chat;
  }

  getChat(chatId: string): UnipileApiChat | undefined {
    return this.chats.get(chatId);
  }

  getChatsByAccount(accountId: string): UnipileApiChat[] {
    return Array.from(this.chats.values()).filter(
      (chat) => chat.account_id === accountId
    );
  }

  getAllChats(): UnipileApiChat[] {
    return Array.from(this.chats.values());
  }

  updateChat(chatId: string, updates: Partial<UnipileApiChat>): UnipileApiChat | undefined {
    const chat = this.chats.get(chatId);
    if (!chat) return undefined;
    
    const updatedChat = { ...chat, ...updates };
    this.chats.set(chatId, updatedChat);
    return updatedChat;
  }

  // Message operations
  addMessage(chatId: string, message: UnipileApiMessage): UnipileApiMessage {
    if (!this.messages.has(chatId)) {
      this.messages.set(chatId, []);
    }
    const messages = this.messages.get(chatId);
    if (messages) {
      messages.push(message);
    }

    // Update chat's last message timestamp
    const chat = this.getChat(chatId);
    if (chat) {
      this.updateChat(chatId, { 
        timestamp: message.timestamp,
        last_message: message 
      });
    }
    
    return message;
  }

  getMessages(chatId: string): UnipileApiMessage[] {
    return this.messages.get(chatId) || [];
  }

  getMessage(messageId: string): UnipileApiMessage | undefined {
    for (const messages of this.messages.values()) {
      const message = messages.find(m => m.id === messageId);
      if (message) return message;
    }
    return undefined;
  }

  // Attendee operations
  addAttendee(
    chatId: string,
    attendee: UnipileApiChatAttendee,
  ): UnipileApiChatAttendee {
    if (!this.attendees.has(chatId)) {
      this.attendees.set(chatId, []);
    }
    const attendees = this.attendees.get(chatId);
    if (attendees) {
      attendees.push(attendee);
    }
    return attendee;
  }

  getAttendees(chatId: string): UnipileApiChatAttendee[] {
    return this.attendees.get(chatId) || [];
  }

  // Attachment operations
  addAttachment(
    messageId: string,
    attachment: UnipileApiAttachment,
  ): UnipileApiAttachment {
    if (!this.attachments.has(messageId)) {
      this.attachments.set(messageId, []);
    }
    const attachments = this.attachments.get(messageId);
    if (attachments) {
      attachments.push(attachment);
    }
    return attachment;
  }

  getAttachments(messageId: string): UnipileApiAttachment[] {
    return this.attachments.get(messageId) || [];
  }

  // Utility methods
  clear(): void {
    this.accounts.clear();
    this.chats.clear();
    this.messages.clear();
    this.attendees.clear();
    this.attachments.clear();
  }

  // Pagination helpers
  paginateChats(
    chats: UnipileApiChat[],
    cursor?: string,
    limit = 20,
  ): {
    items: UnipileApiChat[];
    cursor?: string;
    has_more: boolean;
  } {
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = chats.findIndex((chat) => chat.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const endIndex = startIndex + limit;
    const items = chats.slice(startIndex, endIndex);
    const hasMore = endIndex < chats.length;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && items.length > 0 && lastItem ? lastItem.id : undefined;

    return {
      items,
      cursor: nextCursor,
      has_more: hasMore,
    };
  }

  paginateMessages(
    messages: UnipileApiMessage[],
    cursor?: string,
    limit = 50,
  ): {
    items: UnipileApiMessage[];
    cursor?: string;
    has_more: boolean;
  } {
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = messages.findIndex((msg) => msg.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const endIndex = startIndex + limit;
    const items = messages.slice(startIndex, endIndex);
    const hasMore = endIndex < messages.length;
    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && items.length > 0 && lastItem ? lastItem.id : undefined;

    return {
      items,
      cursor: nextCursor,
      has_more: hasMore,
    };
  }
}

// Create a singleton instance
export const mockStore = new MockDataStore();

// Types for external use
export type MockStore = typeof mockStore;
