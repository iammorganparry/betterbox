import { eq, and, desc, asc, count } from "drizzle-orm";
import type { Database } from "~/db";
import { unipileMessages } from "~/db/schema";

export type CreateUnipileMessageData = typeof unipileMessages.$inferInsert;
export type UpdateUnipileMessageData = Partial<
	typeof unipileMessages.$inferInsert
>;

export class UnipileMessageService {
	constructor(private readonly db: Database) {}
	/**
	 * Find messages by Unipile account
	 */
	public async findByAccount(accountId: string, limit = 50, offset = 0) {
		return this.db.query.unipileMessages.findMany({
			where: (table, { eq, and }) =>
				and(
					eq(table.unipile_account_id, accountId),
					eq(table.is_deleted, false),
				),
			orderBy: (table, { desc }) => [desc(table.sent_at)],
			limit,
			offset,
		});
	}

	/**
	 * Find messages by chat ID
	 */
	public async findByChatId(chatId: string, limit = 50) {
		return this.db.query.unipileMessages.findMany({
			where: (table, { eq, and }) =>
				and(eq(table.chat_id, chatId), eq(table.is_deleted, false)),
			orderBy: (table, { asc }) => [asc(table.sent_at)],
			limit,
		});
	}

	/**
	 * Find unread messages for an account
	 */
	public async findUnreadByAccount(accountId: string) {
		return this.db.query.unipileMessages.findMany({
			where: (table, { eq, and }) =>
				and(
					eq(table.unipile_account_id, accountId),
					eq(table.is_read, false),
					eq(table.is_deleted, false),
				),
			orderBy: (table, { desc }) => [desc(table.sent_at)],
		});
	}

	/**
	 * Create a new message
	 */
	public async create(data: CreateUnipileMessageData) {
		const result = await this.db
			.insert(unipileMessages)
			.values({
				...data,
				message_type: data.message_type || "text",
				is_read: data.is_read || false,
				is_outgoing: data.is_outgoing || false,
				sent_at: data.sent_at || new Date(),
			})
			.returning();

		if (!result[0]) {
			throw new Error("Failed to create message");
		}
		return result[0];
	}

	/**
	 * Update a message
	 */
	public async update(id: string, data: UpdateUnipileMessageData) {
		const result = await this.db
			.update(unipileMessages)
			.set({
				...data,
				updated_at: new Date(),
			})
			.where(eq(unipileMessages.id, id))
			.returning();

		if (!result[0]) {
			throw new Error(`Message not found: ${id}`);
		}
		return result[0];
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
		const result = await this.db
			.insert(unipileMessages)
			.values({
				...createData,
				unipile_account_id: accountId,
				external_id: externalId,
			})
			.onConflictDoUpdate({
				target: [
					unipileMessages.unipile_account_id,
					unipileMessages.external_id,
				],
				set: {
					...updateData,
					updated_at: new Date(),
				},
			})
			.returning();

		if (!result[0]) {
			throw new Error("Failed to upsert message");
		}
		return result[0];
	}

	/**
	 * Mark message as read
	 */
	public async markAsRead(id: string) {
		const result = await this.db
			.update(unipileMessages)
			.set({
				is_read: true,
				updated_at: new Date(),
			})
			.where(eq(unipileMessages.id, id))
			.returning();

		if (!result[0]) {
			throw new Error(`Message not found: ${id}`);
		}
		return result[0];
	}

	/**
	 * Mark all messages in a chat as read
	 */
	public async markChatAsRead(chatId: string) {
		await this.db
			.update(unipileMessages)
			.set({
				is_read: true,
				updated_at: new Date(),
			})
			.where(
				and(
					eq(unipileMessages.chat_id, chatId),
					eq(unipileMessages.is_read, false),
					eq(unipileMessages.is_deleted, false),
				),
			);

		// Note: Drizzle doesn't return affected count for update operations
		return { count: 0 }; // Return for compatibility
	}

	/**
	 * Delete a message (soft delete)
	 */
	public async delete(id: string) {
		const result = await this.db
			.update(unipileMessages)
			.set({
				is_deleted: true,
				updated_at: new Date(),
			})
			.where(eq(unipileMessages.id, id))
			.returning();

		if (!result[0]) {
			throw new Error(`Message not found: ${id}`);
		}
		return result[0];
	}

	/**
	 * Get message statistics for an account
	 */
	public async getMessageStats(accountId: string) {
		const [totalResult, unreadResult, sentResult, receivedResult] =
			await Promise.all([
				this.db
					.select({ count: count() })
					.from(unipileMessages)
					.where(
						and(
							eq(unipileMessages.unipile_account_id, accountId),
							eq(unipileMessages.is_deleted, false),
						),
					),
				this.db
					.select({ count: count() })
					.from(unipileMessages)
					.where(
						and(
							eq(unipileMessages.unipile_account_id, accountId),
							eq(unipileMessages.is_read, false),
							eq(unipileMessages.is_deleted, false),
						),
					),
				this.db
					.select({ count: count() })
					.from(unipileMessages)
					.where(
						and(
							eq(unipileMessages.unipile_account_id, accountId),
							eq(unipileMessages.is_outgoing, true),
							eq(unipileMessages.is_deleted, false),
						),
					),
				this.db
					.select({ count: count() })
					.from(unipileMessages)
					.where(
						and(
							eq(unipileMessages.unipile_account_id, accountId),
							eq(unipileMessages.is_outgoing, false),
							eq(unipileMessages.is_deleted, false),
						),
					),
			]);

		return {
			total: totalResult[0]?.count || 0,
			unread: unreadResult[0]?.count || 0,
			sent: sentResult[0]?.count || 0,
			received: receivedResult[0]?.count || 0,
		};
	}

	/**
	 * Get unique chat IDs for an account
	 */
	public async getChatIds(accountId: string) {
		const messages = await this.db
			.select({ chat_id: unipileMessages.chat_id })
			.from(unipileMessages)
			.where(
				and(
					eq(unipileMessages.unipile_account_id, accountId),
					eq(unipileMessages.is_deleted, false),
				),
			);

		// Get unique chat IDs and filter out null values
		const uniqueChatIds = [...new Set(messages.map((m) => m.chat_id))];
		return uniqueChatIds.filter(Boolean);
	}
}
