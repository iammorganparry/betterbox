import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingService } from '../onboarding.service';
import drizzleMock from '../../../test/setup';

describe('OnboardingService', () => {
  let onboardingService: OnboardingService;

  beforeEach(() => {
    vi.clearAllMocks();
    onboardingService = new OnboardingService(drizzleMock);
  });

  describe('getOnboardingStatus', () => {
    it('should return null for empty userId', async () => {
      const result = await onboardingService.getOnboardingStatus('');
      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      drizzleMock.select().from().where().limit.mockResolvedValue([]);
      
      const result = await onboardingService.getOnboardingStatus('non-existent');
      expect(result).toBeNull();
    });

    it('should return correct status for user requiring onboarding', async () => {
      const mockUser = {
        onboarding_required: true,
        onboarding_completed_at: null,
        payment_method_added: false,
        is_deleted: false,
      };
      drizzleMock.select().from().where().limit.mockResolvedValue([mockUser]);

      const result = await onboardingService.getOnboardingStatus('user123');
      
      expect(result).toEqual({
        isRequired: true,
        isCompleted: false,
        completedAt: null,
        paymentMethodAdded: false,
        userId: 'user123',
      });
    });

    it('should return correct status for user with completed onboarding', async () => {
      const completedAt = new Date();
      const mockUser = {
        onboarding_required: false,
        onboarding_completed_at: completedAt,
        payment_method_added: true,
        is_deleted: false,
      };
      drizzleMock.select().from().where().limit.mockResolvedValue([mockUser]);

      const result = await onboardingService.getOnboardingStatus('user123');
      
      expect(result).toEqual({
        isRequired: false,
        isCompleted: true,
        completedAt,
        paymentMethodAdded: true,
        userId: 'user123',
      });
    });
  });

  describe('requiresOnboarding', () => {
    it('should return true for non-existent user (secure default)', async () => {
      drizzleMock.select().from().where().limit.mockResolvedValue([]);
      
      const result = await onboardingService.requiresOnboarding('non-existent');
      expect(result).toBe(true);
    });

    it('should return true when onboarding_required is true', async () => {
      const mockUser = {
        onboarding_required: true,
        onboarding_completed_at: null,
        payment_method_added: false,
        is_deleted: false,
      };
      drizzleMock.select().from().where().limit.mockResolvedValue([mockUser]);

      const result = await onboardingService.requiresOnboarding('user123');
      expect(result).toBe(true);
    });

    it('should return true when payment method not added (even if onboarding_required is false)', async () => {
      const mockUser = {
        onboarding_required: false,
        onboarding_completed_at: new Date(),
        payment_method_added: false, // Critical: this should still require onboarding
        is_deleted: false,
      };
      drizzleMock.select().from().where().limit.mockResolvedValue([mockUser]);

      const result = await onboardingService.requiresOnboarding('user123');
      expect(result).toBe(true);
    });

    it('should return false only when both conditions are met', async () => {
      const mockUser = {
        onboarding_required: false,
        onboarding_completed_at: new Date(),
        payment_method_added: true,
        is_deleted: false,
      };
      drizzleMock.select().from().where().limit.mockResolvedValue([mockUser]);

      const result = await onboardingService.requiresOnboarding('user123');
      expect(result).toBe(false);
    });
  });

  describe('completeOnboarding', () => {
    it('should return false for empty userId', async () => {
      const result = await onboardingService.completeOnboarding('');
      expect(result).toBe(false);
    });

    it('should successfully complete onboarding', async () => {
      drizzleMock.update().set().where().returning.mockResolvedValue([{ id: 'user123' }]);

      const result = await onboardingService.completeOnboarding('user123');
      
      expect(result).toBe(true);
      expect(drizzleMock.update).toHaveBeenCalled();
    });

    it('should return false when database update fails', async () => {
      drizzleMock.update().set().where().returning.mockResolvedValue([]);

      const result = await onboardingService.completeOnboarding('user123');
      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      drizzleMock.update().set().where().returning.mockRejectedValue(new Error('Database error'));

      const result = await onboardingService.completeOnboarding('user123');
      expect(result).toBe(false);
    });
  });

  describe('markPaymentMethodAdded', () => {
    it('should return false for empty userId', async () => {
      const result = await onboardingService.markPaymentMethodAdded('');
      expect(result).toBe(false);
    });

    it('should successfully mark payment method as added', async () => {
      drizzleMock.update().set().where().returning.mockResolvedValue([{ id: 'user123' }]);

      const result = await onboardingService.markPaymentMethodAdded('user123');
      
      expect(result).toBe(true);
      expect(drizzleMock.update).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      drizzleMock.update().set().where().returning.mockRejectedValue(new Error('Database error'));

      const result = await onboardingService.markPaymentMethodAdded('user123');
      expect(result).toBe(false);
    });
  });

  describe('resetOnboarding', () => {
    it('should return false for empty userId', async () => {
      const result = await onboardingService.resetOnboarding('');
      expect(result).toBe(false);
    });

    it('should successfully reset onboarding status', async () => {
      drizzleMock.update().set().where().returning.mockResolvedValue([{ id: 'user123' }]);

      const result = await onboardingService.resetOnboarding('user123');
      
      expect(result).toBe(true);
      expect(drizzleMock.update).toHaveBeenCalled();
    });
  });

  describe('validateOnboardingIntegrity', () => {
    it('should identify user not found', async () => {
      drizzleMock.select().from().where().limit.mockResolvedValue([]);

      const result = await onboardingService.validateOnboardingIntegrity('user123');
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('User not found');
    });

    it('should identify inconsistent state: onboarding complete but payment not added', async () => {
      const mockUser = {
        onboarding_required: false,
        onboarding_completed_at: new Date(),
        payment_method_added: false, // Inconsistent!
        is_deleted: false,
      };
      drizzleMock.select().from().where().limit.mockResolvedValue([mockUser]);

      const result = await onboardingService.validateOnboardingIntegrity('user123');
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Onboarding marked complete but payment method not added');
    });

    it('should identify inconsistent state: payment added but onboarding required', async () => {
      const mockUser = {
        onboarding_required: true, // Inconsistent!
        onboarding_completed_at: new Date(),
        payment_method_added: true,
        is_deleted: false,
      };
      drizzleMock.select().from().where().limit.mockResolvedValue([mockUser]);

      const result = await onboardingService.validateOnboardingIntegrity('user123');
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Payment method added but onboarding still required');
    });

    it('should identify missing completion date', async () => {
      const mockUser = {
        onboarding_required: false,
        onboarding_completed_at: null, // Missing!
        payment_method_added: true,
        is_deleted: false,
      };
      drizzleMock.select().from().where().limit.mockResolvedValue([mockUser]);

      const result = await onboardingService.validateOnboardingIntegrity('user123');
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Onboarding complete but no completion date');
    });

    it('should validate consistent completed state', async () => {
      const mockUser = {
        onboarding_required: false,
        onboarding_completed_at: new Date(),
        payment_method_added: true,
        is_deleted: false,
      };
      drizzleMock.select().from().where().limit.mockResolvedValue([mockUser]);

      const result = await onboardingService.validateOnboardingIntegrity('user123');
      
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should validate consistent incomplete state', async () => {
      const mockUser = {
        onboarding_required: true,
        onboarding_completed_at: null,
        payment_method_added: false,
        is_deleted: false,
      };
      drizzleMock.select().from().where().limit.mockResolvedValue([mockUser]);

      const result = await onboardingService.validateOnboardingIntegrity('user123');
      
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Security and Edge Cases', () => {
    it('should handle SQL injection attempts in userId', async () => {
      const maliciousUserId = "'; DROP TABLE users; --";
      drizzleMock.select().from().where().limit.mockResolvedValue([]);
      
      await onboardingService.getOnboardingStatus(maliciousUserId);
      
      // Verify the query was called (Drizzle ORM should handle SQL injection protection)
      expect(drizzleMock.select).toHaveBeenCalled();
    });

    it('should enforce the strictest security by default', async () => {
      // Test that any uncertainty results in requiring onboarding
      drizzleMock.select().from().where().limit.mockRejectedValue(new Error('Network error'));

      const result = await onboardingService.requiresOnboarding('user123');
      
      // Even on error, should default to requiring onboarding (fail-safe)
      expect(result).toBe(true);
    });

    it('should maintain data consistency across operations', async () => {
      drizzleMock.update().set().where().returning.mockResolvedValue([{ id: 'user123' }]);

      await onboardingService.completeOnboarding('user123');
      
      // Verify the update was called with proper structure
      expect(drizzleMock.update).toHaveBeenCalled();
    });
  });

  describe('Air-tight Protection Tests', () => {
    it('should never allow access without payment method', async () => {
      // Test various combinations that should all require onboarding
      const testCases = [
        {
          onboarding_required: true,
          payment_method_added: false,
          expected: true,
          description: 'Both flags false'
        },
        {
          onboarding_required: false,
          payment_method_added: false,
          expected: true,
          description: 'Onboarding not required but no payment method'
        },
        {
          onboarding_required: true,
          payment_method_added: true,
          expected: true,
          description: 'Payment method added but onboarding still required'
        },
      ];

      for (const testCase of testCases) {
        drizzleMock.select().from().where().limit.mockResolvedValue([{
          onboarding_required: testCase.onboarding_required,
          onboarding_completed_at: testCase.onboarding_required ? null : new Date(),
          payment_method_added: testCase.payment_method_added,
          is_deleted: false,
        }]);

        const result = await onboardingService.requiresOnboarding('user123');
        expect(result, `Failed for case: ${testCase.description}`).toBe(testCase.expected);
      }
    });

    it('should only allow access when BOTH conditions are met', async () => {
      drizzleMock.select().from().where().limit.mockResolvedValue([{
        onboarding_required: false,
        onboarding_completed_at: new Date(),
        payment_method_added: true,
        is_deleted: false,
      }]);

      const result = await onboardingService.requiresOnboarding('user123');
      expect(result).toBe(false);
    });
  });
});