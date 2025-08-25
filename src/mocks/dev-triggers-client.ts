/**
 * Client-safe development triggers for testing mock functionality
 * Only available when USE_MOCK_UNIPILE=1 and NODE_ENV=development
 */

// Check if dev triggers should be available (client-safe)
export const DEV_TRIGGERS_ENABLED = 
  (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") && 
  (process.env.NEXT_PUBLIC_USE_MOCK_UNIPILE === "1");

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
