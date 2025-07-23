import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { InboxSidebar } from '../inbox-sidebar'
import { api } from '~/trpc/react'
import { toast } from 'sonner'
import {
    resetApiMocks,
    mockGetChats,
    mockMarkChatAsRead,
    mockChatsData,
    triggerMutationCallback,
    defaultMockImplementations
} from '~/test/mocks/api'
import { SidebarProvider } from '~/components/ui/sidebar'

// Mock the mobile hook
vi.mock('~/hooks/use-mobile', () => ({
    useIsMobile: () => false,
}))

// Mock toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

// Mock the dropdown menu components
vi.mock('~/components/ui/dropdown-menu', () => {
    const React = require('react')

    return {
        DropdownMenu: ({ children }: { children: React.ReactNode }) => (
            <div data-testid="dropdown-menu">{children}</div>
        ),
        DropdownMenuTrigger: React.forwardRef(({ children, asChild, ...props }: any, ref: any) => {
            if (asChild && React.isValidElement(children)) {
                return React.cloneElement(children, { ref, ...props })
            }
            return <button ref={ref} {...props}>{children}</button>
        }),
        DropdownMenuContent: ({ children, align, ...props }: any) => (
            <div data-testid="dropdown-menu-content" data-align={align} {...props}>
                {children}
            </div>
        ),
        DropdownMenuItem: ({ children, onClick, disabled, ...props }: any) => (
            <div
                data-testid="dropdown-menu-item"
                onClick={disabled ? undefined : onClick}
                data-disabled={disabled}
                role="menuitem"
                {...props}
            >
                {children}
            </div>
        ),
    }
})

// Mock only the useSidebar hook to provide the context
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

// Test wrapper component with SidebarProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
    return (
        <SidebarProvider>
            {children}
        </SidebarProvider>
    )
}

// Store mutation options for testing callbacks
let mutationOptions: any = null

// Mock the API
vi.mocked(api.inbox.getChats.useQuery).mockImplementation(mockGetChats)
vi.mocked(api.inbox.markChatAsRead.useMutation).mockImplementation((options) => {
    mutationOptions = options
    return {
        mutate: mockMarkChatAsRead,
        isLoading: false,
        isError: false,
        error: null,
    } as any
})

describe('InboxSidebar', () => {
    beforeEach(() => {
        resetApiMocks()
        vi.clearAllMocks()
        mutationOptions = null
    })

    it('should render chat list with unread indicators', () => {
        // Arrange
        mockGetChats.mockReturnValue({
            data: mockChatsData,
            isLoading: false,
            refetch: vi.fn(),
        })

        // Act
        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Assert
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Jane Smith')).toBeInTheDocument()

        // Check for unread indicator on first chat (has unread_count: 2)
        const unreadIndicators = screen.getAllByRole('generic').filter(el =>
            el.className.includes('bg-blue-500')
        )
        expect(unreadIndicators).toHaveLength(1)
    })

    it('should show loading state', () => {
        // Arrange
        mockGetChats.mockReturnValue({
            data: undefined,
            isLoading: true,
            refetch: vi.fn(),
        })

        // Act
        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Assert
        expect(screen.getByText('Loading conversations...')).toBeInTheDocument()
    })

    it('should show empty state when no chats', () => {
        // Arrange
        mockGetChats.mockReturnValue({
            data: [],
            isLoading: false,
            refetch: vi.fn(),
        })

        // Act
        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Assert
        expect(screen.getByText('No conversations found')).toBeInTheDocument()
    })

    it('should filter to show only unread chats when toggle is enabled', () => {
        // Arrange
        mockGetChats.mockReturnValue({
            data: mockChatsData,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Act
        const unreadsToggle = screen.getByRole('switch')
        fireEvent.click(unreadsToggle)

        // Assert - should only show John Doe (unread_count: 2), not Jane Smith (unread_count: 0)
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument()
    })

    it('should show context menu on hover', async () => {
        // Arrange
        mockGetChats.mockReturnValue({
            data: mockChatsData,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Act - find the first dropdown trigger button (there are multiple)
        const chatItem = screen.getByText('John Doe').closest('.group')
        expect(chatItem).toBeInTheDocument()

        // Get all dropdown trigger buttons and select the first one
        const dropdownTriggers = screen.getAllByRole('button', {
            name: '', // The button doesn't have text, it has an icon
        })

        // Click the first dropdown trigger (for John Doe's chat)
        fireEvent.click(dropdownTriggers[0]!)

        // Assert - context menu should appear for unread chat
        await waitFor(() => {
            expect(screen.getByText('Mark as read')).toBeInTheDocument()
        })
    })

    it('should not show mark as read option for already read chats', async () => {
        // Arrange
        const readChatsData = mockChatsData.map(chat => ({ ...chat, unread_count: 0 }))
        mockGetChats.mockReturnValue({
            data: readChatsData,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Act - try to open context menu on first chat (now read)
        const dropdownTriggers = screen.getAllByRole('button', { name: '' })
        fireEvent.click(dropdownTriggers[0]!)

        // Assert - mark as read option should not be present since all chats are read
        await waitFor(() => {
            // The dropdown should be present but no "Mark as read" option
            const dropdownContents = screen.getAllByTestId('dropdown-menu-content')
            expect(dropdownContents[0]).toBeInTheDocument()
            expect(screen.queryByText('Mark as read')).not.toBeInTheDocument()
        })
    })

    it('should call markChatAsRead mutation when mark as read is clicked', async () => {
        // Arrange
        const mockRefetch = vi.fn()
        mockGetChats.mockReturnValue({
            data: mockChatsData,
            isLoading: false,
            refetch: mockRefetch,
        })

        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Act - open context menu and click mark as read
        const dropdownTriggers = screen.getAllByRole('button', { name: '' })
        fireEvent.click(dropdownTriggers[0]!)

        await waitFor(() => {
            const markAsReadButton = screen.getByText('Mark as read')
            fireEvent.click(markAsReadButton)
        })

        // Assert
        expect(mockMarkChatAsRead).toHaveBeenCalledWith({ chatId: 'chat-1' })
    })

    it('should show success toast and refetch data on successful mark as read', async () => {
        // Arrange
        const mockRefetch = vi.fn()
        mockGetChats.mockReturnValue({
            data: mockChatsData,
            isLoading: false,
            refetch: mockRefetch,
        })

        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Act - trigger mark as read and simulate success
        const dropdownTriggers = screen.getAllByRole('button', { name: '' })
        fireEvent.click(dropdownTriggers[0]!)

        await waitFor(() => {
            const markAsReadButton = screen.getByText('Mark as read')
            fireEvent.click(markAsReadButton)
        })

        // Simulate successful mutation by calling the onSuccess callback
        expect(mutationOptions).toBeTruthy()
        if (mutationOptions?.onSuccess) {
            mutationOptions.onSuccess({ success: true })
        }

        // Assert
        expect(toast.success).toHaveBeenCalledWith('Chat marked as read')
        expect(mockRefetch).toHaveBeenCalled()
    })

    it('should show error toast on failed mark as read', async () => {
        // Arrange
        mockGetChats.mockReturnValue({
            data: mockChatsData,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Act - trigger mark as read and simulate error
        const dropdownTriggers = screen.getAllByRole('button', { name: '' })
        fireEvent.click(dropdownTriggers[0]!)

        await waitFor(() => {
            const markAsReadButton = screen.getByText('Mark as read')
            fireEvent.click(markAsReadButton)
        })

        // Simulate failed mutation by calling the onError callback
        expect(mutationOptions).toBeTruthy()
        if (mutationOptions?.onError) {
            const error = { message: 'Failed to mark chat as read' }
            mutationOptions.onError(error)
        }

        // Assert
        expect(toast.error).toHaveBeenCalledWith('Failed to mark chat as read')
    })

    it('should show loading state on mark as read button during mutation', async () => {
        // Arrange
        mockGetChats.mockReturnValue({
            data: mockChatsData,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Act - trigger mark as read
        const dropdownTriggers = screen.getAllByRole('button', { name: '' })
        fireEvent.click(dropdownTriggers[0]!)

        await waitFor(() => {
            const markAsReadButton = screen.getByText('Mark as read')
            fireEvent.click(markAsReadButton)
        })

        // Assert - button should show loading state
        await waitFor(() => {
            expect(screen.getByText('Marking as read...')).toBeInTheDocument()
        })

        // Simulate mutation completion by calling onSettled
        expect(mutationOptions).toBeTruthy()
        if (mutationOptions?.onSettled) {
            mutationOptions.onSettled()
        }

        // Assert - loading state should be cleared
        await waitFor(() => {
            expect(screen.queryByText('Marking as read...')).not.toBeInTheDocument()
        })
    })

    it('should group chats by provider', () => {
        // Arrange
        const mixedProviderChats = [
            { ...mockChatsData[0], provider: 'linkedin' },
            { ...mockChatsData[1], provider: 'whatsapp' },
        ]

        mockGetChats.mockReturnValue({
            data: mixedProviderChats,
            isLoading: false,
            refetch: vi.fn(),
        })

        // Act
        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Assert
        expect(screen.getByText('LINKEDIN')).toBeInTheDocument()
        expect(screen.getByText('WHATSAPP')).toBeInTheDocument()
    })

    it('should prioritize LinkedIn provider in grouping', () => {
        // Arrange
        const mixedProviderChats = [
            { ...mockChatsData[0], provider: 'whatsapp' },
            { ...mockChatsData[1], provider: 'linkedin' },
        ]

        mockGetChats.mockReturnValue({
            data: mixedProviderChats,
            isLoading: false,
            refetch: vi.fn(),
        })

        // Act
        render(<InboxSidebar />, { wrapper: TestWrapper })

        // Assert - LinkedIn should appear first
        const providerHeaders = screen.getAllByText(/LINKEDIN|WHATSAPP/)
        expect(providerHeaders[0]).toHaveTextContent('LINKEDIN')
    })
}) 