import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { act } from '@testing-library/react'

// Mock toast with factory function
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

// Mock TRPC API with factory function
vi.mock('~/trpc/react', () => ({
    api: {
        inbox: {
            sendMessage: {
                useMutation: vi.fn(),
            },
        },
    },
}))

// Now import the component and dependencies after mocks are set up
import { MessageInput } from '../message-input'
import { api } from '~/trpc/react'
import { toast } from 'sonner'

describe('MessageInput', () => {
    const mockOnMessageSent = vi.fn()
    const defaultProps = {
        chatId: 'chat-123',
        onMessageSent: mockOnMessageSent,
    }

    // Mock mutation object
    const mockMutate = vi.fn()
    const mockMutation = {
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
    }

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(api.inbox.sendMessage.useMutation).mockReturnValue(mockMutation as any)
    })

    it('should render message input with send button', () => {
        // Act
        render(<MessageInput {...defaultProps} />)

        // Assert
        expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
    })

    it('should render with custom placeholder', () => {
        // Act
        render(<MessageInput {...defaultProps} placeholder="Custom placeholder" />)

        // Assert
        expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument()
    })

    it('should disable input and button when disabled prop is true', () => {
        // Act
        render(<MessageInput {...defaultProps} disabled={true} />)

        // Assert
        expect(screen.getByPlaceholderText('Type a message...')).toBeDisabled()
        expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
    })

    it('should send a message when form is submitted', async () => {
        // Arrange
        const user = userEvent.setup()
        render(<MessageInput {...defaultProps} />)

        const input = screen.getByPlaceholderText('Type a message...')
        const sendButton = screen.getByRole('button', { name: /send message/i })

        // Act
        await user.type(input, 'Hello, world!')
        await user.click(sendButton)

        // Assert
        expect(mockMutate).toHaveBeenCalledWith({
            chatId: 'chat-123',
            content: 'Hello, world!',
        })
    })

    it('should send a message when Enter key is pressed', async () => {
        // Arrange
        const user = userEvent.setup()
        render(<MessageInput {...defaultProps} />)

        const input = screen.getByPlaceholderText('Type a message...')

        // Act
        await user.type(input, 'Hello, world!')
        await user.keyboard('{Enter}')

        // Assert
        expect(mockMutate).toHaveBeenCalledWith({
            chatId: 'chat-123',
            content: 'Hello, world!',
        })
    })

    it('should not send message when Shift+Enter is pressed', async () => {
        // Arrange
        const user = userEvent.setup()
        render(<MessageInput {...defaultProps} />)

        const input = screen.getByPlaceholderText('Type a message...')

        // Act
        await user.type(input, 'Hello, world!')
        await user.keyboard('{Shift>}{Enter}{/Shift}')

        // Assert
        expect(mockMutate).not.toHaveBeenCalled()
    })

    it('should trim whitespace from message content', async () => {
        // Arrange
        const user = userEvent.setup()
        render(<MessageInput {...defaultProps} />)

        const input = screen.getByPlaceholderText('Type a message...')
        const sendButton = screen.getByRole('button', { name: /send message/i })

        // Act
        await user.type(input, '  Hello, world!  ')
        await user.click(sendButton)

        // Assert
        expect(mockMutate).toHaveBeenCalledWith({
            chatId: 'chat-123',
            content: 'Hello, world!',
        })
    })

    it('should show error toast for empty message', async () => {
        // Arrange
        const user = userEvent.setup()
        render(<MessageInput {...defaultProps} />)

        const input = screen.getByPlaceholderText('Type a message...')

        // Act - try to send empty message using Enter key
        await user.click(input) // Focus the input
        await user.keyboard('{Enter}')

        // Assert
        expect(toast.error).toHaveBeenCalledWith('Please enter a message')
        expect(mockMutate).not.toHaveBeenCalled()
    })

    it('should show error toast for message that is too long', async () => {
        // Arrange
        const user = userEvent.setup()
        render(<MessageInput {...defaultProps} />)

        const input = screen.getByPlaceholderText('Type a message...')
        const sendButton = screen.getByRole('button', { name: /send message/i })
        const longMessage = 'a'.repeat(2001)

        // Act - use fireEvent for performance with long strings
        fireEvent.change(input, { target: { value: longMessage } })
        await user.click(sendButton)

        // Assert
        expect(toast.error).toHaveBeenCalledWith('Message is too long (max 2000 characters)')
        expect(mockMutate).not.toHaveBeenCalled()
    })

    it('should show character count when approaching limit', async () => {
        // Arrange
        render(<MessageInput {...defaultProps} />)

        const input = screen.getByPlaceholderText('Type a message...')
        const longMessage = 'a'.repeat(1850)

        // Act - use fireEvent for performance with long strings
        fireEvent.change(input, { target: { value: longMessage } })

        // Assert
        expect(screen.getByText('150 characters remaining')).toBeInTheDocument()
    })

    it('should clear input after successful message send', async () => {
        // Arrange
        let capturedOptions: any = null
        vi.mocked(api.inbox.sendMessage.useMutation).mockImplementation((options) => {
            capturedOptions = options
            return mockMutation as any
        })

        const user = userEvent.setup()
        render(<MessageInput {...defaultProps} />)

        const input = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement
        const sendButton = screen.getByRole('button', { name: /send message/i })

        // Act
        await user.type(input, 'Hello, world!')
        await user.click(sendButton)

        // Simulate successful mutation
        if (capturedOptions?.onSuccess) {
            await act(async () => {
                capturedOptions.onSuccess({
                    success: true,
                    message: 'Message sent successfully',
                    messageId: 'msg-123',
                    chatId: 'chat-123',
                })
            })
        }

        // Assert
        expect(input.value).toBe('')
        expect(toast.success).toHaveBeenCalledWith('Message sent successfully')
        expect(mockOnMessageSent).toHaveBeenCalled()
    })

    it('should show error toast on send failure', async () => {
        // Arrange
        let capturedOptions: any = null
        vi.mocked(api.inbox.sendMessage.useMutation).mockImplementation((options) => {
            capturedOptions = options
            return mockMutation as any
        })

        const user = userEvent.setup()
        render(<MessageInput {...defaultProps} />)

        const input = screen.getByPlaceholderText('Type a message...')
        const sendButton = screen.getByRole('button', { name: /send message/i })

        // Act
        await user.type(input, 'Hello, world!')
        await user.click(sendButton)

        // Simulate failed mutation
        if (capturedOptions?.onError) {
            capturedOptions.onError({
                message: 'Network error occurred',
            })
        }

        // Assert
        expect(toast.error).toHaveBeenCalledWith('Network error occurred')
    })

    it('should show loading state when sending message', () => {
        // Arrange
        const loadingMutation = { ...mockMutation, isPending: true }
        vi.mocked(api.inbox.sendMessage.useMutation).mockReturnValue(loadingMutation as any)

        // Act
        render(<MessageInput {...defaultProps} />)

        // Assert
        expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })
}) 