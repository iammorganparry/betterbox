import type { Prisma, PrismaClient } from "../../../generated/prisma";
import type {
	UnipileMessage,
	UnipileMessageAttachment,
} from "../../../generated/prisma";

// Use Prisma's generated types instead of custom interfaces
export type CreateMessageData = Prisma.UnipileMessageCreateInput;
export type UpdateMessageData = Prisma.UnipileMessageUpdateInput;
export type CreateAttachmentData = Prisma.UnipileMessageAttachmentCreateInput;
export type UpdateAttachmentData = Prisma.UnipileMessageAttachmentUpdateInput;

// Message with various include options
export type MessageWithAttachments = Prisma.UnipileMessageGetPayload<{
	include: { UnipileMessageAttachment: true };
}>;

export type MessageWithChat = Prisma.UnipileMessageGetPayload<{
	include: { chat: true };
}>;

export type MessageWithAccount = Prisma.UnipileMessageGetPayload<{
	include: { unipile_account: true };
}>;

export type MessageWithDetails = Prisma.UnipileMessageGetPayload<{
	include: {
		UnipileMessageAttachment: true;
		chat: {
			include: {
				UnipileChatAttendee: true;
			};
		};
		unipile_account: {
			include: { user: true };
		};
	};
}>;

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
	constructor(private readonly db: PrismaClient) {}

	/**
	 * Find message by unique constraint
	 */
	async findMessageByExternalId(
		unipileAccountId: string,
		externalId: string,
		includeDeleted = false,
	): Promise<UnipileMessage | null> {
		return await this.db.unipileMessage.findFirst({
			where: {
				unipile_account_id: unipileAccountId,
				external_id: externalId,
				...(includeDeleted ? {} : { is_deleted: false }),
			},
		});
	}

	/**
	 * Create or update a message
	 */
	async upsertMessage(
		unipileAccountId: string,
		externalId: string,
		updateData: Partial<UpdateMessageData>,
		createData?: Partial<Prisma.UnipileMessageCreateWithoutUnipile_accountInput>,
	): Promise<UnipileMessage> {
		return await this.db.unipileMessage.upsert({
			where: {
				unipile_account_id_external_id: {
					unipile_account_id: unipileAccountId,
					external_id: externalId,
				},
			},
			update: {
				...updateData,
				updated_at: new Date(),
			},
			create: {
				unipile_account: {
					connect: { id: unipileAccountId },
				},
				external_id: externalId,
				message_type: "text",
				is_read: false,
				is_outgoing: false,
				...createData,
			},
		});
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

		return await this.db.unipileMessage.findMany({
			where: {
				chat_id: chatId,
				...(include_deleted ? {} : { is_deleted: false }),
				...(message_type ? { message_type } : {}),
				...(is_outgoing !== undefined ? { is_outgoing } : {}),
				...(is_read !== undefined ? { is_read } : {}),
			},
			include: {
				...(include_attachments
					? {
							UnipileMessageAttachment: {
								where: { is_deleted: false },
							},
						}
					: {}),
				...(include_chat ? { chat: true } : {}),
				...(include_account ? { unipile_account: true } : {}),
			},
			orderBy: { [order_by]: order_direction },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {}),
		});
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

		return await this.db.unipileMessage.findMany({
			where: {
				unipile_account_id: unipileAccountId,
				...(include_deleted ? {} : { is_deleted: false }),
				...(message_type ? { message_type } : {}),
				...(is_outgoing !== undefined ? { is_outgoing } : {}),
				...(is_read !== undefined ? { is_read } : {}),
			},
			include: {
				...(include_attachments
					? {
							UnipileMessageAttachment: {
								where: { is_deleted: false },
							},
						}
					: {}),
				...(include_chat ? { chat: true } : {}),
			},
			orderBy: { [order_by]: order_direction },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {}),
		});
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

		return await this.db.unipileMessage.findMany({
			where: {
				unipile_account: {
					user_id: userId,
					...(provider ? { provider } : {}),
					is_deleted: false,
				},
				...(include_deleted ? {} : { is_deleted: false }),
				...(message_type ? { message_type } : {}),
				...(is_outgoing !== undefined ? { is_outgoing } : {}),
				...(is_read !== undefined ? { is_read } : {}),
			},
			include: {
				...(include_attachments
					? {
							UnipileMessageAttachment: {
								where: { is_deleted: false },
							},
						}
					: {}),
				...(include_chat ? { chat: true } : {}),
				...(include_account ? { unipile_account: true } : {}),
			},
			orderBy: { [order_by]: order_direction },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {}),
		});
	}

	/**
	 * Mark message as read
	 */
	async markMessageAsRead(messageId: string): Promise<UnipileMessage> {
		return await this.db.unipileMessage.update({
			where: { id: messageId },
			data: {
				is_read: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Mark multiple messages as read
	 */
	async markMessagesAsRead(messageIds: string[]): Promise<Prisma.BatchPayload> {
		return await this.db.unipileMessage.updateMany({
			where: {
				id: { in: messageIds },
				is_deleted: false,
			},
			data: {
				is_read: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Mark all chat messages as read
	 */
	async markChatMessagesAsRead(chatId: string): Promise<Prisma.BatchPayload> {
		return await this.db.unipileMessage.updateMany({
			where: {
				chat_id: chatId,
				is_deleted: false,
				is_read: false,
			},
			data: {
				is_read: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get unread message count for a chat
	 */
	async getUnreadMessageCount(chatId: string): Promise<number> {
		return await this.db.unipileMessage.count({
			where: {
				chat_id: chatId,
				is_deleted: false,
				is_read: false,
				is_outgoing: false, // Only count incoming messages
			},
		});
	}

	/**
	 * Get unread message count for a user
	 */
	async getUnreadMessageCountByUser(
		userId: string,
		provider?: string,
	): Promise<number> {
		return await this.db.unipileMessage.count({
			where: {
				unipile_account: {
					user_id: userId,
					...(provider ? { provider } : {}),
					is_deleted: false,
				},
				is_deleted: false,
				is_read: false,
				is_outgoing: false,
			},
		});
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

		return await this.db.unipileMessage.findMany({
			where: {
				unipile_account_id: unipileAccountId,
				is_deleted: false,
				content: {
					contains: searchTerm,
					mode: "insensitive",
				},
			},
			include: {
				...(include_chat ? { chat: true } : {}),
				...(include_attachments
					? {
							UnipileMessageAttachment: {
								where: { is_deleted: false },
							},
						}
					: {}),
			},
			orderBy: { sent_at: "desc" },
			take: limit,
		});
	}

	/**
	 * Get latest message for each chat
	 */
	async getLatestMessagesPerChat(
		unipileAccountId: string,
		limit = 20,
	): Promise<UnipileMessage[]> {
		// Get the latest message for each chat
		const latestMessages = await this.db.$queryRaw<UnipileMessage[]>`
			SELECT DISTINCT ON (chat_id) *
			FROM "UnipileMessage"
			WHERE unipile_account_id = ${unipileAccountId}
			  AND is_deleted = false
			  AND chat_id IS NOT NULL
			ORDER BY chat_id, sent_at DESC
			LIMIT ${limit}
		`;

		return latestMessages;
	}

	/**
	 * Mark message as deleted (soft delete)
	 */
	async markMessageAsDeleted(messageId: string): Promise<UnipileMessage> {
		return await this.db.unipileMessage.update({
			where: { id: messageId },
			data: {
				is_deleted: true,
				updated_at: new Date(),
			},
		});
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
		const [stats] = await this.db.$queryRaw<
			[
				{
					total_messages: number;
					outgoing_messages: number;
					incoming_messages: number;
					unread_messages: number;
					last_message_at: Date | null;
				},
			]
		>`
			SELECT 
				COUNT(*)::int as total_messages,
				COUNT(*) FILTER (WHERE is_outgoing = true)::int as outgoing_messages,
				COUNT(*) FILTER (WHERE is_outgoing = false)::int as incoming_messages,
				COUNT(*) FILTER (WHERE is_read = false AND is_outgoing = false)::int as unread_messages,
				MAX(sent_at) as last_message_at
			FROM "UnipileMessage"
			WHERE chat_id = ${chatId} AND is_deleted = false
		`;

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
		return await this.db.unipileMessageAttachment.findFirst({
			where: {
				message_id: messageId,
				external_id: externalId,
				...(includeDeleted ? {} : { is_deleted: false }),
			},
		});
	}

	/**
	 * Create or update an attachment
	 */
	async upsertAttachment(
		messageId: string,
		externalId: string,
		updateData: Partial<UpdateAttachmentData>,
		createData?: Partial<Prisma.UnipileMessageAttachmentCreateWithoutMessageInput>,
	): Promise<UnipileMessageAttachment> {
		return await this.db.unipileMessageAttachment.upsert({
			where: {
				message_id_external_id: {
					message_id: messageId,
					external_id: externalId,
				},
			},
			update: {
				...updateData,
				updated_at: new Date(),
			},
			create: {
				message: {
					connect: { id: messageId },
				},
				external_id: externalId,
				attachment_type: "file",
				...createData,
			},
		});
	}

	/**
	 * Get attachments for a message
	 */
	async getAttachmentsByMessage(
		messageId: string,
		includeDeleted = false,
	): Promise<UnipileMessageAttachment[]> {
		return await this.db.unipileMessageAttachment.findMany({
			where: {
				message_id: messageId,
				...(includeDeleted ? {} : { is_deleted: false }),
			},
			orderBy: { created_at: "asc" },
		});
	}

	/**
	 * Get attachments for a chat
	 */
	async getAttachmentsByChat(
		chatId: string,
		attachmentType?: string,
		limit = 50,
	): Promise<
		Prisma.UnipileMessageAttachmentGetPayload<{
			include: { message: true };
		}>[]
	> {
		return await this.db.unipileMessageAttachment.findMany({
			where: {
				message: {
					chat_id: chatId,
					is_deleted: false,
				},
				is_deleted: false,
				...(attachmentType ? { attachment_type: attachmentType } : {}),
			},
			include: {
				message: true,
			},
			orderBy: { created_at: "desc" },
			take: limit,
		});
	}

	/**
	 * Mark attachment as deleted (soft delete)
	 */
	async markAttachmentAsDeleted(
		attachmentId: string,
	): Promise<UnipileMessageAttachment> {
		return await this.db.unipileMessageAttachment.update({
			where: { id: attachmentId },
			data: {
				is_deleted: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Bulk create attachments
	 */
	async bulkCreateAttachments(
		attachmentsData: Prisma.UnipileMessageAttachmentCreateManyInput[],
	): Promise<Prisma.BatchPayload> {
		return await this.db.unipileMessageAttachment.createMany({
			data: attachmentsData,
			skipDuplicates: true,
		});
	}

	/**
	 * Get message with full details (attachments, chat, account)
	 */
	async getMessageWithDetails(
		messageId: string,
	): Promise<MessageWithDetails | null> {
		return await this.db.unipileMessage.findUnique({
			where: { id: messageId },
			include: {
				UnipileMessageAttachment: {
					where: { is_deleted: false },
				},
				chat: {
					include: {
						UnipileChatAttendee: {
							where: { is_deleted: false },
						},
					},
				},
				unipile_account: {
					include: { user: true },
				},
			},
		});
	}

	/**
	 * Get message thread (messages around a specific message)
	 */
	async getMessageThread(
		messageId: string,
		contextCount = 5,
	): Promise<{
		message: MessageWithAttachments;
		previousMessages: MessageWithAttachments[];
		nextMessages: MessageWithAttachments[];
	}> {
		const message = await this.db.unipileMessage.findUnique({
			where: { id: messageId },
			include: {
				UnipileMessageAttachment: {
					where: { is_deleted: false },
				},
			},
		});

		if (!message || !message.chat_id) {
			throw new Error(`Message not found: ${messageId}`);
		}

		const [previousMessages, nextMessages] = await Promise.all([
			// Get messages before this one
			this.db.unipileMessage.findMany({
				where: {
					chat_id: message.chat_id,
					...(message.sent_at ? { sent_at: { lt: message.sent_at } } : {}),
					is_deleted: false,
				},
				orderBy: { sent_at: "desc" },
				take: contextCount,
				include: {
					UnipileMessageAttachment: {
						where: { is_deleted: false },
					},
				},
			}),
			// Get messages after this one
			this.db.unipileMessage.findMany({
				where: {
					chat_id: message.chat_id,
					...(message.sent_at ? { sent_at: { gt: message.sent_at } } : {}),
					is_deleted: false,
				},
				orderBy: { sent_at: "asc" },
				take: contextCount,
				include: {
					UnipileMessageAttachment: {
						where: { is_deleted: false },
					},
				},
			}),
		]);

		return {
			message,
			previousMessages: previousMessages.reverse(), // Reverse to chronological order
			nextMessages,
		};
	}
}
