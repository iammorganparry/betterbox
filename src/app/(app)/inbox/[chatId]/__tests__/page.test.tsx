import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatPage from '../page'
import { toast } from 'sonner'

// Mock data
const mockChatDetails = {
    UnipileChatAttendee: [{
        id: 'attendee-1',
        is_self: 0,
        contact: {
            id: 'contact-1',
            full_name: 'John Doe',
            headline: 'Software Engineer',
            profile_image_url: 'https://example.com/avatar.jpg',
        },
    }],
}

const mockMessages = [
    {
        id: 'message-1',
        content: 'Hello, this is a test message',
        is_outgoing: true,
        is_read: true,
        sent_at: new Date('2024-01-01T10:00:00Z'),
        sender_id: 'user-1',
    },
    {
        id: 'message-2',
        content: 'This is another message',
        is_outgoing: false,
        is_read: true,
        sent_at: new Date('2024-01-01T10:05:00Z'),
        sender_id: 'user-2',
    },
]

// Use vi.hoisted to create mock functions that can be referenced in vi.mock
const { mockDeleteMessage, mockRefetchMessages, mockGetChatDetails, mockGetChatMessages, mockMutationObject } = vi.hoisted(() => ({
    mockDeleteMessage: vi.fn(),
    mockRefetchMessages: vi.fn(),
    mockGetChatDetails: vi.fn(),
    mockGetChatMessages: vi.fn(),
    mockMutationObject: {
        mutate: vi.fn(),
        isLoading: false,
        isError: false,
        error: null,
        _callbacks: null as any,
    },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

// Mock tRPC
vi.mock('~/trpc/react', () => ({
    api: {
        inbox: {
            getChatDetails: {
                useQuery: mockGetChatDetails,
            },
            getChatMessages: {
                useQuery: mockGetChatMessages,
            },
            deleteMessage: {
                useMutation: vi.fn((callbacks) => {
                    // Store the callbacks so we can trigger them in tests
                    mockMutationObject._callbacks = callbacks
                    return mockMutationObject
                }),
            },
        },
    },
}))

// Reset function to clear all mocks
const resetApiMocks = () => {
    mockDeleteMessage.mockReset()
    mockRefetchMessages.mockReset()
    mockGetChatDetails.mockReset()
    mockGetChatMessages.mockReset()
    mockMutationObject.mutate.mockReset()

    // Reset to default implementations
    mockGetChatDetails.mockReturnValue({
        data: mockChatDetails,
        isLoading: false,
    })

    mockGetChatMessages.mockReturnValue({
        data: mockMessages,
        isLoading: false,
        refetch: mockRefetchMessages,
    })
}

describe('ChatPage - Delete Message Functionality', () => {
    beforeEach(() => {
        resetApiMocks()

        // Default implementation for delete mutation - just set up the mutate function
        mockMutationObject.mutate.mockImplementation((params: any, options?: any) => {
            // Don't automatically call callbacks - let tests control this
        })
    })

    it('should render chat messages correctly', () => {
        render(<ChatPage />)

        expect(screen.getByText('Hello, this is a test message')).toBeInTheDocument()
        expect(screen.getByText('This is another message')).toBeInTheDocument()
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Software Engineer')).toBeInTheDocument()
    })

    it('should show delete button only for outgoing messages on hover', async () => {
        render(<ChatPage />)

        const messages = screen.getAllByText(/this is/i)
        expect(messages).toHaveLength(2)

        // The delete button should not be visible initially
        expect(screen.queryByLabelText('Delete message')).not.toBeInTheDocument()

        // Find dropdown trigger buttons by test ID
        const dropdownTriggers = screen.getAllByTestId('message-options-button')
        expect(dropdownTriggers.length).toBeGreaterThan(0)
    })

    it('should not show delete button for incoming messages', () => {
        render(<ChatPage />)

        // Find the incoming message
        const incomingMessage = screen.getByText('This is another message')
        expect(incomingMessage).toBeInTheDocument()

        // The incoming message should not have a delete button in its container
        const messageContainer = incomingMessage.closest('.group')
        expect(messageContainer).toBeInTheDocument()

        // Check that this specific message container doesn't contain a delete button
        if (messageContainer) {
            const deleteButtonsInContainer = messageContainer.querySelectorAll('[data-testid="message-options-button"]')
            expect(deleteButtonsInContainer.length).toBe(0)
        }
    })

    it('should open dropdown and show delete option when clicking menu button', async () => {
        const user = userEvent.setup()
        render(<ChatPage />)

        // Find dropdown trigger button by test ID
        const dropdownTrigger = screen.getByTestId('message-options-button')
        await user.click(dropdownTrigger)

        // Wait for dropdown to appear
        await waitFor(() => {
            expect(screen.getByText('Delete message')).toBeInTheDocument()
        })
    })

    it('should show confirmation dialog when delete is clicked', async () => {
        const user = userEvent.setup()

        // Mock window.confirm
        const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

        render(<ChatPage />)

        // Click dropdown and then delete
        const dropdownTrigger = screen.getByTestId('message-options-button')
        await user.click(dropdownTrigger)

        await waitFor(() => {
            expect(screen.getByText('Delete message')).toBeInTheDocument()
        })

        const deleteMenuItem = screen.getByText('Delete message')
        await user.click(deleteMenuItem)

        expect(mockConfirm).toHaveBeenCalledWith(
            'Are you sure you want to delete this message? This action cannot be undone.'
        )

        mockConfirm.mockRestore()
    })

    it('should call delete mutation when confirmed', async () => {
        const user = userEvent.setup()

        // Mock window.confirm to return true
        const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

        render(<ChatPage />)

        // Click dropdown and then delete
        const dropdownTrigger = screen.getByTestId('message-options-button')
        await user.click(dropdownTrigger)

        await waitFor(() => {
            expect(screen.getByText('Delete message')).toBeInTheDocument()
        })

        const deleteMenuItem = screen.getByText('Delete message')
        await user.click(deleteMenuItem)

        expect(mockMutationObject.mutate).toHaveBeenCalledWith({
            messageId: 'message-1',
        })

        mockConfirm.mockRestore()
    })

    it('should not call delete mutation when cancelled', async () => {
        const user = userEvent.setup()

        // Mock window.confirm to return false
        const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

        render(<ChatPage />)

        // Click dropdown and then delete
        const dropdownTrigger = screen.getByTestId('message-options-button')
        await user.click(dropdownTrigger)

        await waitFor(() => {
            expect(screen.getByText('Delete message')).toBeInTheDocument()
        })

        const deleteMenuItem = screen.getByText('Delete message')
        await user.click(deleteMenuItem)

        expect(mockMutationObject.mutate).not.toHaveBeenCalled()

        mockConfirm.mockRestore()
    })

    it('should show success toast and refetch messages on successful delete', async () => {
        const user = userEvent.setup()
        const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

        // Set up mock mutate to trigger onSuccess callback
        mockMutationObject.mutate.mockImplementation((params: any) => {
            // Simulate async behavior and call onSuccess
            setTimeout(() => {
                if (mockMutationObject._callbacks?.onSuccess) {
                    mockMutationObject._callbacks.onSuccess()
                }
            }, 0)
        })

        render(<ChatPage />)

        // Click dropdown and then delete
        const dropdownTrigger = screen.getByTestId('message-options-button')
        await user.click(dropdownTrigger)

        await waitFor(() => {
            expect(screen.getByText('Delete message')).toBeInTheDocument()
        })

        const deleteMenuItem = screen.getByText('Delete message')
        await user.click(deleteMenuItem)

        // Verify the mutation was called
        expect(mockMutationObject.mutate).toHaveBeenCalledWith({
            messageId: 'message-1',
        })

        // Wait for success toast to be called
        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith('Message deleted successfully')
        }, { timeout: 3000 })

        // Verify messages are refetched
        await waitFor(() => {
            expect(mockRefetchMessages).toHaveBeenCalled()
        })

        mockConfirm.mockRestore()
    })

    it('should show error toast on delete failure', async () => {
        const user = userEvent.setup()
        const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

        // Set up mock mutate to trigger onError callback
        mockMutationObject.mutate.mockImplementation((params: any) => {
            // Simulate async behavior and call onError
            setTimeout(() => {
                if (mockMutationObject._callbacks?.onError) {
                    mockMutationObject._callbacks.onError({ message: 'Failed to delete message' })
                }
            }, 0)
        })

        render(<ChatPage />)

        // Click dropdown and then delete
        const dropdownTrigger = screen.getByTestId('message-options-button')
        await user.click(dropdownTrigger)

        await waitFor(() => {
            expect(screen.getByText('Delete message')).toBeInTheDocument()
        })

        const deleteMenuItem = screen.getByText('Delete message')
        await user.click(deleteMenuItem)

        // Verify the mutation was called
        expect(mockMutationObject.mutate).toHaveBeenCalledWith({
            messageId: 'message-1',
        })

        // Wait for error toast to be called
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Failed to delete message')
        }, { timeout: 3000 })

        mockConfirm.mockRestore()
    })
}) 