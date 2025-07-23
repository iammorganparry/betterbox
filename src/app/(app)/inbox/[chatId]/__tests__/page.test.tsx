import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ChatPage from '../page'
import { api } from '~/trpc/react'
import { toast } from 'sonner'
import {
    resetApiMocks,
    mockGetChatDetails,
    mockGetChatMessages,
    mockMarkChatAsRead,
    mockDeleteMessage,
    mockSendMessage,
    mockChatDetails,
    mockChatDetailsRead,
    mockMessages,
} from '~/test/mocks/api'
import { mockDropdownMenuModule, mockSonnerModule } from '~/test/mocks/ui'

// Setup shared mocks
mockDropdownMenuModule()
mockSonnerModule()

// Store mutation options for testing callbacks
let markChatAsReadOptions: any = null
let deleteMessageOptions: any = null

// Mock the API
vi.mocked(api.inbox.getChatDetails.useQuery).mockImplementation(mockGetChatDetails)
vi.mocked(api.inbox.getChatMessages.useQuery).mockImplementation(mockGetChatMessages)
vi.mocked(api.inbox.markChatAsRead.useMutation).mockImplementation((options) => {
    markChatAsReadOptions = options
    return {
        mutate: mockMarkChatAsRead,
        isPending: false,
        isError: false,
        error: null,
    } as any
})
vi.mocked(api.inbox.deleteMessage.useMutation).mockImplementation((options) => {
    deleteMessageOptions = options
    return {
        mutate: mockDeleteMessage,
        isPending: false,
        isError: false,
        error: null,
    } as any
})
vi.mocked(api.inbox.sendMessage.useMutation).mockImplementation(() => ({
    mutate: mockSendMessage,
    isPending: false,
    isError: false,
    error: null,
} as any))

describe('ChatPage', () => {
    beforeEach(() => {
        resetApiMocks()
        vi.clearAllMocks()
        markChatAsReadOptions = null
        deleteMessageOptions = null
    })

    it('should render chat details and messages', () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        // Act
        render(<ChatPage />)

        // Assert
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Software Engineer')).toBeInTheDocument()
        expect(screen.getByText('Hello, this is a test message')).toBeInTheDocument()
        expect(screen.getByText('This is another message')).toBeInTheDocument()
    })

    it('should show Mark as read button for unread chats', () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails, // has unread_count: 2
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        // Act
        render(<ChatPage />)

        // Assert
        expect(screen.getByText('Mark as read')).toBeInTheDocument()
    })

    it('should not show Mark as read button for read chats', () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetailsRead, // has unread_count: 0
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        // Act
        render(<ChatPage />)

        // Assert
        expect(screen.queryByText('Mark as read')).not.toBeInTheDocument()
    })

    it('should call markChatAsRead mutation when Mark as read button is clicked', async () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<ChatPage />)

        // Act
        const markAsReadButton = screen.getByText('Mark as read')
        fireEvent.click(markAsReadButton)

        // Assert
        expect(mockMarkChatAsRead).toHaveBeenCalledWith({ chatId: 'test-chat-id' })
    })

    it('should show loading state on Mark as read button during mutation', async () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<ChatPage />)

        // Act
        const markAsReadButton = screen.getByText('Mark as read')
        fireEvent.click(markAsReadButton)

        // Assert - button should be disabled and show loading text
        expect(markAsReadButton).toBeDisabled()
        expect(screen.getByText('Marking as read...')).toBeInTheDocument()
    })

    it('should show success toast and refetch chat details on successful mark as read', async () => {
        // Arrange
        const mockRefetch = vi.fn()
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: mockRefetch,
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<ChatPage />)

        // Act
        const markAsReadButton = screen.getByText('Mark as read')
        fireEvent.click(markAsReadButton)

        // Simulate successful mutation
        markChatAsReadOptions.onSuccess({ success: true })

        // Assert
        expect(toast.success).toHaveBeenCalledWith('Chat marked as read')
        expect(mockRefetch).toHaveBeenCalled()
    })

    it('should show error toast on failed mark as read', async () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<ChatPage />)

        // Act
        const markAsReadButton = screen.getByText('Mark as read')
        fireEvent.click(markAsReadButton)

        // Simulate failed mutation
        const error = { message: 'Failed to mark chat as read' }
        markChatAsReadOptions.onError(error)

        // Assert
        expect(toast.error).toHaveBeenCalledWith('Failed to mark chat as read')
    })

    it('should show loading state when chat details are loading', () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: undefined,
            isLoading: true,
            refetch: vi.fn(),
        })

        // Act
        render(<ChatPage />)

        // Assert
        expect(screen.getByText('Loading chat details...')).toBeInTheDocument()
    })

    it('should show loading state when messages are loading', () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: undefined,
            isLoading: true,
            refetch: vi.fn(),
        })

        // Act
        render(<ChatPage />)

        // Assert
        expect(screen.getByText('Loading messages...')).toBeInTheDocument()
    })

    it('should show empty state when no messages', () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: [],
            isLoading: false,
            refetch: vi.fn(),
        })

        // Act
        render(<ChatPage />)

        // Assert
        expect(screen.getByText('No messages in this conversation')).toBeInTheDocument()
    })

    it('should show message options dropdown for outgoing messages', async () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<ChatPage />)

        // Act - find the outgoing message and its options button
        const outgoingMessage = screen.getByText('Hello, this is a test message').closest('.group')
        const optionsButton = outgoingMessage?.querySelector('[data-testid="message-options-button"]')

        expect(optionsButton).toBeInTheDocument()
        if (optionsButton) {
            fireEvent.click(optionsButton)
        }

        // Assert - Check for dropdown content by testid first, then text
        await waitFor(() => {
            // The mocked dropdown should render the content immediately
            const dropdownContent = screen.queryByTestId('dropdown-menu-content')
            if (dropdownContent) {
                expect(dropdownContent).toBeInTheDocument()
            }
            // The delete message text should be in a dropdown menu item
            expect(screen.getByText('Delete message')).toBeInTheDocument()
        })
    })

    it('should not show message options for incoming messages', () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<ChatPage />)

        // Act - find the incoming message
        const incomingMessage = screen.getByText('This is another message').closest('.group')
        const optionsButton = incomingMessage?.querySelector('[data-testid="message-options-button"]')

        // Assert - options button should not exist for incoming messages
        expect(optionsButton).not.toBeInTheDocument()
    })

    it('should call deleteMessage mutation when delete is clicked', async () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        // Mock window.confirm to return true
        vi.stubGlobal('confirm', vi.fn(() => true))

        render(<ChatPage />)

        // Act
        const outgoingMessage = screen.getByText('Hello, this is a test message').closest('.group')
        const optionsButton = outgoingMessage?.querySelector('[data-testid="message-options-button"]')

        if (optionsButton) {
            fireEvent.click(optionsButton)
        }

        // Wait for dropdown content and then click delete
        const deleteButton = await screen.findByText('Delete message')
        fireEvent.click(deleteButton)

        // Assert
        expect(mockDeleteMessage).toHaveBeenCalledWith({ messageId: 'message-1' })
    })

    it('should not delete message when user cancels confirmation', async () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        // Mock window.confirm to return false
        vi.stubGlobal('confirm', vi.fn(() => false))

        render(<ChatPage />)

        // Act
        const outgoingMessage = screen.getByText('Hello, this is a test message').closest('.group')
        const optionsButton = outgoingMessage?.querySelector('[data-testid="message-options-button"]')

        if (optionsButton) {
            fireEvent.click(optionsButton)
        }

        // Wait for dropdown content and then click delete
        const deleteButton = await screen.findByText('Delete message')
        fireEvent.click(deleteButton)

        // Assert
        expect(mockDeleteMessage).not.toHaveBeenCalled()
    })

    it('should display contact avatar and initials correctly', () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        // Act
        render(<ChatPage />)

        // Assert - check for avatar fallback with initials
        expect(screen.getByText('JD')).toBeInTheDocument() // John Doe initials
    })

    it('should format message timestamps correctly', () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        // Act
        render(<ChatPage />)

        // Assert - check for formatted time
        const expectedTime = new Date('2024-01-01T10:00:00Z').toLocaleTimeString()
        expect(screen.getByText(expectedTime)).toBeInTheDocument()
    })

    it('should clear loading state after mutation settles', async () => {
        // Arrange
        mockGetChatDetails.mockReturnValue({
            data: mockChatDetails,
            isLoading: false,
            refetch: vi.fn(),
        })
        mockGetChatMessages.mockReturnValue({
            data: mockMessages,
            isLoading: false,
            refetch: vi.fn(),
        })

        render(<ChatPage />)

        // Act
        const markAsReadButton = screen.getByText('Mark as read')
        fireEvent.click(markAsReadButton)

        // Simulate mutation settling
        await act(async () => {
            markChatAsReadOptions.onSettled()
        })

        // Assert - loading state should be cleared
        await waitFor(() => {
            expect(screen.queryByText('Marking as read...')).not.toBeInTheDocument()
            expect(markAsReadButton).not.toBeDisabled()
        })
    })
}) 