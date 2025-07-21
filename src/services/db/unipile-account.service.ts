import type { Prisma, PrismaClient } from "../../../generated/prisma";
import type {
	User,
	UnipileAccount,
	UnipileAccountStatus,
} from "../../../generated/prisma";

// Use Prisma's generated types
export type CreateAccountData = Prisma.UnipileAccountCreateInput;
export type UpdateAccountData = Prisma.UnipileAccountUpdateInput;

// Account with various include options
export type AccountWithUser = Prisma.UnipileAccountGetPayload<{
	include: { user: true };
}>;

export type UserWithAccounts = Prisma.UserGetPayload<{
	include: { UnipileAccount: true };
}>;

export interface FindAccountOptions {
	include_user?: boolean;
	include_deleted?: boolean;
}

export class UnipileAccountService {
	constructor(private readonly db: PrismaClient) {}

	/**
	 * Find user by email or Clerk ID
	 */
	async findUserByIdentifier(identifier: string): Promise<User | null> {
		// Try to find by id (clerk_id) first, then by email
		const user = await this.db.user.findFirst({
			where: {
				OR: [{ id: identifier }, { email: identifier }],
			},
		});

		return user;
	}

	/**
	 * Find user by Clerk ID specifically
	 */
	async findUserByClerkId(clerkId: string): Promise<User | null> {
		return await this.db.user.findUnique({
			where: { id: clerkId },
		});
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

		return (await this.db.unipileAccount.findFirst({
			where: {
				user_id: userId,
				account_id: accountId,
				provider: provider,
				...(include_deleted ? {} : { is_deleted: false }),
			},
			...(include_user ? { include: { user: true } } : {}),
		})) as UnipileAccount | AccountWithUser | null;
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

		return (await this.db.unipileAccount.findFirst({
			where: {
				account_id: accountId,
				provider: provider,
				...(include_deleted ? {} : { is_deleted: false }),
			},
			...(include_user ? { include: { user: true } } : {}),
		})) as UnipileAccount | AccountWithUser | null;
	}

	/**
	 * Create or update a Unipile account
	 */
	async upsertUnipileAccount(
		userId: string,
		accountId: string,
		provider: string,
		updateData: Partial<Prisma.UnipileAccountUpdateInput>,
		createData?: Partial<Prisma.UnipileAccountCreateWithoutUserInput>,
	): Promise<UnipileAccount> {
		return await this.db.unipileAccount.upsert({
			where: {
				user_id_provider_account_id: {
					user_id: userId,
					provider: provider,
					account_id: accountId,
				},
			},
			update: {
				...updateData,
				updated_at: new Date(),
			},
			create: {
				user: {
					connect: { id: userId },
				},
				account_id: accountId,
				provider: provider,
				status: "connected",
				...createData,
			},
		});
	}

	/**
	 * Update account status
	 */
	async updateAccountStatus(
		accountId: string,
		provider: string,
		status: string,
	): Promise<Prisma.BatchPayload> {
		return await this.db.unipileAccount.updateMany({
			where: {
				account_id: accountId,
				provider: provider,
				is_deleted: false,
			},
			data: {
				status: status as UnipileAccountStatus,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Mark account as deleted (soft delete)
	 */
	async markAccountAsDeleted(
		userId: string,
		accountId: string,
		provider: string,
	): Promise<UnipileAccount> {
		return await this.db.unipileAccount.update({
			where: {
				user_id_provider_account_id: {
					user_id: userId,
					provider: provider,
					account_id: accountId,
				},
			},
			data: {
				is_deleted: true,
				status: "disconnected",
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get all accounts for a user
	 */
	async getUserAccounts(
		userId: string,
		provider?: string,
		includeDeleted = false,
	): Promise<UnipileAccount[]> {
		return await this.db.unipileAccount.findMany({
			where: {
				user_id: userId,
				...(provider ? { provider } : {}),
				...(includeDeleted ? {} : { is_deleted: false }),
			},
			orderBy: { created_at: "desc" },
		});
	}

	/**
	 * Check if account is active
	 */
	async isAccountActive(
		userId: string,
		accountId: string,
		provider: string,
	): Promise<boolean> {
		const count = await this.db.unipileAccount.count({
			where: {
				user_id: userId,
				account_id: accountId,
				provider: provider,
				status: "connected",
				is_deleted: false,
			},
		});

		return count > 0;
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
		const [stats] = await this.db.$queryRaw<
			[
				{
					total_accounts: number;
					connected_accounts: number;
					disconnected_accounts: number;
					error_accounts: number;
				},
			]
		>`
			SELECT 
				COUNT(*)::int as total_accounts,
				COUNT(*) FILTER (WHERE status = 'connected')::int as connected_accounts,
				COUNT(*) FILTER (WHERE status = 'disconnected')::int as disconnected_accounts,
				COUNT(*) FILTER (WHERE status = 'error')::int as error_accounts
			FROM "UnipileAccount"
			WHERE user_id = ${userId} AND is_deleted = false
		`;

		return {
			totalAccounts: stats?.total_accounts || 0,
			connectedAccounts: stats?.connected_accounts || 0,
			disconnectedAccounts: stats?.disconnected_accounts || 0,
			errorAccounts: stats?.error_accounts || 0,
		};
	}
}
