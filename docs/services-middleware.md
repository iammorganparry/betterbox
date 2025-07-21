# Services Middleware for Inngest

This middleware provides dependency injection for our database services in Inngest functions, eliminating the need for direct database imports and enabling better testing and separation of concerns.

## Features

- **Dependency Injection**: All database services are automatically injected into Inngest functions
- **Type Safety**: Full TypeScript support with proper typing
- **Testability**: Easy to mock services for testing
- **Performance**: Services are initialized once and reused across function calls
- **Flexibility**: Support for custom database clients (useful for testing)

## Services Provided

The middleware injects the following services:

- `db`: PrismaClient instance
- `userService`: UserService for user operations
- `unipileAccountService`: UnipileAccountService for account management
- `unipileMessageService`: UnipileMessageService for message operations
- `unipileContactService`: UnipileContactService for contact management
- `realtimeService`: RealtimeService for real-time event creation

## Setup

The middleware is automatically configured in `src/services/inngest.ts`:

```typescript
import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime";
import { servicesMiddleware } from "~/middleware/services.middleware";

export const inngest = new Inngest({ 
  id: "linkedin-messages",
  middleware: [realtimeMiddleware(), servicesMiddleware()],
});
```

## Usage in Inngest Functions

Access services through the function context. The exact method depends on how Inngest exposes the middleware context:

### Method 1: Through Context (if available)

```typescript
export const myFunction = inngest.createFunction(
  { id: "my-function" },
  { event: "my/event" },
  async ({ event, step, ctx }) => {
    // Access services from context
    const { services } = ctx;
    
    const user = await services.userService.findById(event.data.userId);
    const accounts = await services.unipileAccountService.findByUserId(user.id);
    
    return { userId: user.id, accountCount: accounts.length };
  }
);
```

### Method 2: Through Step Context (alternative)

```typescript
export const myFunction = inngest.createFunction(
  { id: "my-function" },
  { event: "my/event" },
  async ({ event, step }) => {
    // Services might be available through step context
    const user = await step.run("find-user", async ({ ctx }) => {
      return await ctx.services.userService.findById(event.data.userId);
    });
    
    return { userId: user.id };
  }
);
```

## Service Examples

### User Operations

```typescript
// Find user by ID
const user = await services.userService.findById(userId);

// Find by Clerk ID
const user = await services.userService.findByClerkId(clerkId);

// Create user
const newUser = await services.userService.create({
  clerk_id: clerkId,
  email: email,
  first_name: firstName,
  last_name: lastName,
});
```

### Account Operations

```typescript
// Find accounts for user
const accounts = await services.unipileAccountService.findByUserId(userId);

// Update account status
await services.unipileAccountService.updateStatus(accountId, "connected");

// Get account with relations
const accountWithData = await services.unipileAccountService.findWithRelations(accountId);
```

### Message Operations

```typescript
// Get recent messages
const messages = await services.unipileMessageService.getRecentForUser(userId, {
  limit: 20,
});

// Mark messages as read
await services.unipileMessageService.markAsRead(messageIds);

// Search messages
const results = await services.unipileMessageService.search(accountId, "hello");
```

### Realtime Events

```typescript
// Create message event
const messageEvent = services.realtimeService.createMessageNewEvent({
  messageId: message.id,
  content: message.content,
  senderName: sender.name,
  // ... other fields
});

// Send realtime event
await step.sendEvent("realtime-publish", {
  name: "realtime/publish",
  data: {
    channel: services.realtimeService.getUserChannel(userId),
    topic: "messages:new",
    payload: messageEvent,
  },
});
```

## Testing

For testing, you can provide a custom database client:

```typescript
import { servicesMiddleware } from "~/middleware/services.middleware";

// Create middleware with test database
const testMiddleware = servicesMiddleware({
  db: testDatabaseClient,
});

// Use in test Inngest instance
const testInngest = new Inngest({
  id: "test",
  middleware: [testMiddleware],
});
```

## Benefits

1. **Cleaner Code**: No need to import `db` in every function
2. **Better Testing**: Easy to mock entire service layer
3. **Consistency**: Standardized way to access services
4. **Type Safety**: Full TypeScript support
5. **Performance**: Services initialized once, reused across calls
6. **Separation of Concerns**: Business logic in services, not in functions

## Migration

To migrate existing Inngest functions:

### Before:
```typescript
import { db } from "~/server/db";

export const oldFunction = inngest.createFunction(
  { id: "old-function" },
  { event: "old/event" },
  async ({ event, step }) => {
    const user = await db.user.findUnique({
      where: { id: event.data.userId }
    });
    // ... direct database operations
  }
);
```

### After:
```typescript
export const newFunction = inngest.createFunction(
  { id: "new-function" },
  { event: "new/event" },
  async ({ event, step, ctx }) => {
    const user = await ctx.services.userService.findById(event.data.userId);
    // ... use service methods
  }
);
```

This provides better abstraction, testing capabilities, and maintainability. 