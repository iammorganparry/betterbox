import { and, count, desc, eq, getTableColumns, or, sql } from "drizzle-orm";
import type { db } from "~/db";
import {
	type unipileAccountStatusEnum,
	unipileAccounts,
	users,
} from "~/db/schema";

// Helper function for type mapping using database enums
const VALID_PROVIDERS = [
	"linkedin",
	"whatsapp",
	"telegram",
	"instagram",
	"facebook",
] as const;
type ValidProvider = (typeof VALID_PROVIDERS)[number];

const normalizeProvider = (provider: string): ValidProvider => {
	const normalized = provider.toLowerCase();
	if (VALID_PROVIDERS.includes(normalized as ValidProvider)) {
		return normalized as ValidProvider;
	}
	return "linkedin"; // default fallback
};

// Use Drizzle's inferred types
export type UnipileAccount = typeof unipileAccounts.$inferSelect;
export type User = typeof users.$inferSelect;
export type CreateAccountData = typeof unipileAccounts.$inferInsert;
export type UpdateAccountData = Partial<CreateAccountData>;
export type UnipileAccountStatus =
	(typeof unipileAccountStatusEnum.enumValues)[number];

// Account with user relationship
export type AccountWithUser = UnipileAccount & {
	user: User;
};

export type UserWithAccounts = User & {
	UnipileAccount: UnipileAccount[];
};

export interface FindAccountOptions {
	include_user?: boolean;
	include_deleted?: boolean;
}

export class UnipileAccountService {
	constructor(private readonly drizzleDb: typeof db) {}

	/**
	 * Find user by email or Clerk ID
	 */
	async findUserByIdentifier(identifier: string): Promise<User | null> {
		// Try to find by id (clerk_id) first, then by email
		const result = await this.drizzleDb
			.select()
			.from(users)
			.where(or(eq(users.id, identifier), eq(users.email, identifier)))
			.limit(1);

		return result[0] || null;
	}

	/**
	 * Find user by Clerk ID specifically
	 */
	async findUserByClerkId(clerkId: string): Promise<User | null> {
		const result = await this.drizzleDb
			.select()
			.from(users)
			.where(eq(users.id, clerkId))
			.limit(1);

		return result[0] || null;
	}

	/**
	 * Find Unipile account by ID
	 */
	async findUnipileAccount(
		userId: string,
		accountId: string,
		provider: string,
		options: FindAccountOptions = {},
	): Promise<UnipileAccount | AccountWithUser | null> {
		const { include_user = false, include_deleted = false } = options;

		const whereConditions = [
			eq(unipileAccounts.user_id, userId),
			eq(unipileAccounts.account_id, accountId),
			eq(unipileAccounts.provider, normalizeProvider(provider)),
		];

		if (!include_deleted) {
			whereConditions.push(eq(unipileAccounts.is_deleted, false));
		}

		if (include_user) {
			const result = await this.drizzleDb
				.select({
					...getTableColumns(unipileAccounts),
					user: getTableColumns(users),
				})
				.from(unipileAccounts)
				.leftJoin(users, eq(unipileAccounts.user_id, users.id))
				.where(and(...whereConditions))
				.limit(1);

			const row = result[0];
			if (!row || !row.user) return null;

			return {
				...row,
				user: row.user,
			} as AccountWithUser;
		}

		const result = await this.drizzleDb
			.select()
			.from(unipileAccounts)
			.where(and(...whereConditions))
			.limit(1);

		return result[0] || null;
	}

	/**
	 * Find Unipile account by provider details
	 */
	async findUnipileAccountByProvider(
		accountId: string,
		provider: string,
		options: FindAccountOptions = {},
	): Promise<UnipileAccount | AccountWithUser | null> {
		const { include_user = false, include_deleted = false } = options;

		const whereConditions = [
			eq(unipileAccounts.account_id, accountId),
			eq(unipileAccounts.provider, normalizeProvider(provider)),
		];

		if (!include_deleted) {
			whereConditions.push(eq(unipileAccounts.is_deleted, false));
		}

		if (include_user) {
			const result = await this.drizzleDb
				.select({
					...getTableColumns(unipileAccounts),
					user: getTableColumns(users),
				})
				.from(unipileAccounts)
				.leftJoin(users, eq(unipileAccounts.user_id, users.id))
				.where(and(...whereConditions))
				.limit(1);

			const row = result[0];
			if (!row || !row.user) return null;

			return {
				...row,
				user: row.user,
			} as AccountWithUser;
		}

		const result = await this.drizzleDb
			.select()
			.from(unipileAccounts)
			.where(and(...whereConditions))
			.limit(1);

		return result[0] || null;
	}

	/**
	 * Create or update a Unipile account
	 */
	async upsertUnipileAccount(
		userId: string,
		accountId: string,
		provider: string,
		updateData: Partial<UpdateAccountData>,
		createData?: Partial<CreateAccountData>,
	): Promise<UnipileAccount> {
		const insertData: CreateAccountData = {
			user_id: userId,
			account_id: accountId,
			provider: normalizeProvider(provider),
			status: "connected",
			is_deleted: false,
			created_at: new Date(),
			updated_at: new Date(),
			...createData,
		};

		const result = await this.drizzleDb
			.insert(unipileAccounts)
			.values(insertData)
			.onConflictDoUpdate({
				target: [
					unipileAccounts.user_id,
					unipileAccounts.provider,
					unipileAccounts.account_id,
				],
				set: {
					...updateData,
					updated_at: new Date(),
				},
			})
			.returning();

		if (!result[0]) {
			throw new Error("Failed to upsert unipile account");
		}
		return result[0];
	}

	/**
	 * Update account status
	 */
	async updateAccountStatus(
		accountId: string,
		provider: string,
		status: string,
	): Promise<{ count: number }> {
		const result = await this.drizzleDb
			.update(unipileAccounts)
			.set({
				status: status as UnipileAccountStatus,
				updated_at: new Date(),
			})
			.where(
				and(
					eq(unipileAccounts.account_id, accountId),
					eq(unipileAccounts.provider, normalizeProvider(provider)),
					eq(unipileAccounts.is_deleted, false),
				),
			);

		// Drizzle doesn't return count by default, so we simulate the BatchPayload
		return { count: result.length || 0 };
	}

	/**
	 * Mark account as deleted (soft delete)
	 */
	async markAccountAsDeleted(
		userId: string,
		accountId: string,
		provider: string,
	): Promise<UnipileAccount> {
		const result = await this.drizzleDb
			.update(unipileAccounts)
			.set({
				is_deleted: true,
				status: "disconnected",
				updated_at: new Date(),
			})
			.where(
				and(
					eq(unipileAccounts.user_id, userId),
					eq(unipileAccounts.provider, normalizeProvider(provider)),
					eq(unipileAccounts.account_id, accountId),
				),
			)
			.returning();

		if (!result[0]) {
			throw new Error("Failed to mark account as deleted");
		}
		return result[0];
	}

	/**
	 * Get all accounts for a user
	 */
	async getUserAccounts(
		userId: string,
		provider?: string,
		includeDeleted = false,
	): Promise<UnipileAccount[]> {
		const whereConditions = [eq(unipileAccounts.user_id, userId)];

		if (provider) {
			whereConditions.push(
				eq(unipileAccounts.provider, normalizeProvider(provider)),
			);
		}

		if (!includeDeleted) {
			whereConditions.push(eq(unipileAccounts.is_deleted, false));
		}

		return await this.drizzleDb
			.select()
			.from(unipileAccounts)
			.where(and(...whereConditions))
			.orderBy(desc(unipileAccounts.created_at));
	}

	/**
	 * Check if account is active
	 */
	async isAccountActive(
		userId: string,
		accountId: string,
		provider: string,
	): Promise<boolean> {
		const result = await this.drizzleDb
			.select({ count: count() })
			.from(unipileAccounts)
			.where(
				and(
					eq(unipileAccounts.user_id, userId),
					eq(unipileAccounts.account_id, accountId),
					eq(unipileAccounts.provider, normalizeProvider(provider)),
					eq(unipileAccounts.status, "connected"),
					eq(unipileAccounts.is_deleted, false),
				),
			);

		if (!result[0]) {
			return false;
		}

		return result[0].count > 0;
	}

	/**
	 * Get account statistics
	 */
	async getAccountStats(userId: string): Promise<{
		totalAccounts: number;
		connectedAccounts: number;
		disconnectedAccounts: number;
		errorAccounts: number;
		syncingAccounts: number;
	}> {
		const result = await this.drizzleDb.execute(sql`
			SELECT 
				COUNT(*)::int as total_accounts,
				COUNT(*) FILTER (WHERE status = 'connected')::int as connected_accounts,
				COUNT(*) FILTER (WHERE status = 'disconnected')::int as disconnected_accounts,
				COUNT(*) FILTER (WHERE status = 'error')::int as error_accounts,
				COUNT(*) FILTER (WHERE status = 'syncing')::int as syncing_accounts
			FROM ${unipileAccounts}
			WHERE ${eq(unipileAccounts.user_id, userId)} AND ${eq(unipileAccounts.is_deleted, false)}
		`);

		const stats = result[0] as
			| {
					total_accounts: number;
					connected_accounts: number;
					disconnected_accounts: number;
					error_accounts: number;
					syncing_accounts: number;
			  }
			| undefined;

		return {
			totalAccounts: stats?.total_accounts || 0,
			connectedAccounts: stats?.connected_accounts || 0,
			disconnectedAccounts: stats?.disconnected_accounts || 0,
			errorAccounts: stats?.error_accounts || 0,
			syncingAccounts: stats?.syncing_accounts || 0,
		};
	}

	/**
	 * Start sync for an account
	 */
	async startSync(
		accountId: string,
		provider: string,
	): Promise<UnipileAccount> {
		const result = await this.drizzleDb
			.update(unipileAccounts)
			.set({
				status: "syncing",
				sync_status: "in_progress",
				sync_started_at: new Date(),
				sync_completed_at: null,
				sync_error: null,
				sync_progress: {
					chats_processed: 0,
					messages_processed: 0,
					attendees_processed: 0,
					started_at: new Date().toISOString(),
				},
				updated_at: new Date(),
			})
			.where(
				and(
					eq(unipileAccounts.account_id, accountId),
					eq(unipileAccounts.provider, normalizeProvider(provider)),
					eq(unipileAccounts.is_deleted, false),
				),
			)
			.returning();

		if (!result[0]) {
			throw new Error("Failed to start sync for account");
		}
		return result[0];
	}

	/**
	 * Update sync progress
	 */
	async updateSyncProgress(
		accountId: string,
		provider: string,
		progress: {
			chats_processed?: number;
			messages_processed?: number;
			attendees_processed?: number;
			total_chats?: number;
			current_step?: string;
		},
	): Promise<UnipileAccount> {
		// Get current progress to merge with new data
		const currentAccount = await this.findUnipileAccountByProvider(
			accountId,
			provider,
		);
		const currentProgress = (currentAccount?.sync_progress as any) || {};

		const updatedProgress = {
			...currentProgress,
			...progress,
			last_updated: new Date().toISOString(),
		};

		const result = await this.drizzleDb
			.update(unipileAccounts)
			.set({
				sync_progress: updatedProgress,
				updated_at: new Date(),
			})
			.where(
				and(
					eq(unipileAccounts.account_id, accountId),
					eq(unipileAccounts.provider, normalizeProvider(provider)),
					eq(unipileAccounts.is_deleted, false),
				),
			)
			.returning();

		if (!result[0]) {
			throw new Error("Failed to update sync progress");
		}
		return result[0];
	}

	/**
	 * Complete sync for an account
	 */
	async completeSync(
		accountId: string,
		provider: string,
		finalStats: {
			total_chats_processed: number;
			total_messages_processed: number;
			total_attendees_processed: number;
		},
	): Promise<UnipileAccount> {
		const result = await this.drizzleDb
			.update(unipileAccounts)
			.set({
				status: "connected",
				sync_status: "completed",
				sync_completed_at: new Date(),
				last_sync_at: new Date(),
				sync_progress: {
					...finalStats,
					completed_at: new Date().toISOString(),
					status: "completed",
				},
				sync_error: null,
				updated_at: new Date(),
			})
			.where(
				and(
					eq(unipileAccounts.account_id, accountId),
					eq(unipileAccounts.provider, normalizeProvider(provider)),
					eq(unipileAccounts.is_deleted, false),
				),
			)
			.returning();

		if (!result[0]) {
			throw new Error("Failed to complete sync for account");
		}
		return result[0];
	}

	/**
	 * Fail sync for an account
	 */
	async failSync(
		accountId: string,
		provider: string,
		error: string,
	): Promise<UnipileAccount> {
		const result = await this.drizzleDb
			.update(unipileAccounts)
			.set({
				status: "error",
				sync_status: "failed",
				sync_error: error,
				sync_progress: {
					failed_at: new Date().toISOString(),
					error: error,
					status: "failed",
				},
				updated_at: new Date(),
			})
			.where(
				and(
					eq(unipileAccounts.account_id, accountId),
					eq(unipileAccounts.provider, normalizeProvider(provider)),
					eq(unipileAccounts.is_deleted, false),
				),
			)
			.returning();

		if (!result[0]) {
			throw new Error("Failed to fail sync for account");
		}
		return result[0];
	}

	/**
	 * Get sync status for user's accounts
	 */
	async getSyncStatus(userId: string): Promise<
		Array<{
			account_id: string;
			provider: string;
			status: string;
			sync_status: string | null;
			sync_progress: any;
			sync_started_at: Date | null;
			sync_completed_at: Date | null;
			sync_error: string | null;
		}>
	> {
		return await this.drizzleDb
			.select({
				account_id: unipileAccounts.account_id,
				provider: unipileAccounts.provider,
				status: unipileAccounts.status,
				sync_status: unipileAccounts.sync_status,
				sync_progress: unipileAccounts.sync_progress,
				sync_started_at: unipileAccounts.sync_started_at,
				sync_completed_at: unipileAccounts.sync_completed_at,
				sync_error: unipileAccounts.sync_error,
			})
			.from(unipileAccounts)
			.where(
				and(
					eq(unipileAccounts.user_id, userId),
					eq(unipileAccounts.is_deleted, false),
				),
			)
			.orderBy(desc(unipileAccounts.created_at));
	}
}
