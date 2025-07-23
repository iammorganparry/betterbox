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
      deleteMessage: {
        useMutation: vi.fn(),
      },
      getChatMessages: {
        useQuery: vi.fn(),
      },
      getChatDetails: {
        useQuery: vi.fn(),
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