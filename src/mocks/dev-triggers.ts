/**
 * Development-only triggers for testing mock functionality
 * Only available when USE_MOCK_UNIPILE=1 and NODE_ENV=development
 */

import { createMockReply, createMockMessage, createMockChat, createMockAttendee } from "./data/factories";
import { mockStore } from "./data/store";
import { webhookDispatcher } from "./handlers/webhook";
import { db } from "~/db";
import { unipileChats, unipileAccounts } from "~/db/schema/tables";
import { unipileChatAttendees } from "~/db/schema/tables2";
import { eq, and } from "drizzle-orm";

// Check if dev triggers should be available
export const DEV_TRIGGERS_ENABLED = 
  (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") && 
  (process.env.USE_MOCK_UNIPILE === "1" || process.env.NEXT_PUBLIC_USE_MOCK_UNIPILE === "1");

/**
 * Get real attendees for a chat from the database
 */
async function getRealAttendeesForChat(internalChatId: string): Promise<Array<{
  id: string;
  external_id: string;
  is_self: number;
  contact?: { full_name?: string | null; first_name?: string | null; profile_image_url?: string | null } | null;
}> | null> {
  try {
    console.log("[Dev Triggers] Querying database for chat attendees using internal chat ID:", internalChatId);
    
    const attendees = await db.query.unipileChatAttendees.findMany({
      where: (table, { eq, and }) => and(
        eq(table.chat_id, internalChatId),
        eq(table.is_deleted, false)
      ),
      with: {
        contact: {
          columns: {
            full_name: true,
            first_name: true,
            profile_image_url: true
          }
        }
      }
    });
    
    console.log("[Dev Triggers] Found attendees:", attendees?.length || 0);
    return attendees || null;
  } catch (error) {
    console.error("[Dev Triggers] Failed to query attendees:", error);
    return null;
  }
}

/**
 * Get the real account ID for a chat from the database
 */
async function getChatDataForInternalChatId(internalChatId: string): Promise<{
  unipileAccountId: string;
  externalChatId: string;
} | null> {
  try {
    console.log("[Dev Triggers] Querying database for chat data using internal chat ID:", internalChatId);
    
    // Query by internal ID (unipile_chat.id) since that's what we have from the URL
    const result = await db.query.unipileChats.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.id, internalChatId),
        eq(table.is_deleted, false)
      ),
      columns: {
        external_id: true  // Get the external_id for webhook
      },
      with: {
        unipileAccount: {
          columns: {
            account_id: true  // Get the Unipile account_id, not the UUID primary key
          }
        }
      }
    });
    
    console.log("[Dev Triggers] Database query result:", result);
    
    if (result?.unipileAccount?.account_id && result.external_id) {
      const chatData = {
        unipileAccountId: result.unipileAccount.account_id,
        externalChatId: result.external_id
      };
      console.log("[Dev Triggers] Found chat data:", chatData);
      return chatData;
    }
    
    console.log("[Dev Triggers] No chat data found for internal chat ID:", internalChatId);
    return null;
  } catch (error) {
    console.error("[Dev Triggers] Failed to query chat data:", error);
    return null;
  }
}

// Trigger a mock incoming message for a specific chat
export async function triggerMockIncomingMessage(
  chatId: string,     // Internal unipile_chat.id from URL params (e.g., "335bc09d-df75-4919-ad08-48de6a62cb49")
  accountId: string,  // Internal account UUID from UI (will be converted to Unipile account ID)
  customText?: string
): Promise<boolean> {
  if (!DEV_TRIGGERS_ENABLED) {
    console.warn("[Dev Triggers] Attempted to use dev triggers in non-development environment");
    return false;
  }

  try {
    // Log what we received from the UI
    console.log("[Dev Triggers] Triggering incoming message with params:", {
      chatId,
      providedAccountId: accountId,
      customText
    });
    
    // The chatId parameter IS the internal unipile_chat.id from URL params!
    // We need to get both the Unipile account ID and external chat ID
    console.log("[Dev Triggers] Using internal chat ID from URL params:", chatId);
    const dbChatData = await getChatDataForInternalChatId(chatId);
    let realAccountId = accountId; // Default to provided accountId (internal UUID)
    let externalChatId = chatId; // Default to internal chat ID if we can't find external
    
    if (dbChatData) {
      console.log("[Dev Triggers] Found real chat data in database:", dbChatData);
      console.log("[Dev Triggers] Chat data:", {
        internalChatId: chatId,                           // Internal unipile_chat.id from URL
        externalChatId: dbChatData.externalChatId,        // External chat ID for webhook
        providedInternalAccountId: accountId,             // Internal UUID like "5be4ed31-..."
        unipileAccountId: dbChatData.unipileAccountId,    // Unipile ID like "Q5awOgRCS5agwsyXXHJgfg"
        usingRealData: true
      });
      realAccountId = dbChatData.unipileAccountId; // Use the Unipile account ID for webhook
      externalChatId = dbChatData.externalChatId; // Use external chat ID for webhook
    } else {
      console.log("[Dev Triggers] No chat data found for internal chat ID:", chatId);
      console.warn("[Dev Triggers] WARNING: Using provided IDs - Inngest may fail!");
    }
    
    // Try to get real attendees from the database first
    console.log("[Dev Triggers] Looking up real attendees for chat:", chatId);
    const dbAttendees = await getRealAttendeesForChat(chatId);
    let realSenderAttendee: { external_id: string; name: string; profile_url?: string } | null = null;
    
    if (dbAttendees && dbAttendees.length > 0) {
      // Find a non-self attendee to use as sender
      const otherAttendee = dbAttendees.find(attendee => attendee.is_self !== 1);
      if (otherAttendee) {
        realSenderAttendee = {
          external_id: otherAttendee.external_id,
          name: otherAttendee.contact?.full_name || otherAttendee.contact?.first_name || "Contact",
          profile_url: otherAttendee.contact?.profile_image_url || undefined
        };
        console.log("[Dev Triggers] Using real attendee as sender:", {
          external_id: realSenderAttendee.external_id,
          name: realSenderAttendee.name
        });
      }
    }
    
    if (!realSenderAttendee) {
      console.log("[Dev Triggers] No real attendees found, will create mock sender");
    }
    
    // Check if chat exists in mock store, if not create it (for real chats from DB)
    let chat = mockStore.getChat(chatId);
    let attendees = mockStore.getAttendees(chatId);
    
    if (!chat) {
      console.log("[Dev Triggers] Chat not found in mock store, creating mock entry for real chat:", chatId);
      
      // Create a mock chat entry for this real chatId
      chat = createMockChat(realAccountId, {
        id: chatId,
        type: 0, // Direct chat
        archived: 0,
        read_only: 0,
        updated_at: new Date().toISOString(),
      });
      
      // Store the chat
      mockStore.createChat(chat);
      
      // Create mock attendees for this chat
      const selfAttendee = createMockAttendee(realAccountId, {
        id: `${chatId}-self`,
        chat_id: chatId,
        is_self: 1,
        provider_id: realAccountId,
      });
      
      const otherAttendee = createMockAttendee(realAccountId, {
        id: `${chatId}-other`,
        chat_id: chatId,
        is_self: 0,
        provider_id: realSenderAttendee?.external_id || `mock-contact-${Date.now()}`,
        name: realSenderAttendee?.name || "Mock User",
        profile_url: realSenderAttendee?.profile_url || "https://linkedin.com/in/mockuser",
      });
      
      mockStore.addAttendee(chatId, selfAttendee);
      mockStore.addAttendee(chatId, otherAttendee);
      
      attendees = [selfAttendee, otherAttendee];
    } else {
      // Use the account ID from the existing chat in mock store
      realAccountId = chat.account_id;
    }

    const otherAttendee = attendees.find(a => a.is_self !== 1);
    if (!otherAttendee) {
      console.error("[Dev Triggers] No other attendee found in chat");
      return false;
    }

    // Create a mock incoming message
    const incomingMessage = createMockMessage(realAccountId, chatId, {
      is_sender: 0, // Incoming message
      sender_id: otherAttendee.provider_id,
      sender_attendee_id: otherAttendee.id,
      text: customText || generateRandomMessage(),
      timestamp: new Date().toISOString(),
    });

    // Store the message
    mockStore.addMessage(chatId, incomingMessage);

    // Dispatch webhook to trigger Inngest functions  
    console.log("[Dev Triggers] Dispatching webhook with final data:", {
      internalChatId: chatId,                       // Internal chat ID (message.chat_id)
      externalChatId: externalChatId,               // External chat ID for webhook
      messageId: incomingMessage.id,
      finalUnipileAccountId: realAccountId,         // Should be Unipile ID like "Q5awOgRCS5agwsyXXHJgfg"
      text: incomingMessage.text?.substring(0, 50)
    });
    
    // Prepare sender information for webhook
    const senderInfo = realSenderAttendee ? {
      name: realSenderAttendee.name,
      profile_url: realSenderAttendee.profile_url,
      provider_id: realSenderAttendee.external_id
    } : undefined;
    
    console.log("[Dev Triggers] Webhook sender info:", senderInfo);
    
    const success = await webhookDispatcher.messageReceived(incomingMessage, realAccountId, "LINKEDIN", senderInfo, externalChatId);
    
    if (success) {
      console.log("[Dev Triggers] Successfully triggered incoming message:", {
        internalChatId: chatId,
        externalChatId: externalChatId,
        messageId: incomingMessage.id,
        text: incomingMessage.text,
        unipileAccountIdUsed: realAccountId  // Should be Unipile ID like "Q5awOgRCS5agwsyXXHJgfg"
      });
    }

    return success;
  } catch (error) {
    console.error("[Dev Triggers] Failed to trigger incoming message:", error);
    return false;
  }
}

// Trigger multiple mock messages to simulate a conversation burst
export async function triggerMockConversationBurst(
  chatId: string,
  accountId: string,
  messageCount = 3
): Promise<boolean> {
  if (!DEV_TRIGGERS_ENABLED) {
    return false;
  }

  try {
    const results: boolean[] = [];
    
    for (let i = 0; i < messageCount; i++) {
      // Add delay between messages to make it realistic
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      }
      
      const result = await triggerMockIncomingMessage(chatId, accountId);
      results.push(result);
    }

    return results.every(Boolean);
  } catch (error) {
    console.error("[Dev Triggers] Failed to trigger conversation burst:", error);
    return false;
  }
}

// Generate random conversation messages
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

// Note: Client-side functions moved to dev-triggers-client.ts to avoid server imports in client components
