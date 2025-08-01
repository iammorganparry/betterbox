import {
	eq,
	and,
	or,
	desc,
	asc,
	count,
	getTableColumns,
	sql,
	inArray,
	ilike,
	lt,
	gt,
} from "drizzle-orm";
import type { db } from "~/db";
import {
	unipileMessages,
	unipileMessageAttachments,
	unipileChats,
	type unipileAccounts,
	type unipileChatAttendees,
	type users,
	type unipileAttachmentTypeEnum,
} from "~/db/schema";

// Use Drizzle's inferred types
export type UnipileMessage = typeof unipileMessages.$inferSelect;
export type UnipileMessageAttachment =
	typeof unipileMessageAttachments.$inferSelect;
export type CreateMessageData = typeof unipileMessages.$inferInsert;
export type UpdateMessageData = Partial<CreateMessageData>;
export type CreateAttachmentData =
	typeof unipileMessageAttachments.$inferInsert;
export type UpdateAttachmentData = Partial<CreateAttachmentData>;
export type UnipileAttachmentType =
	(typeof unipileAttachmentTypeEnum.enumValues)[number];

// Message with various include options
export type MessageWithAttachments = UnipileMessage & {
	UnipileMessageAttachment: UnipileMessageAttachment[];
};

export type MessageWithChat = UnipileMessage & {
	chat: typeof unipileChats.$inferSelect;
};

export type MessageWithAccount = UnipileMessage & {
	unipile_account: typeof unipileAccounts.$inferSelect;
};

export type MessageWithAccountAndAttachments = UnipileMessage & {
	unipileAccount: typeof unipileAccounts.$inferSelect;
	unipileMessageAttachments: UnipileMessageAttachment[];
};

export type MessageWithDetails = UnipileMessage & {
	unipileMessageAttachment: UnipileMessageAttachment[];
	chat: typeof unipileChats.$inferSelect & {
		UnipileChatAttendee: (typeof unipileChatAttendees.$inferSelect)[];
	};
	unipile_account: typeof unipileAccounts.$inferSelect & {
		user: typeof users.$inferSelect;
	};
};

export interface FindMessagesOptions {
	include_attachments?: boolean;
	include_chat?: boolean;
	include_account?: boolean;
	include_deleted?: boolean;
	limit?: number;
	offset?: number;
	order_by?: "created_at" | "updated_at" | "sent_at";
	order_direction?: "asc" | "desc";
	message_type?: string;
	is_outgoing?: boolean;
	is_read?: boolean;
}

export class UnipileMessageService {
	constructor(private readonly drizzleDb: typeof db) {}

	/**
	 * Find message by unique constraint
	 */
	async findMessageByExternalId(
		unipileAccountId: string,
		externalId: string,
		includeDeleted = false,
	): Promise<UnipileMessage | null> {
		const conditions = [
			eq(unipileMessages.unipile_account_id, unipileAccountId),
			eq(unipileMessages.external_id, externalId),
		];

		if (!includeDeleted) {
			conditions.push(eq(unipileMessages.is_deleted, false));
		}

		const result = await this.drizzleDb
			.select()
			.from(unipileMessages)
			.where(and(...conditions))
			.limit(1);

		return result[0] || null;
	}

	/**
	 * Create or update a message
	 */
	async upsertMessage(
		unipileAccountId: string,
		externalId: string,
		data: Partial<UpdateMessageData>,
	): Promise<UnipileMessage> {
		const result = await this.drizzleDb
			.insert(unipileMessages)
			.values({
				...data,
				updated_at: new Date(),
				unipile_account_id: unipileAccountId,
				external_id: externalId,
				is_read: false,
				is_outgoing: false,
				message_type: "text",
			})
			.onConflictDoUpdate({
				target: [
					unipileMessages.unipile_account_id,
					unipileMessages.external_id,
				],
				set: {
					...data,
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
	 * Get messages for a specific chat
	 */
	async getMessagesByChat(
		chatId: string,
		options: FindMessagesOptions = {},
	): Promise<UnipileMessage[]> {
		const {
			include_attachments = false,
			include_chat = false,
			include_account = false,
			include_deleted = false,
			limit,
			offset,
			order_by = "sent_at",
			order_direction = "asc",
			message_type,
			is_outgoing,
			is_read,
		} = options;

		const conditions = [eq(unipileMessages.chat_id, chatId)];

		if (!include_deleted) {
			conditions.push(eq(unipileMessages.is_deleted, false));
		}

		if (message_type) {
			conditions.push(eq(unipileMessages.message_type, message_type));
		}

		if (is_outgoing !== undefined) {
			conditions.push(eq(unipileMessages.is_outgoing, is_outgoing));
		}

		if (is_read !== undefined) {
			conditions.push(eq(unipileMessages.is_read, is_read));
		}

		const results = await this.drizzleDb
			.select()
			.from(unipileMessages)
			.where(and(...conditions))
			.orderBy(
				order_direction === "desc"
					? desc(unipileMessages[order_by])
					: asc(unipileMessages[order_by]),
			)
			.limit(limit ?? 100)
			.offset(offset ?? 0);

		return results;
	}

	/**
	 * Get messages for a Unipile account
	 */
	async getMessagesByAccount(
		unipileAccountId: string,
		options: FindMessagesOptions = {},
	): Promise<UnipileMessage[]> {
		const {
			include_attachments = false,
			include_chat = false,
			include_deleted = false,
			limit,
			offset,
			order_by = "sent_at",
			order_direction = "desc",
			message_type,
			is_outgoing,
			is_read,
		} = options;

		const conditions = [
			eq(unipileMessages.unipile_account_id, unipileAccountId),
		];

		if (!include_deleted) {
			conditions.push(eq(unipileMessages.is_deleted, false));
		}

		if (message_type) {
			conditions.push(eq(unipileMessages.message_type, message_type));
		}

		if (is_outgoing !== undefined) {
			conditions.push(eq(unipileMessages.is_outgoing, is_outgoing));
		}

		if (is_read !== undefined) {
			conditions.push(eq(unipileMessages.is_read, is_read));
		}

		// TODO: Implement include_attachments and include_chat with relational queries when needed
		const results = await this.drizzleDb
			.select()
			.from(unipileMessages)
			.where(and(...conditions))
			.orderBy(
				order_direction === "desc"
					? desc(unipileMessages[order_by])
					: asc(unipileMessages[order_by]),
			)
			.limit(limit ?? 100)
			.offset(offset ?? 0);

		return results;
	}

	/**
	 * Get messages for a user across all accounts
	 */
	async getMessagesByUser(
		userId: string,
		provider?: string,
		options: FindMessagesOptions = {},
	): Promise<UnipileMessage[]> {
		const {
			include_attachments = false,
			include_chat = false,
			include_account = false,
			include_deleted = false,
			limit,
			offset,
			order_by = "sent_at",
			order_direction = "desc",
			message_type,
			is_outgoing,
			is_read,
		} = options;

		// TODO: Implement proper join with unipile_accounts table for user filtering
		// For now, simplified query without account filtering
		const conditions = [];

		if (!include_deleted) {
			conditions.push(eq(unipileMessages.is_deleted, false));
		}

		if (message_type) {
			conditions.push(eq(unipileMessages.message_type, message_type));
		}

		if (is_outgoing !== undefined) {
			conditions.push(eq(unipileMessages.is_outgoing, is_outgoing));
		}

		if (is_read !== undefined) {
			conditions.push(eq(unipileMessages.is_read, is_read));
		}

		// TODO: Add proper join with unipileAccounts to filter by userId and provider
		const results = await this.drizzleDb
			.select()
			.from(unipileMessages)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(
				order_direction === "desc"
					? desc(unipileMessages[order_by])
					: asc(unipileMessages[order_by]),
			)
			.limit(limit ?? 100)
			.offset(offset ?? 0);

		return results;
	}

	/**
	 * Mark message as read
	 */
	async markMessageAsRead(messageId: string): Promise<UnipileMessage> {
		const result = await this.drizzleDb
			.update(unipileMessages)
			.set({
				is_read: true,
				updated_at: new Date(),
			})
			.where(eq(unipileMessages.id, messageId))
			.returning();

		if (!result[0]) {
			throw new Error(`Message not found: ${messageId}`);
		}
		return result[0];
	}

	/**
	 * Mark multiple messages as read
	 */
	async markMessagesAsRead(messageIds: string[]): Promise<{ count: number }> {
		const result = await this.drizzleDb
			.update(unipileMessages)
			.set({
				is_read: true,
				updated_at: new Date(),
			})
			.where(
				and(
					inArray(unipileMessages.id, messageIds),
					eq(unipileMessages.is_deleted, false),
				),
			);

		// Note: Drizzle doesn't return affected count for update operations
		// Return a count based on the input array length for compatibility
		return { count: messageIds.length };
	}

	/**
	 * Mark all chat messages as read
	 */
	async markChatMessagesAsRead(chatId: string): Promise<{ count: number }> {
		await this.drizzleDb
			.update(unipileMessages)
			.set({
				is_read: true,
				updated_at: new Date(),
			})
			.where(
				and(
					eq(unipileMessages.chat_id, chatId),
					eq(unipileMessages.is_deleted, false),
					eq(unipileMessages.is_read, false),
				),
			);

		// Note: Drizzle doesn't return affected count for update operations
		// Return a simplified count for compatibility
		return { count: 0 };
	}

	/**
	 * Get unread message count for a chat
	 */
	async getUnreadMessageCount(chatId: string): Promise<number> {
		const result = await this.drizzleDb
			.select({ count: count() })
			.from(unipileMessages)
			.where(
				and(
					eq(unipileMessages.chat_id, chatId),
					eq(unipileMessages.is_deleted, false),
					eq(unipileMessages.is_read, false),
					eq(unipileMessages.is_outgoing, false), // Only count incoming messages
				),
			);

		return result[0]?.count || 0;
	}

	/**
	 * Get unread message count for a user
	 */
	async getUnreadMessageCountByUser(
		userId: string,
		provider?: string,
	): Promise<number> {
		// TODO: Implement proper join with unipile_accounts table for user filtering
		const result = await this.drizzleDb
			.select({ count: count() })
			.from(unipileMessages)
			.where(
				and(
					eq(unipileMessages.is_deleted, false),
					eq(unipileMessages.is_read, false),
					eq(unipileMessages.is_outgoing, false),
				),
			);

		return result[0]?.count || 0;
	}

	/**
	 * Search messages by content
	 */
	async searchMessages(
		unipileAccountId: string,
		searchTerm: string,
		options: FindMessagesOptions = {},
	): Promise<UnipileMessage[]> {
		const {
			limit = 50,
			include_chat = true,
			include_attachments = false,
		} = options;

		// TODO: Implement include_chat and include_attachments with relational queries when needed
		const results = await this.drizzleDb
			.select()
			.from(unipileMessages)
			.where(
				and(
					eq(unipileMessages.unipile_account_id, unipileAccountId),
					eq(unipileMessages.is_deleted, false),
					ilike(unipileMessages.content, `%${searchTerm}%`),
				),
			)
			.orderBy(desc(unipileMessages.sent_at))
			.limit(limit);

		return results;
	}

	/**
	 * Get latest message for each chat
	 */
	async getLatestMessagesPerChat(
		unipileAccountId: string,
		limit = 20,
	): Promise<UnipileMessage[]> {
		// Get the latest message for each chat using raw SQL
		const latestMessages = await this.drizzleDb.execute(sql`
			SELECT DISTINCT ON (chat_id) *
			FROM "unipile_message"
			WHERE unipile_account_id = ${unipileAccountId}
			  AND is_deleted = false
			  AND chat_id IS NOT NULL
			ORDER BY chat_id, sent_at DESC
			LIMIT ${limit}
		`);

		return latestMessages.map((row) => row as UnipileMessage);
	}

	/**
	 * Mark message as deleted (soft delete)
	 */
	async markMessageAsDeleted(messageId: string): Promise<UnipileMessage> {
		// First, get the message to know which chat to update
		const messageResult = await this.drizzleDb
			.select({ chat_id: unipileMessages.chat_id })
			.from(unipileMessages)
			.where(eq(unipileMessages.id, messageId))
			.limit(1);

		if (!messageResult[0]?.chat_id) {
			throw new Error(`Message not found: ${messageId}`);
		}

		// Mark the message as deleted
		const deletedMessageResult = await this.drizzleDb
			.update(unipileMessages)
			.set({
				is_deleted: true,
				updated_at: new Date(),
			})
			.where(eq(unipileMessages.id, messageId))
			.returning();

		if (!deletedMessageResult[0]) {
			throw new Error(`Failed to delete message: ${messageId}`);
		}

		// Recalculate chat statistics after deletion
		const stats = await this.getChatMessageStats(messageResult[0].chat_id);

		// Update the chat's cached statistics
		await this.drizzleDb
			.update(unipileChats)
			.set({
				unread_count: stats.unreadMessages,
				last_message_at: stats.lastMessageAt,
				updated_at: new Date(),
			})
			.where(eq(unipileChats.id, messageResult[0].chat_id));

		return deletedMessageResult[0];
	}

	/**
	 * Get message statistics for a chat
	 */
	async getChatMessageStats(chatId: string): Promise<{
		totalMessages: number;
		outgoingMessages: number;
		incomingMessages: number;
		unreadMessages: number;
		lastMessageAt: Date | null;
	}> {
		const statsResult = await this.drizzleDb.execute<{
			total_messages: number;
			outgoing_messages: number;
			incoming_messages: number;
			unread_messages: number;
			last_message_at: Date | null;
		}>(sql`
			SELECT 
				COUNT(*)::int as total_messages,
				COUNT(*) FILTER (WHERE is_outgoing = true)::int as outgoing_messages,
				COUNT(*) FILTER (WHERE is_outgoing = false)::int as incoming_messages,
				COUNT(*) FILTER (WHERE is_read = false AND is_outgoing = false)::int as unread_messages,
				MAX(sent_at) as last_message_at
			FROM "unipile_message"
			WHERE chat_id = ${chatId} AND is_deleted = false
		`);

		const stats = statsResult[0] || null;

		return {
			totalMessages: stats?.total_messages || 0,
			outgoingMessages: stats?.outgoing_messages || 0,
			incomingMessages: stats?.incoming_messages || 0,
			unreadMessages: stats?.unread_messages || 0,
			lastMessageAt: stats?.last_message_at || null,
		};
	}

	/**
	 * ATTACHMENT OPERATIONS
	 */

	/**
	 * Find attachment by unique constraint
	 */
	async findAttachmentByExternalId(
		messageId: string,
		externalId: string,
		includeDeleted = false,
	): Promise<UnipileMessageAttachment | null> {
		const conditions = [
			eq(unipileMessageAttachments.message_id, messageId),
			eq(unipileMessageAttachments.external_id, externalId),
		];

		if (!includeDeleted) {
			conditions.push(eq(unipileMessageAttachments.is_deleted, false));
		}

		const result = await this.drizzleDb
			.select()
			.from(unipileMessageAttachments)
			.where(and(...conditions))
			.limit(1);

		return result[0] || null;
	}

	/**
	 * Create or update an attachment
	 */
	async upsertAttachment(
		messageId: string,
		externalId: string,
		updateData: Partial<UpdateAttachmentData>,
		createData?: Partial<CreateAttachmentData>,
	): Promise<UnipileMessageAttachment> {
		const result = await this.drizzleDb
			.insert(unipileMessageAttachments)
			.values({
				message_id: messageId,
				external_id: externalId,
				attachment_type: "file",
				...updateData,
				...createData,
			})
			.onConflictDoUpdate({
				target: [
					unipileMessageAttachments.message_id,
					unipileMessageAttachments.external_id,
				],
				set: {
					...updateData,
					updated_at: new Date(),
				},
			})
			.returning();

		if (!result[0]) {
			throw new Error("Failed to upsert attachment");
		}
		return result[0];
	}

	/**
	 * Get attachments for a message
	 */
	async getAttachmentsByMessage(
		messageId: string,
		includeDeleted = false,
	): Promise<UnipileMessageAttachment[]> {
		const conditions = [eq(unipileMessageAttachments.message_id, messageId)];

		if (!includeDeleted) {
			conditions.push(eq(unipileMessageAttachments.is_deleted, false));
		}

		const results = await this.drizzleDb
			.select()
			.from(unipileMessageAttachments)
			.where(and(...conditions))
			.orderBy(asc(unipileMessageAttachments.created_at));

		return results;
	}

	/**
	 * Get attachments for a chat
	 */
	async getAttachmentsByChat(
		chatId: string,
		attachmentType?: string,
		limit = 50,
	): Promise<UnipileMessageAttachment[]> {
		// TODO: Implement proper join with unipile_messages table for chat filtering
		const conditions = [eq(unipileMessageAttachments.is_deleted, false)];

		if (attachmentType) {
			conditions.push(
				eq(
					unipileMessageAttachments.attachment_type,
					attachmentType as UnipileAttachmentType,
				),
			);
		}

		const results = await this.drizzleDb
			.select()
			.from(unipileMessageAttachments)
			.where(and(...conditions))
			.orderBy(desc(unipileMessageAttachments.created_at))
			.limit(limit);

		return results;
	}

	/**
	 * Mark attachment as deleted (soft delete)
	 */
	async markAttachmentAsDeleted(
		attachmentId: string,
	): Promise<UnipileMessageAttachment> {
		const result = await this.drizzleDb
			.update(unipileMessageAttachments)
			.set({
				is_deleted: true,
				updated_at: new Date(),
			})
			.where(eq(unipileMessageAttachments.id, attachmentId))
			.returning();

		if (!result[0]) {
			throw new Error(`Attachment not found: ${attachmentId}`);
		}
		return result[0];
	}

	/**
	 * Bulk create attachments
	 */
	async bulkCreateAttachments(
		attachmentsData: CreateAttachmentData[],
	): Promise<{ count: number }> {
		const result = await this.drizzleDb
			.insert(unipileMessageAttachments)
			.values(attachmentsData)
			.onConflictDoNothing();

		// Note: Drizzle doesn't return affected count for insert operations
		// Return a count based on the input array length for compatibility
		return { count: attachmentsData.length };
	}

	/**
	 * Get message with full details (attachments, chat, account)
	 */
	async getMessageWithDetails(
		messageId: string,
	): Promise<MessageWithAccountAndAttachments | null> {
		// TODO: Implement proper relational queries using Drizzle's query API for full MessageWithDetails
		const result = await this.drizzleDb.query.unipileMessages.findFirst({
			where: eq(unipileMessages.id, messageId),
			with: {
				unipileMessageAttachments: true,
				unipileAccount: true,
			},
		});

		return result || null;
	}

	/**
	 * Get message thread (messages around a specific message)
	 */
	async getMessageThread(
		messageId: string,
		contextCount = 5,
	): Promise<{
		message: UnipileMessage;
		previousMessages: UnipileMessage[];
		nextMessages: UnipileMessage[];
	}> {
		const messageResult = await this.drizzleDb
			.select()
			.from(unipileMessages)
			.where(eq(unipileMessages.id, messageId))
			.limit(1);

		if (!messageResult[0] || !messageResult[0].chat_id) {
			throw new Error(`Message not found: ${messageId}`);
		}

		const message = messageResult[0];

		const [previousMessages, nextMessages] = await Promise.all([
			// Get messages before this one
			this.drizzleDb
				.select()
				.from(unipileMessages)
				.where(
					and(
						message.chat_id
							? eq(unipileMessages.chat_id, message.chat_id)
							: sql`false`,
						...(message.sent_at
							? [lt(unipileMessages.sent_at, message.sent_at)]
							: []),
						eq(unipileMessages.is_deleted, false),
					),
				)
				.orderBy(desc(unipileMessages.sent_at))
				.limit(contextCount),
			// Get messages after this one
			this.drizzleDb
				.select()
				.from(unipileMessages)
				.where(
					and(
						message.chat_id
							? eq(unipileMessages.chat_id, message.chat_id)
							: sql`false`,
						...(message.sent_at
							? [gt(unipileMessages.sent_at, message.sent_at)]
							: []),
						eq(unipileMessages.is_deleted, false),
					),
				)
				.orderBy(asc(unipileMessages.sent_at))
				.limit(contextCount),
		]);

		// TODO: Implement attachment loading for messages
		return {
			message: message,
			previousMessages: previousMessages.reverse(), // Reverse to chronological order
			nextMessages: nextMessages,
		};
	}
}
