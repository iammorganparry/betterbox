import { and, count, desc, eq, getTableColumns, gt, lt } from "drizzle-orm";
import type { db } from "~/db";
import { paymentMethods, subscriptions, type users } from "~/db/schema";

// Use Drizzle's inferred types
export type Subscription = typeof subscriptions.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type CreateSubscriptionData = typeof subscriptions.$inferInsert;
export type UpdateSubscriptionData = Partial<CreateSubscriptionData>;

// Subscription with relationships
export type SubscriptionWithUser = Subscription & {
	user: typeof users.$inferSelect;
};

export type SubscriptionWithPaymentMethod = Subscription & {
	paymentMethod: PaymentMethod[];
};

export type SubscriptionPlan =
	| "FREE"
	| "STARTER"
	| "PROFESSIONAL"
	| "ENTERPRISE"
	| "GOLD";
export type SubscriptionStatus =
	| "ACTIVE"
	| "CANCELED"
	| "PAST_DUE"
	| "UNPAID"
	| "TRIALING"
	| "INCOMPLETE"
	| "INCOMPLETE_EXPIRED";

export class SubscriptionService {
	constructor(private drizzleDb: typeof db) {}

	/**
	 * Create or update subscription for a user (upsert since only one subscription per user)
	 */
	async createOrUpdateSubscription(data: {
		userId: string;
		plan: SubscriptionPlan;
		status: SubscriptionStatus;
		stripeSubscriptionId?: string;
		stripeCustomerId?: string;
		currentPeriodStart?: Date;
		currentPeriodEnd?: Date;
		trialStart?: Date;
		trialEnd?: Date;
	}): Promise<Subscription> {
		const result = await this.drizzleDb
			.insert(subscriptions)
			.values({
				user_id: data.userId,
				plan: data.plan,
				status: data.status,
				stripe_subscription_id: data.stripeSubscriptionId,
				stripe_customer_id: data.stripeCustomerId,
				current_period_start: data.currentPeriodStart,
				current_period_end: data.currentPeriodEnd,
				trial_start: data.trialStart,
				trial_end: data.trialEnd,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.onConflictDoUpdate({
				target: [subscriptions.user_id],
				set: {
					plan: data.plan,
					status: data.status,
					stripe_subscription_id: data.stripeSubscriptionId,
					stripe_customer_id: data.stripeCustomerId,
					current_period_start: data.currentPeriodStart,
					current_period_end: data.currentPeriodEnd,
					trial_start: data.trialStart,
					trial_end: data.trialEnd,
					updated_at: new Date(),
				},
			})
			.returning();

		if (!result[0]) {
			throw new Error("Failed to create or update subscription");
		}

		return result[0];
	}

	/**
	 * Get active subscription for a user
	 */
	async getActiveSubscription(userId: string): Promise<Subscription | null> {
		const result = await this.drizzleDb
			.select()
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.user_id, userId),
					eq(subscriptions.is_deleted, false),
					eq(subscriptions.status, "ACTIVE"),
				),
			);

		if (!result[0]) {
			throw new Error("Subscription not found");
		}

		return result[0];
	}

	/**
	 * Get subscription for a user
	 */
	async getUserSubscription(userId: string): Promise<Subscription | null> {
		const result = await this.drizzleDb
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.user_id, userId));

		if (!result[0]) {
			throw new Error("Subscription not found");
		}

		return result[0];
	}

	/**
	 * Update subscription
	 */
	async updateSubscription(
		subscriptionId: string,
		data: Partial<{
			plan: SubscriptionPlan;
			status: SubscriptionStatus;
			stripeSubscriptionId: string;
			currentPeriodStart: Date;
			currentPeriodEnd: Date;
			trialEnd: Date;
			cancelAtPeriodEnd: boolean;
			canceledAt: Date;
		}>,
	): Promise<Subscription> {
		const result = await this.drizzleDb
			.update(subscriptions)
			.set({
				plan: data.plan,
				status: data.status,
				stripe_subscription_id: data.stripeSubscriptionId,
				current_period_start: data.currentPeriodStart,
				current_period_end: data.currentPeriodEnd,
				trial_end: data.trialEnd,
				cancel_at_period_end: data.cancelAtPeriodEnd,
				canceled_at: data.canceledAt,
				updated_at: new Date(),
			})
			.where(eq(subscriptions.id, subscriptionId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to update subscription");
		}

		return result[0];
	}

	/**
	 * Cancel subscription (soft delete)
	 */
	async cancelSubscription(subscriptionId: string): Promise<Subscription> {
		const result = await this.drizzleDb
			.update(subscriptions)
			.set({
				status: "CANCELED",
				canceled_at: new Date(),
				updated_at: new Date(),
			})
			.where(eq(subscriptions.id, subscriptionId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to cancel subscription");
		}

		return result[0];
	}

	/**
	 * Cancel subscription at period end
	 */
	async cancelSubscriptionAtPeriodEnd(
		subscriptionId: string,
		cancelAtPeriodEnd: boolean,
		canceledAt: Date,
	): Promise<Subscription> {
		const result = await this.drizzleDb
			.update(subscriptions)
			.set({
				status: "CANCELED",
				cancel_at_period_end: cancelAtPeriodEnd,
				canceled_at: canceledAt,
				updated_at: new Date(),
			})
			.where(eq(subscriptions.id, subscriptionId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to cancel subscription");
		}

		return result[0];
	}

	/**
	 * Add payment method to subscription
	 */
	async addPaymentMethod(data: {
		subscriptionId: string;
		stripePaymentMethodId: string;
		type: string;
		cardBrand?: string;
		cardLast4?: string;
		cardExpMonth?: number;
		cardExpYear?: number;
		isDefault?: boolean;
	}): Promise<PaymentMethod> {
		// If this is the default payment method, unset others
		if (data.isDefault) {
			await this.drizzleDb
				.update(paymentMethods)
				.set({
					is_default: false,
				})
				.where(eq(paymentMethods.subscription_id, data.subscriptionId));
		}

		const result = await this.drizzleDb
			.insert(paymentMethods)
			.values({
				subscription_id: data.subscriptionId,
				stripe_payment_method_id: data.stripePaymentMethodId,
				type: data.type,
				card_brand: data.cardBrand,
				card_last4: data.cardLast4,
				card_exp_month: data.cardExpMonth,
				card_exp_year: data.cardExpYear,
				is_default: data.isDefault ?? false,
			})
			.returning();

		if (!result[0]) {
			throw new Error("Failed to add payment method");
		}

		return result[0];
	}

	/**
	 * Get payment methods for subscription
	 */
	async getPaymentMethods(subscriptionId: string): Promise<PaymentMethod[]> {
		const result = await this.drizzleDb
			.select()
			.from(paymentMethods)
			.where(eq(paymentMethods.subscription_id, subscriptionId));

		if (!result[0]) {
			throw new Error("Failed to get payment methods");
		}

		return result;
	}

	/**
	 * Check if user has an active trial
	 */
	async hasActiveTrial(userId: string): Promise<boolean> {
		const subscription = await this.drizzleDb
			.select()
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.user_id, userId),
					eq(subscriptions.is_deleted, false),
					gt(subscriptions.trial_end, new Date()),
				),
			);

		return !!subscription[0];
	}

	/**
	 * Create 7-day gold trial subscription
	 */
	async createGoldTrial(userId: string): Promise<Subscription> {
		const trialStart = new Date();
		const trialEnd = new Date();
		trialEnd.setDate(trialEnd.getDate() + 7); // 7 days from now

		return this.createOrUpdateSubscription({
			userId,
			plan: "GOLD",
			status: "TRIALING",
			trialStart,
			trialEnd,
		});
	}

	/**
	 * Get subscriptions that need to transition from trial to paid
	 */
	async getTrialsEndingSoon(hours = 24): Promise<Subscription[]> {
		const cutoffDate = new Date();
		cutoffDate.setHours(cutoffDate.getHours() + hours);

		const result = await this.drizzleDb
			.select()
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.status, "TRIALING"),
					lt(subscriptions.trial_end, cutoffDate),
					eq(subscriptions.is_deleted, false),
				),
			);

		if (!result[0]) {
			throw new Error("Failed to get trials ending soon");
		}

		return result;
	}

	/**
	 * Transition trial to paid subscription
	 */
	async transitionTrialToPaid(
		subscriptionId: string,
		targetPlan: SubscriptionPlan,
		stripeSubscriptionId: string,
	): Promise<Subscription> {
		return this.updateSubscription(subscriptionId, {
			plan: targetPlan,
			status: "ACTIVE",
			stripeSubscriptionId,
		});
	}

	/**
	 * Check if user has access to Gold features (GOLD plan or higher)
	 */
	async hasGoldAccess(userId: string): Promise<boolean> {
		const subscription = await this.getActiveSubscription(userId);

		if (!subscription) {
			return false;
		}

		// Define plan hierarchy (higher number = higher tier)
		const planHierarchy: Record<SubscriptionPlan, number> = {
			FREE: 0,
			STARTER: 1,
			PROFESSIONAL: 2,
			ENTERPRISE: 3,
			GOLD: 4,
		};

		const userPlanLevel = planHierarchy[subscription.plan];
		const goldLevel = planHierarchy.GOLD;

		return userPlanLevel >= goldLevel;
	}

	/**
	 * Check if user has access to a specific plan level or higher
	 */
	async hasAccessToPlan(
		userId: string,
		requiredPlan: SubscriptionPlan,
	): Promise<boolean> {
		const subscription = await this.getActiveSubscription(userId);

		if (!subscription) {
			return requiredPlan === "FREE";
		}

		// Define plan hierarchy (higher number = higher tier)
		const planHierarchy: Record<SubscriptionPlan, number> = {
			FREE: 0,
			STARTER: 1,
			PROFESSIONAL: 2,
			ENTERPRISE: 3,
			GOLD: 4,
		};

		const userPlanLevel = planHierarchy[subscription.plan];
		const requiredLevel = planHierarchy[requiredPlan];

		return userPlanLevel >= requiredLevel;
	}

	/**
	 * Get user's current plan or FREE if no subscription
	 */
	async getUserPlan(userId: string): Promise<SubscriptionPlan> {
		const subscription = await this.getActiveSubscription(userId);
		return subscription?.plan || "FREE";
	}
}
