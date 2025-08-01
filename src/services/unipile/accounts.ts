import type {
	Prisma,
	PrismaClient,
	UnipileAccount,
	UnipileAccountStatus,
	User,
} from "generated/prisma";
import { db } from "~/db";

export interface UnipileAccountWithUser extends UnipileAccount {
	user: User;
}

export type CreateUnipileAccountData = Prisma.UnipileAccountCreateInput;

export type UpdateUnipileAccountData = Prisma.UnipileAccountUpdateInput;

export class UnipileAccountService {
	constructor(private readonly db: PrismaClient) {}
	/**
	 * Find a Unipile account by account ID and provider
	 */
	public async findByAccountId(
		accountId: string,
		provider: string,
		includeUser = false,
	): Promise<UnipileAccountWithUser | UnipileAccount | null> {
		return await this.db.unipileAccount.findFirst({
			where: {
				account_id: accountId,
				provider,
				is_deleted: false,
			},
			include: includeUser ? { user: true } : undefined,
		});
	}

	/**
	 * Find all Unipile accounts for a user
	 */
	public async findByUserId(userId: string): Promise<UnipileAccount[]> {
		return await this.db.unipileAccount.findMany({
			where: {
				user_id: userId,
				is_deleted: false,
			},
			orderBy: {
				created_at: "desc",
			},
		});
	}

	/**
	 * Find Unipile accounts by provider for a user
	 */
	public async findByUserAndProvider(
		userId: string,
		provider: string,
	): Promise<UnipileAccount[]> {
		return await this.db.unipileAccount.findMany({
			where: {
				user_id: userId,
				provider,
				is_deleted: false,
			},
			orderBy: {
				created_at: "desc",
			},
		});
	}

	/**
	 * Create a new Unipile account
	 */
	public async create(data: CreateUnipileAccountData): Promise<UnipileAccount> {
		return await this.db.unipileAccount.create({
			data: {
				...data,
				status: data.status || "connected",
			},
		});
	}

	/**
	 * Update a Unipile account
	 */
	public async update(
		id: string,
		data: UpdateUnipileAccountData,
	): Promise<UnipileAccount> {
		return await this.db.unipileAccount.update({
			where: { id },
			data: {
				...data,
				updated_at: new Date(),
			},
		});
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
		return await this.db.unipileAccount.upsert({
			where: {
				user_id_provider_account_id: {
					user_id: userId,
					provider,
					account_id: accountId,
				},
			},
			update: {
				...updateData,
				updated_at: new Date(),
			},
			create: data,
		});
	}

	/**
	 * Delete a Unipile account (soft delete)
	 */
	public async delete(id: string): Promise<UnipileAccount> {
		return await this.db.unipileAccount.update({
			where: { id },
			data: {
				is_deleted: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Update account status
	 */
	public async updateStatus(
		id: string,
		status: UnipileAccountStatus,
	): Promise<UnipileAccount> {
		return await this.db.unipileAccount.update({
			where: { id },
			data: {
				status,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get account statistics for a user
	 */
	public async getAccountStats(userId: string) {
		const accounts = await this.db.unipileAccount.findMany({
			where: {
				user_id: userId,
				is_deleted: false,
			},
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
