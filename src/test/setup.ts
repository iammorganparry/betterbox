import '@testing-library/jest-dom'

// Mock Next.js router
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({
    chatId: 'test-chat-id',
  }),
  usePathname: () => '/test-path',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock tRPC
vi.mock('~/trpc/react', () => ({
  api: {
    inbox: {
      getChats: {
        useQuery: vi.fn(),
      },
      getChatDetails: {
        useQuery: vi.fn(),
      },
      getChatMessages: {
        useQuery: vi.fn(),
      },
      deleteMessage: {
        useMutation: vi.fn(),
      },
      markChatAsRead: {
        useMutation: vi.fn(),
      },
    },
  },
}))

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock environment variables
vi.mock('~/env', () => ({
  env: {
    UNIPILE_API_KEY: 'test-api-key',
    UNIPILE_DSN: 'test-dsn',
  },
})) 