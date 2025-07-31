import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TRPCError } from '@trpc/server'
import { subscriptionRouter } from '../subscription'

// Mock the services
const mockSubscriptionService = {
  getUserSubscription: vi.fn(),
  createGoldTrial: vi.fn(),
  updateSubscription: vi.fn(),
  addPaymentMethod: vi.fn(),
  getPaymentMethods: vi.fn(),
}

const mockStripeService = {
  createOrGetCustomer: vi.fn(),
  createSetupIntent: vi.fn(),
  createSubscription: vi.fn(),
  getPaymentMethod: vi.fn(),
  updateSubscription: vi.fn(),
}

const mockUserService = {
  findByClerkId: vi.fn(),
  updateUser: vi.fn(),
}

// Create mock context
const createMockContext = (userId: string | null = 'user_123') => ({
  db: {} as any,
  auth: {
    userId,
    sessionClaims: null,
    sessionId: userId ? "session-123" : null,
    sessionStatus: userId ? "active" : "expired",
    actor: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    orgPermissions: null,
    factorVerificationAge: null,
    redirectToSignIn: vi.fn(),
    redirectToSignUp: vi.fn(),
    protect: vi.fn(),
    has: vi.fn(),
    debug: vi.fn(),
  },
  userId,
  services: {
    subscriptionService: mockSubscriptionService,
    stripeService: mockStripeService,
    userService: mockUserService,
  },
  headers: new Headers(),
})

describe('Subscription Router - Backend Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSetupIntent', () => {
    it('should create Stripe customer and setup intent successfully', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      const mockCustomer = { id: 'cus_test_123' }
      const mockSetupIntent = { client_secret: 'seti_test_123' }
      
      mockStripeService.createOrGetCustomer.mockResolvedValue(mockCustomer)
      mockStripeService.createSetupIntent.mockResolvedValue(mockSetupIntent)
      mockUserService.updateUser.mockResolvedValue({})

      // Act
      const result = await caller.createSetupIntent({
        email: 'test@example.com',
        name: 'Test User',
      })

      // Assert
      expect(mockStripeService.createOrGetCustomer).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        userId: 'user_123',
      })
      expect(mockStripeService.createSetupIntent).toHaveBeenCalledWith('cus_test_123')
      expect(mockUserService.updateUser).toHaveBeenCalledWith('user_123', {
        stripe_customer_id: 'cus_test_123',
      })
      expect(result).toEqual({
        customerId: 'cus_test_123',
        clientSecret: 'seti_test_123',
      })
    })

    it('should throw error when user not authenticated', async () => {
      // Arrange
      const ctx = createMockContext(null)
      const caller = subscriptionRouter.createCaller(ctx)

      // Act & Assert
      await expect(caller.createSetupIntent({
        email: 'test@example.com',
      })).rejects.toThrow('UNAUTHORIZED')
    })

    it('should handle Stripe customer creation failure', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      mockStripeService.createOrGetCustomer.mockRejectedValue(new Error('Stripe error'))

      // Act & Assert
      await expect(caller.createSetupIntent({
        email: 'test@example.com',
      })).rejects.toThrow('Stripe error')
    })
  })

  describe('createSubscription - Gold Trial Flow', () => {
    it('should create Gold trial then set up paid subscription', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      const mockUser = { stripe_customer_id: 'cus_test_123' }
      const mockGoldTrial = { id: 'sub_gold_123' }
      const mockStripeSubscription = {
        id: 'sub_stripe_123',
        current_period_start: 1640995200, // Jan 1, 2022
        current_period_end: 1643673600,   // Feb 1, 2022
      }
      const mockUpdatedSubscription = { id: 'sub_gold_123', plan: 'STARTER' }
      const mockPaymentMethod = {
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025,
        },
      }

      mockUserService.findByClerkId.mockResolvedValue(mockUser)
      mockSubscriptionService.createGoldTrial.mockResolvedValue(mockGoldTrial)
      mockStripeService.createSubscription.mockResolvedValue(mockStripeSubscription)
      mockSubscriptionService.updateSubscription.mockResolvedValue(mockUpdatedSubscription)
      mockStripeService.getPaymentMethod.mockResolvedValue(mockPaymentMethod)
      mockSubscriptionService.addPaymentMethod.mockResolvedValue({})

      // Act
      const result = await caller.createSubscription({
        plan: 'STARTER',
        isAnnual: false,
        paymentMethodId: 'pm_test_123',
      })

      // Assert
      // Should create Gold trial first
      expect(mockSubscriptionService.createGoldTrial).toHaveBeenCalledWith('user_123')
      
      // Should create Stripe subscription with 7-day trial and correct price ID
      expect(mockStripeService.createSubscription).toHaveBeenCalledWith({
        customerId: 'cus_test_123',
        priceId: 'price_starter_monthly',
        paymentMethodId: 'pm_test_123',
        trialPeriodDays: 7,
      })
      
      // Should update local subscription with Stripe details
      expect(mockSubscriptionService.updateSubscription).toHaveBeenCalledWith('sub_gold_123', {
        plan: 'STARTER',
        stripeSubscriptionId: 'sub_stripe_123',
        currentPeriodStart: new Date(1640995200 * 1000),
        currentPeriodEnd: new Date(1643673600 * 1000),
      })
      
      // Should add payment method
      expect(mockSubscriptionService.addPaymentMethod).toHaveBeenCalledWith({
        subscriptionId: 'sub_gold_123',
        stripePaymentMethodId: 'pm_test_123',
        type: 'card',
        cardBrand: 'visa',
        cardLast4: '4242',
        cardExpMonth: 12,
        cardExpYear: 2025,
        isDefault: true,
      })

      expect(result.message).toBe('Subscription created successfully! You\'re on a 7-day Gold trial.')
    })

    it('should handle annual billing with correct price mapping', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      const mockUser = { stripe_customer_id: 'cus_test_123' }
      const mockGoldTrial = { id: 'sub_gold_123' }
      const mockStripeSubscription = {
        id: 'sub_stripe_123',
        current_period_start: 1640995200,
        current_period_end: 1672531200, // +1 year
      }

      mockUserService.findByClerkId.mockResolvedValue(mockUser)
      mockSubscriptionService.createGoldTrial.mockResolvedValue(mockGoldTrial)
      mockStripeService.createSubscription.mockResolvedValue(mockStripeSubscription)
      mockSubscriptionService.updateSubscription.mockResolvedValue({})
      mockStripeService.getPaymentMethod.mockResolvedValue({ card: {} })
      mockSubscriptionService.addPaymentMethod.mockResolvedValue({})

      // Act
      await caller.createSubscription({
        plan: 'PROFESSIONAL',
        isAnnual: true,
        paymentMethodId: 'pm_test_123',
      })

      // Assert
      expect(mockStripeService.createSubscription).toHaveBeenCalledWith({
        customerId: 'cus_test_123',
        priceId: 'price_professional_annual',
        paymentMethodId: 'pm_test_123',
        trialPeriodDays: 7,
      })
    })

    it('should validate all plan types map to correct price IDs', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      const mockUser = { stripe_customer_id: 'cus_test_123' }
      const mockGoldTrial = { id: 'sub_gold_123' }
      const mockStripeSubscription = { id: 'sub_stripe_123', current_period_start: 1640995200, current_period_end: 1643673600 }

      mockUserService.findByClerkId.mockResolvedValue(mockUser)
      mockSubscriptionService.createGoldTrial.mockResolvedValue(mockGoldTrial)
      mockStripeService.createSubscription.mockResolvedValue(mockStripeSubscription)
      mockSubscriptionService.updateSubscription.mockResolvedValue({})
      mockStripeService.getPaymentMethod.mockResolvedValue({ card: {} })
      mockSubscriptionService.addPaymentMethod.mockResolvedValue({})

      const testCases = [
        { plan: 'STARTER' as const, isAnnual: false, expectedPriceId: 'price_starter_monthly' },
        { plan: 'STARTER' as const, isAnnual: true, expectedPriceId: 'price_starter_annual' },
        { plan: 'PROFESSIONAL' as const, isAnnual: false, expectedPriceId: 'price_professional_monthly' },
        { plan: 'PROFESSIONAL' as const, isAnnual: true, expectedPriceId: 'price_professional_annual' },
        { plan: 'ENTERPRISE' as const, isAnnual: false, expectedPriceId: 'price_enterprise_monthly' },
        { plan: 'ENTERPRISE' as const, isAnnual: true, expectedPriceId: 'price_enterprise_annual' },
      ]

      // Act & Assert
      for (const testCase of testCases) {
        vi.clearAllMocks()
        
        await caller.createSubscription({
          plan: testCase.plan,
          isAnnual: testCase.isAnnual,
          paymentMethodId: 'pm_test_123',
        })

        expect(mockStripeService.createSubscription).toHaveBeenCalledWith({
          customerId: 'cus_test_123',
          priceId: testCase.expectedPriceId,
          paymentMethodId: 'pm_test_123',
          trialPeriodDays: 7,
        })
      }
    })

    it('should throw error when user has no Stripe customer ID', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      mockUserService.findByClerkId.mockResolvedValue({ stripe_customer_id: null })

      // Act & Assert
      await expect(caller.createSubscription({
        plan: 'STARTER',
        isAnnual: false,
        paymentMethodId: 'pm_test_123',
      })).rejects.toThrow('User must have a Stripe customer ID')
    })

    it('should handle Stripe subscription creation failure', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      const mockUser = { stripe_customer_id: 'cus_test_123' }
      const mockGoldTrial = { id: 'sub_gold_123' }

      mockUserService.findByClerkId.mockResolvedValue(mockUser)
      mockSubscriptionService.createGoldTrial.mockResolvedValue(mockGoldTrial)
      mockStripeService.createSubscription.mockRejectedValue(new Error('Stripe subscription failed'))

      // Act & Assert
      await expect(caller.createSubscription({
        plan: 'STARTER',
        isAnnual: false,
        paymentMethodId: 'pm_test_123',
      })).rejects.toThrow('Stripe subscription failed')
    })
  })

  describe('getTrialStatus', () => {
    it('should return correct status for active Gold trial', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      const trialEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
      const mockSubscription = {
        status: 'TRIALING',
        trial_end: trialEnd,
        plan: 'GOLD',
      }

      mockSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription)

      // Act
      const result = await caller.getTrialStatus()

      // Assert
      expect(result).toEqual({
        hasTrial: true,
        isTrialing: true,
        trialEndsAt: trialEnd,
        daysRemaining: 5,
        plan: 'GOLD',
      })
    })

    it('should return correct status for expired trial', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      const trialEnd = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
      const mockSubscription = {
        status: 'ACTIVE',
        trial_end: trialEnd,
        plan: 'STARTER',
      }

      mockSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription)

      // Act
      const result = await caller.getTrialStatus()

      // Assert
      expect(result).toEqual({
        hasTrial: true,
        isTrialing: false,
        trialEndsAt: trialEnd,
        daysRemaining: 0,
        plan: 'STARTER',
      })
    })

    it('should return no trial when user has no subscription', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      mockSubscriptionService.getUserSubscription.mockResolvedValue(null)

      // Act
      const result = await caller.getTrialStatus()

      // Assert
      expect(result).toEqual({
        hasTrial: false,
        isTrialing: false,
        trialEndsAt: null,
        daysRemaining: 0,
      })
    })

    it('should calculate days remaining correctly', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      const trialEnd = new Date(Date.now() + 3.5 * 24 * 60 * 60 * 1000) // 3.5 days from now
      const mockSubscription = {
        status: 'TRIALING',
        trial_end: trialEnd,
        plan: 'GOLD',
      }

      mockSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription)

      // Act
      const result = await caller.getTrialStatus()

      // Assert
      expect(result.daysRemaining).toBe(4) // Should round up 3.5 to 4
    })
  })

  describe('updatePlan', () => {
    it('should update subscription plan successfully', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      const mockSubscription = { stripe_subscription_id: 'sub_stripe_123', id: 'sub_local_123' }
      const mockUpdatedStripeSubscription = {
        current_period_start: 1640995200,
        current_period_end: 1643673600,
      }
      const mockUpdatedSubscription = { plan: 'PROFESSIONAL' }

      mockSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription)
      mockStripeService.updateSubscription.mockResolvedValue(mockUpdatedStripeSubscription)
      mockSubscriptionService.updateSubscription.mockResolvedValue(mockUpdatedSubscription)

      // Act
      const result = await caller.updatePlan({
        plan: 'PROFESSIONAL',
        isAnnual: true,
      })

      // Assert
      expect(mockStripeService.updateSubscription).toHaveBeenCalledWith('sub_stripe_123', {
        priceId: 'price_professional_annual',
      })
      expect(mockSubscriptionService.updateSubscription).toHaveBeenCalledWith('sub_local_123', {
        plan: 'PROFESSIONAL',
        currentPeriodStart: new Date(1640995200 * 1000),
        currentPeriodEnd: new Date(1643673600 * 1000),
      })
      expect(result.message).toBe('Plan updated successfully!')
    })

    it('should throw error when no active subscription exists', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      mockSubscriptionService.getUserSubscription.mockResolvedValue(null)

      // Act & Assert
      await expect(caller.updatePlan({
        plan: 'STARTER',
        isAnnual: false,
      })).rejects.toThrow('No active subscription found')
    })

    it('should throw error when subscription has no Stripe ID', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      mockSubscriptionService.getUserSubscription.mockResolvedValue({ stripe_subscription_id: null })

      // Act & Assert
      await expect(caller.updatePlan({
        plan: 'STARTER',
        isAnnual: false,
      })).rejects.toThrow('No active subscription found')
    })
  })

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      const mockSubscription = { stripe_subscription_id: 'sub_stripe_123', id: 'sub_local_123' }
      const mockCanceledSubscription = { cancelAtPeriodEnd: true }

      mockSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription)
      mockStripeService.updateSubscription.mockResolvedValue({})
      mockSubscriptionService.updateSubscription.mockResolvedValue(mockCanceledSubscription)

      // Act
      const result = await caller.cancelSubscription()

      // Assert
      expect(mockStripeService.updateSubscription).toHaveBeenCalledWith('sub_stripe_123', {
        cancelAtPeriodEnd: true,
      })
      expect(mockSubscriptionService.updateSubscription).toHaveBeenCalledWith('sub_local_123', {
        cancelAtPeriodEnd: true,
      })
      expect(result.message).toBe('Subscription will be canceled at the end of the current period.')
    })

    it('should throw error when no subscription exists', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      mockSubscriptionService.getUserSubscription.mockResolvedValue(null)

      // Act & Assert
      await expect(caller.cancelSubscription()).rejects.toThrow('No active subscription found')
    })
  })

  describe('getPaymentMethods', () => {
    it('should return payment methods for subscription', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      const mockSubscription = { id: 'sub_123' }
      const mockPaymentMethods = [
        { id: 'pm_1', card_last4: '4242', card_brand: 'visa', is_default: true },
        { id: 'pm_2', card_last4: '1111', card_brand: 'mastercard', is_default: false },
      ]

      mockSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription)
      mockSubscriptionService.getPaymentMethods.mockResolvedValue(mockPaymentMethods)

      // Act
      const result = await caller.getPaymentMethods()

      // Assert
      expect(mockSubscriptionService.getPaymentMethods).toHaveBeenCalledWith('sub_123')
      expect(result).toEqual(mockPaymentMethods)
    })

    it('should return empty array when user has no subscription', async () => {
      // Arrange
      const ctx = createMockContext()
      const caller = subscriptionRouter.createCaller(ctx)
      
      mockSubscriptionService.getUserSubscription.mockResolvedValue(null)

      // Act
      const result = await caller.getPaymentMethods()

      // Assert
      expect(result).toEqual([])
    })
  })
}) 