import { inngest } from "~/services/inngest";
import { env } from "~/env";
import type { UnipileProvider } from "~/types/unipile-account";
import type { PrismaClient } from "generated/prisma";

export interface TriggerHistoricalSyncData {
	user_id: string;
	account_id: string;
	provider: UnipileProvider;
	limit?: number; // Optional limit, defaults to 1000
}

export class HistoricalSyncService {
	constructor(private readonly db: PrismaClient) {}
	/**
	 * Trigger historical message sync for a user's Unipile account
	 * Call this after a user successfully connects their social account
	 */
	public async triggerSync(data: TriggerHistoricalSyncData) {
		return await inngest.send({
			name: "unipile/sync.historical_messages",
			data: {
				...data,
				dsn: env.UNIPILE_DSN,
				api_key: env.UNIPILE_API_KEY,
				limit: data.limit || 1000,
			},
		});
	}

	/**
	 * Trigger historical sync for multiple accounts
	 * Useful for bulk onboarding or re-syncing
	 */
	public async triggerBulkSync(accounts: TriggerHistoricalSyncData[]) {
		const events = accounts.map((account) => ({
			name: "unipile/sync.historical_messages" as const,
			data: {
				...account,
				dsn: env.UNIPILE_DSN,
				api_key: env.UNIPILE_API_KEY,
				limit: account.limit || 1000,
			},
		}));

		return await inngest.send(events);
	}

	/**
	 * Trigger sync with custom parameters
	 * For advanced use cases where you need more control
	 */
	public async triggerCustomSync(
		data: TriggerHistoricalSyncData & {
			dsn?: string;
			api_key?: string;
		},
	) {
		return await inngest.send({
			name: "unipile/sync.historical_messages",
			data: {
				...data,
				dsn: data.dsn || env.UNIPILE_DSN,
				api_key: data.api_key || env.UNIPILE_API_KEY,
				limit: data.limit || 1000,
			},
		});
	}
}
