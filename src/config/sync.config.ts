/**
 * Global Sync Configuration
 *
 * Centralized configuration for Unipile sync operations.
 * Easily modify limits and settings for development and production environments.
 */

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
	};
}

/**
 * Helper function to log sync configuration
 */
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
			},
		});
	}
}
