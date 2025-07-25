import type { Prisma, PrismaClient } from "../../../generated/prisma";

// Note: These types will be available after running Prisma migration
type Subscription = Prisma.SubscriptionGetPayload<{
	include: {
		user: true;
		PaymentMethod: true;
	};
}>;
type PaymentMethod = Prisma.PaymentMethodGetPayload<{
	include: {
		subscription: true;
	};
}>;

type SubscriptionPlan =
	| "FREE"
	| "STARTER"
	| "PROFESSIONAL"
	| "ENTERPRISE"
	| "GOLD";
type SubscriptionStatus =
	| "ACTIVE"
	| "CANCELED"
	| "PAST_DUE"
	| "UNPAID"
	| "TRIALING"
	| "INCOMPLETE"
	| "INCOMPLETE_EXPIRED";

export class SubscriptionService {
	constructor(private db: PrismaClient) {}

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
		return this.db.subscription.upsert({
			where: {
				user_id: data.userId,
			},
			update: {
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
			create: {
				user_id: data.userId,
				plan: data.plan,
				status: data.status,
				stripe_subscription_id: data.stripeSubscriptionId,
				stripe_customer_id: data.stripeCustomerId,
				current_period_start: data.currentPeriodStart,
				current_period_end: data.currentPeriodEnd,
				trial_start: data.trialStart,
				trial_end: data.trialEnd,
			},
			include: {
				user: true,
				PaymentMethod: true,
			},
		});
	}

	/**
	 * Get active subscription for a user
	 */
	async getActiveSubscription(userId: string): Promise<Subscription | null> {
		return this.db.subscription.findFirst({
			where: {
				user_id: userId,
				is_deleted: false,
				status: {
					in: ["ACTIVE", "TRIALING"],
				},
			},
			include: {
				user: true,
				PaymentMethod: true,
			},
			orderBy: {
				created_at: "desc",
			},
		});
	}

	/**
	 * Get subscription for a user
	 */
	async getUserSubscription(userId: string): Promise<Subscription | null> {
		return this.db.subscription.findUnique({
			where: {
				user_id: userId,
			},
			include: {
				user: true,
				PaymentMethod: true,
			},
		});
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
		return this.db.subscription.update({
			where: {
				id: subscriptionId,
			},
			data: {
				plan: data.plan,
				status: data.status,
				stripe_subscription_id: data.stripeSubscriptionId,
				current_period_start: data.currentPeriodStart,
				current_period_end: data.currentPeriodEnd,
				trial_end: data.trialEnd,
				cancel_at_period_end: data.cancelAtPeriodEnd,
				canceled_at: data.canceledAt,
				updated_at: new Date(),
			},
			include: {
				user: true,
				PaymentMethod: true,
			},
		});
	}

	/**
	 * Cancel subscription (soft delete)
	 */
	async cancelSubscription(subscriptionId: string): Promise<Subscription> {
		return this.db.subscription.update({
			where: {
				id: subscriptionId,
			},
			data: {
				status: "CANCELED",
				canceled_at: new Date(),
				updated_at: new Date(),
			},
			include: {
				user: true,
				PaymentMethod: true,
			},
		});
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
			await this.db.paymentMethod.updateMany({
				where: {
					subscription_id: data.subscriptionId,
					is_deleted: false,
				},
				data: {
					is_default: false,
				},
			});
		}

		return this.db.paymentMethod.create({
			data: {
				subscription_id: data.subscriptionId,
				stripe_payment_method_id: data.stripePaymentMethodId,
				type: data.type,
				card_brand: data.cardBrand,
				card_last4: data.cardLast4,
				card_exp_month: data.cardExpMonth,
				card_exp_year: data.cardExpYear,
				is_default: data.isDefault ?? false,
			},
			include: {
				subscription: true,
			},
		});
	}

	/**
	 * Get payment methods for subscription
	 */
	async getPaymentMethods(subscriptionId: string): Promise<PaymentMethod[]> {
		return this.db.paymentMethod.findMany({
			where: {
				subscription_id: subscriptionId,
				is_deleted: false,
			},
			include: {
				subscription: true,
			},
			orderBy: [
				{
					is_default: "desc",
				},
				{
					created_at: "desc",
				},
			],
		});
	}

	/**
	 * Check if user has an active trial
	 */
	async hasActiveTrial(userId: string): Promise<boolean> {
		const subscription = await this.db.subscription.findFirst({
			where: {
				user_id: userId,
				is_deleted: false,
				trial_end: {
					gte: new Date(),
				},
			},
		});

		return !!subscription;
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

		return this.db.subscription.findMany({
			where: {
				status: "TRIALING",
				trial_end: {
					lte: cutoffDate,
				},
				is_deleted: false,
			},
			include: {
				user: true,
				PaymentMethod: true,
			},
		});
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
}
