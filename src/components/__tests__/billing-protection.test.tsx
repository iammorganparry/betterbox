import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Simple mock implementation
let shouldAllowAccess = true

vi.mock('@clerk/nextjs', () => ({
    Protect: ({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) => {
        return shouldAllowAccess ? children : fallback
    },
}))

vi.mock('next/link', () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    ),
}))

// Import components after mocks
import {
    BillingProtection,
    StarterProtection,
    ProfessionalProtection,
    EnterpriseProtection,
} from '../billing-protection'

describe('BillingProtection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        shouldAllowAccess = true
    })

    describe('Access granted scenarios', () => {
        it('should render children when access is granted', () => {
            // Arrange
            shouldAllowAccess = true

            // Act
            render(
                <BillingProtection plan="starter">
                    <div>Protected Content</div>
                </BillingProtection>
            )

            // Assert
            expect(screen.getByText('Protected Content')).toBeInTheDocument()
        })

        it('should render starter plan content when accessible', () => {
            // Arrange
            shouldAllowAccess = true

            // Act
            render(
                <StarterProtection>
                    <div>Starter Feature</div>
                </StarterProtection>
            )

            // Assert
            expect(screen.getByText('Starter Feature')).toBeInTheDocument()
        })
    })

    describe('Access denied scenarios', () => {
        beforeEach(() => {
            shouldAllowAccess = false
        })

        it('should render fallback when access is denied', () => {
            // Act
            render(
                <BillingProtection plan="professional">
                    <div>Protected Content</div>
                </BillingProtection>
            )

            // Assert
            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
            expect(screen.getByText('Premium Feature')).toBeInTheDocument()
            expect(screen.getByText('This feature requires a subscription to access.')).toBeInTheDocument()
        })

        it('should render custom fallback content', () => {
            // Act
            render(
                <BillingProtection
                    plan="enterprise"
                    fallbackTitle="Custom Title"
                    fallbackDescription="Custom description for this feature."
                >
                    <div>Protected Content</div>
                </BillingProtection>
            )

            // Assert
            expect(screen.getByText('Custom Title')).toBeInTheDocument()
            expect(screen.getByText('Custom description for this feature.')).toBeInTheDocument()
        })

        it('should show upgrade CTA in fallback', () => {
            // Act
            render(
                <ProfessionalProtection>
                    <div>Professional Content</div>
                </ProfessionalProtection>
            )

            // Assert
            expect(screen.queryByText('Professional Content')).not.toBeInTheDocument()
            expect(screen.getByText('Professional Plan Required')).toBeInTheDocument()
            expect(screen.getByText('Upgrade your plan to unlock this feature and many more.')).toBeInTheDocument()

            const viewPlansLink = screen.getByRole('link', { name: 'View Plans' })
            expect(viewPlansLink).toHaveAttribute('href', '/pricing')
        })
    })

    describe('Component structure', () => {
        it('should render without protection when no criteria provided', () => {
            // Act
            render(
                <BillingProtection>
                    <div>Unprotected Content</div>
                </BillingProtection>
            )

            // Assert
            expect(screen.getByText('Unprotected Content')).toBeInTheDocument()
        })

        it('should handle null children gracefully', () => {
            // Act & Assert - Should not throw
            expect(() => {
                render(
                    <BillingProtection plan="starter">
                        {null}
                    </BillingProtection>
                )
            }).not.toThrow()
        })
    })
}) 