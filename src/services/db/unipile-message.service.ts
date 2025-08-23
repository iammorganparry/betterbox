import {
	type SQL,
	and,
	asc,
	count,
	desc,
	eq,
	getTableColumns,
	gt,
	ilike,
	inArray,
	lt,
	or,
	sql,
} from "drizzle-orm";
import type { db } from "~/db";
import {
	type unipileAccounts,
	type unipileAttachmentTypeEnum,
	type unipileChatAttendees,
	unipileChats,
	unipileMessageAttachments,
	unipileMessages,
	type users,
} from "~/db/schema";
import type { createR2Service } from "../r2/r2.service";
import type { createUnipileService } from "../unipile/unipile.service";

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
				// Override with actual data
				...data,
				// Always set these required fields
				updated_at: new Date(),
				unipile_account_id: unipileAccountId,
				external_id: externalId,
			})
			.onConflictDoUpdate({
				target: [
					unipileMessages.unipile_account_id,
					unipileMessages.external_id,
				],
				set: {
					...data,
					updated_at: new Date(),
					// Preserve existing is_outgoing if not explicitly provided
					is_outgoing: data.is_outgoing,
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
	async getMessagesByChat(chatId: string, options: FindMessagesOptions = {}) {
		// Return any[] to allow for extended types with attachments
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

		if (include_attachments) {
			// Use relational query when attachments are needed
			const conditions: SQL[] = [eq(unipileMessages.chat_id, chatId)];

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

			const results = await this.drizzleDb.query.unipileMessages.findMany({
				where: and(...conditions),
				with: {
					unipileMessageAttachments: {
						where: eq(unipileMessageAttachments.is_deleted, false),
					},
				},
				orderBy:
					order_direction === "desc"
						? desc(unipileMessages[order_by])
						: asc(unipileMessages[order_by]),
				limit: limit ?? 100,
				offset: offset ?? 0,
			});

			return results;
		}

		// Original logic for simple queries without relations
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

		const results = await this.drizzleDb.query.unipileMessages.findMany({
			where: () => and(...conditions),
			with: {
				unipileMessageAttachments: {
					where: eq(unipileMessageAttachments.is_deleted, false),
				},
			},
			orderBy:
				order_direction === "desc"
					? desc(unipileMessages[order_by])
					: asc(unipileMessages[order_by]),
			limit: limit ?? 100,
			offset: offset ?? 0,
		});

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

		// TODO: Implement proper join with unipile_account table for user filtering
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
		// TODO: Implement proper join with unipile_account table for user filtering
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

	/**
	 * Ensure attachment has a valid URL or content available
	 * Prefers R2 URL, falls back to Unipile if R2 is missing and fetches from Unipile + uploads to R2
	 * Note: This method should be called from contexts that have access to injected services
	 * For use in TRPC/API routes, use the injected services instead of this method
	 */
	async ensureAttachmentAvailable(
		attachment: UnipileMessageAttachment,
		unipileAccountId: string,
		unipileService: ReturnType<typeof createUnipileService>,
		r2Service: ReturnType<typeof createR2Service>,
	): Promise<UnipileMessageAttachment> {
		// If we have a valid R2 URL, use it (R2 URLs don't expire)
		if (attachment.r2_url && !attachment.unavailable) {
			console.log(`✅ Using R2 URL for attachment ${attachment.id}`);
			return attachment;
		}

		// Check if Unipile URL needs refreshing
		const unipileNeedsRefresh =
			attachment.unavailable ||
			!attachment.url ||
			(attachment.url_expires_at &&
				attachment.url_expires_at < BigInt(Date.now() + 5 * 60 * 1000)); // Expires within 5 minutes

		// If we have valid Unipile URL and no R2, still use Unipile for now
		if (!unipileNeedsRefresh && !attachment.r2_url) {
			console.log(
				`✅ Using Unipile URL for attachment ${attachment.id} (no R2 available)`,
			);
			return attachment;
		}

		console.log(
			`🔄 Refreshing attachment ${attachment.id} from Unipile and uploading to R2...`,
		);

		try {
			// Get the message to find its external_id for the API call
			const message = await this.drizzleDb
				.select({ external_id: unipileMessages.external_id })
				.from(unipileMessages)
				.where(eq(unipileMessages.id, attachment.message_id))
				.limit(1);

			if (!message[0]) {
				console.warn(`❌ Message not found for attachment ${attachment.id}`);
				return attachment;
			}

			// Fetch fresh attachment data from Unipile using getMessageAttachment (returns base64 content)
			const freshAttachment = await unipileService.getMessageAttachment(
				message[0].external_id,
				attachment.external_id,
				unipileAccountId,
			);

			// Upload to R2 if we have content and no R2 URL yet
			let r2Key: string | undefined = attachment.r2_key ?? undefined;
			let r2Url: string | undefined = attachment.r2_url ?? undefined;
			let r2UploadedAt: Date | undefined = attachment.r2_uploaded_at
				? new Date(attachment.r2_uploaded_at)
				: undefined;

			if (freshAttachment.content && !r2Url) {
				try {
					// Convert base64 to Uint8Array
					const binaryData = Uint8Array.from(
						atob(freshAttachment.content),
						(c) => c.charCodeAt(0),
					);

					// Generate R2 key if we don't have one
					if (!r2Key) {
						r2Key = r2Service.generateAttachmentKey(
							attachment.message_id,
							attachment.filename || "",
							freshAttachment.mime_type || attachment.mime_type || "",
						);
					}

					// Upload to R2
					r2Url = await r2Service.upload(
						r2Key,
						binaryData,
						freshAttachment.mime_type ||
							attachment.mime_type ||
							"application/octet-stream",
						{
							originalFilename: attachment.filename || "attachment",
							messageId: attachment.message_id,
							attachmentId: attachment.external_id,
						},
					);

					r2UploadedAt = new Date();

					console.log(
						`✅ Uploaded attachment ${attachment.id} to R2: ${r2Key}`,
					);
				} catch (r2Error) {
					console.warn(
						`⚠️ Failed to upload attachment ${attachment.id} to R2:`,
						r2Error,
					);
					// Continue without R2 - we'll still update with Unipile data
				}
			}

			// Update the attachment in the database with fresh data + R2 info
			const updatedAttachment = await this.upsertAttachment(
				attachment.message_id,
				attachment.external_id,
				{
					// Only update fields we can get from getMessageAttachment
					content: r2Url ? undefined : freshAttachment.content, // Only store base64 if no R2
					mime_type: freshAttachment.mime_type || attachment.mime_type,
					unavailable: false, // We successfully got content
					// R2 fields
					r2_key: r2Key,
					r2_url: r2Url,
					r2_uploaded_at: r2UploadedAt,
				},
			);

			console.log(
				`✅ Refreshed attachment ${attachment.id} from Unipile${r2Url ? " + uploaded to R2" : ""}`,
			);
			return updatedAttachment;
		} catch (error) {
			console.error(
				`❌ Failed to refresh attachment ${attachment.id} from Unipile:`,
				error,
			);

			// Mark as unavailable if we can't fetch it
			if (!attachment.unavailable) {
				try {
					const updatedAttachment = await this.upsertAttachment(
						attachment.message_id,
						attachment.external_id,
						{ unavailable: true },
					);
					return updatedAttachment;
				} catch (updateError) {
					console.error(
						`❌ Failed to mark attachment ${attachment.id} as unavailable:`,
						updateError,
					);
				}
			}

			return attachment;
		}
	}
}
