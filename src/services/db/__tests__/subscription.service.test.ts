import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SubscriptionService } from '../subscription.service'

// Mock Prisma client
const mockPrisma = {
  subscription: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  paymentMethod: {
    updateMany: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
}

describe('SubscriptionService - Backend Logic', () => {
  let subscriptionService: SubscriptionService

  beforeEach(() => {
    vi.clearAllMocks()
    subscriptionService = new SubscriptionService(mockPrisma as any)
  })

  describe('createOrUpdateSubscription', () => {
    it('should create new subscription when none exists', async () => {
      // Arrange
      const subscriptionData = {
        userId: 'user_123',
        plan: 'STARTER' as const,
        status: 'ACTIVE' as const,
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_123',
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      }

      const createdSubscription = {
        id: 'sub_123',
        ...subscriptionData,
        created_at: new Date(),
        updated_at: new Date(),
      }

      mockPrisma.subscription.upsert.mockResolvedValue(createdSubscription)

      // Act
      const result = await subscriptionService.createOrUpdateSubscription(subscriptionData)

      // Assert
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith({
        where: { user_id: 'user_123' },
        update: {
          plan: 'STARTER',
          status: 'ACTIVE',
          stripe_subscription_id: 'sub_stripe_123',
          stripe_customer_id: 'cus_123',
          current_period_start: subscriptionData.currentPeriodStart,
          current_period_end: subscriptionData.currentPeriodEnd,
          trial_start: undefined,
          trial_end: undefined,
          updated_at: expect.any(Date),
        },
        create: {
          user_id: 'user_123',
          plan: 'STARTER',
          status: 'ACTIVE',
          stripe_subscription_id: 'sub_stripe_123',
          stripe_customer_id: 'cus_123',
          current_period_start: subscriptionData.currentPeriodStart,
          current_period_end: subscriptionData.currentPeriodEnd,
          trial_start: undefined,
          trial_end: undefined,
        },
        include: {
          user: true,
          PaymentMethod: true,
        },
      })
      expect(result).toEqual(createdSubscription)
    })

    it('should update existing subscription', async () => {
      // Arrange
      const subscriptionData = {
        userId: 'user_123',
        plan: 'PROFESSIONAL' as const,
        status: 'ACTIVE' as const,
      }

      const updatedSubscription = {
        id: 'sub_123',
        ...subscriptionData,
        updated_at: new Date(),
      }

      mockPrisma.subscription.upsert.mockResolvedValue(updatedSubscription)

      // Act
      await subscriptionService.createOrUpdateSubscription(subscriptionData)

      // Assert
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith({
        where: { user_id: 'user_123' },
        update: expect.objectContaining({
          plan: 'PROFESSIONAL',
          status: 'ACTIVE',
          updated_at: expect.any(Date),
        }),
        create: expect.objectContaining({
          user_id: 'user_123',
          plan: 'PROFESSIONAL',
          status: 'ACTIVE',
        }),
        include: {
          user: true,
          PaymentMethod: true,
        },
      })
    })
  })

  describe('createGoldTrial - Key Feature', () => {
    it('should create 7-day Gold trial subscription', async () => {
      // Arrange
      const userId = 'user_123'
      const goldTrialSubscription = {
        id: 'sub_gold_123',
        user_id: userId,
        plan: 'GOLD',
        status: 'TRIALING',
        trial_start: expect.any(Date),
        trial_end: expect.any(Date),
      }

      mockPrisma.subscription.upsert.mockResolvedValue(goldTrialSubscription)

      // Act
      const result = await subscriptionService.createGoldTrial(userId)

      // Assert
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith({
        where: { user_id: userId },
        update: {
          plan: 'GOLD',
          status: 'TRIALING',
          stripe_subscription_id: undefined,
          stripe_customer_id: undefined,
          current_period_start: undefined,
          current_period_end: undefined,
          trial_start: expect.any(Date),
          trial_end: expect.any(Date),
          updated_at: expect.any(Date),
        },
        create: {
          user_id: userId,
          plan: 'GOLD',
          status: 'TRIALING',
          stripe_subscription_id: undefined,
          stripe_customer_id: undefined,
          current_period_start: undefined,
          current_period_end: undefined,
          trial_start: expect.any(Date),
          trial_end: expect.any(Date),
        },
        include: {
          user: true,
          PaymentMethod: true,
        },
      })

      // Verify trial dates are set correctly (7 days apart)
      const callArgs = mockPrisma.subscription.upsert.mock.calls[0]?.[0]
      expect(callArgs).toBeDefined()
      const trialStart = callArgs!.create.trial_start
      const trialEnd = callArgs!.create.trial_end
      const diffInDays = (trialEnd.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffInDays).toBe(7)

      expect(result).toEqual(goldTrialSubscription)
    })

    it('should handle Gold trial creation failure', async () => {
      // Arrange
      mockPrisma.subscription.upsert.mockRejectedValue(new Error('Database error'))

      // Act & Assert
      await expect(subscriptionService.createGoldTrial('user_123')).rejects.toThrow('Database error')
    })
  })

  describe('getUserSubscription', () => {
    it('should return user subscription with includes', async () => {
      // Arrange
      const subscription = {
        id: 'sub_123',
        user_id: 'user_123',
        plan: 'STARTER',
        status: 'ACTIVE',
      }

      mockPrisma.subscription.findUnique.mockResolvedValue(subscription)

      // Act
      const result = await subscriptionService.getUserSubscription('user_123')

      // Assert
      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { user_id: 'user_123' },
        include: {
          user: true,
          PaymentMethod: true,
        },
      })
      expect(result).toEqual(subscription)
    })

    it('should return null when user has no subscription', async () => {
      // Arrange
      mockPrisma.subscription.findUnique.mockResolvedValue(null)

      // Act
      const result = await subscriptionService.getUserSubscription('user_123')

      // Assert
      expect(result).toBeNull()
    })
  })

  describe('getActiveSubscription', () => {
    it('should return active subscription', async () => {
      // Arrange
      const activeSubscription = {
        id: 'sub_123',
        user_id: 'user_123',
        plan: 'STARTER',
        status: 'ACTIVE',
      }

      mockPrisma.subscription.findFirst.mockResolvedValue(activeSubscription)

      // Act
      const result = await subscriptionService.getActiveSubscription('user_123')

      // Assert
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          user_id: 'user_123',
          is_deleted: false,
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
        include: {
          user: true,
          PaymentMethod: true,
        },
        orderBy: { created_at: 'desc' },
      })
      expect(result).toEqual(activeSubscription)
    })

    it('should return trialing subscription as active', async () => {
      // Arrange
      const trialingSubscription = {
        id: 'sub_gold_123',
        user_id: 'user_123',
        plan: 'GOLD',
        status: 'TRIALING',
      }

      mockPrisma.subscription.findFirst.mockResolvedValue(trialingSubscription)

      // Act
      const result = await subscriptionService.getActiveSubscription('user_123')

      // Assert
      expect(result).toEqual(trialingSubscription)
      // Verify both ACTIVE and TRIALING are considered active
      const whereClause = mockPrisma.subscription.findFirst.mock.calls[0]?.[0]?.where
      expect(whereClause?.status.in).toEqual(['ACTIVE', 'TRIALING'])
    })
  })

  describe('updateSubscription', () => {
    it('should update subscription with partial data', async () => {
      // Arrange
      const subscriptionId = 'sub_123'
      const updateData = {
        plan: 'PROFESSIONAL' as const,
        status: 'ACTIVE' as const,
        stripeSubscriptionId: 'sub_stripe_new_123',
      }

      const updatedSubscription = {
        id: subscriptionId,
        ...updateData,
        updated_at: new Date(),
      }

      mockPrisma.subscription.update.mockResolvedValue(updatedSubscription)

      // Act
      const result = await subscriptionService.updateSubscription(subscriptionId, updateData)

      // Assert
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionId },
        data: {
          plan: 'PROFESSIONAL',
          status: 'ACTIVE',
          stripe_subscription_id: 'sub_stripe_new_123',
          current_period_start: undefined,
          current_period_end: undefined,
          trial_end: undefined,
          cancel_at_period_end: undefined,
          canceled_at: undefined,
          updated_at: expect.any(Date),
        },
        include: {
          user: true,
          PaymentMethod: true,
        },
      })
      expect(result).toEqual(updatedSubscription)
    })

    it('should handle cancellation data', async () => {
      // Arrange
      const subscriptionId = 'sub_123'
      const cancelData = {
        cancelAtPeriodEnd: true,
        canceledAt: new Date('2024-01-15'),
      }

      mockPrisma.subscription.update.mockResolvedValue({})

      // Act
      await subscriptionService.updateSubscription(subscriptionId, cancelData)

      // Assert
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionId },
        data: expect.objectContaining({
          cancel_at_period_end: true,
          canceled_at: cancelData.canceledAt,
        }),
        include: {
          user: true,
          PaymentMethod: true,
        },
      })
    })
  })

  describe('addPaymentMethod', () => {
    it('should add payment method and set as default', async () => {
      // Arrange
      const paymentMethodData = {
        subscriptionId: 'sub_123',
        stripePaymentMethodId: 'pm_123',
        type: 'card',
        cardBrand: 'visa',
        cardLast4: '4242',
        cardExpMonth: 12,
        cardExpYear: 2025,
        isDefault: true,
      }

      const createdPaymentMethod = {
        id: 'pm_local_123',
        ...paymentMethodData,
      }

      mockPrisma.paymentMethod.updateMany.mockResolvedValue({ count: 2 })
      mockPrisma.paymentMethod.create.mockResolvedValue(createdPaymentMethod)

      // Act
      const result = await subscriptionService.addPaymentMethod(paymentMethodData)

      // Assert
      // Should unset other default payment methods first
      expect(mockPrisma.paymentMethod.updateMany).toHaveBeenCalledWith({
        where: {
          subscription_id: 'sub_123',
          is_deleted: false,
        },
        data: { is_default: false },
      })

      // Should create new payment method
      expect(mockPrisma.paymentMethod.create).toHaveBeenCalledWith({
        data: {
          subscription_id: 'sub_123',
          stripe_payment_method_id: 'pm_123',
          type: 'card',
          card_brand: 'visa',
          card_last4: '4242',
          card_exp_month: 12,
          card_exp_year: 2025,
          is_default: true,
        },
        include: { subscription: true },
      })

      expect(result).toEqual(createdPaymentMethod)
    })

    it('should add payment method without unsetting others when not default', async () => {
      // Arrange
      const paymentMethodData = {
        subscriptionId: 'sub_123',
        stripePaymentMethodId: 'pm_123',
        type: 'card',
        isDefault: false,
      }

      mockPrisma.paymentMethod.create.mockResolvedValue({})

      // Act
      await subscriptionService.addPaymentMethod(paymentMethodData)

      // Assert
      expect(mockPrisma.paymentMethod.updateMany).not.toHaveBeenCalled()
      expect(mockPrisma.paymentMethod.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          is_default: false,
        }),
        include: { subscription: true },
      })
    })
  })

  describe('getPaymentMethods', () => {
    it('should retrieve payment methods ordered by default first', async () => {
      // Arrange
      const paymentMethods = [
        { id: 'pm_1', is_default: true, card_last4: '4242' },
        { id: 'pm_2', is_default: false, card_last4: '1111' },
      ]

      mockPrisma.paymentMethod.findMany.mockResolvedValue(paymentMethods)

      // Act
      const result = await subscriptionService.getPaymentMethods('sub_123')

      // Assert
      expect(mockPrisma.paymentMethod.findMany).toHaveBeenCalledWith({
        where: {
          subscription_id: 'sub_123',
          is_deleted: false,
        },
        include: { subscription: true },
        orderBy: [
          { is_default: 'desc' },
          { created_at: 'desc' },
        ],
      })
      expect(result).toEqual(paymentMethods)
    })
  })

  describe('hasActiveTrial', () => {
    it('should return true when user has active trial', async () => {
      // Arrange
      const trialSubscription = {
        id: 'sub_gold_123',
        trial_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      }

      mockPrisma.subscription.findFirst.mockResolvedValue(trialSubscription)

      // Act
      const result = await subscriptionService.hasActiveTrial('user_123')

      // Assert
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: {
          user_id: 'user_123',
          is_deleted: false,
          trial_end: { gte: expect.any(Date) },
        },
      })
      expect(result).toBe(true)
    })

    it('should return false when user has no active trial', async () => {
      // Arrange
      mockPrisma.subscription.findFirst.mockResolvedValue(null)

      // Act
      const result = await subscriptionService.hasActiveTrial('user_123')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getTrialsEndingSoon', () => {
    it('should return trials ending within specified hours', async () => {
      // Arrange
      const endingTrials = [
        { id: 'sub_1', trial_end: new Date(Date.now() + 12 * 60 * 60 * 1000) }, // 12 hours
        { id: 'sub_2', trial_end: new Date(Date.now() + 20 * 60 * 60 * 1000) }, // 20 hours
      ]

      mockPrisma.subscription.findMany.mockResolvedValue(endingTrials)

      // Act
      const result = await subscriptionService.getTrialsEndingSoon(24) // 24 hours

      // Assert
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          status: 'TRIALING',
          trial_end: { lte: expect.any(Date) },
          is_deleted: false,
        },
        include: {
          user: true,
          PaymentMethod: true,
        },
      })
      expect(result).toEqual(endingTrials)
    })

    it('should use default 24 hours when not specified', async () => {
      // Arrange
      mockPrisma.subscription.findMany.mockResolvedValue([])

      // Act
      await subscriptionService.getTrialsEndingSoon()

      // Assert
      const callArgs = mockPrisma.subscription.findMany.mock.calls[0]?.[0]
      expect(callArgs).toBeDefined()
      const cutoffDate = callArgs!.where.trial_end.lte
      const hoursFromNow = (cutoffDate.getTime() - Date.now()) / (1000 * 60 * 60)
      expect(Math.round(hoursFromNow)).toBe(24)
    })
  })

  describe('transitionTrialToPaid', () => {
    it('should transition Gold trial to paid plan', async () => {
      // Arrange
      const subscriptionId = 'sub_gold_123'
      const targetPlan = 'STARTER'
      const stripeSubscriptionId = 'sub_stripe_123'

      const transitionedSubscription = {
        id: subscriptionId,
        plan: targetPlan,
        status: 'ACTIVE',
        stripe_subscription_id: stripeSubscriptionId,
      }

      mockPrisma.subscription.update.mockResolvedValue(transitionedSubscription)

      // Act
      const result = await subscriptionService.transitionTrialToPaid(
        subscriptionId,
        targetPlan as any,
        stripeSubscriptionId
      )

      // Assert
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionId },
        data: {
          plan: targetPlan,
          status: 'ACTIVE',
          stripe_subscription_id: stripeSubscriptionId,
          current_period_start: undefined,
          current_period_end: undefined,
          trial_end: undefined,
          cancel_at_period_end: undefined,
          canceled_at: undefined,
          updated_at: expect.any(Date),
        },
        include: {
          user: true,
          PaymentMethod: true,
        },
      })
      expect(result).toEqual(transitionedSubscription)
    })
  })

  describe('cancelSubscription', () => {
    it('should soft delete subscription', async () => {
      // Arrange
      const subscriptionId = 'sub_123'
      const canceledSubscription = {
        id: subscriptionId,
        status: 'CANCELED',
        canceled_at: expect.any(Date),
      }

      mockPrisma.subscription.update.mockResolvedValue(canceledSubscription)

      // Act
      const result = await subscriptionService.cancelSubscription(subscriptionId)

      // Assert
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionId },
        data: {
          status: 'CANCELED',
          canceled_at: expect.any(Date),
          updated_at: expect.any(Date),
        },
        include: {
          user: true,
          PaymentMethod: true,
        },
      })
      expect(result).toEqual(canceledSubscription)
    })
  })
}) 