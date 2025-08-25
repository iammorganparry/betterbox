import type {
  UnipileMessageReceivedEventData,
  UnipileAccountStatusEventData,
  UnipileBulkMessageSyncEventData,
} from "~/services/inngest/schemas/unipile";
import type { UnipileApiMessage, UnipileApiAccountStatus } from "~/types/unipile-api";

// Configuration
const WEBHOOK_CONFIG = {
  target: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  endpoint: "/api/mock-unipile/webhook",
  retries: 3,
  retryDelay: 1000,
} as const;

// Helper to convert our mock message to webhook event format
function messageToWebhookEvent(
  message: UnipileApiMessage,
  accountId: string,
  provider: string = "LINKEDIN"
): UnipileMessageReceivedEventData {
  return {
    account_id: accountId,
    account_info: {
      feature: "messaging",
      type: "linkedin",
      user_id: accountId,
    },
    account_type: provider,
    attachments: message.attachments?.map(att => ({
      id: att.id,
      url: att.url,
      filename: att.file_name,
      file_size: att.file_size,
      mime_type: att.mimetype,
      type: att.type,
      unavailable: att.unavailable || false,
    })) || [],
    attendees: [], // Will be populated by the handler if needed
    chat_content_type: null,
    chat_id: message.chat_id,
    event: "message_received",
    folder: ["INBOX"],
    is_event: message.is_event,
    is_group: false,
    message: message.text || "",
    message_id: message.id,
    message_type: message.message_type,
    provider_chat_id: message.chat_provider_id,
    provider_message_id: message.provider_id,
    quoted: message.quoted ? {
      id: message.quoted.id,
      text: message.quoted.text || "",
      timestamp: message.quoted.timestamp,
    } : null,
    sender: {
      attendee_id: message.sender_attendee_id || "",
      attendee_name: "Mock User",
      attendee_profile_url: "https://linkedin.com/in/mockuser",
      attendee_provider_id: message.sender_id,
    },
    subject: message.subject || null,
    timestamp: message.timestamp,
    webhook_name: "mock_unipile_webhook",
  };
}

// Helper to create account status event
function createAccountStatusEvent(
  account: UnipileApiAccountStatus,
  status: "pending" | "connected" | "error" = "connected"
): UnipileAccountStatusEventData {
  return {
    ...account,
    status,
    error_message: status === "error" ? "Mock error for testing" : undefined,
    user_identifier: account.account_id,
  };
}

// Helper to create bulk sync event
function createBulkSyncEvent(
  accountId: string,
  provider: string,
  messages: UnipileApiMessage[]
): UnipileBulkMessageSyncEventData {
  return {
    account_id: accountId,
    provider,
    messages,
  };
}

// Core webhook dispatcher with retry logic
async function dispatchWebhook(
  eventType: string,
  eventData: any,
  retryCount = 0
): Promise<boolean> {
  const url = `${WEBHOOK_CONFIG.target}${WEBHOOK_CONFIG.endpoint}`;
  
  try {
    console.log(`[Mock Unipile] Dispatching webhook: ${eventType}`, { url, eventData });
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: eventType,
        data: eventData,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }

    console.log(`[Mock Unipile] Webhook dispatched successfully: ${eventType}`);
    return true;
  } catch (error) {
    console.error(`[Mock Unipile] Webhook dispatch failed (attempt ${retryCount + 1}):`, error);
    
    if (retryCount < WEBHOOK_CONFIG.retries - 1) {
      const delay = WEBHOOK_CONFIG.retryDelay * Math.pow(2, retryCount);
      console.log(`[Mock Unipile] Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return dispatchWebhook(eventType, eventData, retryCount + 1);
    }
    
    return false;
  }
}

// Public API for dispatching different webhook types
export const webhookDispatcher = {
  // Dispatch a message received event
  async messageReceived(
    message: UnipileApiMessage,
    accountId: string,
    provider: string = "LINKEDIN"
  ): Promise<boolean> {
    const eventData = messageToWebhookEvent(message, accountId, provider);
    return dispatchWebhook("unipile/message_received", eventData);
  },

  // Dispatch account status change
  async accountStatus(
    account: UnipileApiAccountStatus,
    status: "pending" | "connected" | "error" = "connected"
  ): Promise<boolean> {
    const eventData = createAccountStatusEvent(account, status);
    return dispatchWebhook("unipile/account.status", eventData);
  },

  // Dispatch bulk message sync
  async bulkMessageSync(
    accountId: string,
    provider: string,
    messages: UnipileApiMessage[]
  ): Promise<boolean> {
    const eventData = createBulkSyncEvent(accountId, provider, messages);
    return dispatchWebhook("unipile/messages.bulk_sync", eventData);
  },

  // Generic webhook dispatcher
  async dispatch(eventType: string, eventData: any): Promise<boolean> {
    return dispatchWebhook(eventType, eventData);
  },
};

// Delayed webhook dispatcher for simulating async behavior
export function dispatchWebhookDelayed(
  dispatcher: () => Promise<boolean>,
  delay: number = 500
): void {
  setTimeout(async () => {
    try {
      await dispatcher();
    } catch (error) {
      console.error("[Mock Unipile] Delayed webhook dispatch failed:", error);
    }
  }, delay);
}

export { messageToWebhookEvent, createAccountStatusEvent, createBulkSyncEvent };
