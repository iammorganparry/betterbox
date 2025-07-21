# Unipile Contact Enrichment with Profile Data

This document describes the enhanced contact creation system that fetches complete profile data from the Unipile API using the `getProfile` endpoint.

## Overview

Previously, contact data was limited to what was available in chat attendee responses or message sender data. Now, the system automatically fetches comprehensive profile information for each contact using the Unipile `getProfile` API endpoint.

## Enhanced Data Collection

### Before: Limited Data
- Basic name and headline from chat attendee data
- Profile image URL from attendee response
- Limited contact information

### After: Comprehensive Profile Data
- **Complete Names**: `first_name`, `last_name` from LinkedIn profiles
- **Rich Profile Info**: Detailed headlines, summaries, current job positions
- **High-Quality Images**: Profile pictures (including large versions) from LinkedIn
- **LinkedIn URNs**: Public identifiers and profile URLs for LinkedIn linking
- **Network Information**: Accurate connection status and network distance mapping
- **Contact Details**: Email addresses, phone numbers, websites, social handles
- **Professional Data**: Current job position from work experience
- **Location Data**: Geographic location from LinkedIn profiles
- **Profile Metadata**: Premium status, creator/influencer flags, hiring status

## Implementation Details

### Helper Functions

#### `fetchContactProfile()`
Safely fetches complete profile data with error handling:
- Calls Unipile's `getProfile` endpoint
- Handles API failures gracefully
- Falls back to basic data if profile fetch fails
- Logs success/failure for monitoring

#### `createEnrichedContactFromAttendee()`
Creates contacts from chat attendees with profile enrichment:
- Fetches complete profile data using `provider_id`
- Maps LinkedIn-specific fields (member URN, network distance)
- Preserves network relationship information
- Skips account owners (`is_self === 1`)

#### `createEnrichedContactFromSender()`
Creates contacts from message senders with profile enrichment:
- Fetches profile data using sender ID
- Handles real-time message events
- Falls back to sender URN if profile fetch fails

### Integration Points

#### Historical Message Sync
- **Chat Attendees**: All non-self attendees get full profile data
- **Message Processing**: Enhanced contact creation for message threads
- **Batch Processing**: Efficient profile fetching during bulk sync

#### Real-time Events
- **New Messages**: Automatic profile enrichment for new senders
- **Profile Views**: Enhanced contact data for LinkedIn profile viewers
- **Bulk Message Sync**: Profile enrichment for webhook message imports

## Error Handling

### Graceful Degradation
- If `getProfile` fails (rate limits, privacy, deleted profiles), falls back to basic data
- Environment variable checks prevent crashes if Unipile config is missing
- Comprehensive error logging for debugging

### Rate Limiting Considerations
- Profile fetching adds API calls to sync process
- Consider implementing caching for frequently accessed profiles
- Monitor API usage to stay within Unipile limits

## Data Schema Updates

### Enhanced Contact Fields
All contact records now potentially include:

```typescript
{
  full_name: string,           // Constructed from first_name + last_name
  first_name: string,          // From UnipileApiUserProfile.first_name
  last_name: string,           // From UnipileApiUserProfile.last_name
  headline: string,            // From UnipileApiUserProfile.headline
  profile_image_url: string,   // From profile_picture_url_large or profile_picture_url
  provider_url: string,        // From UnipileApiUserProfile.public_profile_url
  member_urn: string,          // From public_identifier or provider_id
  network_distance: enum,      // Mapped from API network_distance (FIRST_DEGREE -> FIRST, etc.)
  occupation: string,          // From current work_experience position
  location: string,           // From UnipileApiUserProfile.location
  contact_info: json,         // Rich structured data including:
    // {
    //   emails: string[],        // From contact_info.emails
    //   phones: string[],        // From contact_info.phones
    //   addresses: string[],     // From contact_info.adresses (API typo)
    //   websites: string[],      // From websites array
    //   socials: object[],       // From contact_info.socials
    //   summary: string,         // From profile summary
    // }
  is_connection: boolean,     // Whether network_distance !== "OUT_OF_NETWORK"
  pending_invitation: boolean, // From attendee data if available
}
```

## Configuration

### Environment Variables
Required for profile enrichment:
- `UNIPILE_API_KEY`: API key for Unipile service
- `UNIPILE_DSN`: Unipile service endpoint

### Fallback Behavior
If environment variables are missing:
- Functions fall back to basic contact creation
- No errors thrown, degraded functionality
- Logs indicate when fallback is used

## Performance Considerations

### API Call Optimization
- Profile fetching adds 1 API call per unique contact
- Consider implementing profile caching for repeat contacts
- Monitor Unipile API usage and rate limits

### Development Mode Optimization
- When `NODE_ENV === "development"`, sync limits are reduced for faster testing:
  - **Chat limit**: 3 chats (instead of 1000)
  - **Messages per chat**: 5 messages (instead of 100)
  - **Message batch size**: 5 messages (instead of 50)
- This makes development and testing much faster while maintaining full functionality
- Production deployments use full limits for comprehensive data sync

### Async Processing
- Profile fetching is done asynchronously within sync steps
- Failures don't block message or chat sync
- Each profile fetch is independent

## Monitoring and Debugging

### Logging
- Profile fetch attempts with identifiers
- Success/failure indicators with details
- Fallback usage notifications
- API error details for troubleshooting

### Key Log Messages
- `🔍 Fetching complete profile for: {identifier, accountId}`
- `✅ Profile data fetched successfully: {stats}`
- `⚠️ Failed to fetch profile data, using fallback: {error}`

## Future Enhancements

### Potential Improvements
1. **Profile Caching**: Redis cache for frequently accessed profiles
2. **Batch Profile Fetching**: Request multiple profiles in single API call
3. **Smart Refresh**: Update stale profile data periodically
4. **Profile Analytics**: Track profile data completeness and fetch success rates

### LinkedIn-Specific Features
- Company profile enrichment for contacts
- Education and experience history
- Mutual connections and recommendations
- Profile activity and post engagement data 