import { vi } from 'vitest'

// Create a mock mutation result that matches TRPC's structure
export const createMockMutation = (overrides: Partial<any> = {}) => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  data: undefined,
  status: 'idle' as const,
  variables: undefined,
  failureCount: 0,
  failureReason: null,
  isIdle: true,
  isLoading: false,
  isPaused: false,
  reset: vi.fn(),
  trpc: {
    path: 'test.mutation',
    meta: {},
  },
  ...overrides,
})

// Create a mock query result that matches TRPC's structure
export const createMockQuery = (overrides: Partial<any> = {}) => ({
  data: undefined,
  isLoading: false,
  isError: false,
  isSuccess: true,
  error: null,
  status: 'success' as const,
  refetch: vi.fn(),
  isFetching: false,
  isRefetching: false,
  fetchStatus: 'idle' as const,
  dataUpdatedAt: Date.now(),
  errorUpdatedAt: 0,
  failureCount: 0,
  failureReason: null,
  isInitialLoading: false,
  isLoadingError: false,
  isPlaceholderData: false,
  isPreviousData: false,
  isRefetchError: false,
  isStale: false,
  trpc: {
    path: 'test.query',
    meta: {},
  },
  ...overrides,
})

// Helper to create mutation with callback capture
export const createMutationWithCallbacks = () => {
  let capturedOptions: any = null
  
  const mockMutation = createMockMutation()
  
  const useMutation = vi.fn((options) => {
    capturedOptions = options
    return mockMutation
  })
  
  const triggerCallback = (type: 'onSuccess' | 'onError' | 'onSettled', data?: any) => {
    if (capturedOptions?.[type]) {
      capturedOptions[type](data)
    }
  }
  
  return {
    useMutation,
    mockMutation,
    triggerCallback,
    getCapturedOptions: () => capturedOptions,
  }
}

// Common TRPC API mock structure
export const createMockTrpcApi = () => ({
  inbox: {
    getChats: {
      useQuery: vi.fn(() => createMockQuery()),
    },
    getChatMessages: {
      useQuery: vi.fn(() => createMockQuery()),
    },
    getChatDetails: {
      useQuery: vi.fn(() => createMockQuery()),
    },
    sendMessage: {
      useMutation: vi.fn(() => createMockMutation()),
    },
    markChatAsRead: {
      useMutation: vi.fn(() => createMockMutation()),
    },
    deleteMessage: {
      useMutation: vi.fn(() => createMockMutation()),
    },
  },
})

// Mock the entire TRPC module
export const mockTrpcModule = () => {
  const mockApi = createMockTrpcApi()
  
  vi.mock('~/trpc/react', () => ({
    api: mockApi,
  }))
  
  return mockApi
} 