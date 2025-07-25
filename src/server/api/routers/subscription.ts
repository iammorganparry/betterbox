import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { getAllPlanLimits } from "~/config/contact-limits.config";

// TODO: This router will work after running the Prisma migration and updating UserService
export const subscriptionRouter = createTRPCRouter({
	/**
	 * Get user's current subscription
	 */
	getSubscription: protectedProcedure.query(async ({ ctx }) => {
		const { subscriptionService } = ctx.services;
		if (!ctx.userId) {
			throw new Error("User not authenticated");
		}
		return subscriptionService.getUserSubscription(ctx.userId);
	}),

	/**
	 * Create Stripe customer and setup intent for payment collection
	 */
	createSetupIntent: protectedProcedure
		.input(
			z.object({
				email: z.string().email(),
				name: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { stripeService, userService, subscriptionService } = ctx.services;

			// Create or get Stripe customer
			const customer = await stripeService.createOrGetCustomer({
				email: input.email,
				name: input.name,
				userId: ctx.userId!,
			});

			// Update user with Stripe customer ID
			await userService.updateUser(ctx.userId!, {
				stripe_customer_id: customer.id,
			});

			// Create setup intent for collecting payment method
			const setupIntent = await stripeService.createSetupIntent(customer.id);

			return {
				customerId: customer.id,
				clientSecret: setupIntent.client_secret,
			};
		}),

	/**
	 * Create subscription with plan selection and trial
	 */
	createSubscription: protectedProcedure
		.input(
			z.object({
				plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]),
				isAnnual: z.boolean().default(false),
				paymentMethodId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { subscriptionService, stripeService, userService } = ctx.services;

			// Get user's Stripe customer ID
			const user = await userService.findByClerkId(ctx.userId!);
			if (!user?.stripe_customer_id) {
				throw new Error("User must have a Stripe customer ID");
			}

			// Create 7-day Gold trial first
			const goldTrial = await subscriptionService.createGoldTrial(ctx.userId!);

			// Map plan and billing to Stripe price IDs (you'll need to create these in Stripe)
			const priceMapping = {
				STARTER: {
					monthly: "price_starter_monthly", // Replace with actual Stripe price IDs
					annual: "price_starter_annual",
				},
				PROFESSIONAL: {
					monthly: "price_professional_monthly",
					annual: "price_professional_annual",
				},
				ENTERPRISE: {
					monthly: "price_enterprise_monthly",
					annual: "price_enterprise_annual",
				},
			};

			const priceId = input.isAnnual
				? priceMapping[input.plan].annual
				: priceMapping[input.plan].monthly;

			// Create Stripe subscription (will start after trial ends)
			const stripeSubscription = await stripeService.createSubscription({
				customerId: user.stripe_customer_id,
				priceId,
				paymentMethodId: input.paymentMethodId,
				trialPeriodDays: 7, // 7-day trial
			});

			// Update local subscription with Stripe details
			const subscription = await subscriptionService.updateSubscription(
				goldTrial.id,
				{
					plan: input.plan,
					stripeSubscriptionId: stripeSubscription.id,
					currentPeriodStart: new Date(
						stripeSubscription.current_period_start * 1000,
					),
					currentPeriodEnd: new Date(
						stripeSubscription.current_period_end * 1000,
					),
				},
			);

			// Add payment method to subscription
			const paymentMethod = await stripeService.getPaymentMethod(
				input.paymentMethodId,
			);
			if (paymentMethod.card) {
				await subscriptionService.addPaymentMethod({
					subscriptionId: subscription.id,
					stripePaymentMethodId: input.paymentMethodId,
					type: "card",
					cardBrand: paymentMethod.card.brand,
					cardLast4: paymentMethod.card.last4,
					cardExpMonth: paymentMethod.card.exp_month,
					cardExpYear: paymentMethod.card.exp_year,
					isDefault: true,
				});
			}

			return {
				subscription,
				stripeSubscription,
				message:
					"Subscription created successfully! You're on a 7-day Gold trial.",
			};
		}),

	/**
	 * Update subscription plan
	 */
	updatePlan: protectedProcedure
		.input(
			z.object({
				plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]),
				isAnnual: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { subscriptionService, stripeService } = ctx.services;

			const subscription = await subscriptionService.getUserSubscription(
				ctx.userId!,
			);
			if (!subscription?.stripe_subscription_id) {
				throw new Error("No active subscription found");
			}

			// Map to price ID (same as above)
			const priceMapping = {
				STARTER: {
					monthly: "price_starter_monthly",
					annual: "price_starter_annual",
				},
				PROFESSIONAL: {
					monthly: "price_professional_monthly",
					annual: "price_professional_annual",
				},
				ENTERPRISE: {
					monthly: "price_enterprise_monthly",
					annual: "price_enterprise_annual",
				},
			};

			const priceId = input.isAnnual
				? priceMapping[input.plan].annual
				: priceMapping[input.plan].monthly;

			// Update Stripe subscription
			const stripeSubscription = await stripeService.updateSubscription(
				subscription.stripe_subscription_id,
				{ priceId },
			);

			// Update local subscription
			const updatedSubscription = await subscriptionService.updateSubscription(
				subscription.id,
				{
					plan: input.plan,
					currentPeriodStart: new Date(
						stripeSubscription.current_period_start * 1000,
					),
					currentPeriodEnd: new Date(
						stripeSubscription.current_period_end * 1000,
					),
				},
			);

			return {
				subscription: updatedSubscription,
				message: "Plan updated successfully!",
			};
		}),

	/**
	 * Cancel subscription
	 */
	cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
		const { subscriptionService, stripeService } = ctx.services;

		const subscription = await subscriptionService.getUserSubscription(
			ctx.userId!,
		);
		if (!subscription?.stripe_subscription_id) {
			throw new Error("No active subscription found");
		}

		// Cancel in Stripe
		await stripeService.updateSubscription(
			subscription.stripe_subscription_id,
			{
				cancelAtPeriodEnd: true,
			},
		);

		// Update local subscription
		const canceledSubscription = await subscriptionService.updateSubscription(
			subscription.id,
			{
				cancelAtPeriodEnd: true,
			},
		);

		return {
			subscription: canceledSubscription,
			message:
				"Subscription will be canceled at the end of the current period.",
		};
	}),

	/**
	 * Get payment methods
	 */
	getPaymentMethods: protectedProcedure.query(async ({ ctx }) => {
		const { subscriptionService } = ctx.services;

		const subscription = await subscriptionService.getUserSubscription(
			ctx.userId!,
		);
		if (!subscription) {
			return [];
		}

		return subscriptionService.getPaymentMethods(subscription.id);
	}),

	/**
	 * Check trial status
	 */
	getTrialStatus: protectedProcedure.query(async ({ ctx }) => {
		const { subscriptionService } = ctx.services;

		const subscription = await subscriptionService.getUserSubscription(
			ctx.userId!,
		);
		if (!subscription) {
			return {
				hasTrial: false,
				isTrialing: false,
				trialEndsAt: null,
				daysRemaining: 0,
			};
		}

		const now = new Date();
		const isTrialing =
			subscription.status === "TRIALING" &&
			subscription.trial_end &&
			subscription.trial_end > now;

		const daysRemaining = subscription.trial_end
			? Math.max(
					0,
					Math.ceil(
						(subscription.trial_end.getTime() - now.getTime()) /
							(1000 * 60 * 60 * 24),
					),
				)
			: 0;

		return {
			hasTrial: !!subscription.trial_end,
			isTrialing,
			trialEndsAt: subscription.trial_end,
			daysRemaining,
			plan: subscription.plan,
		};
	}),

	/**
	 * Get contact limit status
	 */
	getContactLimitStatus: protectedProcedure.query(async ({ ctx }) => {
		const { contactLimitService } = ctx.services;

		const limitStatus = await contactLimitService.getContactLimitStatus(
			ctx.userId!,
		);

		return limitStatus;
	}),

	/**
	 * Get all subscription plans with their contact limits
	 * Public endpoint for pricing page
	 */
	getPlanLimits: publicProcedure.query(async () => {
		return getAllPlanLimits();
	}),
});
