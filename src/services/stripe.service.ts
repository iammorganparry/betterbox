import Stripe from "stripe";
import { env } from "~/env";

export class StripeService {
	private stripe: Stripe;

	constructor() {
		this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
			apiVersion: "2025-06-30.basil",
		});
	}

	/**
	 * Create or retrieve a Stripe customer
	 */
	async createOrGetCustomer(data: {
		email: string;
		name?: string;
		userId: string;
	}): Promise<Stripe.Customer> {
		// First try to find existing customer by email
		const existingCustomers = await this.stripe.customers.list({
			email: data.email,
			limit: 1,
		});

		if (existingCustomers.data.length > 0) {
			const customer = existingCustomers.data[0];
			if (customer) {
				return customer;
			}
		}

		// Create new customer if none exists
		return this.stripe.customers.create({
			email: data.email,
			name: data.name,
			metadata: {
				userId: data.userId,
			},
		});
	}

	/**
	 * Create a setup intent for collecting payment method
	 */
	async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
		return this.stripe.setupIntents.create({
			customer: customerId,
			usage: "off_session",
			payment_method_types: ["card"],
		});
	}

	/**
	 * Get payment methods for a customer
	 */
	async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
		const paymentMethods = await this.stripe.paymentMethods.list({
			customer: customerId,
			type: "card",
		});

		return paymentMethods.data;
	}

	/**
	 * Create a subscription with trial period
	 */
	async createSubscription(data: {
		customerId: string;
		priceId: string;
		paymentMethodId?: string;
		trialPeriodDays?: number;
	}): Promise<Stripe.Subscription> {
		const subscriptionData: Stripe.SubscriptionCreateParams = {
			customer: data.customerId,
			items: [{ price: data.priceId }],
			payment_behavior: "default_incomplete",
			payment_settings: {
				save_default_payment_method: "on_subscription",
			},
			expand: ["latest_invoice.payment_intent"],
		};

		if (data.paymentMethodId) {
			subscriptionData.default_payment_method = data.paymentMethodId;
		}

		if (data.trialPeriodDays) {
			subscriptionData.trial_period_days = data.trialPeriodDays;
		}

		return this.stripe.subscriptions.create(subscriptionData);
	}

	/**
	 * Update subscription
	 */
	async updateSubscription(
		subscriptionId: string,
		data: {
			priceId?: string;
			paymentMethodId?: string;
			cancelAtPeriodEnd?: boolean;
		},
	): Promise<Stripe.Response<Stripe.Subscription>> {
		const updateData: Stripe.SubscriptionUpdateParams = {};

		if (data.priceId) {
			// Get current subscription to update items
			const subscription =
				await this.stripe.subscriptions.retrieve(subscriptionId);
			updateData.items = [
				{
					id: subscription.items.data[0]?.id,
					price: data.priceId,
				},
			];
		}

		if (data.paymentMethodId) {
			updateData.default_payment_method = data.paymentMethodId;
		}

		if (data.cancelAtPeriodEnd !== undefined) {
			updateData.cancel_at_period_end = data.cancelAtPeriodEnd;
		}

		return this.stripe.subscriptions.update(subscriptionId, updateData);
	}

	/**
	 * Cancel subscription
	 */
	async cancelSubscription(
		subscriptionId: string,
	): Promise<Stripe.Subscription> {
		return this.stripe.subscriptions.cancel(subscriptionId);
	}

	/**
	 * Get subscription
	 */
	async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
		return this.stripe.subscriptions.retrieve(subscriptionId);
	}

	/**
	 * Get price information
	 */
	async getPrice(priceId: string): Promise<Stripe.Price> {
		return this.stripe.prices.retrieve(priceId);
	}

	/**
	 * Create prices for plans (run this once to set up your pricing)
	 */
	async createPlanPrices() {
		const plans = [
			{
				nickname: "Starter Monthly",
				unit_amount: 2900, // $29.00
				currency: "usd",
				recurring: { interval: "month" as const },
				product_data: {
					name: "Starter Plan",
					description: "Perfect for growing professionals",
				},
			},
			{
				nickname: "Starter Annual",
				unit_amount: 26100, // $261.00 (10% discount)
				currency: "usd",
				recurring: { interval: "year" as const },
				product_data: {
					name: "Starter Plan (Annual)",
					description: "Perfect for growing professionals - Annual billing",
				},
			},
			{
				nickname: "Professional Monthly",
				unit_amount: 7900, // $79.00
				currency: "usd",
				recurring: { interval: "month" as const },
				product_data: {
					name: "Professional Plan",
					description: "For teams and growing businesses",
				},
			},
			{
				nickname: "Professional Annual",
				unit_amount: 71100, // $711.00 (10% discount)
				currency: "usd",
				recurring: { interval: "year" as const },
				product_data: {
					name: "Professional Plan (Annual)",
					description: "For teams and growing businesses - Annual billing",
				},
			},
			{
				nickname: "Enterprise Monthly",
				unit_amount: 19900, // $199.00
				currency: "usd",
				recurring: { interval: "month" as const },
				product_data: {
					name: "Enterprise Plan",
					description: "Advanced features for large organizations",
				},
			},
			{
				nickname: "Enterprise Annual",
				unit_amount: 179100, // $1791.00 (10% discount)
				currency: "usd",
				recurring: { interval: "year" as const },
				product_data: {
					name: "Enterprise Plan (Annual)",
					description:
						"Advanced features for large organizations - Annual billing",
				},
			},
		];

		const createdPrices = [];
		for (const plan of plans) {
			const price = await this.stripe.prices.create(plan);
			createdPrices.push(price);
		}

		return createdPrices;
	}

	/**
	 * Handle Stripe webhook events
	 */
	async handleWebhookEvent(
		payload: string | Buffer,
		signature: string,
	): Promise<Stripe.Event> {
		const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
		if (!webhookSecret) {
			throw new Error("Stripe webhook secret not configured");
		}

		return this.stripe.webhooks.constructEvent(
			payload,
			signature,
			webhookSecret,
		);
	}

	/**
	 * Get payment method
	 */
	async getPaymentMethod(
		paymentMethodId: string,
	): Promise<Stripe.PaymentMethod> {
		return this.stripe.paymentMethods.retrieve(paymentMethodId);
	}

	/**
	 * Attach payment method to customer
	 */
	async attachPaymentMethod(
		paymentMethodId: string,
		customerId: string,
	): Promise<Stripe.PaymentMethod> {
		return this.stripe.paymentMethods.attach(paymentMethodId, {
			customer: customerId,
		});
	}

	/**
	 * Set default payment method for customer
	 */
	async setDefaultPaymentMethod(
		customerId: string,
		paymentMethodId: string,
	): Promise<Stripe.Customer> {
		return this.stripe.customers.update(customerId, {
			invoice_settings: {
				default_payment_method: paymentMethodId,
			},
		});
	}
}
