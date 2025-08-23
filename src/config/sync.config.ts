/**
 * Global Sync Configuration
 *
 * Centralized configuration for Unipile sync operations.
 * Includes both environment-based (dev/prod) and subscription-based limits.
 */

import { env } from "~/env";

export interface SyncConfig {
	development: {
		chat: {
			/** Maximum number of chats to sync in development */
			maxChats: number;
			/** Page size for chat fetching */
			pageSize: number;
		};
		message: {
			/** Maximum messages per chat in development */
			maxPerChat: number;
			/** Batch size for message processing */
			batchSize: number;
		};
		attendee: {
			/** Maximum attendees per chat */
			maxPerChat: number;
		};
	};
	production: {
		chat: {
			/** Maximum number of chats to sync in production */
			maxChats: number;
			/** Page size for chat fetching */
			pageSize: number;
		};
		message: {
			/** Maximum messages per chat in production */
			maxPerChat: number;
			/** Batch size for message processing */
			batchSize: number;
		};
		attendee: {
			/** Maximum attendees per chat */
			maxPerChat: number;
		};
	};
	/** Enable detailed logging for sync operations */
	enableDetailedLogging: boolean;
	/** Enable profile enrichment (requires Unipile API credentials) */
	enableProfileEnrichment: boolean;
	/** Include company page messages in sync (default false - only personal messages) */
	includeCompanyMessages: boolean;
}

/**
 * Default sync configuration
 */
export const SYNC_CONFIG: SyncConfig = {
	development: {
		chat: {
			maxChats: 5,
			pageSize: 5, // MUST be <= maxChats to avoid looping
		},
		message: {
			maxPerChat: 5,
			batchSize: 5,
		},
		attendee: {
			maxPerChat: 100, // Still fetch all attendees even in dev
		},
	},
	production: {
		chat: {
			maxChats: 1000,
			pageSize: 50,
		},
		message: {
			maxPerChat: 100,
			batchSize: 50,
		},
		attendee: {
			maxPerChat: 100,
		},
	},
	enableDetailedLogging: process.env.NODE_ENV === "development",
	enableProfileEnrichment: !!(
		process.env.UNIPILE_API_KEY && process.env.UNIPILE_DSN
	),
	includeCompanyMessages: false, // Default to personal messages only
};

/**
 * Get current environment configuration
 */
export function getCurrentSyncConfig() {
	const isDevelopment = process.env.NODE_ENV === "development";
	const config = isDevelopment
		? SYNC_CONFIG.development
		: SYNC_CONFIG.production;

	return {
		...config,
		environment: isDevelopment ? "development" : "production",
		enableDetailedLogging: SYNC_CONFIG.enableDetailedLogging,
		enableProfileEnrichment: SYNC_CONFIG.enableProfileEnrichment,
		includeCompanyMessages: SYNC_CONFIG.includeCompanyMessages,
	};
}

/**
 * Helper function to log sync configuration
 */
/**
 * Subscription-based sync limits configuration
 * Defines historical sync limits based on user's subscription plan
 */
export const SUBSCRIPTION_SYNC_LIMITS = {
	FREE: {
		historicalSyncLimit: 10,
		description: "Free plan with basic sync access",
	},
	STARTER: {
		historicalSyncLimit: 50,
		description: "Starter plan for growing professionals",
	},
	PROFESSIONAL: {
		historicalSyncLimit: 100,
		description: "Professional plan for active networkers",
	},
	ENTERPRISE: {
		historicalSyncLimit: 1000,
		description: "Enterprise plan with full access",
	},
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_SYNC_LIMITS;

/**
 * Get historical sync limit for a subscription plan
 */
export function getHistoricalSyncLimitForPlan(plan: SubscriptionPlan): number {
	if (env.NODE_ENV === "development") {
		return 5;
	}
	return (
		SUBSCRIPTION_SYNC_LIMITS[plan]?.historicalSyncLimit ??
		SUBSCRIPTION_SYNC_LIMITS.FREE.historicalSyncLimit
	);
}

export function logSyncConfig() {
	const config = getCurrentSyncConfig();

	if (config.enableDetailedLogging) {
		console.log("🔧 Sync configuration:", {
			environment: config.environment,
			chatLimits: {
				maxChats: config.chat.maxChats,
				pageSize: config.chat.pageSize,
			},
			messageLimits: {
				maxPerChat: config.message.maxPerChat,
				batchSize: config.message.batchSize,
			},
			attendeeLimits: {
				maxPerChat: config.attendee.maxPerChat,
			},
			features: {
				profileEnrichment: config.enableProfileEnrichment,
				detailedLogging: config.enableDetailedLogging,
				includeCompanyMessages: config.includeCompanyMessages,
			},
		});
	}
}
