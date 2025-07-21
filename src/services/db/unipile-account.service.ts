import { db } from "~/server/db";
import type { Prisma, PrismaClient } from "../../../generated/prisma";
import type {
	UnipileAccount,
	UnipileAccountCreateInput,
	UnipileAccountUpdateInput,
	UnipileProvider,
} from "~/types/unipile-account";

export class UnipileAccountService {
	constructor(private readonly db: PrismaClient) {}

	/**
	 * Find account by ID
	 */
	public async findById(id: string): Promise<UnipileAccount | null> {
		return await this.db.unipileAccount.findUnique({
			where: { id },
		});
	}

	/**
	 * Find account by user ID and provider
	 */
	public async findByUserAndProvider(
		userId: string,
		provider: UnipileProvider,
	): Promise<UnipileAccount | null> {
		return await db.unipileAccount.findFirst({
			where: {
				user_id: userId,
				provider,
				is_deleted: false,
			},
		});
	}

	/**
	 * Find account by unique combination (user_id, provider, account_id)
	 */
	public async findByUnique(
		userId: string,
		provider: UnipileProvider,
		accountId: string,
	): Promise<UnipileAccount | null> {
		return await db.unipileAccount.findFirst({
			where: {
				user_id: userId,
				provider,
				account_id: accountId,
				is_deleted: false,
			},
		});
	}

	/**
	 * Create a new Unipile account
	 */
	public async create(
		data: UnipileAccountCreateInput,
	): Promise<UnipileAccount> {
		return await db.unipileAccount.create({
			data,
		});
	}

	/**
	 * Update account by ID
	 */
	public async update(
		id: string,
		data: UnipileAccountUpdateInput,
	): Promise<UnipileAccount> {
		return await db.unipileAccount.update({
			where: { id },
			data: {
				...data,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Upsert account by unique combination
	 * Used heavily in webhook processing
	 */
	public async upsertByUnique(
		userId: string,
		provider: UnipileProvider,
		accountId: string,
		createData: UnipileAccountCreateInput,
		updateData?: UnipileAccountUpdateInput,
	): Promise<UnipileAccount> {
		return await db.unipileAccount.upsert({
			where: {
				user_id_provider_account_id: {
					user_id: userId,
					provider,
					account_id: accountId,
				},
			},
			create: createData,
			update: {
				...updateData,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Soft delete account
	 */
	public async softDelete(id: string): Promise<UnipileAccount> {
		return await this.db.unipileAccount.update({
			where: { id },
			data: {
				is_deleted: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get all accounts for a user
	 */
	public async findByUserId(userId: string, includeDeleted = false) {
		return await this.db.unipileAccount.findMany({
			where: {
				user_id: userId,
				...(includeDeleted ? {} : { is_deleted: false }),
			},
			orderBy: { created_at: "desc" },
		});
	}

	/**
	 * Get account with user details
	 */
	public async findWithUser(id: string) {
		return await this.db.unipileAccount.findUnique({
			where: { id },
			include: {
				user: true,
			},
		});
	}

	/**
	 * Get account with messages and contacts
	 */
	public async findWithRelations(id: string) {
		return await this.db.unipileAccount.findUnique({
			where: { id },
			include: {
				user: true,
				UnipileMessage: {
					where: { is_deleted: false },
					orderBy: { sent_at: "desc" },
					take: 50, // Limit to recent messages
				},
				UnipileContact: {
					where: { is_deleted: false },
					orderBy: { last_interaction: "desc" },
					take: 50, // Limit to recent contacts
				},
			},
		});
	}

	/**
	 * Update account status
	 */
	public async updateStatus(
		id: string,
		status: string,
		providerData?: Record<string, unknown>,
	): Promise<UnipileAccount> {
		return await db.unipileAccount.update({
			where: { id },
			data: {
				status,
				...(providerData
					? { provider_data: providerData as Prisma.InputJsonValue }
					: {}),
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get account statistics
	 */
	public async getAccountStats(id: string) {
		const account = await this.db.unipileAccount.findUnique({
			where: { id },
			include: {
				UnipileMessage: {
					where: { is_deleted: false },
				},
				UnipileContact: {
					where: { is_deleted: false },
				},
			},
		});

		if (!account) return null;

		const totalMessages = account.UnipileMessage.length;
		const outgoingMessages = account.UnipileMessage.filter(
			(m) => m.is_outgoing,
		).length;
		const incomingMessages = totalMessages - outgoingMessages;
		const totalContacts = account.UnipileContact.length;
		const connections = account.UnipileContact.filter(
			(c) => c.is_connection,
		).length;

		return {
			account,
			stats: {
				totalMessages,
				outgoingMessages,
				incomingMessages,
				totalContacts,
				connections,
			},
		};
	}

	/**
	 * List accounts with pagination
	 */
	public async list(
		options: {
			page?: number;
			limit?: number;
			userId?: string;
			provider?: UnipileProvider;
			status?: string;
			includeDeleted?: boolean;
		} = {},
	) {
		const {
			page = 1,
			limit = 50,
			userId,
			provider,
			status,
			includeDeleted = false,
		} = options;
		const skip = (page - 1) * limit;

		const whereClause: Prisma.UnipileAccountWhereInput = {
			...(includeDeleted ? {} : { is_deleted: false }),
			...(userId ? { user_id: userId } : {}),
			...(provider ? { provider } : {}),
			...(status ? { status } : {}),
		};

		const [accounts, total] = await Promise.all([
			db.unipileAccount.findMany({
				where: whereClause,
				skip,
				take: limit,
				orderBy: { created_at: "desc" },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							first_name: true,
							last_name: true,
						},
					},
				},
			}),
			db.unipileAccount.count({ where: whereClause }),
		]);

		return {
			accounts,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Check if account exists
	 */
	public async exists(
		userId: string,
		provider: UnipileProvider,
		accountId: string,
	): Promise<boolean> {
		const account = await this.findByUnique(userId, provider, accountId);
		return !!account;
	}
}
