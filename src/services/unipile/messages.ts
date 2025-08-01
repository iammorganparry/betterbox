import type { Prisma, PrismaClient } from "generated/prisma";
import { db } from "~/db";

export type CreateUnipileMessageData = Prisma.UnipileMessageCreateInput;

export type UpdateUnipileMessageData = Prisma.UnipileMessageUpdateInput;

export class UnipileMessageService {
	constructor(private readonly db: PrismaClient) {}
	/**
	 * Find messages by Unipile account
	 */
	public async findByAccount(accountId: string, limit = 50, offset = 0) {
		return this.db.unipileMessage.findMany({
			where: {
				unipile_account_id: accountId,
				is_deleted: false,
			},
			orderBy: {
				sent_at: "desc",
			},
			take: limit,
			skip: offset,
		});
	}

	/**
	 * Find messages by chat ID
	 */
	public async findByChatId(chatId: string, limit = 50) {
		return this.db.unipileMessage.findMany({
			where: {
				chat_id: chatId,
				is_deleted: false,
			},
			orderBy: {
				sent_at: "asc",
			},
			take: limit,
		});
	}

	/**
	 * Find unread messages for an account
	 */
	public async findUnreadByAccount(accountId: string) {
		return this.db.unipileMessage.findMany({
			where: {
				unipile_account_id: accountId,
				is_read: false,
				is_deleted: false,
			},
			orderBy: {
				sent_at: "desc",
			},
		});
	}

	/**
	 * Create a new message
	 */
	public async create(data: CreateUnipileMessageData) {
		return this.db.unipileMessage.create({
			data: {
				...data,
				message_type: data.message_type || "text",
				is_read: data.is_read || false,
				is_outgoing: data.is_outgoing || false,
				sent_at: data.sent_at || new Date(),
			},
		});
	}

	/**
	 * Update a message
	 */
	public async update(id: string, data: UpdateUnipileMessageData) {
		return this.db.unipileMessage.update({
			where: { id },
			data: {
				...data,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Upsert a message by external ID
	 */
	public async upsert(
		accountId: string,
		externalId: string,
		createData: CreateUnipileMessageData,
		updateData: UpdateUnipileMessageData,
	) {
		return this.db.unipileMessage.upsert({
			where: {
				unipile_account_id_external_id: {
					unipile_account_id: accountId,
					external_id: externalId,
				},
			},
			update: {
				...updateData,
				updated_at: new Date(),
			},
			create: createData,
		});
	}

	/**
	 * Mark message as read
	 */
	public async markAsRead(id: string) {
		return this.db.unipileMessage.update({
			where: { id },
			data: {
				is_read: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Mark all messages in a chat as read
	 */
	public async markChatAsRead(chatId: string) {
		return this.db.unipileMessage.updateMany({
			where: {
				chat_id: chatId,
				is_read: false,
				is_deleted: false,
			},
			data: {
				is_read: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Delete a message (soft delete)
	 */
	public async delete(id: string) {
		return this.db.unipileMessage.update({
			where: { id },
			data: {
				is_deleted: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get message statistics for an account
	 */
	public async getMessageStats(accountId: string) {
		const total = await this.db.unipileMessage.count({
			where: {
				unipile_account_id: accountId,
				is_deleted: false,
			},
		});

		const unread = await db.unipileMessage.count({
			where: {
				unipile_account_id: accountId,
				is_read: false,
				is_deleted: false,
			},
		});

		const sent = await db.unipileMessage.count({
			where: {
				unipile_account_id: accountId,
				is_outgoing: true,
				is_deleted: false,
			},
		});

		const received = await db.unipileMessage.count({
			where: {
				unipile_account_id: accountId,
				is_outgoing: false,
				is_deleted: false,
			},
		});

		return {
			total,
			unread,
			sent,
			received,
		};
	}

	/**
	 * Get unique chat IDs for an account
	 */
	public async getChatIds(accountId: string) {
		const messages = await this.db.unipileMessage.findMany({
			where: {
				unipile_account_id: accountId,
				is_deleted: false,
				chat_id: {
					not: null,
				},
			},
			select: {
				chat_id: true,
			},
			distinct: ["chat_id"],
		});

		return messages.map((m) => m.chat_id).filter(Boolean);
	}
}
