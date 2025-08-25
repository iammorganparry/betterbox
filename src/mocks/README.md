# Mock Unipile Framework

A comprehensive Mock Service Worker (MSW) framework for testing Unipile API interactions without external dependencies.

## Overview

This mock framework replicates the Unipile API behavior locally, allowing you to:

- **Test message flows** - Send and receive messages with realistic timing
- **Simulate account sync** - Mock historical data synchronization 
- **Trigger webhooks** - Test Inngest event handling
- **Generate realistic data** - Use Faker.js for believable test data
- **Paginate results** - Test cursor-based pagination
- **Handle attachments** - Mock file uploads and downloads

## Quick Start

1. **Enable mock mode:**
   ```bash
   npm run dev:mock
   # or
   yarn dev:mock
   ```

2. **Use in development:**
   - The app will use mock data instead of real Unipile API
   - All Unipile requests are intercepted by MSW
   - Webhooks trigger your Inngest functions with mock data

3. **Test different scenarios:**
   - Send messages and receive auto-replies
   - Trigger account sync with generated conversations
   - Use dev tools in chat interface for quick testing

## Directory Structure

```
src/mocks/
├── data/
│   ├── store.ts          # In-memory data storage
│   └── factories.ts      # Faker.js data generators
├── handlers/
│   ├── unipile.ts        # MSW request handlers
│   └── webhook.ts        # Webhook dispatch helpers  
├── __tests__/
│   └── mock-integration.test.ts  # Integration tests
├── browser.ts            # MSW worker for browser
├── server.ts             # MSW server for Node.js
├── init-server.ts        # Server initialization
├── dev-triggers.ts       # Development message triggers
└── README.md            # This file
```

## Core Components

### Data Store (`data/store.ts`)

In-memory storage that simulates a database:

```typescript
import { mockStore } from "~/mocks/data/store";

// Create account
const account = createMockAccount({ account_id: "test-123" });
mockStore.createAccount(account);

// Add messages to chat
const message = createMockMessage("account-123", "chat-456");
mockStore.addMessage("chat-456", message);

// Get paginated results
const chats = mockStore.getChatsByAccount("account-123");
const paginated = mockStore.paginateChats(chats, cursor, 20);
```

### Data Factories (`data/factories.ts`)

Realistic data generation using Faker.js:

```typescript
import { createMockConversation, createHistoricalSyncData } from "~/mocks/data/factories";

// Generate a complete conversation
const { chat, attendees, messages } = createMockConversation("account-123", 50);

// Generate bulk sync data
const { account, conversations } = createHistoricalSyncData("account-123", 10, 100);
```

### Request Handlers (`handlers/unipile.ts`)

MSW handlers that intercept API calls:

- `GET /chats` - List conversations with pagination
- `POST /chats/:id/messages` - Send message + auto-reply
- `PATCH /chats/:id` - Mark as read/unread
- `POST /account/sync` - Trigger historical sync simulation
- `GET /health` - Health check endpoint

### Webhook Dispatcher (`handlers/webhook.ts`)

Simulates Unipile webhooks by calling your local webhook endpoint:

```typescript
import { webhookDispatcher } from "~/mocks/handlers/webhook";

// Trigger message received event
await webhookDispatcher.messageReceived(message, accountId);

// Trigger account status change
await webhookDispatcher.accountStatus(account, "connected");

// Trigger bulk sync event
await webhookDispatcher.bulkSync(accountId, "LINKEDIN", messages);
```

## Development Tools

### Message Triggers (Development Only)

When viewing a chat in development mode with mocking enabled, a "Dev Tools" button appears in the bottom-right corner. This provides:

**Quick Incoming Message**
- Triggers a random incoming message immediately
- Simulates realistic conversation flow

**Custom Message**
- Send a specific message as if received from the other person
- Useful for testing specific content or edge cases

**Conversation Burst**
- Sends 3 random messages with realistic delays
- Simulates an active conversation

**API Endpoints**
```bash
# Trigger single message
POST /api/mock-unipile/dev-trigger
{
  "action": "incoming_message",
  "chatId": "chat_123",
  "accountId": "account_123",
  "customText": "Optional custom message"
}

# Trigger conversation burst
POST /api/mock-unipile/dev-trigger
{
  "action": "conversation_burst", 
  "chatId": "chat_123",
  "accountId": "account_123",
  "messageCount": 3
}
```

These features are only available when:
- `NODE_ENV=development`
- `NEXT_PUBLIC_USE_MOCK_UNIPILE=1`

## Configuration

### Environment Variables

```bash
# Enable mock mode
USE_MOCK_UNIPILE=1
NEXT_PUBLIC_USE_MOCK_UNIPILE=1
```

### Mock Configuration (`data/factories.ts`)

```typescript
export const MOCK_CONFIG = {
  DEFAULT_ACCOUNT_ID: "mock-linkedin-account",
  DEFAULT_PROVIDER: "LINKEDIN",
  MESSAGE_DELAY_MS: { min: 300, max: 800 },
  SYNC_BATCH_SIZE: 20,
  DEFAULT_CHAT_COUNT: 5,
  DEFAULT_MESSAGE_COUNT: 20,
};
```

## Integration

### Client Setup (`src/app/providers.tsx`)

MSW automatically initializes when `NEXT_PUBLIC_USE_MOCK_UNIPILE=1`:

```typescript
useEffect(() => {
  if (process.env.NEXT_PUBLIC_USE_MOCK_UNIPILE === "1") {
    import("~/mocks/browser").then(({ startMockServiceWorker }) => {
      startMockServiceWorker().catch(console.error);
    });
  }
}, []);
```

### Server Setup (`src/env.js`)

MSW server starts automatically when `USE_MOCK_UNIPILE=1`:

```typescript
if (typeof window === "undefined" && process.env.USE_MOCK_UNIPILE === "1") {
  import("./mocks/init-server");
}
```

### HTTP Client (`src/lib/http.ts`)

Unipile client automatically uses mock endpoints:

```typescript
const baseURL = process.env.USE_MOCK_UNIPILE === "1" 
  ? "http://localhost:3000/api/v1" // Intercepted by MSW
  : `https://${dsn}/api/v1`;       // Real Unipile API
```

## Testing

### Unit Tests

Test individual components:

```typescript
import { mockStore } from "~/mocks/data/store";
import { createMockAccount } from "~/mocks/data/factories";

it("should store and retrieve accounts", () => {
  const account = createMockAccount({ account_id: "test-123" });
  mockStore.createAccount(account);
  
  expect(mockStore.getAccount("test-123")).toEqual(account);
});
```

### Integration Tests

Test complete API flows:

```typescript
import { server } from "~/mocks/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it("should handle message sending", async () => {
  const response = await fetch("/api/v1/chats/123/messages", {
    method: "POST",
    body: JSON.stringify({ text: "Hello!" }),
  });
  
  expect(response.status).toBe(200);
});
```

## Common Use Cases

### Testing Message Flows

```typescript
// Send a message
const response = await fetch("/api/v1/chats/123/messages", {
  method: "POST", 
  body: JSON.stringify({ text: "Hello!", account_id: "acc-123" })
});

// Auto-reply will be generated and sent via webhook after delay
```

### Testing Account Sync

```typescript
// Trigger sync
await fetch("/api/v1/account/sync", {
  method: "POST",
  body: JSON.stringify({ 
    account_id: "acc-123",
    chat_count: 10,
    limit: 50 
  })
});

// Webhook events will be dispatched:
// 1. account.status (pending)
// 2. messages.bulk_sync (multiple batches)  
// 3. account.status (connected)
```

### Testing Pagination

```typescript
// First page
const page1 = await fetch("/api/v1/chats?account_id=acc-123&limit=20");
const data1 = await page1.json();

// Next page
const page2 = await fetch(`/api/v1/chats?account_id=acc-123&limit=20&cursor=${data1.cursor}`);
```

## Troubleshooting

### Common Issues

**MSW not intercepting requests:**
- Check `USE_MOCK_UNIPILE=1` is set
- Verify MSW worker is registered: `/mockServiceWorker.js`
- Check browser console for MSW startup messages

**Webhooks not working:**
- Ensure `/api/mock-unipile/webhook` route exists
- Check webhook dispatcher target URL
- Verify Inngest is running locally

**Type errors:**
- Import types from `~/types/unipile-api`
- Ensure mock data matches real API structure
- Update factories when API types change

## Best Practices

1. **Keep data realistic** - Use faker to generate believable test data
2. **Test edge cases** - Empty states, error conditions, pagination
3. **Maintain type safety** - Mock data should match production types
4. **Document customizations** - Comment any project-specific modifications
5. **Update with API changes** - Keep mocks in sync with real Unipile API
6. **Use dev triggers** - Test incoming message flows with the development tools

## Security Notes

- Mock mode is disabled in production via environment checks
- No real API keys or credentials are used
- All data is generated locally and stored in memory
- MSW only runs when explicitly enabled
