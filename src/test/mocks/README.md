# Test Mocks - Drizzle Database Migration Guide

This directory contains mock utilities for testing with Drizzle ORM. This guide explains how to migrate from Prisma-based tests to Drizzle-based tests.

## Migration Overview

We've migrated from PrismaClient mocks to comprehensive Drizzle ORM mocks. The new mock system provides:

- **Global shareable Drizzle mock**: Consistent mock setup across all tests
- **Comprehensive query builder mocks**: Support for select, insert, update, delete operations
- **Relational query API mocks**: Support for complex queries with relations
- **Raw SQL execution mocks**: Support for custom SQL queries
- **Service-specific mocks**: Pre-configured mocks for all database services

## Files

### Core Mock Files

- `drizzle.ts` - Main Drizzle mock utilities and builders
- `services.ts` - Service-level mocks (includes both Prisma legacy and new Drizzle mocks)
- `api.ts` - API mocks for external services
- `trpc.ts` - TRPC context mocks
- `ui.ts` - UI component mocks

## Using the Drizzle Mocks

### Basic Setup

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { YourService } from "../your-service";
import { 
  createMockDrizzleDb, 
  createMockSelectQueryBuilder,
  createMockInsertQueryBuilder,
  createMockUpdateQueryBuilder,
  mockDrizzleData,
  type MockDrizzleDb 
} from "../../../test/mocks/drizzle";

// Create mock Drizzle DB
let mockDb: MockDrizzleDb;

describe('YourService - Drizzle Tests', () => {
  let service: YourService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDrizzleDb();
    service = new YourService(mockDb);
  });

  // Your tests here...
});
```

### Mocking SELECT Operations

```typescript
it('should find records successfully', async () => {
  // Arrange
  const expectedData = [
    { id: 'record-1', name: 'Test Record' },
    { id: 'record-2', name: 'Another Record' },
  ];

  // Mock Drizzle select
  const selectBuilder = createMockSelectQueryBuilder();
  selectBuilder.limit = vi.fn(() => {
    selectBuilder.then = vi.fn((resolve) => resolve(expectedData));
    return selectBuilder;
  });
  mockDb.select = vi.fn(() => selectBuilder);

  // Act
  const result = await service.findRecords();

  // Assert
  expect(mockDb.select).toHaveBeenCalled();
  expect(selectBuilder.from).toHaveBeenCalled();
  expect(selectBuilder.where).toHaveBeenCalled();
  expect(selectBuilder.limit).toHaveBeenCalled();
  expect(result).toEqual(expectedData);
});
```

### Mocking INSERT Operations

```typescript
it('should create record successfully', async () => {
  // Arrange
  const newRecord = { name: 'New Record' };
  const expectedResult = { id: 'record-123', ...newRecord };

  // Mock Drizzle insert
  const insertBuilder = createMockInsertQueryBuilder();
  insertBuilder.returning = vi.fn(() => {
    insertBuilder.then = vi.fn((resolve) => resolve([expectedResult]));
    return insertBuilder;
  });
  mockDb.insert = vi.fn(() => insertBuilder);

  // Act
  const result = await service.createRecord(newRecord);

  // Assert
  expect(mockDb.insert).toHaveBeenCalled();
  expect(insertBuilder.values).toHaveBeenCalledWith(expect.objectContaining(newRecord));
  expect(insertBuilder.returning).toHaveBeenCalled();
  expect(result).toEqual(expectedResult);
});
```

### Mocking UPDATE Operations

```typescript
it('should update record successfully', async () => {
  // Arrange
  const recordId = 'record-123';
  const updateData = { name: 'Updated Name' };
  const expectedResult = { id: recordId, ...updateData };

  // Mock Drizzle update
  const updateBuilder = createMockUpdateQueryBuilder();
  updateBuilder.returning = vi.fn(() => {
    updateBuilder.then = vi.fn((resolve) => resolve([expectedResult]));
    return updateBuilder;
  });
  mockDb.update = vi.fn(() => updateBuilder);

  // Act
  const result = await service.updateRecord(recordId, updateData);

  // Assert
  expect(mockDb.update).toHaveBeenCalled();
  expect(updateBuilder.set).toHaveBeenCalledWith(expect.objectContaining(updateData));
  expect(updateBuilder.where).toHaveBeenCalled();
  expect(updateBuilder.returning).toHaveBeenCalled();
  expect(result).toEqual(expectedResult);
});
```

### Mocking RAW SQL Queries

```typescript
it('should execute raw SQL successfully', async () => {
  // Arrange
  const expectedStats = {
    total_count: 100,
    active_count: 75,
  };

  // Mock raw SQL execution
  mockDb.execute = vi.fn().mockResolvedValue([expectedStats]);

  // Act
  const result = await service.getStatistics();

  // Assert
  expect(mockDb.execute).toHaveBeenCalled();
  expect(result).toEqual(expectedStats);
});
```

### Mocking Complex Queries with Joins

```typescript
it('should perform join query successfully', async () => {
  // Arrange
  const expectedData = [
    { 
      record: { id: 'record-1', name: 'Test' },
      related: { id: 'related-1', value: 'Value' }
    }
  ];

  // Mock Drizzle select with join
  const selectBuilder = createMockSelectQueryBuilder();
  selectBuilder.offset = vi.fn(() => {
    selectBuilder.then = vi.fn((resolve) => resolve(expectedData));
    return selectBuilder;
  });
  mockDb.select = vi.fn(() => selectBuilder);

  // Act
  const result = await service.findWithRelated();

  // Assert
  expect(mockDb.select).toHaveBeenCalled();
  expect(selectBuilder.from).toHaveBeenCalled();
  expect(selectBuilder.innerJoin).toHaveBeenCalled(); // or leftJoin, etc.
  expect(selectBuilder.where).toHaveBeenCalled();
  expect(result).toEqual(expectedData);
});
```

### Using Pre-built Mock Data

The `mockDrizzleData` object contains pre-built test data for common entities:

```typescript
import { mockDrizzleData } from "../../../test/mocks/drizzle";

it('should work with mock data', async () => {
  const expectedChat = {
    ...mockDrizzleData.chat,
    name: 'Custom Chat Name',
  };

  // Use in your test setup...
});
```

Available mock data:
- `mockDrizzleData.user`
- `mockDrizzleData.chat`
- `mockDrizzleData.folder`
- `mockDrizzleData.contact`
- `mockDrizzleData.message`
- `mockDrizzleData.account`
- `mockDrizzleData.subscription`

### Helper Functions

#### createMockDbWithData

Quickly create a mock with predefined data:

```typescript
it('should use helper function', async () => {
  const testData = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
  ];

  const mockDb = createMockDbWithData(testData);
  const service = new YourService(mockDb);

  const result = await service.getAllItems();
  expect(result).toEqual(testData);
});
```

#### createMockDbWithSuccessfulWrites

Mock successful insert/update operations:

```typescript
it('should handle successful writes', async () => {
  const newItem = { id: '1', name: 'New Item' };
  const mockDb = createMockDbWithSuccessfulWrites(newItem);
  const service = new YourService(mockDb);

  const result = await service.createItem({ name: 'New Item' });
  expect(result).toEqual(newItem);
});
```

## Error Handling in Tests

```typescript
it('should handle database errors gracefully', async () => {
  // Arrange
  const dbError = new Error('Database connection failed');
  
  const selectBuilder = createMockSelectQueryBuilder();
  selectBuilder.then = vi.fn((resolve, reject) => reject(dbError));
  mockDb.select = vi.fn(() => selectBuilder);

  // Act & Assert
  await expect(service.findRecords()).rejects.toThrow('Database connection failed');
});
```

## Service-Level Mocks

For integration tests, you can use pre-built service mocks:

```typescript
import { createMockDrizzleServices } from "../../../test/mocks/services";

describe('Integration Tests', () => {
  it('should work with service mocks', async () => {
    const mockServices = createMockDrizzleServices();
    const chatService = new mockServices.UnipileChatService();
    
    chatService.findChatByExternalId.mockResolvedValue(mockDrizzleData.chat);
    
    const result = await chatService.findChatByExternalId('account-1', 'chat-1');
    expect(result).toEqual(mockDrizzleData.chat);
  });
});
```

## Migration Checklist

When migrating a test from Prisma to Drizzle:

1. **Update imports**: Replace Prisma imports with Drizzle mock imports
2. **Update mock setup**: Use `createMockDrizzleDb()` instead of manual Prisma mock
3. **Update query mocks**: Replace Prisma method mocks with Drizzle query builder mocks
4. **Update assertions**: Check for Drizzle method calls instead of Prisma methods
5. **Handle query builders**: Ensure proper chaining and promise resolution
6. **Update error handling**: Use proper error throwing patterns
7. **Run tests**: Verify all tests pass with new mocks

## Example Migration

### Before (Prisma)

```typescript
const mockPrismaClient = {
  chatFolder: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
} as unknown as PrismaClient;

it('should create folder', async () => {
  const expectedFolder = { id: 'folder-1', name: 'Test' };
  mockPrismaClient.chatFolder.create = vi.fn().mockResolvedValue(expectedFolder);
  
  const result = await service.createFolder('user-1', { name: 'Test' });
  
  expect(mockPrismaClient.chatFolder.create).toHaveBeenCalledWith({
    data: { user_id: 'user-1', name: 'Test' }
  });
  expect(result).toEqual(expectedFolder);
});
```

### After (Drizzle)

```typescript
let mockDb: MockDrizzleDb;

beforeEach(() => {
  mockDb = createMockDrizzleDb();
  service = new ChatFolderService(mockDb);
});

it('should create folder', async () => {
  const expectedFolder = { id: 'folder-1', name: 'Test' };
  
  const insertBuilder = createMockInsertQueryBuilder();
  insertBuilder.returning = vi.fn(() => {
    insertBuilder.then = vi.fn((resolve) => resolve([expectedFolder]));
    return insertBuilder;
  });
  mockDb.insert = vi.fn(() => insertBuilder);
  
  const result = await service.createFolder('user-1', { name: 'Test' });
  
  expect(mockDb.insert).toHaveBeenCalled();
  expect(insertBuilder.values).toHaveBeenCalledWith({
    user_id: 'user-1',
    name: 'Test'
  });
  expect(result).toEqual(expectedFolder);
});
```

## Best Practices

1. **Use type-safe mocks**: Always use the provided TypeScript types
2. **Mock at the right level**: Mock query builders for unit tests, services for integration tests
3. **Keep tests focused**: Each test should verify one specific behavior
4. **Use realistic data**: Base test data on actual database schema
5. **Test error conditions**: Always include error handling tests
6. **Clean up**: Use `beforeEach` to reset mocks between tests
7. **Be explicit**: Clearly mock the expected call chain for query builders

## Common Patterns

### Pagination Tests

```typescript
it('should handle pagination', async () => {
  const selectBuilder = createMockSelectQueryBuilder();
  selectBuilder.offset = vi.fn(() => {
    selectBuilder.then = vi.fn((resolve) => resolve([]));
    return selectBuilder;
  });
  mockDb.select = vi.fn(() => selectBuilder);

  await service.getPaginatedResults(10, 20);

  expect(selectBuilder.limit).toHaveBeenCalledWith(10);
  expect(selectBuilder.offset).toHaveBeenCalledWith(20);
});
```

### Upsert Operations

```typescript
it('should handle upsert', async () => {
  const insertBuilder = createMockInsertQueryBuilder();
  insertBuilder.returning = vi.fn(() => {
    insertBuilder.then = vi.fn((resolve) => resolve([expectedResult]));
    return insertBuilder;
  });
  mockDb.insert = vi.fn(() => insertBuilder);

  await service.upsertRecord(data);

  expect(insertBuilder.onConflictDoUpdate).toHaveBeenCalled();
});
```

### Soft Delete Tests

```typescript
it('should soft delete record', async () => {
  const updateBuilder = createMockUpdateQueryBuilder();
  updateBuilder.returning = vi.fn(() => {
    updateBuilder.then = vi.fn((resolve) => resolve([deletedRecord]));
    return updateBuilder;
  });
  mockDb.update = vi.fn(() => updateBuilder);

  await service.deleteRecord(recordId);

  expect(updateBuilder.set).toHaveBeenCalledWith({
    is_deleted: true,
    updated_at: expect.any(Date),
  });
});
```

This migration ensures all tests are compatible with the new Drizzle ORM while maintaining comprehensive test coverage and proper mocking patterns.