# Unipile Comprehensive Inbox Sync

This document describes the enhanced Unipile integration that provides complete LinkedIn inbox synchronization for our application.

## Overview

We've built a comprehensive system to sync LinkedIn inbox data using the Unipile API, including:

- **Chats/Conversations**: All LinkedIn conversations/message threads
- **Messages**: Complete message history with attachments and metadata
- **Attendees/Participants**: All chat participants with their profile information
- **Contacts**: Enriched contact data from LinkedIn profiles
- **Search Functionality**: LinkedIn search capabilities for people, companies, posts, and jobs

## Architecture

### Database Schema

We've extended the database with the following new models:

#### UnipileChat
- Represents conversations/message threads
- Links to UnipileAccount (provider account)
- Contains chat metadata (type, name, last message timestamp)

#### UnipileChatAttendee
- Represents participants in conversations
- Links to UnipileChat
- Contains participant profile information

#### UnipileMessage (Enhanced)
- Enhanced with chat relationship
- Support for attachments and metadata
- Proper message threading

#### UnipileMessageAttachment
- Represents file/media attachments
- Links to messages
- Contains file metadata and download URLs

### Service Layer

#### UnipileService Class
Located at `src/services/unipile/unipile.service.ts`

Provides methods for:
- **Chat Operations**: `listChats()`, `getChat()`
- **Message Operations**: `listChatMessages()`, `getMessage()`, `sendMessage()`
- **Attendee Operations**: `listChatAttendees()`, `getAttendeeProfilePicture()`
- **Search Operations**: `search()`, `getSearchParameters()`
- **Profile Operations**: `getProfile()`, `getCompanyProfile()`
- **Utility Operations**: `downloadAttachment()`, `healthCheck()`

#### Factory Functions
- `createUnipileService(config)`: Create service with custom config
- `createDefaultUnipileService()`: Create service using environment variables

## Sync Process

### Historical Message Sync
The `unipileHistoricalMessageSync` function now provides comprehensive inbox sync:

1. **Chat Discovery**: Fetches all chats/conversations for the account
2. **Attendee Sync**: For each chat, syncs all participants and their profile data
3. **Message Sync**: Fetches all messages in each conversation with pagination
4. **Attachment Sync**: Downloads and stores message attachment metadata
5. **Contact Enrichment**: Updates contact database with participant information

### Real-time Updates
Existing webhook handlers remain functional for real-time updates:
- New message notifications
- Account status changes
- Profile view tracking

## Usage Examples

### Basic Service Usage

```typescript
import { createDefaultUnipileService } from '~/services/unipile/unipile.service';

const unipileService = createDefaultUnipileService();

// List all chats
const chats = await unipileService.listChats({
  account_id: 'linkedin-account-id',
  limit: 50
});

// Get messages from a specific chat
const messages = await unipileService.listChatMessages({
  chat_id: 'chat-id',
  account_id: 'linkedin-account-id',
  limit: 100
});

// Search LinkedIn
const searchResults = await unipileService.search({
  api: 'sales_navigator',
  category: 'people',
  keywords: 'software engineer'
}, {
  account_id: 'linkedin-account-id'
});
```

### Triggering Historical Sync

```typescript
// Trigger comprehensive inbox sync
await inngest.send({
  name: "unipile/sync.historical_messages",
  data: {
    user_id: user.clerk_id,
    account_id: 'linkedin-account-id',
    provider: 'linkedin',
    dsn: process.env.UNIPILE_DSN,
    api_key: process.env.UNIPILE_API_KEY,
    limit: 1000
  }
});
```

## Database Queries

### Getting User's Complete Inbox

```typescript
// Get all chats with latest message
const userChats = await db.unipileChat.findMany({
  where: {
    unipile_account: {
      user_id: userId,
      provider: 'linkedin'
    },
    is_deleted: false
  },
  include: {
    UnipileMessage: {
      orderBy: { sent_at: 'desc' },
      take: 1
    },
    UnipileChatAttendee: true
  },
  orderBy: { last_message_at: 'desc' }
});

// Get messages for a specific chat
const chatMessages = await db.unipileMessage.findMany({
  where: {
    chat_id: chatId,
    is_deleted: false
  },
  include: {
    UnipileMessageAttachment: true
  },
  orderBy: { sent_at: 'asc' }
});
```

### Contact Management

```typescript
// Get all LinkedIn contacts
const contacts = await db.unipileContact.findMany({
  where: {
    unipile_account: {
      user_id: userId,
      provider: 'linkedin'
    },
    is_deleted: false
  },
  orderBy: { last_interaction: 'desc' }
});
```

## API Integration

### Environment Variables Required

```env
UNIPILE_API_KEY=your_api_key
UNIPILE_DSN=your_dsn_endpoint
```

### Webhook Configuration

The system supports real-time webhooks for:
- `unipile/account.status` - Account connection status changes
- `unipile/message.new` - New incoming messages
- `unipile/profile.view` - LinkedIn profile views
- `unipile/account.connected` - New account connections
- `unipile/account.disconnected` - Account disconnections

## Search Capabilities

### LinkedIn Search Types

The service supports multiple LinkedIn search interfaces:

1. **Classic LinkedIn**: Basic search functionality
2. **Sales Navigator**: Advanced sales-focused search
3. **LinkedIn Recruiter**: Specialized recruiting search

### Search Categories

- **People**: Individual LinkedIn profiles
- **Companies**: Business/organization profiles  
- **Posts**: LinkedIn content/posts
- **Jobs**: Job postings

### Example Search Queries

```typescript
// Search for software engineers in tech companies
const peopleSearch = await unipileService.search({
  api: 'sales_navigator',
  category: 'people',
  keywords: 'software engineer',
  industry: { include: ['4'] }, // Tech industry ID
  location: [102277331] // San Francisco area ID
}, { account_id: accountId });

// Search for companies with job openings
const companySearch = await unipileService.search({
  api: 'classic',
  category: 'companies',
  has_job_offers: true,
  location: [102277331, 102448103] // Multiple locations
}, { account_id: accountId });
```

## Performance Considerations

### Pagination
- All list operations support cursor-based pagination
- Recommended page sizes: 50-100 items for optimal performance
- Historical sync uses smaller batches (50) for comprehensive data coverage

### Rate Limiting
- Service automatically handles Unipile API rate limits
- Sync operations include retry logic and error handling
- Failed operations are logged but don't stop the overall sync process

### Data Storage
- Efficient indexing on frequently queried fields
- Soft deletes to maintain data integrity
- Metadata stored as JSON for flexibility

## Monitoring and Debugging

### Logging
- Comprehensive logging throughout the sync process
- Step-by-step progress tracking in Inngest functions
- Warning logs for failed individual operations (continue processing)

### Error Handling
- Graceful degradation: failed chats/messages don't stop entire sync
- Detailed error messages with context
- Separate error tracking for different operation types

## Future Enhancements

Potential improvements to consider:

1. **Incremental Sync**: Only sync new/updated data since last sync
2. **Advanced Search Filters**: More sophisticated search parameter building
3. **Message Search**: Full-text search across message content
4. **Analytics**: Track sync performance and data quality metrics
5. **Caching**: Cache frequently accessed data for better performance

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**: Ensure `UNIPILE_API_KEY` and `UNIPILE_DSN` are set
2. **Rate Limiting**: Reduce pagination sizes if hitting API limits
3. **Database Constraints**: Run migrations if new models are missing
4. **Permission Issues**: Verify LinkedIn account has proper permissions

### Debugging Steps

1. Check Inngest dashboard for sync job status
2. Review application logs for specific error messages
3. Test individual service methods to isolate issues
4. Verify Unipile API connectivity with health check

## Migration Guide

To migrate from the previous simple message sync:

1. Run database migrations: `npx prisma migrate dev`
2. Update imports to use new `UnipileService`
3. Replace direct API calls with service methods
4. Update queries to use new chat/attendee models
5. Test historical sync with small data sets first 