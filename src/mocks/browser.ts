import { setupWorker } from "msw/browser";
import { unipileHandlers } from "./handlers/unipile";

// Create MSW worker for browser environment
const worker = setupWorker(...unipileHandlers);

export async function startMockServiceWorker(): Promise<void> {
  try {
    await worker.start({
      onUnhandledRequest: "bypass",
      serviceWorker: {
        url: "/mockServiceWorker.js",
      },
    });
    console.log("[MSW] Mock Service Worker started in browser");
  } catch (error) {
    console.error("[MSW] Failed to start Mock Service Worker:", error);
    throw error;
  }
}

export { worker };
