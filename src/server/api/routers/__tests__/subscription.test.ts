import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TRPCError } from '@trpc/server';

// Mock the database before importing anything that depends on it
vi.mock('~/db', () => ({
  db: vi.fn(),
}));

import { subscriptionRouter } from '../subscription';

// Mock services
const mockOnboardingService = {
  getOnboardingStatus: vi.fn(),
  completeOnboarding: vi.fn(),
  validateOnboardingIntegrity: vi.fn(),
};

const mockStripeService = {
  createOrGetCustomer: vi.fn(),
  attachPaymentMethod: vi.fn(),
  setDefaultPaymentMethod: vi.fn(),
};

const mockUserService = {
  findById: vi.fn(),
  update: vi.fn(),
};

const mockSubscriptionService = {};

const mockServices = {
  onboardingService: mockOnboardingService,
  stripeService: mockStripeService,
  userService: mockUserService,
  subscriptionService: mockSubscriptionService,
};

// Create mock context
const createMockContext = (userId: string) => ({
  userId,
  services: mockServices,
});

describe('subscriptionRouter.completeOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Stripe customer creation', () => {
    it('should create a new Stripe customer when user does not have one', async () => {
      const mockUserId = 'user_123';
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        stripe_customer_id: null,
      };
      const mockStripeCustomer = { id: 'cus_123456789' };
      const mockOnboardingStatus = {
        isRequired: true,
        paymentMethodAdded: false,
      };
      const mockVerificationStatus = {
        isRequired: false,
        completedAt: new Date(),
      };
      const mockIntegrity = { isValid: true };

      // Setup mocks
      mockOnboardingService.getOnboardingStatus.mockResolvedValue(mockOnboardingStatus);
      mockUserService.findById.mockResolvedValue(mockUser);
      mockStripeService.createOrGetCustomer.mockResolvedValue(mockStripeCustomer);
      mockUserService.update.mockResolvedValue({ ...mockUser, stripe_customer_id: mockStripeCustomer.id });
      mockStripeService.attachPaymentMethod.mockResolvedValue({});
      mockStripeService.setDefaultPaymentMethod.mockResolvedValue({});
      mockOnboardingService.completeOnboarding.mockResolvedValue(true);
      mockOnboardingService.getOnboardingStatus.mockResolvedValueOnce(mockOnboardingStatus)
        .mockResolvedValueOnce(mockVerificationStatus);
      mockOnboardingService.validateOnboardingIntegrity.mockResolvedValue(mockIntegrity);

      const ctx = createMockContext(mockUserId);
      const caller = subscriptionRouter.createCaller(ctx);

      const input = {
        paymentMethodId: 'pm_123456789',
        productId: 'prod_123',
        selectedPlan: 'standard',
        isAnnual: false,
      };

      const result = await caller.completeOnboarding(input);

      // Verify Stripe customer was created
      expect(mockStripeService.createOrGetCustomer).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'John Doe',
        userId: mockUserId,
      });

      // Verify user was updated with Stripe customer ID
      expect(mockUserService.update).toHaveBeenCalledWith(mockUserId, {
        stripe_customer_id: 'cus_123456789',
      });

      // Verify payment method was attached
      expect(mockStripeService.attachPaymentMethod).toHaveBeenCalledWith(
        'pm_123456789',
        'cus_123456789'
      );

      // Verify payment method was set as default
      expect(mockStripeService.setDefaultPaymentMethod).toHaveBeenCalledWith(
        'cus_123456789',
        'pm_123456789'
      );

      // Verify onboarding was completed
      expect(mockOnboardingService.completeOnboarding).toHaveBeenCalledWith(mockUserId);

      // Verify response includes Stripe customer ID
      expect(result.success).toBe(true);
      expect(result.data.stripeCustomerId).toBe('cus_123456789');
      expect(result.data.paymentMethodId).toBe('pm_123456789');
    });

    it('should use existing Stripe customer when user already has one', async () => {
      const mockUserId = 'user_123';
      const existingCustomerId = 'cus_existing123';
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        stripe_customer_id: existingCustomerId,
      };
      const mockOnboardingStatus = {
        isRequired: true,
        paymentMethodAdded: false,
      };
      const mockVerificationStatus = {
        isRequired: false,
        completedAt: new Date(),
      };
      const mockIntegrity = { isValid: true };

      // Setup mocks
      mockOnboardingService.getOnboardingStatus.mockResolvedValue(mockOnboardingStatus);
      mockUserService.findById.mockResolvedValue(mockUser);
      mockStripeService.attachPaymentMethod.mockResolvedValue({});
      mockStripeService.setDefaultPaymentMethod.mockResolvedValue({});
      mockOnboardingService.completeOnboarding.mockResolvedValue(true);
      mockOnboardingService.getOnboardingStatus.mockResolvedValueOnce(mockOnboardingStatus)
        .mockResolvedValueOnce(mockVerificationStatus);
      mockOnboardingService.validateOnboardingIntegrity.mockResolvedValue(mockIntegrity);

      const ctx = createMockContext(mockUserId);
      const caller = subscriptionRouter.createCaller(ctx);

      const input = {
        paymentMethodId: 'pm_123456789',
        productId: 'prod_123',
        selectedPlan: 'standard',
        isAnnual: false,
      };

      const result = await caller.completeOnboarding(input);

      // Verify Stripe customer was NOT created (existing one used)
      expect(mockStripeService.createOrGetCustomer).not.toHaveBeenCalled();

      // Verify user was NOT updated (already has customer ID)
      expect(mockUserService.update).not.toHaveBeenCalled();

      // Verify payment method was attached to existing customer
      expect(mockStripeService.attachPaymentMethod).toHaveBeenCalledWith(
        'pm_123456789',
        existingCustomerId
      );

      // Verify payment method was set as default for existing customer
      expect(mockStripeService.setDefaultPaymentMethod).toHaveBeenCalledWith(
        existingCustomerId,
        'pm_123456789'
      );

      // Verify response includes existing customer ID
      expect(result.success).toBe(true);
      expect(result.data.stripeCustomerId).toBe(existingCustomerId);
    });

    it('should handle Stripe customer creation failure', async () => {
      const mockUserId = 'user_123';
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        stripe_customer_id: null,
      };
      const mockOnboardingStatus = {
        isRequired: true,
        paymentMethodAdded: false,
      };

      // Setup mocks
      mockOnboardingService.getOnboardingStatus.mockResolvedValue(mockOnboardingStatus);
      mockUserService.findById.mockResolvedValue(mockUser);
      mockStripeService.createOrGetCustomer.mockRejectedValue(new Error('Stripe error'));

      const ctx = createMockContext(mockUserId);
      const caller = subscriptionRouter.createCaller(ctx);

      const input = {
        paymentMethodId: 'pm_123456789',
        productId: 'prod_123',
        selectedPlan: 'standard',
        isAnnual: false,
      };

      await expect(caller.completeOnboarding(input)).rejects.toThrow('Failed to create Stripe customer');

      // Verify no further operations were attempted
      expect(mockStripeService.attachPaymentMethod).not.toHaveBeenCalled();
      expect(mockOnboardingService.completeOnboarding).not.toHaveBeenCalled();
    });

    it('should handle payment method attachment failure', async () => {
      const mockUserId = 'user_123';
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        stripe_customer_id: 'cus_existing123',
      };
      const mockOnboardingStatus = {
        isRequired: true,
        paymentMethodAdded: false,
      };

      // Setup mocks
      mockOnboardingService.getOnboardingStatus.mockResolvedValue(mockOnboardingStatus);
      mockUserService.findById.mockResolvedValue(mockUser);
      mockStripeService.attachPaymentMethod.mockRejectedValue(new Error('Payment method error'));

      const ctx = createMockContext(mockUserId);
      const caller = subscriptionRouter.createCaller(ctx);

      const input = {
        paymentMethodId: 'pm_123456789',
        productId: 'prod_123',
        selectedPlan: 'standard',
        isAnnual: false,
      };

      await expect(caller.completeOnboarding(input)).rejects.toThrow('Failed to attach payment method to customer');

      // Verify onboarding was not completed
      expect(mockOnboardingService.completeOnboarding).not.toHaveBeenCalled();
    });

    it('should handle case when user is not found', async () => {
      const mockUserId = 'user_123';
      const mockOnboardingStatus = {
        isRequired: true,
        paymentMethodAdded: false,
      };

      // Setup mocks
      mockOnboardingService.getOnboardingStatus.mockResolvedValue(mockOnboardingStatus);
      mockUserService.findById.mockResolvedValue(null);

      const ctx = createMockContext(mockUserId);
      const caller = subscriptionRouter.createCaller(ctx);

      const input = {
        paymentMethodId: 'pm_123456789',
        productId: 'prod_123',
        selectedPlan: 'standard',
        isAnnual: false,
      };

      await expect(caller.completeOnboarding(input)).rejects.toThrow('User not found in database');
    });

    it('should handle onboarding already completed', async () => {
      const mockUserId = 'user_123';
      const mockOnboardingStatus = {
        isRequired: false,
        paymentMethodAdded: true,
        completedAt: new Date(),
      };

      // Setup mocks
      mockOnboardingService.getOnboardingStatus.mockResolvedValue(mockOnboardingStatus);

      const ctx = createMockContext(mockUserId);
      const caller = subscriptionRouter.createCaller(ctx);

      const input = {
        paymentMethodId: 'pm_123456789',
        productId: 'prod_123',
        selectedPlan: 'standard',
        isAnnual: false,
      };

      const result = await caller.completeOnboarding(input);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Onboarding already completed');
      expect(result.alreadyCompleted).toBe(true);

      // Verify no Stripe operations were performed
      expect(mockStripeService.createOrGetCustomer).not.toHaveBeenCalled();
      expect(mockStripeService.attachPaymentMethod).not.toHaveBeenCalled();
    });

    it('should properly format customer name from user data', async () => {
      const testCases = [
        {
          user: { first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
          expectedName: 'John Doe'
        },
        {
          user: { first_name: 'John', last_name: null, email: 'john@example.com' },
          expectedName: 'John'
        },
        {
          user: { first_name: null, last_name: 'Doe', email: 'john@example.com' },
          expectedName: 'john@example.com'
        },
        {
          user: { first_name: null, last_name: null, email: 'john@example.com' },
          expectedName: 'john@example.com'
        }
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const mockUserId = 'user_123';
        const mockUser = {
          id: mockUserId,
          email: testCase.user.email,
          first_name: testCase.user.first_name,
          last_name: testCase.user.last_name,
          stripe_customer_id: null,
        };
        const mockStripeCustomer = { id: 'cus_123456789' };
        const mockOnboardingStatus = { isRequired: true, paymentMethodAdded: false };
        const mockVerificationStatus = { isRequired: false, completedAt: new Date() };
        const mockIntegrity = { isValid: true };

        // Setup mocks
        mockOnboardingService.getOnboardingStatus.mockResolvedValue(mockOnboardingStatus);
        mockUserService.findById.mockResolvedValue(mockUser);
        mockStripeService.createOrGetCustomer.mockResolvedValue(mockStripeCustomer);
        mockUserService.update.mockResolvedValue({ ...mockUser, stripe_customer_id: mockStripeCustomer.id });
        mockStripeService.attachPaymentMethod.mockResolvedValue({});
        mockStripeService.setDefaultPaymentMethod.mockResolvedValue({});
        mockOnboardingService.completeOnboarding.mockResolvedValue(true);
        mockOnboardingService.getOnboardingStatus.mockResolvedValueOnce(mockOnboardingStatus)
          .mockResolvedValueOnce(mockVerificationStatus);
        mockOnboardingService.validateOnboardingIntegrity.mockResolvedValue(mockIntegrity);

        const ctx = createMockContext(mockUserId);
        const caller = subscriptionRouter.createCaller(ctx);

        const input = {
          paymentMethodId: 'pm_123456789',
          productId: 'prod_123',
          selectedPlan: 'standard',
          isAnnual: false,
        };

        await caller.completeOnboarding(input);

        expect(mockStripeService.createOrGetCustomer).toHaveBeenCalledWith({
          email: testCase.user.email,
          name: testCase.expectedName,
          userId: mockUserId,
        });
      }
    });
  });
});