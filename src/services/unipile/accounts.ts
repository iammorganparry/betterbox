import { and, desc, eq } from "drizzle-orm";
import { type Database, db } from "~/db";
import { unipileAccounts, type users } from "~/db/schema";
import type { unipileAccountStatusEnum } from "~/db/schema";

// Inferred types from Drizzle schema
export type UnipileAccount = typeof unipileAccounts.$inferSelect;
export type CreateUnipileAccountData = typeof unipileAccounts.$inferInsert;
export type UpdateUnipileAccountData = Partial<CreateUnipileAccountData>;
export type UnipileAccountStatus =
	(typeof unipileAccountStatusEnum.enumValues)[number];

export interface UnipileAccountWithUser extends UnipileAccount {
	user: typeof users.$inferSelect;
}

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

export class UnipileAccountService {
	constructor(private readonly db: Database) {}
	/**
	 * Find a Unipile account by account ID and provider
	 */
	public async findByAccountId(
		accountId: string,
		provider: string,
		includeUser = false,
	): Promise<UnipileAccountWithUser | UnipileAccount | null> {
		if (includeUser) {
			const result = await this.db.query.unipileAccounts.findFirst({
				where: (unipileAccounts, { and, eq }) =>
					and(
						eq(unipileAccounts.account_id, accountId),
						eq(unipileAccounts.provider, normalizeProvider(provider)),
						eq(unipileAccounts.is_deleted, false),
					),
				with: {
					user: true,
				},
			});

			return (result as UnipileAccountWithUser | undefined) || null;
		}
		const result = await this.db.query.unipileAccounts.findFirst({
			where: (unipileAccounts, { and, eq }) =>
				and(
					eq(unipileAccounts.account_id, accountId),
					eq(unipileAccounts.provider, normalizeProvider(provider)),
					eq(unipileAccounts.is_deleted, false),
				),
		});

		return result || null;
	}

	/**
	 * Find all Unipile accounts for a user
	 */
	public async findByUserId(userId: string): Promise<UnipileAccount[]> {
		return await this.db.query.unipileAccounts.findMany({
			where: and(
				eq(unipileAccounts.user_id, userId),
				eq(unipileAccounts.is_deleted, false),
			),
			orderBy: [desc(unipileAccounts.created_at)],
		});
	}

	/**
	 * Find Unipile accounts by provider for a user
	 */
	public async findByUserAndProvider(
		userId: string,
		provider: string,
	): Promise<UnipileAccount[]> {
		return await this.db.query.unipileAccounts.findMany({
			where: and(
				eq(unipileAccounts.user_id, userId),
				eq(unipileAccounts.provider, normalizeProvider(provider)),
				eq(unipileAccounts.is_deleted, false),
			),
			orderBy: [desc(unipileAccounts.created_at)],
		});
	}

	/**
	 * Create a new Unipile account
	 */
	public async create(data: CreateUnipileAccountData): Promise<UnipileAccount> {
		const result = await this.db
			.insert(unipileAccounts)
			.values({
				...data,
				status: data.status || "connected",
			})
			.returning();

		if (!result[0]) {
			throw new Error("Failed to create unipile account");
		}

		return result[0];
	}

	/**
	 * Update a Unipile account
	 */
	public async update(
		id: string,
		data: UpdateUnipileAccountData,
	): Promise<UnipileAccount> {
		const result = await this.db
			.update(unipileAccounts)
			.set({
				...data,
				updated_at: new Date(),
			})
			.where(eq(unipileAccounts.id, id))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to update unipile account");
		}

		return result[0];
	}

	/**
	 * Upsert a Unipile account
	 */
	public async upsert(
		userId: string,
		provider: string,
		accountId: string,
		data: CreateUnipileAccountData,
		updateData: UpdateUnipileAccountData,
	): Promise<UnipileAccount> {
		const result = await this.db
			.insert(unipileAccounts)
			.values(data)
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
	 * Delete a Unipile account (soft delete)
	 */
	public async delete(id: string): Promise<UnipileAccount> {
		const result = await this.db
			.update(unipileAccounts)
			.set({
				is_deleted: true,
				updated_at: new Date(),
			})
			.where(eq(unipileAccounts.id, id))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to delete unipile account");
		}

		return result[0];
	}

	/**
	 * Update account status
	 */
	public async updateStatus(
		id: string,
		status: UnipileAccountStatus,
	): Promise<UnipileAccount> {
		const result = await this.db
			.update(unipileAccounts)
			.set({
				status,
				updated_at: new Date(),
			})
			.where(eq(unipileAccounts.id, id))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to update unipile account status");
		}

		return result[0];
	}

	/**
	 * Get account statistics for a user
	 */
	public async getAccountStats(userId: string) {
		const accounts = await this.db.query.unipileAccounts.findMany({
			where: and(
				eq(unipileAccounts.user_id, userId),
				eq(unipileAccounts.is_deleted, false),
			),
		});

		const stats = accounts.reduce(
			(acc, account) => {
				acc[account.provider] = (acc[account.provider] || 0) + 1;
				return acc;
			},
			{} as Record<string, number>,
		);

		return {
			total: accounts.length,
			byProvider: stats,
			connected: accounts.filter((a) => a.status === "connected").length,
			disconnected: accounts.filter((a) => a.status === "disconnected").length,
		};
	}
}
