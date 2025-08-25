import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockAccount,
  createMockAttendee,
  createMockChat,
  createMockMessage,
  createMockAttachment,
  createMockReply,
  createMockConversation,
  createHistoricalSyncData,
  createOutgoingMessage,
  MOCK_CONFIG,
} from "../data/factories";

// Mock faker to make tests deterministic
vi.mock("@faker-js/faker", () => ({
  faker: {
    string: {
      uuid: vi.fn(() => "mock-uuid-123"),
    },
    person: {
      firstName: vi.fn(() => "John"),
      lastName: vi.fn(() => "Doe"),
      jobTitle: vi.fn(() => "Software Engineer"),
      jobDescriptor: vi.fn(() => "Senior"),
    },
    company: {
      name: vi.fn(() => "Tech Corp"),
    },
    location: {
      city: vi.fn(() => "New York"),
      country: vi.fn(() => "USA"),
    },
    internet: {
      email: vi.fn(() => "john.doe@example.com"),
      username: vi.fn(() => "johndoe"),
    },
    image: {
      avatar: vi.fn(() => "https://example.com/avatar.jpg"),
    },
    number: {
      int: vi.fn(() => 42),
    },
    lorem: {
      sentence: vi.fn(() => "This is a test message."),
      sentences: vi.fn(() => "First sentence. Second sentence."),
      paragraph: vi.fn(() => "This is a test paragraph."),
      word: vi.fn(() => "test"),
      words: vi.fn(() => "test words"),
    },
    date: {
      recent: vi.fn(() => new Date("2023-01-01T12:00:00Z")),
    },
    datatype: {
      boolean: vi.fn(() => true),
    },
    helpers: {
      arrayElement: vi.fn((arr) => arr[0]),
    },
  },
}));

describe("Data Factories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMockAccount", () => {
    it("should create a valid mock account with defaults", () => {
      const account = createMockAccount();
      
      expect(account).toMatchObject({
        account_id: MOCK_CONFIG.DEFAULT_ACCOUNT_ID,
        provider: MOCK_CONFIG.DEFAULT_PROVIDER,
        status: "connected",
        last_activity: expect.any(String),
      });
      
      // Verify it's a valid ISO date string
      expect(() => new Date(account.last_activity)).not.toThrow();
    });

    it("should accept overrides", () => {
      const overrides = {
        account_id: "custom-account",
        status: "pending" as const,
      };
      
      const account = createMockAccount(overrides);
      
      expect(account.account_id).toBe("custom-account");
      expect(account.status).toBe("pending");
      expect(account.provider).toBe(MOCK_CONFIG.DEFAULT_PROVIDER);
    });
  });

  describe("createMockAttendee", () => {
    it("should create a valid mock attendee", () => {
      const attendee = createMockAttendee("test-account");
      
      expect(attendee).toMatchObject({
        object: "ChatAttendee",
        id: expect.stringContaining("attendee_"),
        account_id: "test-account",
        provider_id: expect.stringContaining("linkedin_"),
        name: expect.any(String),
        is_self: 0,
        hidden: 0,
        picture_url: expect.any(String),
        profile_url: expect.stringContaining("linkedin.com/in/"),
        first_name: expect.any(String),
        last_name: expect.any(String),
        display_name: expect.any(String),
        is_contact: expect.any(Boolean),
      });

      expect(attendee.specifics).toMatchObject({
        provider: "LINKEDIN",
        member_urn: expect.stringContaining("urn:li:member:"),
        occupation: expect.any(String),
        network_distance: expect.stringMatching(/^(FIRST|SECOND|THIRD)$/),
        pending_invitation: false,
        location: expect.any(String),
        headline: expect.any(String),
        contact_info: {
          emails: [expect.any(String)],
          phone_numbers: [],
          websites: [],
          social_handles: [],
        },
      });
    });

    it("should accept overrides", () => {
      const overrides = {
        name: "Jane Smith",
        is_self: 1,
      };
      
      const attendee = createMockAttendee("test-account", overrides);
      
      expect(attendee.name).toBe("Jane Smith");
      expect(attendee.is_self).toBe(1);
    });
  });

  describe("createMockChat", () => {
    it("should create a valid mock chat", () => {
      const chat = createMockChat("test-account");
      
      expect(chat).toMatchObject({
        id: expect.stringContaining("chat_"),
        object: "Chat",
        account_id: "test-account",
        account_type: "LINKEDIN",
        provider_id: expect.stringContaining("provider_"),
        attendee_provider_id: expect.stringContaining("linkedin_"),
        name: null,
        type: 0,
        timestamp: expect.any(String),
        unread_count: expect.any(Number),
        archived: 0,
        muted_until: null,
        read_only: 0,
        disabledFeatures: [],
        folder: ["INBOX", "INBOX_LINKEDIN_CLASSIC"],
      });
    });

    it("should accept overrides", () => {
      const overrides = {
        name: "Custom Chat",
        unread_count: 5,
      };
      
      const chat = createMockChat("test-account", overrides);
      
      expect(chat.name).toBe("Custom Chat");
      expect(chat.unread_count).toBe(5);
    });
  });

  describe("createMockMessage", () => {
    it("should create a valid mock message", () => {
      const message = createMockMessage("test-account", "test-chat");
      
      expect(message).toMatchObject({
        object: "Message",
        id: expect.stringContaining("msg_"),
        account_id: "test-account",
        chat_id: "test-chat",
        chat_provider_id: expect.stringContaining("chat_provider_"),
        provider_id: expect.stringContaining("msg_provider_"),
        sender_id: expect.stringContaining("sender_"),
        text: expect.any(String),
        timestamp: expect.any(String),
        is_sender: expect.any(Number),
        seen: expect.any(Number),
        hidden: 0,
        deleted: 0,
        edited: 0,
        is_event: 0,
        delivered: 1,
        behavior: 0,
        event_type: 0,
        replies: 0,
        message_type: "MESSAGE",
        attendee_type: "MEMBER",
        attendee_distance: 1,
        content: expect.any(String),
        type: "text",
        is_read: expect.any(Boolean),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it("should accept overrides", () => {
      const overrides = {
        text: "Custom message",
        is_sender: 0,
      };
      
      const message = createMockMessage("test-account", "test-chat", overrides);
      
      expect(message.text).toBe("Custom message");
      expect(message.content).toBe("Custom message");
      expect(message.is_sender).toBe(0);
    });
  });

  describe("createMockAttachment", () => {
    it("should create a valid image attachment", () => {
      const attachment = createMockAttachment({ type: "img" });
      
      expect(attachment).toMatchObject({
        id: expect.stringContaining("att_"),
        type: "img",
        file_size: expect.any(Number),
        unavailable: false,
        mimetype: expect.stringMatching(/^image\//),
        file_name: expect.stringMatching(/\.(jpg|jpeg|png|gif)$/),
        size: {
          width: expect.any(Number),
          height: expect.any(Number),
        },
        sticker: expect.any(Boolean),
      });
    });

    it("should create a valid video attachment", () => {
      const attachment = createMockAttachment({ type: "video" });
      
      expect(attachment).toMatchObject({
        type: "video",
        mimetype: "video/mp4",
        file_name: expect.stringMatching(/\.mp4$/),
        size: {
          width: expect.any(Number),
          height: expect.any(Number),
        },
        duration: expect.any(Number),
        gif: expect.any(Boolean),
      });
    });

    it("should create a valid audio attachment", () => {
      const attachment = createMockAttachment({ type: "audio" });
      
      expect(attachment).toMatchObject({
        type: "audio",
        mimetype: "audio/mp3",
        file_name: expect.stringMatching(/\.mp3$/),
        duration: expect.any(Number),
        voice_note: expect.any(Boolean),
      });
    });

    it("should create a valid file attachment", () => {
      const attachment = createMockAttachment({ type: "file" });
      
      expect(attachment).toMatchObject({
        type: "file",
        mimetype: expect.any(String),
        file_name: expect.any(String),
      });
    });
  });

  describe("createMockReply", () => {
    it("should create a reply message", () => {
      const originalMessage = createMockMessage("test-account", "test-chat", {
        id: "original-msg",
        text: "Original message",
      });
      
      const reply = createMockReply("test-account", "test-chat", originalMessage, 1000);
      
      expect(reply).toMatchObject({
        text: expect.any(String),
        content: expect.any(String),
        is_sender: 0,
        timestamp: expect.any(String),
        reply_to: {
          id: "original-msg",
          text: "Original message",
          timestamp: originalMessage.timestamp,
          sender_id: originalMessage.sender_id,
        },
      });
    });
  });

  describe("createMockConversation", () => {
    it("should create a complete conversation", () => {
      const conversation = createMockConversation("test-account", 3);
      
      expect(conversation.chat).toMatchObject({
        account_id: "test-account",
        object: "Chat",
      });
      
      expect(conversation.attendees).toHaveLength(2);
      expect(conversation.attendees[0].is_self).toBe(1);
      expect(conversation.attendees[1].is_self).toBe(0);
      
      expect(conversation.messages).toHaveLength(3);
      
      // Check that last message info is set on chat
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      expect(conversation.chat.timestamp).toBe(lastMessage.timestamp);
      expect(conversation.chat.last_message).toEqual(lastMessage);
    });

    it("should use default message count", () => {
      const conversation = createMockConversation("test-account");
      
      expect(conversation.messages).toHaveLength(MOCK_CONFIG.DEFAULT_MESSAGE_COUNT);
    });
  });

  describe("createHistoricalSyncData", () => {
    it("should create historical sync data", () => {
      const syncData = createHistoricalSyncData("test-account", 2, 5);
      
      expect(syncData.account).toMatchObject({
        account_id: "test-account",
      });
      
      expect(syncData.conversations).toHaveLength(2);
      expect(syncData.conversations[0].messages).toHaveLength(5);
      expect(syncData.conversations[1].messages).toHaveLength(5);
    });

    it("should use default values", () => {
      const syncData = createHistoricalSyncData("test-account");
      
      expect(syncData.conversations).toHaveLength(MOCK_CONFIG.DEFAULT_CHAT_COUNT);
      expect(syncData.conversations[0].messages).toHaveLength(MOCK_CONFIG.DEFAULT_MESSAGE_COUNT);
    });
  });

  describe("createOutgoingMessage", () => {
    it("should create an outgoing message from request", () => {
      const request = {
        chat_id: "test-chat",
        text: "Hello world",
        attachments: [
          {
            type: "img",
            filename: "photo.jpg",
          },
        ],
      };
      
      const message = createOutgoingMessage("test-account", request);
      
      expect(message).toMatchObject({
        account_id: "test-account",
        chat_id: "test-chat",
        text: "Hello world",
        content: "Hello world",
        is_sender: 1,
        timestamp: expect.any(String),
      });
      
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments?.[0]).toMatchObject({
        type: "img",
        file_name: expect.any(String),
      });
    });
  });
});
