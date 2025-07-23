import { vi } from 'vitest'
import React from 'react'

// Mock toast notifications
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}

export const mockSonnerModule = () => {
  vi.mock('sonner', () => ({
    toast: mockToast,
  }))
  
  return mockToast
}

// Mock sidebar components
export const mockSidebarModule = () => {
  vi.mock('~/components/ui/sidebar', async () => {
    const actual = await vi.importActual('~/components/ui/sidebar')

    return {
      ...actual,
      useSidebar: () => ({
        state: 'expanded' as const,
        open: true,
        setOpen: vi.fn(),
        openMobile: false,
        setOpenMobile: vi.fn(),
        isMobile: false,
        toggleSidebar: vi.fn(),
      }),
    }
  })
}

// Mock mobile hook
export const mockMobileHook = (isMobile = false) => {
  vi.mock('~/hooks/use-mobile', () => ({
    useIsMobile: () => isMobile,
  }))
}

// Mock router hooks
export const mockNextRouter = (overrides: Partial<any> = {}) => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    ...overrides,
  }

  vi.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
    useParams: () => overrides.params || {},
    usePathname: () => mockRouter.pathname,
    useSearchParams: () => new URLSearchParams(),
  }))

  return mockRouter
} 