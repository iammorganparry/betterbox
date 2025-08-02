import { eq, and } from "drizzle-orm";
import type { db } from "~/db";
import { users } from "~/db/schema";

export interface OnboardingStatus {
  isRequired: boolean;
  isCompleted: boolean;
  completedAt: Date | null;
  paymentMethodAdded: boolean;
  userId: string;
}

export class OnboardingService {
  constructor(private drizzleDb: typeof db) {}

  /**
   * Get onboarding status for a user
   * This is the single source of truth for onboarding completion
   */
  async getOnboardingStatus(userId: string): Promise<OnboardingStatus | null> {
    if (!userId) {
      return null;
    }

    const result = await this.drizzleDb
      .select({
        onboarding_required: users.onboarding_required,
        onboarding_completed_at: users.onboarding_completed_at,
        payment_method_added: users.payment_method_added,
        is_deleted: users.is_deleted,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.is_deleted, false)))
      .limit(1);

    const user = result[0];
    if (!user) {
      return null;
    }

    return {
      isRequired: user.onboarding_required,
      isCompleted: !user.onboarding_required && !!user.onboarding_completed_at,
      completedAt: user.onboarding_completed_at,
      paymentMethodAdded: user.payment_method_added,
      userId,
    };
  }

  /**
   * Check if user requires onboarding completion
   * Returns true if user must complete onboarding
   */
  async requiresOnboarding(userId: string): Promise<boolean> {
    const status = await this.getOnboardingStatus(userId);
    if (!status) {
      // User not found or deleted - require onboarding
      return true;
    }

    // User requires onboarding if:
    // 1. onboarding_required is true
    // 2. OR payment method has not been added
    return status.isRequired || !status.paymentMethodAdded;
  }

  /**
   * Mark onboarding as completed
   * This is called when user adds payment method (final step)
   */
  async completeOnboarding(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    try {
      const result = await this.drizzleDb
        .update(users)
        .set({
          onboarding_required: false,
          onboarding_completed_at: new Date(),
          payment_method_added: true,
          updated_at: new Date(),
        })
        .where(and(eq(users.id, userId), eq(users.is_deleted, false)))
        .returning({ id: users.id });

      return result.length > 0;
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      return false;
    }
  }

  /**
   * Mark payment method as added
   * This is the key step that allows access to the app
   */
  async markPaymentMethodAdded(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    try {
      const result = await this.drizzleDb
        .update(users)
        .set({
          payment_method_added: true,
          updated_at: new Date(),
        })
        .where(and(eq(users.id, userId), eq(users.is_deleted, false)))
        .returning({ id: users.id });

      return result.length > 0;
    } catch (error) {
      console.error("Failed to mark payment method added:", error);
      return false;
    }
  }

  /**
   * Reset onboarding status (for testing or admin purposes)
   */
  async resetOnboarding(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    try {
      const result = await this.drizzleDb
        .update(users)
        .set({
          onboarding_required: true,
          onboarding_completed_at: null,
          payment_method_added: false,
          updated_at: new Date(),
        })
        .where(and(eq(users.id, userId), eq(users.is_deleted, false)))
        .returning({ id: users.id });

      return result.length > 0;
    } catch (error) {
      console.error("Failed to reset onboarding:", error);
      return false;
    }
  }

  /**
   * Validate onboarding completion integrity
   * Ensures data consistency
   */
  async validateOnboardingIntegrity(userId: string): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const status = await this.getOnboardingStatus(userId);
    if (!status) {
      return {
        isValid: false,
        issues: ["User not found"],
      };
    }

    const issues: string[] = [];

    // If onboarding is marked as not required, payment method should be added
    if (!status.isRequired && !status.paymentMethodAdded) {
      issues.push("Onboarding marked complete but payment method not added");
    }

    // If payment method is added, onboarding should be complete
    if (status.paymentMethodAdded && status.isRequired) {
      issues.push("Payment method added but onboarding still required");
    }

    // If onboarding is complete, should have completion date
    if (!status.isRequired && !status.completedAt) {
      issues.push("Onboarding complete but no completion date");
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}