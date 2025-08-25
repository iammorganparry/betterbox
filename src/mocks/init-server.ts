import { server } from "./server";

// Configuration
const MOCK_ENABLED = process.env.USE_MOCK_UNIPILE === "1";

function startMockServer(): void {
  server.listen({ 
    onUnhandledRequest: "bypass" 
  });
  console.log("[MSW] Mock Service Worker server started");
}

if (MOCK_ENABLED) {
	console.log("[Mock Init] Initializing Mock Service Worker for server...");
	startMockServer();
} else {
	console.log(
		"[Mock Init] Mock Service Worker disabled (USE_MOCK_UNIPILE != 1)",
	);
}
