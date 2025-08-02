import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";


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
				userId: ctx.userId,
			});

			// Update user with Stripe customer ID
			await userService.update(ctx.userId, {
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
			const user = await userService.findByClerkId(ctx.userId);
			if (!user?.stripe_customer_id) {
				throw new Error("User must have a Stripe customer ID");
			}

			// Create 7-day Gold trial first
			const goldTrial = await subscriptionService.createGoldTrial(ctx.userId);

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
						// @ts-expect-error - Stripe subscription type is not correct
						stripeSubscription.current_period_start * 1000,
					),
					currentPeriodEnd: new Date(
						// @ts-expect-error - Stripe subscription type is not correct
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
				ctx.userId,
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
						// @ts-expect-error - Stripe subscription type is not correct
						stripeSubscription.current_period_start * 1000,
					),
					currentPeriodEnd: new Date(
						// @ts-expect-error - Stripe subscription type is not correct
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
			ctx.userId,
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
			ctx.userId,
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
			ctx.userId,
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
	 * Get onboarding status - used for client-side enforcement
	 */
	getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
		const { onboardingService } = ctx.services;
		
		const status = await onboardingService.getOnboardingStatus(ctx.userId);
		
		if (!status) {
			// User not found - require onboarding for security
			return {
				isRequired: true,
				isCompleted: false,
				completedAt: null,
				paymentMethodAdded: false,
				requiresOnboarding: true,
			};
		}

		const requiresOnboarding = await onboardingService.requiresOnboarding(ctx.userId);

		return {
			...status,
			requiresOnboarding,
		};
	}),

	/**
	 * Check if user requires onboarding (simple boolean check)
	 */
	requiresOnboarding: protectedProcedure.query(async ({ ctx }) => {
		const { onboardingService } = ctx.services;
		return await onboardingService.requiresOnboarding(ctx.userId);
	}),

	/**
	 * Complete onboarding - CRITICAL: This unlocks app access
	 */
	completeOnboarding: protectedProcedure
		.input(
			z.object({
				paymentMethodId: z.string().min(1, "Payment method ID is required"),
				productId: z.string().min(1, "Product ID is required"),
				selectedPlan: z.string().min(1, "Selected plan is required"),
				isAnnual: z.boolean().optional().default(false),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { onboardingService, stripeService, userService } = ctx.services;

			console.log(`Completing onboarding for user ${ctx.userId}:`, {
				paymentMethodId: input.paymentMethodId,
				productId: input.productId,
				selectedPlan: input.selectedPlan,
				isAnnual: input.isAnnual
			});

			// Check current onboarding status
			const currentStatus = await onboardingService.getOnboardingStatus(ctx.userId);
			if (!currentStatus) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "User not found",
				});
			}

			// Verify user still requires onboarding
			if (!currentStatus.isRequired && currentStatus.paymentMethodAdded) {
				return {
					success: true,
					message: "Onboarding already completed",
					alreadyCompleted: true,
					completedAt: currentStatus.completedAt,
				};
			}

			// Get user details for Stripe customer creation
			const user = await userService.findById(ctx.userId);
			if (!user) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "User not found in database",
				});
			}

			// Create or get Stripe customer
			let stripeCustomerId = user.stripe_customer_id;
			
			if (!stripeCustomerId) {
				console.log(`Creating Stripe customer for user ${ctx.userId}`);
				try {
					const stripeCustomer = await stripeService.createOrGetCustomer({
						email: user.email,
						name: user.first_name && user.last_name 
							? `${user.first_name} ${user.last_name}` 
							: user.first_name || user.email,
						userId: ctx.userId,
					});
					
					stripeCustomerId = stripeCustomer.id;
					
					// Update user with Stripe customer ID
					await userService.update(ctx.userId, {
						stripe_customer_id: stripeCustomerId,
					});
					
					console.log(`✅ Created Stripe customer ${stripeCustomerId} for user ${ctx.userId}`);
				} catch (error) {
					console.error(`Failed to create Stripe customer for user ${ctx.userId}:`, error);
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to create Stripe customer",
					});
				}
			}

			// Attach payment method to customer
			try {
				console.log(`Attaching payment method ${input.paymentMethodId} to customer ${stripeCustomerId}`);
				await stripeService.attachPaymentMethod(input.paymentMethodId, stripeCustomerId);
				
				// Set as default payment method
				await stripeService.setDefaultPaymentMethod(stripeCustomerId, input.paymentMethodId);
				
				console.log(`✅ Payment method attached and set as default for customer ${stripeCustomerId}`);
			} catch (error) {
				console.error(`Failed to attach payment method for user ${ctx.userId}:`, error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to attach payment method to customer",
				});
			}

			// CRITICAL: Complete onboarding in database
			// This is the air-tight gate that unlocks app access
			const completed = await onboardingService.completeOnboarding(ctx.userId);
			
			if (!completed) {
				console.error(`Failed to complete onboarding for user ${ctx.userId}`);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to complete onboarding in database",
				});
			}

			// Verify completion was successful
			const verificationStatus = await onboardingService.getOnboardingStatus(ctx.userId);
			if (!verificationStatus || verificationStatus.isRequired) {
				console.error(`Onboarding completion verification failed for user ${ctx.userId}`);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Onboarding completion verification failed",
				});
			}

			// Validate integrity after completion
			const integrity = await onboardingService.validateOnboardingIntegrity(ctx.userId);
			if (!integrity.isValid) {
				console.warn(`Onboarding integrity issues after completion for user ${ctx.userId}:`, integrity.issues);
				// Log but don't fail - data was successfully updated
			}

			console.log(`✅ Onboarding completed successfully for user ${ctx.userId} with Stripe customer ${stripeCustomerId}`);

			// ✅ COMPLETED:
			// 1. Created/retrieved Stripe customer
			// 2. Attached payment method to customer
			// 3. Set payment method as default
			// 4. Completed onboarding in database
			// 
			// TODO for future implementation:
			// 1. Create Stripe subscription with productId and trial period
			// 2. Send welcome email
			// 3. Trigger analytics events
			// 4. Set up initial user data

			return {
				success: true,
				message: "Onboarding completed successfully",
				completedAt: verificationStatus.completedAt,
				data: {
					paymentMethodId: input.paymentMethodId,
					productId: input.productId,
					selectedPlan: input.selectedPlan,
					isAnnual: input.isAnnual,
					stripeCustomerId: stripeCustomerId,
				}
			};
		}),

});
