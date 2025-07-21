import { db } from "~/server/db";
import type { Prisma, PrismaClient } from "generated/prisma";
import type {
	UnipileMessage,
	UnipileMessageCreateInput,
	UnipileMessageUpdateInput,
	UnipileMessageType,
} from "~/types/unipile-message";

export class UnipileMessageService {
	constructor(private readonly db: PrismaClient) {}

	/**
	 * Find message by ID
	 */
	public async findById(id: string): Promise<UnipileMessage | null> {
		return await this.db.unipileMessage.findUnique({
			where: { id },
		});
	}

	/**
	 * Find message by external ID
	 */
	public async findByExternalId(
		accountId: string,
		externalId: string,
	): Promise<UnipileMessage | null> {
		return await this.db.unipileMessage.findUnique({
			where: {
				unipile_account_id_external_id: {
					unipile_account_id: accountId,
					external_id: externalId,
				},
			},
		});
	}

	/**
	 * Create a new message
	 */
	public async create(
		data: UnipileMessageCreateInput,
	): Promise<UnipileMessage> {
		return await this.db.unipileMessage.create({
			data,
		});
	}

	/**
	 * Update message by ID
	 */
	public async update(
		id: string,
		data: UnipileMessageUpdateInput,
	): Promise<UnipileMessage> {
		return await this.db.unipileMessage.update({
			where: { id },
			data: {
				...data,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Upsert message by external ID
	 * Used heavily in webhook and sync processing
	 */
	public async upsertByExternalId(
		accountId: string,
		externalId: string,
		createData: UnipileMessageCreateInput,
		updateData?: UnipileMessageUpdateInput,
	): Promise<UnipileMessage> {
		return await db.unipileMessage.upsert({
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
	 * Soft delete message
	 */
	public async softDelete(id: string): Promise<UnipileMessage> {
		return await this.db.unipileMessage.update({
			where: { id },
			data: {
				is_deleted: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get messages for an account
	 */
	public async findByAccountId(
		accountId: string,
		options: {
			limit?: number;
			offset?: number;
			includeDeleted?: boolean;
			chatId?: string;
			isOutgoing?: boolean;
		} = {},
	) {
		const {
			limit = 50,
			offset = 0,
			includeDeleted = false,
			chatId,
			isOutgoing,
		} = options;

		return await db.unipileMessage.findMany({
			where: {
				unipile_account_id: accountId,
				...(includeDeleted ? {} : { is_deleted: false }),
				...(chatId ? { chat_id: chatId } : {}),
				...(isOutgoing !== undefined ? { is_outgoing: isOutgoing } : {}),
			},
			orderBy: { sent_at: "desc" },
			skip: offset,
			take: limit,
		});
	}

	/**
	 * Get messages for a chat
	 */
	public async findByChatId(
		chatId: string,
		options: {
			limit?: number;
			offset?: number;
			includeDeleted?: boolean;
		} = {},
	) {
		const { limit = 100, offset = 0, includeDeleted = false } = options;

		return await db.unipileMessage.findMany({
			where: {
				chat_id: chatId,
				...(includeDeleted ? {} : { is_deleted: false }),
			},
			orderBy: { sent_at: "asc" }, // Chronological order for chat
			skip: offset,
			take: limit,
		});
	}

	/**
	 * Get message with account details
	 */
	public async findWithAccount(id: string) {
		return await this.db.unipileMessage.findUnique({
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
	 * Mark messages as read
	 */
	public async markAsRead(messageIds: string[]): Promise<void> {
		await this.db.unipileMessage.updateMany({
			where: {
				id: { in: messageIds },
			},
			data: {
				is_read: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Mark all messages in chat as read
	 */
	public async markChatAsRead(
		chatId: string,
		accountId: string,
	): Promise<void> {
		await db.unipileMessage.updateMany({
			where: {
				chat_id: chatId,
				unipile_account_id: accountId,
				is_read: false,
			},
			data: {
				is_read: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get unread message count for account
	 */
	public async getUnreadCount(accountId: string): Promise<number> {
		return await this.db.unipileMessage.count({
			where: {
				unipile_account_id: accountId,
				is_read: false,
				is_deleted: false,
				is_outgoing: false, // Only count incoming messages
			},
		});
	}

	/**
	 * Get recent messages for user (across all accounts)
	 */
	public async getRecentForUser(
		userId: string,
		options: {
			limit?: number;
			includeOutgoing?: boolean;
		} = {},
	) {
		const { limit = 20, includeOutgoing = true } = options;

		return await db.unipileMessage.findMany({
			where: {
				unipile_account: {
					user_id: userId,
					is_deleted: false,
				},
				is_deleted: false,
				...(includeOutgoing ? {} : { is_outgoing: false }),
			},
			include: {
				unipile_account: {
					select: {
						provider: true,
						account_id: true,
					},
				},
			},
			orderBy: { sent_at: "desc" },
			take: limit,
		});
	}

	/**
	 * Search messages by content
	 */
	public async search(
		accountId: string,
		query: string,
		options: {
			limit?: number;
			offset?: number;
		} = {},
	) {
		const { limit = 50, offset = 0 } = options;

		return await db.unipileMessage.findMany({
			where: {
				unipile_account_id: accountId,
				is_deleted: false,
				content: {
					contains: query,
					mode: "insensitive",
				},
			},
			orderBy: { sent_at: "desc" },
			skip: offset,
			take: limit,
		});
	}

	/**
	 * Get message statistics for account
	 */
	public async getAccountStats(accountId: string) {
		const [total, outgoing, incoming, unread] = await Promise.all([
			db.unipileMessage.count({
				where: { unipile_account_id: accountId, is_deleted: false },
			}),
			db.unipileMessage.count({
				where: {
					unipile_account_id: accountId,
					is_deleted: false,
					is_outgoing: true,
				},
			}),
			db.unipileMessage.count({
				where: {
					unipile_account_id: accountId,
					is_deleted: false,
					is_outgoing: false,
				},
			}),
			db.unipileMessage.count({
				where: {
					unipile_account_id: accountId,
					is_deleted: false,
					is_read: false,
					is_outgoing: false,
				},
			}),
		]);

		return {
			total,
			outgoing,
			incoming,
			unread,
		};
	}

	/**
	 * List messages with pagination
	 */
	public async list(
		options: {
			page?: number;
			limit?: number;
			accountId?: string;
			chatId?: string;
			messageType?: UnipileMessageType;
			isOutgoing?: boolean;
			isRead?: boolean;
			includeDeleted?: boolean;
		} = {},
	) {
		const {
			page = 1,
			limit = 50,
			accountId,
			chatId,
			messageType,
			isOutgoing,
			isRead,
			includeDeleted = false,
		} = options;
		const skip = (page - 1) * limit;

		const whereClause: Prisma.UnipileMessageWhereInput = {
			...(includeDeleted ? {} : { is_deleted: false }),
			...(accountId ? { unipile_account_id: accountId } : {}),
			...(chatId ? { chat_id: chatId } : {}),
			...(messageType ? { message_type: messageType } : {}),
			...(isOutgoing !== undefined ? { is_outgoing: isOutgoing } : {}),
			...(isRead !== undefined ? { is_read: isRead } : {}),
		};

		const [messages, total] = await Promise.all([
			db.unipileMessage.findMany({
				where: whereClause,
				skip,
				take: limit,
				orderBy: { sent_at: "desc" },
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
			db.unipileMessage.count({ where: whereClause }),
		]);

		return {
			messages,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		};
	}

	/**
	 * Batch create messages (for bulk sync)
	 */
	public async batchCreate(
		messages: Prisma.UnipileMessageCreateManyInput[],
	): Promise<void> {
		// Use createMany for better performance
		await db.unipileMessage.createMany({
			data: messages,
			skipDuplicates: true, // Skip if external_id already exists
		});
	}
}
