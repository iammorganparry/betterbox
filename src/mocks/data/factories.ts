import { faker } from "@faker-js/faker";
import type {
  UnipileApiAccountStatus,
  UnipileApiChat,
  UnipileApiMessage,
  UnipileApiChatAttendee,
  UnipileApiAttachment,
  UnipileApiSendMessageRequest,
} from "~/types/unipile-api";

// Configuration for generation
export const MOCK_CONFIG = {
  DEFAULT_ACCOUNT_ID: "mock-linkedin-account",
  DEFAULT_PROVIDER: "LINKEDIN" as const,
  MESSAGE_DELAY_MS: { min: 300, max: 800 },
  SYNC_BATCH_SIZE: 20,
  DEFAULT_CHAT_COUNT: 5,
  DEFAULT_MESSAGE_COUNT: 20,
} as const;

// Provider types
type Provider = "LINKEDIN" | "WHATSAPP" | "TELEGRAM" | "INSTAGRAM" | "FACEBOOK";

// Helper to generate consistent IDs
function generateId(prefix: string = ""): string {
  return `${prefix}${faker.string.uuid()}`;
}

// Generate a mock account status
export function createMockAccount(
  overrides: Partial<UnipileApiAccountStatus> = {}
): UnipileApiAccountStatus {
  const accountId = overrides.account_id || MOCK_CONFIG.DEFAULT_ACCOUNT_ID;
  
  return {
    account_id: accountId,
    provider: MOCK_CONFIG.DEFAULT_PROVIDER,
    status: "connected",
    last_activity: new Date().toISOString(),
    ...overrides,
  };
}

// Generate a mock chat attendee
export function createMockAttendee(
  accountId: string,
  overrides: Partial<UnipileApiChatAttendee> = {}
): UnipileApiChatAttendee {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const fullName = `${firstName} ${lastName}`;
  
  return {
    object: "ChatAttendee",
    id: generateId("attendee_"),
    account_id: accountId,
    provider_id: generateId("linkedin_"),
    name: fullName,
    is_self: 0,
    hidden: 0,
    picture_url: faker.image.avatar(),
    profile_url: `https://linkedin.com/in/${faker.internet.username()}`,
    specifics: {
      provider: "LINKEDIN",
      member_urn: `urn:li:member:${faker.number.int({ min: 100000000, max: 999999999 })}`,
      occupation: faker.person.jobTitle(),
      network_distance: faker.helpers.arrayElement(["FIRST", "SECOND", "THIRD"]),
      pending_invitation: false,
      location: `${faker.location.city()}, ${faker.location.country()}`,
      headline: faker.person.jobDescriptor() + " at " + faker.company.name(),
      contact_info: {
        emails: [faker.internet.email({ firstName, lastName })],
        phone_numbers: [],
        websites: [],
        social_handles: [],
      },
    },
    // Legacy fields
    first_name: firstName,
    last_name: lastName,
    display_name: fullName,
    profile_image_url: faker.image.avatar(),
    is_contact: faker.datatype.boolean(),
    ...overrides,
  };
}

// Generate a mock chat
export function createMockChat(
  accountId: string,
  overrides: Partial<UnipileApiChat> = {}
): UnipileApiChat {
  const chatId = generateId("chat_");
  const timestamp = faker.date.recent({ days: 30 }).toISOString();
  
  return {
    id: chatId,
    object: "Chat",
    account_id: accountId,
    account_type: "LINKEDIN",
    provider_id: generateId("provider_"),
    attendee_provider_id: generateId("linkedin_"),
    name: null,
    type: 0, // Direct chat
    timestamp,
    unread_count: faker.number.int({ min: 0, max: 5 }),
    archived: 0,
    muted_until: null,
    read_only: 0,
    disabledFeatures: [],
    folder: ["INBOX", "INBOX_LINKEDIN_CLASSIC"],
    ...overrides,
  };
}

// Generate a mock message
export function createMockMessage(
  accountId: string,
  chatId: string,
  overrides: Partial<UnipileApiMessage> = {}
): UnipileApiMessage {
  const messageId = generateId("msg_");
  const timestamp = faker.date.recent({ days: 7 }).toISOString();
  const isOutgoing = overrides.is_sender ?? faker.datatype.boolean();
  
  // Generate realistic message content
  const messageTypes = [
    () => faker.lorem.sentence(),
    () => `Hi ${faker.person.firstName()}, ${faker.lorem.sentences(2)}`,
    () => `Thanks for connecting! ${faker.lorem.sentence()}`,
    () => faker.lorem.paragraph(2),
    () => `Looking forward to ${faker.lorem.words(3)}. ${faker.lorem.sentence()}`,
  ];
  
  const defaultContent = faker.helpers.arrayElement(messageTypes)();
  
  const baseMessage = {
    object: "Message",
    id: messageId,
    account_id: accountId,
    chat_id: chatId,
    chat_provider_id: generateId("chat_provider_"),
    provider_id: generateId("msg_provider_"),
    sender_id: generateId("sender_"),
    text: defaultContent,
    timestamp,
    is_sender: isOutgoing ? 1 : 0,
    seen: faker.datatype.boolean() ? 1 : 0,
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
    // Legacy fields
    content: defaultContent,
    type: "text",
    is_read: faker.datatype.boolean(),
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };

  // Ensure text and content are synchronized
  if (overrides.text && !overrides.content) {
    baseMessage.content = overrides.text;
  } else if (overrides.content && !overrides.text) {
    baseMessage.text = overrides.content;
  }

  return baseMessage as UnipileApiMessage;
}

// Generate a mock attachment
export function createMockAttachment(
  overrides: Partial<UnipileApiAttachment> = {}
): UnipileApiAttachment {
  const attachmentTypes = ["img", "file", "video", "audio"] as const;
  const defaultType = faker.helpers.arrayElement(attachmentTypes);
  
  const baseAttachment = {
    id: generateId("att_"),
    type: defaultType,
    file_size: faker.number.int({ min: 1024, max: 10485760 }), // 1KB to 10MB
    unavailable: false,
    ...overrides,
  };
  
  // Add type-specific properties based on final type (after overrides)
  switch (baseAttachment.type) {
    case "img":
      return {
        ...baseAttachment,
        mimetype: "image/jpeg",
        file_name: `${faker.lorem.word()}.jpg`,
        size: {
          width: faker.number.int({ min: 200, max: 1920 }),
          height: faker.number.int({ min: 200, max: 1080 }),
        },
        sticker: faker.datatype.boolean({ probability: 0.1 }),
      };
    case "video":
      return {
        ...baseAttachment,
        mimetype: "video/mp4",
        file_name: `${faker.lorem.word()}.mp4`,
        size: {
          width: faker.number.int({ min: 320, max: 1920 }),
          height: faker.number.int({ min: 240, max: 1080 }),
        },
        duration: faker.number.int({ min: 5, max: 300 }),
        gif: faker.datatype.boolean({ probability: 0.2 }),
      };
    case "audio":
      return {
        ...baseAttachment,
        mimetype: "audio/mp3",
        file_name: `${faker.lorem.word()}.mp3`,
        duration: faker.number.int({ min: 5, max: 180 }),
        voice_note: faker.datatype.boolean({ probability: 0.7 }),
      };
    case "file":
    default:
      return {
        ...baseAttachment,
        mimetype: "application/pdf",
        file_name: `${faker.lorem.words(2).replace(/\s+/g, "_")}.pdf`,
      };
  }
}

// Generate reply message based on incoming message
export function createMockReply(
  accountId: string,
  chatId: string,
  originalMessage: UnipileApiMessage,
  delay: number = faker.number.int(MOCK_CONFIG.MESSAGE_DELAY_MS)
): UnipileApiMessage {
  // Generate contextual replies
  const replyTemplates = [
    "Thanks for reaching out!",
    "That sounds interesting. Tell me more.",
    "I appreciate you sharing that.",
    "Let me think about it and get back to you.",
    "Good point. I hadn't considered that.",
    "Absolutely! I completely agree.",
    "That's a great question.",
    "I'd love to learn more about this opportunity.",
    "Thanks for the connection!",
    "Looking forward to working together.",
  ];
  
  const replyText = faker.helpers.arrayElement(replyTemplates);
  
  return createMockMessage(accountId, chatId, {
    text: replyText,
    content: replyText,
    is_sender: 0, // Reply is always from the other person
    timestamp: new Date(Date.now() + delay).toISOString(),
    reply_to: {
      id: originalMessage.id,
      provider_id: originalMessage.provider_id,
      timestamp: originalMessage.timestamp,
      sender_attendee_id: originalMessage.sender_attendee_id || "",
      sender_id: originalMessage.sender_id,
      text: originalMessage.text || "",
    },
  });
}

// Generate a complete conversation
export function createMockConversation(
  accountId: string,
  messageCount: number = MOCK_CONFIG.DEFAULT_MESSAGE_COUNT
): { chat: UnipileApiChat; attendees: UnipileApiChatAttendee[]; messages: UnipileApiMessage[] } {
  const chat = createMockChat(accountId);
  
  // Create attendees (self + 1 other person)
  const otherAttendee = createMockAttendee(accountId);
  const selfAttendee = createMockAttendee(accountId, {
    is_self: 1,
    name: "You",
    first_name: "You",
    last_name: "",
    display_name: "You",
  });
  
  const attendees = [selfAttendee, otherAttendee];
  
  // Generate messages with realistic conversation flow
  const messages: UnipileApiMessage[] = [];
  const startDate = faker.date.recent({ days: 30 });
  
  for (let i = 0; i < messageCount; i++) {
    const isOutgoing = i === 0 ? true : faker.datatype.boolean({ probability: 0.4 });
    const messageDate = new Date(startDate.getTime() + i * 1000 * 60 * faker.number.int({ min: 5, max: 480 }));
    
    const message = createMockMessage(accountId, chat.id, {
      is_sender: isOutgoing ? 1 : 0,
      timestamp: messageDate.toISOString(),
      sender_id: isOutgoing ? selfAttendee.provider_id : otherAttendee.provider_id,
      sender_attendee_id: isOutgoing ? selfAttendee.id : otherAttendee.id,
    });
    
    messages.push(message);
  }
  
  // Update chat with last message info
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      chat.timestamp = lastMessage.timestamp;
      chat.last_message = lastMessage;
      chat.lastMessage = lastMessage;
    }
  }

  return { chat, attendees, messages };
}

// Generate historical sync data
export function createHistoricalSyncData(
  accountId: string,
  chatCount: number = MOCK_CONFIG.DEFAULT_CHAT_COUNT,
  messagesPerChat: number = MOCK_CONFIG.DEFAULT_MESSAGE_COUNT
): {
  account: UnipileApiAccountStatus;
  conversations: Array<{
    chat: UnipileApiChat;
    attendees: UnipileApiChatAttendee[];
    messages: UnipileApiMessage[];
  }>;
} {
  const account = createMockAccount({ account_id: accountId });
  const conversations = [];
  
  for (let i = 0; i < chatCount; i++) {
    conversations.push(createMockConversation(accountId, messagesPerChat));
  }
  
  return { account, conversations };
}

// Create an incoming message (from another user)
export function createMockIncomingMessage(
  accountId: string,
  chatId: string,
  customText?: string
): UnipileApiMessage {
  const messageText = customText || generateRandomMessage();
  
  return createMockMessage(accountId, chatId, {
    text: messageText,
    content: messageText,
    is_sender: 0, // Incoming message
    timestamp: new Date().toISOString(),
  });
}

// Convert send message request to outgoing message
export function createOutgoingMessage(
  accountId: string,
  request: UnipileApiSendMessageRequest
): UnipileApiMessage {
  return createMockMessage(accountId, request.chat_id, {
    text: request.text,
    content: request.text,
    is_sender: 1,
    timestamp: new Date().toISOString(),
    attachments: request.attachments?.map((att) =>
      createMockAttachment({
        type: att.type as
          | "img"
          | "video"
          | "audio"
          | "file"
          | "linkedin_post"
          | "video_meeting",
        file_name: att.filename,
      }),
    ),
  });
}

// Helper function to generate random message content
function generateRandomMessage(): string {
  const messages = [
    "Hey! How are you doing?",
    "Thanks for connecting on LinkedIn!",
    "I saw your recent post and found it really interesting.",
    "Would love to chat more about this opportunity.",
    "Looking forward to hearing from you!",
    "That's a great point you made in your article.",
    "I'd be interested in learning more about your experience.",
    "Thanks for sharing that resource!",
    "Hope you're having a great week!",
    "Completely agree with your perspective on this.",
    "Would you be open to a quick call sometime?",
    "I have a similar background in this area.",
    "Really appreciate you taking the time to respond.",
    "Excited to see where this conversation leads!",
    "Your work at [company] sounds fascinating.",
  ];

  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex] ?? "Hello! How are you doing?"; // Fallback to ensure string is returned
}
