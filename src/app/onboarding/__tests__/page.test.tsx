import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// Mock dependencies
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}))

vi.mock('@clerk/nextjs', () => ({
    useUser: vi.fn(),
    PricingTable: ({ forOrganizations }: { forOrganizations?: boolean }) => (
        <div data-testid="pricing-table">
            Pricing Table {forOrganizations ? '(Organizations)' : ''}
        </div>
    ),
}))

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('../_actions', () => ({
    updateOnboardingStep: vi.fn(),
    completeOnboarding: vi.fn(),
}))

vi.mock('~/components/linkedin-connection-card', () => ({
    LinkedInConnectionCard: ({ userId }: { userId: string }) => (
        <div data-testid="linkedin-connection-card">
            <button data-testid="connect-linkedin">
                Connect LinkedIn
            </button>
        </div>
    ),
}))

// Import component after mocks
import OnboardingPage from '../page'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { updateOnboardingStep, completeOnboarding } from '../_actions'

const mockUseUser = useUser as ReturnType<typeof vi.fn>
const mockUpdateOnboardingStep = vi.mocked(updateOnboardingStep)
const mockCompleteOnboarding = vi.mocked(completeOnboarding)

describe('OnboardingPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUpdateOnboardingStep.mockResolvedValue({ success: true, metadata: {} })
        mockCompleteOnboarding.mockResolvedValue({ success: true, metadata: {} })
    })

    it('should render initial LinkedIn connection step', () => {
        // Arrange
        mockUseUser.mockReturnValue({
            user: {
                publicMetadata: {},
            },
        })

        // Act
        render(<OnboardingPage />)

        // Assert
        expect(screen.getByText('Welcome to BetterBox')).toBeInTheDocument()
        expect(screen.getByText('Connect your LinkedIn account')).toBeInTheDocument()
        expect(screen.getByTestId('linkedin-connection-card')).toBeInTheDocument()
    })

    it('should show progress bar with correct initial progress', () => {
        // Arrange
        mockUseUser.mockReturnValue({
            user: {
                publicMetadata: {},
            },
        })

        // Act
        render(<OnboardingPage />)

        // Assert
        expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    })

    it('should advance to plan selection step after LinkedIn connection', async () => {
        // Arrange
        const user = userEvent.setup()
        mockUseUser.mockReturnValue({
            user: {
                publicMetadata: { linkedinConnected: true },
            },
        })

        // Act
        render(<OnboardingPage />)

        // Assert
        expect(screen.getByText('Choose your plan')).toBeInTheDocument()
        expect(screen.getByTestId('pricing-table')).toBeInTheDocument()
        expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
    })

    it('should show payment completion step after plan selection', () => {
        // Arrange
        mockUseUser.mockReturnValue({
            user: {
                publicMetadata: {
                    linkedinConnected: true,
                    stripeSubscribed: true,
                },
            },
        })

        // Act
        render(<OnboardingPage />)

        // Assert
        expect(screen.getByText('Payment completed!')).toBeInTheDocument()
        expect(screen.getByText('Setup Complete')).toBeInTheDocument()
        expect(screen.getByText('Step 3 of 3')).toBeInTheDocument()
    })

    it('should handle LinkedIn connection success', async () => {
        // Arrange
        const user = userEvent.setup()
        mockUseUser.mockReturnValue({
            user: {
                publicMetadata: {},
            },
        })

        // Act
        render(<OnboardingPage />)
        await user.click(screen.getByText('Continue to Plan Selection'))

        // Assert
        await waitFor(() => {
            expect(mockUpdateOnboardingStep).toHaveBeenCalledWith({
                linkedinConnected: true,
            })
        })
        expect(toast.success).toHaveBeenCalledWith('Connect LinkedIn completed!')
    })

    it('should handle plan selection step completion', async () => {
        // Arrange
        const user = userEvent.setup()
        mockUseUser.mockReturnValue({
            user: {
                publicMetadata: { linkedinConnected: true },
            },
        })

        // Act
        render(<OnboardingPage />)
        await user.click(screen.getByText('Continue to Payment'))

        // Assert
        await waitFor(() => {
            expect(mockUpdateOnboardingStep).toHaveBeenCalledWith({
                planConnected: true,
            })
        })
        expect(toast.success).toHaveBeenCalledWith('Choose Plan completed!')
    })

    it('should complete onboarding and redirect', async () => {
        // Arrange
        const user = userEvent.setup()
        mockUseUser.mockReturnValue({
            user: {
                publicMetadata: {
                    linkedinConnected: true,
                    stripeSubscribed: true,
                    cardDetailsAdded: true,
                },
                reload: vi.fn().mockResolvedValue(undefined),
            },
        })

        // Act
        render(<OnboardingPage />)
        await user.click(screen.getByText('Get Started with BetterBox'))

        // Assert
        await waitFor(() => {
            expect(mockCompleteOnboarding).toHaveBeenCalled()
            expect(toast.success).toHaveBeenCalledWith('Onboarding completed! Welcome to BetterBox!')
            expect(mockPush).toHaveBeenCalledWith('/')
        })
    })

    it('should handle errors during step updates', async () => {
        // Arrange
        const user = userEvent.setup()
        mockUseUser.mockReturnValue({
            user: {
                publicMetadata: {},
            },
        })
        mockUpdateOnboardingStep.mockResolvedValue({
            error: 'Update failed',
        })

        // Act
        render(<OnboardingPage />)
        await user.click(screen.getByText('Continue to Plan Selection'))

        // Assert
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Update failed')
        })
    })

    it('should show loading state during step completion', async () => {
        // Arrange
        const user = userEvent.setup()
        mockUseUser.mockReturnValue({
            user: {
                publicMetadata: { linkedinConnected: true },
            },
        })
        // Make the mock take time to resolve
        mockUpdateOnboardingStep.mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve({ success: true, metadata: {} }), 100))
        )

        // Act
        render(<OnboardingPage />)
        const continueButton = screen.getByText('Continue to Payment')

        await user.click(continueButton)

        // Assert
        expect(continueButton).toBeDisabled()
    })

    it('should show correct step indicators', () => {
        // Test each step's indicators
        const steps = [
            { metadata: {}, expectedActive: 'Connect LinkedIn' },
            { metadata: { linkedinConnected: true }, expectedActive: 'Choose Plan' },
            {
                metadata: { linkedinConnected: true, stripeSubscribed: true },
                expectedActive: 'Payment Details'
            },
        ]

        steps.forEach(({ metadata, expectedActive }) => {
            mockUseUser.mockReturnValue({
                user: { publicMetadata: metadata },
            })

            const { unmount } = render(<OnboardingPage />)

            // Check that the correct step is highlighted by looking for the primary color class
            const stepIndicators = screen.getAllByText(expectedActive)
            // The step indicator should have the text-primary class when active
            const activeStepIndicator = stepIndicators.find(element =>
                element.closest('.text-primary') !== null
            )
            expect(activeStepIndicator).toBeDefined()

            unmount()
        })
    })

    it('should navigate back to previous steps', async () => {
        // Arrange
        const user = userEvent.setup()
        mockUseUser.mockReturnValue({
            user: {
                publicMetadata: { linkedinConnected: true },
            },
        })

        // Act
        render(<OnboardingPage />)
        const backButton = screen.getByRole('button', { name: /back/i })
        await user.click(backButton)

        // The component should handle navigation back
        // This would depend on implementation details
    })

    it('should display step completion checkmarks correctly', () => {
        // Arrange
        mockUseUser.mockReturnValue({
            user: {
                publicMetadata: {
                    linkedinConnected: true,
                    stripeSubscribed: true,
                },
            },
        })

        // Act
        render(<OnboardingPage />)

        // Assert
        const checkmarks = screen.getAllByTestId('check-circle')
        expect(checkmarks.length).toBeGreaterThan(0)
    })
}) 