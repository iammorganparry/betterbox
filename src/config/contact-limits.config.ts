/**
 * Contact limits configuration by subscription plan
 * 
 * A contact is defined as:
 * - A profile that messages the user (incoming messages)
 * - A profile that views the user's profile
 */

export const CONTACT_LIMITS_CONFIG = {
	// Free tier - basic functionality
	FREE: {
		contactLimit: 100,
		description: "Free plan with basic contact access"
	},
	
	// Starter tier - small businesses
	STARTER: {
		contactLimit: 1000,
		description: "Starter plan for growing professionals"
	},
	
	// Professional tier - established professionals
	PROFESSIONAL: {
		contactLimit: 10000,
		description: "Professional plan for active networkers"
	},
	
	// Enterprise tier - large organizations
	ENTERPRISE: {
		contactLimit: 10000,
		description: "Enterprise plan with full access"
	},
	
	// Gold tier - trial plan with full access
	GOLD: {
		contactLimit: 10000,
		description: "Gold trial plan with premium features"
	}
} as const;

export type SubscriptionPlan = keyof typeof CONTACT_LIMITS_CONFIG;

/**
 * Get contact limit for a subscription plan
 */
export function getContactLimitForPlan(plan: SubscriptionPlan): number {
	return CONTACT_LIMITS_CONFIG[plan]?.contactLimit ?? CONTACT_LIMITS_CONFIG.FREE.contactLimit;
}

/**
 * Get plan description
 */
export function getPlanDescription(plan: SubscriptionPlan): string {
	return CONTACT_LIMITS_CONFIG[plan]?.description ?? CONTACT_LIMITS_CONFIG.FREE.description;
}

/**
 * Get all available plans with their limits
 */
export function getAllPlanLimits() {
	return Object.entries(CONTACT_LIMITS_CONFIG).map(([plan, config]) => ({
		plan: plan as SubscriptionPlan,
		limit: config.contactLimit,
		description: config.description
	}));
} 