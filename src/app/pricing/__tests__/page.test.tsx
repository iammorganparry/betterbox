import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock Clerk PricingTable component
vi.mock('@clerk/nextjs', () => ({
    PricingTable: ({ forOrganizations }: { forOrganizations?: boolean }) => (
        <div data-testid="pricing-table">
            Pricing Table {forOrganizations ? '(Organizations)' : ''}
        </div>
    ),
}))

// Mock components
vi.mock('~/components/ui/sidebar', () => ({
    SidebarInset: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="sidebar-inset">{children}</div>
    ),
}))

vi.mock('~/components/app-header', () => ({
    AppHeader: () => <div data-testid="app-header">App Header</div>,
}))

// Import component after mocks
import PricingPage from '../page'

describe('PricingPage', () => {
    it('should render the page title and description', () => {
        // Act
        render(<PricingPage />)

        // Assert
        expect(screen.getByText('Choose Your Plan')).toBeInTheDocument()
        expect(screen.getByText('Select the perfect plan for your LinkedIn messaging needs')).toBeInTheDocument()
    })

    it('should render the pricing table for organizations', () => {
        // Act
        render(<PricingPage />)

        // Assert
        const pricingTable = screen.getByTestId('pricing-table')
        expect(pricingTable).toBeInTheDocument()
        expect(pricingTable).toHaveTextContent('Pricing Table (Organizations)')
    })

    it('should render within sidebar inset layout', () => {
        // Act
        render(<PricingPage />)

        // Assert
        expect(screen.getByTestId('sidebar-inset')).toBeInTheDocument()
    })

    it('should render the app header', () => {
        // Act
        render(<PricingPage />)

        // Assert
        expect(screen.getByTestId('app-header')).toBeInTheDocument()
    })

    it('should apply correct container and styling classes', () => {
        // Act
        const { container } = render(<PricingPage />)

        // Assert
        const containerDiv = container.querySelector('.container')
        expect(containerDiv).toBeInTheDocument()
        expect(containerDiv).toHaveClass('mx-auto', 'px-4', 'py-8')

        const pricingTableContainer = container.querySelector('.max-w-4xl')
        expect(pricingTableContainer).toBeInTheDocument()
        expect(pricingTableContainer).toHaveClass('mx-auto', 'px-4')
    })

    it('should have proper heading hierarchy', () => {
        // Act
        render(<PricingPage />)

        // Assert
        const heading = screen.getByRole('heading', { level: 1 })
        expect(heading).toBeInTheDocument()
        expect(heading).toHaveTextContent('Choose Your Plan')
    })

    it('should center align the header content', () => {
        // Act
        const { container } = render(<PricingPage />)

        // Assert
        const headerDiv = container.querySelector('.text-center')
        expect(headerDiv).toBeInTheDocument()
    })

    it('should render all required text content', () => {
        // Act
        render(<PricingPage />)

        // Assert
        expect(screen.getByText('Choose Your Plan')).toBeInTheDocument()
        expect(screen.getByText('Select the perfect plan for your LinkedIn messaging needs')).toBeInTheDocument()
    })

    it('should have proper spacing classes', () => {
        // Act
        const { container } = render(<PricingPage />)

        // Assert
        const headerSection = container.querySelector('.mb-8')
        expect(headerSection).toBeInTheDocument()
        expect(headerSection).toHaveClass('text-center')
    })
}) 