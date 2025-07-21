# HTTP Client Usage

Our application uses a centralized HTTP client configuration to ensure consistent request handling, error management, and authentication across all external API calls.

## Overview

All HTTP requests should use our centralized HTTP client from `~/lib/http.ts` instead of direct `axios` or `fetch` calls. This provides:

- **Consistent Configuration**: Timeout, headers, and error handling
- **Authentication**: Automatic Bearer token management for Unipile API
- **Logging**: Request/response logging in development
- **Error Handling**: Standardized error formatting and debugging
- **Type Safety**: Full TypeScript support with generic types

## HTTP Client Functions

### General HTTP Client

For general-purpose HTTP requests:

```typescript
import { http, httpClient, makeRequest } from "~/lib/http";

// Simple GET request
const data = await http.get<ResponseType>("/api/endpoint");

// POST with data
const result = await http.post<ResponseType, RequestType>("/api/endpoint", requestData);

// PUT, PATCH, DELETE
await http.put<ResponseType>("/api/endpoint", updateData);
await http.patch<ResponseType>("/api/endpoint", patchData);
await http.delete<ResponseType>("/api/endpoint");

// Custom request configuration
const response = await makeRequest<ResponseType>({
  method: "GET",
  url: "/api/endpoint",
  headers: { "Custom-Header": "value" },
  timeout: 10000,
});
```

### Unipile API Client

For Unipile API requests, use the specialized client:

```typescript
import { createUnipileClient } from "~/lib/http";

// Create authenticated Unipile client
const unipileClient = createUnipileClient(apiKey, dsn);

// Make requests to Unipile API
const chats = await unipileClient.get<UnipileApiResponse<UnipileApiChat>>("/chats", {
  params: { account_id: "123", limit: "10" }
});

const messages = await unipileClient.get<UnipileApiResponse<UnipileApiMessage>>(
  `/chats/${chatId}/messages`
);
```

## Current Usage

### ✅ **Properly Configured**

#### Inngest Functions (`src/services/inngest/unipile-sync.ts`)
```typescript
import { createUnipileClient } from "~/lib/http";

// Create client with API credentials
const unipileClient = createUnipileClient(api_key, dsn);

// Fetch chats with proper authentication and base URL
const response = await unipileClient.get<UnipileApiResponse<UnipileApiChat>>(
  `/chats?${params.toString()}`
);

// Fetch messages for specific chat
const messagesResponse = await unipileClient.get<UnipileApiResponse<UnipileApiMessage>>(
  `/chats/${chat.id}/messages`
);
```

#### General HTTP Requests
- Use `http.get()`, `http.post()`, etc. for external APIs
- Use `makeRequest()` for custom configurations
- Use `httpClient` directly for advanced scenarios

### ❌ **Avoid These Patterns**

#### Direct Axios/Fetch Calls
```typescript
// ❌ Don't do this
import axios from "axios";

const response = await axios.get("https://api.example.com/data", {
  headers: { Authorization: `Bearer ${token}` }
});

// ❌ Don't do this
const response = await fetch("https://api.example.com/data", {
  headers: { Authorization: `Bearer ${token}` }
});
```

#### Manual URL Construction for Unipile
```typescript
// ❌ Don't do this
const url = `https://${dsn}/api/v1/chats`;
const response = await axios.get(url, {
  headers: { Authorization: `Bearer ${apiKey}` }
});
```

## Configuration

### Default Settings (`src/lib/http.ts`)

```typescript
const defaultConfig: AxiosRequestConfig = {
  timeout: 30000, // 30 seconds
  headers: {
    "Content-Type": "application/json",
  },
};
```

### Unipile Client Configuration

```typescript
export function createUnipileClient(apiKey: string, dsn: string): AxiosInstance {
  return axios.create({
    ...defaultConfig,
    baseURL: `https://${dsn}/api/v1`,
    headers: {
      ...defaultConfig.headers,
      Authorization: `Bearer ${apiKey}`,
    },
  });
}
```

## Logging & Debugging

In development mode, the HTTP client automatically logs:

- **Request Logs**: `🚀 GET /api/endpoint`
- **Success Logs**: `✅ 200 /api/endpoint`
- **Error Logs**: `❌ 404 /api/endpoint: Not Found`

Set `NODE_ENV=development` to enable logging.

## Error Handling

The centralized client provides enhanced error information:

```typescript
try {
  const data = await http.get<DataType>("/api/endpoint");
  return data;
} catch (error) {
  // Error includes HTTP status and enhanced message
  console.error(error.message); // "HTTP 404: Not Found"
}
```

## Migration Guide

### Before (Direct Axios)
```typescript
import axios from "axios";

const response = await axios.get(`https://${dsn}/api/v1/chats`, {
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  params: { account_id, limit },
});
```

### After (Centralized Client)
```typescript
import { createUnipileClient } from "~/lib/http";

const unipileClient = createUnipileClient(apiKey, dsn);
const response = await unipileClient.get("/chats", {
  params: { account_id, limit },
});
```

## Benefits

1. **Consistency**: All HTTP requests follow the same patterns
2. **Authentication**: Automatic credential management
3. **Debugging**: Built-in request/response logging
4. **Error Handling**: Standardized error formatting
5. **Type Safety**: Full TypeScript support
6. **Maintenance**: Centralized configuration updates
7. **Testing**: Easy to mock for testing scenarios

## Testing

For testing, you can override the HTTP client:

```typescript
import { httpClient } from "~/lib/http";

// Mock the client for testing
jest.mock("~/lib/http", () => ({
  httpClient: mockAxiosInstance,
  createUnipileClient: jest.fn(() => mockUnipileClient),
}));
```

Always use our centralized HTTP client to ensure consistent behavior and easier maintenance across the application! 