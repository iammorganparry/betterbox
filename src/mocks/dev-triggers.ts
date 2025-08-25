/**
 * Development-only triggers for testing mock functionality
 * Only available when USE_MOCK_UNIPILE=1 and NODE_ENV=development
 */

import { createMockReply, createMockMessage } from "./data/factories";
import { mockStore } from "./data/store";
import { webhookDispatcher } from "./handlers/webhook";

// Check if dev triggers should be available
export const DEV_TRIGGERS_ENABLED = 
  (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") && 
  (process.env.USE_MOCK_UNIPILE === "1" || process.env.NEXT_PUBLIC_USE_MOCK_UNIPILE === "1");

// Trigger a mock incoming message for a specific chat
export async function triggerMockIncomingMessage(
  chatId: string,
  accountId: string,
  customText?: string
): Promise<boolean> {
  if (!DEV_TRIGGERS_ENABLED) {
    console.warn("[Dev Triggers] Attempted to use dev triggers in non-development environment");
    return false;
  }

  try {
    // Get existing chat and attendees
    const chat = mockStore.getChat(chatId);
    if (!chat) {
      console.error("[Dev Triggers] Chat not found:", chatId);
      return false;
    }

    const attendees = mockStore.getAttendees(chatId);
    const otherAttendee = attendees.find(a => a.is_self !== 1);
    if (!otherAttendee) {
      console.error("[Dev Triggers] No other attendee found in chat");
      return false;
    }

    // Create a mock incoming message
    const incomingMessage = createMockMessage(accountId, chatId, {
      is_sender: 0, // Incoming message
      sender_id: otherAttendee.provider_id,
      sender_attendee_id: otherAttendee.id,
      text: customText || generateRandomMessage(),
      timestamp: new Date().toISOString(),
    });

    // Store the message
    mockStore.addMessage(chatId, incomingMessage);

    // Dispatch webhook to trigger Inngest functions
    const success = await webhookDispatcher.messageReceived(incomingMessage, accountId);
    
    if (success) {
      console.log("[Dev Triggers] Successfully triggered incoming message:", {
        chatId,
        messageId: incomingMessage.id,
        text: incomingMessage.text,
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

// Client-side helper to trigger via API call (for use in React components)
export async function triggerIncomingMessageFromClient(
  chatId: string,
  accountId: string,
  customText?: string
): Promise<boolean> {
  if (!DEV_TRIGGERS_ENABLED) {
    return false;
  }

  try {
    const response = await fetch("/api/mock-unipile/dev-trigger", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "incoming_message",
        chatId,
        accountId,
        customText,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("[Dev Triggers] Failed to trigger from client:", error);
    return false;
  }
}

// Export environment check for components
export { DEV_TRIGGERS_ENABLED as isDevelopment };
