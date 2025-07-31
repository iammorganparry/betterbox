import { eq, and, or, count, desc, sql, getTableColumns } from 'drizzle-orm';
import type { Database } from '~/db';
import { users, unipileAccounts, unipileAccountStatusEnum } from '~/db/schema';

// Use Drizzle's inferred types
export type UnipileAccount = typeof unipileAccounts.$inferSelect;
export type User = typeof users.$inferSelect;
export type CreateAccountData = typeof unipileAccounts.$inferInsert;
export type UpdateAccountData = Partial<CreateAccountData>;
export type UnipileAccountStatus = typeof unipileAccountStatusEnum.enumValues[number];

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
	constructor(private readonly db: Database) {}

	/**
	 * Find user by email or Clerk ID
	 */
	async findUserByIdentifier(identifier: string): Promise<User | null> {
		// Try to find by id (clerk_id) first, then by email
		const result = await this.db
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
		const result = await this.db
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
			eq(unipileAccounts.userId, userId),
			eq(unipileAccounts.accountId, accountId),
			eq(unipileAccounts.provider, provider),
		];

		if (!include_deleted) {
			whereConditions.push(eq(unipileAccounts.isDeleted, false));
		}

		if (include_user) {
			const result = await this.db
				.select({
					...getTableColumns(unipileAccounts),
					user: getTableColumns(users),
				})
				.from(unipileAccounts)
				.leftJoin(users, eq(unipileAccounts.userId, users.id))
				.where(and(...whereConditions))
				.limit(1);

			const row = result[0];
			if (!row) return null;

			return {
				...row,
				user: row.user!,
			} as AccountWithUser;
		} else {
			const result = await this.db
				.select()
				.from(unipileAccounts)
				.where(and(...whereConditions))
				.limit(1);

			return result[0] || null;
		}
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
			eq(unipileAccounts.accountId, accountId),
			eq(unipileAccounts.provider, provider),
		];

		if (!include_deleted) {
			whereConditions.push(eq(unipileAccounts.isDeleted, false));
		}

		if (include_user) {
			const result = await this.db
				.select({
					...getTableColumns(unipileAccounts),
					user: getTableColumns(users),
				})
				.from(unipileAccounts)
				.leftJoin(users, eq(unipileAccounts.userId, users.id))
				.where(and(...whereConditions))
				.limit(1);

			const row = result[0];
			if (!row) return null;

			return {
				...row,
				user: row.user!,
			} as AccountWithUser;
		} else {
			const result = await this.db
				.select()
				.from(unipileAccounts)
				.where(and(...whereConditions))
				.limit(1);

			return result[0] || null;
		}
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
			userId,
			accountId,
			provider,
			status: 'connected',
			isDeleted: false,
			createdAt: new Date(),
			updatedAt: new Date(),
			...createData,
		};

		const result = await this.db
			.insert(unipileAccounts)
			.values(insertData)
			.onConflictDoUpdate({
				target: [unipileAccounts.userId, unipileAccounts.provider, unipileAccounts.accountId],
				set: {
					...updateData,
					updatedAt: new Date(),
				},
			})
			.returning();

		return result[0]!;
	}

	/**
	 * Update account status
	 */
	async updateAccountStatus(
		accountId: string,
		provider: string,
		status: string,
	): Promise<{ count: number }> {
		const result = await this.db
			.update(unipileAccounts)
			.set({
				status: status as UnipileAccountStatus,
				updatedAt: new Date(),
			})
			.where(and(
				eq(unipileAccounts.accountId, accountId),
				eq(unipileAccounts.provider, provider),
				eq(unipileAccounts.isDeleted, false)
			));

		// Drizzle doesn't return count by default, so we simulate the BatchPayload
		return { count: result.rowCount || 0 };
	}

	/**
	 * Mark account as deleted (soft delete)
	 */
	async markAccountAsDeleted(
		userId: string,
		accountId: string,
		provider: string,
	): Promise<UnipileAccount> {
		const result = await this.db
			.update(unipileAccounts)
			.set({
				isDeleted: true,
				status: 'disconnected',
				updatedAt: new Date(),
			})
			.where(and(
				eq(unipileAccounts.userId, userId),
				eq(unipileAccounts.provider, provider),
				eq(unipileAccounts.accountId, accountId)
			))
			.returning();

		return result[0]!;
	}

	/**
	 * Get all accounts for a user
	 */
	async getUserAccounts(
		userId: string,
		provider?: string,
		includeDeleted = false,
	): Promise<UnipileAccount[]> {
		const whereConditions = [eq(unipileAccounts.userId, userId)];

		if (provider) {
			whereConditions.push(eq(unipileAccounts.provider, provider));
		}

		if (!includeDeleted) {
			whereConditions.push(eq(unipileAccounts.isDeleted, false));
		}

		return await this.db
			.select()
			.from(unipileAccounts)
			.where(and(...whereConditions))
			.orderBy(desc(unipileAccounts.createdAt));
	}

	/**
	 * Check if account is active
	 */
	async isAccountActive(
		userId: string,
		accountId: string,
		provider: string,
	): Promise<boolean> {
		const result = await this.db
			.select({ count: count() })
			.from(unipileAccounts)
			.where(and(
				eq(unipileAccounts.userId, userId),
				eq(unipileAccounts.accountId, accountId),
				eq(unipileAccounts.provider, provider),
				eq(unipileAccounts.status, 'connected'),
				eq(unipileAccounts.isDeleted, false)
			));

		return result[0]?.count > 0;
	}

	/**
	 * Get account statistics
	 */
	async getAccountStats(userId: string): Promise<{
		totalAccounts: number;
		connectedAccounts: number;
		disconnectedAccounts: number;
		errorAccounts: number;
	}> {
		const result = await this.db.execute(sql`
			SELECT 
				COUNT(*)::int as total_accounts,
				COUNT(*) FILTER (WHERE status = 'connected')::int as connected_accounts,
				COUNT(*) FILTER (WHERE status = 'disconnected')::int as disconnected_accounts,
				COUNT(*) FILTER (WHERE status = 'error')::int as error_accounts
			FROM ${unipileAccounts}
			WHERE ${eq(unipileAccounts.userId, userId)} AND ${eq(unipileAccounts.isDeleted, false)}
		`);

		const stats = result.rows[0] as {
			total_accounts: number;
			connected_accounts: number;
			disconnected_accounts: number;
			error_accounts: number;
		} | undefined;

		return {
			totalAccounts: stats?.total_accounts || 0,
			connectedAccounts: stats?.connected_accounts || 0,
			disconnectedAccounts: stats?.disconnected_accounts || 0,
			errorAccounts: stats?.error_accounts || 0,
		};
	}
}
