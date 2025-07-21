import { db } from "~/server/db";
import type { Prisma, PrismaClient } from "generated/prisma";
import type {
	UnipileContact,
	UnipileContactCreateInput,
	UnipileContactUpdateInput,
} from "~/types/unipile-contact";

export class UnipileContactService {
	constructor(private readonly db: PrismaClient) {}

	/**
	 * Find contact by ID
	 */
	public async findById(id: string): Promise<UnipileContact | null> {
		return await db.unipileContact.findUnique({
			where: { id },
		});
	}

	/**
	 * Find contact by external ID
	 */
	public async findByExternalId(
		accountId: string,
		externalId: string,
	): Promise<UnipileContact | null> {
		return await db.unipileContact.findUnique({
			where: {
				unipile_account_id_external_id: {
					unipile_account_id: accountId,
					external_id: externalId,
				},
			},
		});
	}

	/**
	 * Create a new contact
	 */
	public async create(
		data: UnipileContactCreateInput,
	): Promise<UnipileContact> {
		return await db.unipileContact.create({
			data,
		});
	}

	/**
	 * Update contact by ID
	 */
	public async update(
		id: string,
		data: UnipileContactUpdateInput,
	): Promise<UnipileContact> {
		return await db.unipileContact.update({
			where: { id },
			data: {
				...data,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Upsert contact by external ID
	 * Used heavily in webhook and sync processing
	 */
	public async upsertByExternalId(
		accountId: string,
		externalId: string,
		createData: UnipileContactCreateInput,
		updateData?: UnipileContactUpdateInput,
	): Promise<UnipileContact> {
		return await db.unipileContact.upsert({
			where: {
				unipile_account_id_external_id: {
					unipile_account_id: accountId,
					external_id: externalId,
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
	 * Soft delete contact
	 */
	public async softDelete(id: string): Promise<UnipileContact> {
		return await db.unipileContact.update({
			where: { id },
			data: {
				is_deleted: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get contacts for an account
	 */
	public async findByAccountId(
		accountId: string,
		options: {
			limit?: number;
			offset?: number;
			includeDeleted?: boolean;
			isConnection?: boolean;
		} = {},
	) {
		const {
			limit = 50,
			offset = 0,
			includeDeleted = false,
			isConnection,
		} = options;

		return await db.unipileContact.findMany({
			where: {
				unipile_account_id: accountId,
				...(includeDeleted ? {} : { is_deleted: false }),
				...(isConnection !== undefined ? { is_connection: isConnection } : {}),
			},
			orderBy: { last_interaction: "desc" },
			skip: offset,
			take: limit,
		});
	}

	/**
	 * Get contact with account details
	 */
	public async findWithAccount(id: string) {
		return await db.unipileContact.findUnique({
			where: { id },
			include: {
				unipile_account: {
					include: {
						user: true,
					},
				},
			},
		});
	}

	/**
	 * Update last interaction time
	 */
	public async updateLastInteraction(id: string): Promise<UnipileContact> {
		return await db.unipileContact.update({
			where: { id },
			data: {
				last_interaction: new Date(),
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Mark as connection
	 */
	public async markAsConnection(id: string): Promise<UnipileContact> {
		return await db.unipileContact.update({
			where: { id },
			data: {
				is_connection: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Search contacts by name or email
	 */
	public async search(
		accountId: string,
		query: string,
		options: {
			limit?: number;
			offset?: number;
			connectionsOnly?: boolean;
		} = {},
	) {
		const { limit = 50, offset = 0, connectionsOnly = false } = options;

		return await db.unipileContact.findMany({
			where: {
				unipile_account_id: accountId,
				is_deleted: false,
				...(connectionsOnly ? { is_connection: true } : {}),
				OR: [
					{ full_name: { contains: query, mode: "insensitive" } },
					{ headline: { contains: query, mode: "insensitive" } },
				],
			},
			orderBy: { last_interaction: "desc" },
			skip: offset,
			take: limit,
		});
	}

	/**
	 * Get recent contacts for user (across all accounts)
	 */
	public async getRecentForUser(
		userId: string,
		options: {
			limit?: number;
			connectionsOnly?: boolean;
		} = {},
	) {
		const { limit = 20, connectionsOnly = false } = options;

		return await db.unipileContact.findMany({
			where: {
				unipile_account: {
					user_id: userId,
					is_deleted: false,
				},
				is_deleted: false,
				...(connectionsOnly ? { is_connection: true } : {}),
			},
			include: {
				unipile_account: {
					select: {
						provider: true,
						account_id: true,
					},
				},
			},
			orderBy: { last_interaction: "desc" },
			take: limit,
		});
	}

	/**
	 * Get contact statistics for account
	 */
	public async getAccountStats(accountId: string) {
		const [total, connections, recent] = await Promise.all([
			db.unipileContact.count({
				where: { unipile_account_id: accountId, is_deleted: false },
			}),
			db.unipileContact.count({
				where: {
					unipile_account_id: accountId,
					is_deleted: false,
					is_connection: true,
				},
			}),
			db.unipileContact.count({
				where: {
					unipile_account_id: accountId,
					is_deleted: false,
					last_interaction: {
						gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
					},
				},
			}),
		]);

		return {
			total,
			connections,
			recent,
		};
	}

	/**
	 * List contacts with pagination
	 */
	public async list(
		options: {
			page?: number;
			limit?: number;
			accountId?: string;
			isConnection?: boolean;
			search?: string;
			includeDeleted?: boolean;
		} = {},
	) {
		const {
			page = 1,
			limit = 50,
			accountId,
			isConnection,
			search,
			includeDeleted = false,
		} = options;
		const skip = (page - 1) * limit;

		const whereClause: Prisma.UnipileContactWhereInput = {
			...(includeDeleted ? {} : { is_deleted: false }),
			...(accountId ? { unipile_account_id: accountId } : {}),
			...(isConnection !== undefined ? { is_connection: isConnection } : {}),
			...(search
				? {
						OR: [
							{ full_name: { contains: search, mode: "insensitive" } },
							{ headline: { contains: search, mode: "insensitive" } },
						],
					}
				: {}),
		};

		const [contacts, total] = await Promise.all([
			db.unipileContact.findMany({
				where: whereClause,
				skip,
				take: limit,
				orderBy: { last_interaction: "desc" },
				include: {
					unipile_account: {
						select: {
							provider: true,
							account_id: true,
							user: {
								select: {
									id: true,
									email: true,
								},
							},
						},
					},
				},
			}),
			db.unipileContact.count({ where: whereClause }),
		]);

		return {
			contacts,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Batch create contacts (for bulk sync)
	 */
	public async batchCreate(
		contacts: Prisma.UnipileContactCreateManyInput[],
	): Promise<void> {
		// Use createMany for better performance
		await db.unipileContact.createMany({
			data: contacts,
			skipDuplicates: true, // Skip if external_id already exists
		});
	}

	/**
	 * Find or create contact by external ID
	 * Used when processing messages with sender information
	 */
	public async findOrCreateByExternalId(
		accountId: string,
		externalId: string,
		contactData: UnipileContactCreateInput,
	): Promise<UnipileContact> {
		// Try to find existing contact first
		const existing = await this.findByExternalId(accountId, externalId);
		if (existing) {
			// Update last interaction time
			return await this.updateLastInteraction(existing.id);
		}

		// Create new contact
		return await this.create(contactData);
	}
}
