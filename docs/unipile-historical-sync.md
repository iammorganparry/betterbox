# Unipile Historical Message Sync

The Historical Message Sync allows you to fetch and seed historical messages from a user's connected social accounts (LinkedIn, etc.) after they complete onboarding.

## Overview

When a user connects their social account through Unipile, you can trigger a historical sync to fetch their existing message history and populate your database. This is particularly useful for:

- Initial onboarding experience
- Providing immediate value by showing existing conversations
- Backfilling data for analytics and insights

## Usage

### Basic Sync

Trigger a historical sync after a user connects their account:

```typescript
import { HistoricalSyncService } from "~/services/unipile/historical-sync";

// After user successfully connects their LinkedIn account
const syncResult = await HistoricalSyncService.triggerSync({
  user_id: "user_123",
  account_id: "linkedin_account_456", 
  provider: "linkedin",
  limit: 500, // Optional: limit messages (default: 1000)
});

console.log("Sync triggered:", syncResult);
```

### Bulk Sync

Sync multiple accounts at once:

```typescript
const accounts = [
  { user_id: "user_1", account_id: "linkedin_1", provider: "linkedin" },
  { user_id: "user_2", account_id: "linkedin_2", provider: "linkedin" },
];

await HistoricalSyncService.triggerBulkSync(accounts);
```

### Custom Sync

For advanced use cases with custom parameters:

```typescript
await HistoricalSyncService.triggerCustomSync({
  user_id: "user_123",
  account_id: "linkedin_account_456",
  provider: "linkedin", 
  limit: 2000,
  dsn: "custom.unipile.dsn", // Optional: override default DSN
  api_key: "custom_api_key", // Optional: override default API key
});
```

## Integration Points

### After Account Connection

Trigger sync immediately after successful account connection:

```typescript
// In your account connection handler
export async function connectAccount(userId: string, provider: string, accountData: any) {
  // 1. Save account to database
  const account = await db.unipileAccount.create({
    data: {
      user_id: userId,
      provider,
      account_id: accountData.id,
      status: "connected",
      provider_data: accountData,
    },
  });

  // 2. Trigger historical sync
  await HistoricalSyncService.triggerSync({
    user_id: userId,
    account_id: accountData.id,
    provider,
    limit: 1000,
  });

  return account;
}
```

### Using with tRPC

Create a tRPC procedure to trigger sync:

```typescript
// In your tRPC router
export const unipileRouter = createTRPCRouter({
  triggerHistoricalSync: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      provider: z.string(),
      limit: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await HistoricalSyncService.triggerSync({
        user_id: ctx.session.user.id,
        account_id: input.accountId,
        provider: input.provider,
        limit: input.limit,
      });
    }),
});
```

## Monitoring Progress

The sync function updates the account's `provider_data` with sync status:

```typescript
// Check sync status
const account = await db.unipileAccount.findUnique({
  where: { id: accountId },
});

const syncData = account.provider_data as any;
console.log("Last sync:", syncData?.last_historical_sync);
console.log("Messages synced:", syncData?.historical_sync_count);
```

## Event Flow

1. **Trigger**: Call `HistoricalSyncService.triggerSync()`
2. **Processing**: Inngest function `unipileHistoricalMessageSync` executes
3. **API Calls**: Function fetches chats and messages from Unipile API
4. **Database**: Messages and contacts are upserted to database
5. **Completion**: Account status is updated with sync metadata

## API Limits & Considerations

- **Rate Limits**: Respects Unipile API rate limits
- **Pagination**: Handles large message volumes with pagination
- **Error Handling**: Graceful failure handling per chat/message
- **Timeout**: Long-running operation suitable for background processing
- **Idempotent**: Safe to run multiple times (upsert operations)

## Environment Variables

Ensure these are configured in your `.env`:

```bash
UNIPILE_API_KEY=your_api_key
UNIPILE_DSN=your_dsn
UNIPILE_WEBHOOK_SECRET=optional_webhook_secret
```

## Example Integration

Complete example of integrating historical sync into your onboarding flow:

```typescript
// pages/api/unipile/connect.ts
export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { userId, provider, accountData } = req.body;
  
  try {
    // 1. Save account
    const account = await db.unipileAccount.create({
      data: {
        user_id: userId,
        provider,
        account_id: accountData.id,
        status: "connected",
        provider_data: accountData,
      },
    });

    // 2. Trigger historical sync
    const syncResult = await HistoricalSyncService.triggerSync({
      user_id: userId,
      account_id: accountData.id,
      provider,
      limit: 1000,
    });

    res.json({ 
      success: true, 
      account, 
      syncTriggered: true,
      syncId: syncResult.ids[0] 
    });
  } catch (error) {
    console.error('Account connection failed:', error);
    res.status(500).json({ error: 'Failed to connect account' });
  }
}
```

This historical sync ensures your users see immediate value from their connected accounts! 🚀 