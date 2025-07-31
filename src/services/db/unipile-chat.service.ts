import { db } from "~/server/db";
import type { Prisma, PrismaClient } from "../../../generated/prisma";
import type {
	UnipileChat,
	UnipileChatAttendee,
} from "../../../generated/prisma";

// Use Prisma's generated types
export type CreateChatData = Prisma.UnipileChatCreateInput;
export type UpdateChatData = Prisma.UnipileChatUpdateInput;
export type CreateAttendeeData = Prisma.UnipileChatAttendeeCreateInput;
export type UpdateAttendeeData = Prisma.UnipileChatAttendeeUpdateInput;

// Chat with various include options
export type ChatWithAttendees = Prisma.UnipileChatGetPayload<{
	include: { UnipileChatAttendee: true };
}>;

export type ChatWithMessages = Prisma.UnipileChatGetPayload<{
	include: { UnipileMessage: true };
}>;

export type ChatWithDetails = Prisma.UnipileChatGetPayload<{
	include: {
		UnipileChatAttendee: true;
		UnipileMessage: {
			include: { UnipileMessageAttachment: true };
		};
		unipile_account: true;
	};
}>;

export type AttendeeWithChat = Prisma.UnipileChatAttendeeGetPayload<{
	include: { chat: true };
}>;

export interface FindChatOptions {
	include_attendees?: boolean;
	include_messages?: boolean;
	include_account?: boolean;
	include_deleted?: boolean;
	limit?: number;
	offset?: number;
	cursor?: string; // Chat ID to start pagination from
	order_by?: "created_at" | "updated_at" | "last_message_at";
	order_direction?: "asc" | "desc";
}

export interface PaginatedChats {
	chats: UnipileChat[];
	nextCursor?: string;
	hasMore: boolean;
}

export class UnipileChatService {
	constructor(private readonly db: PrismaClient) {}

	/**
	 * Find chat by external ID
	 */
	async findChatByExternalId(
		unipileAccountId: string,
		externalId: string,
		includeDeleted = false,
	): Promise<UnipileChat | null> {
		return await this.db.unipileChat.findFirst({
			where: {
				unipile_account_id: unipileAccountId,
				external_id: externalId,
				...(includeDeleted ? {} : { is_deleted: false }),
			},
		});
	}

	/**
	 * Create or update a chat
	 */
	async upsertChat(
		unipileAccountId: string,
		externalId: string,
		updateData: Partial<UpdateChatData>,
		createData?: Partial<Prisma.UnipileChatCreateWithoutUnipile_accountInput>,
	): Promise<UnipileChat> {
		return await this.db.unipileChat.upsert({
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
				provider: "linkedin",
				chat_type: "direct",
				...createData,
			},
		});
	}

	/**
	 * Get chats for a Unipile account
	 */
	async getChatsByAccount(
		unipileAccountId: string,
		options: FindChatOptions = {},
	): Promise<UnipileChat[]> {
		const {
			include_attendees = false,
			include_messages = false,
			include_deleted = false,
			limit,
			offset,
			order_by = "last_message_at",
			order_direction = "desc",
		} = options;

		return await this.db.unipileChat.findMany({
			where: {
				unipile_account_id: unipileAccountId,
				...(include_deleted ? {} : { is_deleted: false }),
			},
			include: {
				...(include_attendees
					? {
							UnipileChatAttendee: {
								where: { is_deleted: false },
								include: {
									contact: true, // Include the related contact data
								},
							},
						}
					: {}),
				...(include_messages
					? {
							UnipileMessage: {
								where: { is_deleted: false },
								orderBy: { sent_at: "desc" },
								take: 5, // Latest 5 messages
							},
						}
					: {}),
			},
			orderBy: { [order_by]: order_direction },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {}),
		});
	}

	/**
	 * Get chats for a user across all accounts
	 */
	async getChatsByUser(
		userId: string,
		provider?: string,
		options: FindChatOptions = {},
	): Promise<UnipileChat[]> {
		const {
			include_attendees = false,
			include_messages = false,
			include_account = false,
			include_deleted = false,
			limit,
			offset,
			order_by = "last_message_at",
			order_direction = "desc",
		} = options;

		return await this.db.unipileChat.findMany({
			where: {
				unipile_account: {
					user_id: userId,
					...(provider ? { provider } : {}),
					is_deleted: false,
				},
				...(include_deleted ? {} : { is_deleted: false }),
			},
			include: {
				...(include_attendees
					? {
							UnipileChatAttendee: {
								where: { is_deleted: false },
								include: {
									contact: true, // Include the related contact data
								},
							},
						}
					: {}),
				...(include_messages
					? {
							UnipileMessage: {
								where: { is_deleted: false },
								orderBy: { sent_at: "desc" },
								take: 5,
							},
						}
					: {}),
				...(include_account ? { unipile_account: true } : {}),
			},
			orderBy: { [order_by]: order_direction },
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {}),
		});
	}

	/**
	 * Get chats for a user with cursor-based pagination for infinite scrolling
	 */
	async getChatsByUserPaginated(
		userId: string,
		provider?: string,
		options: FindChatOptions = {},
	): Promise<PaginatedChats> {
		const {
			include_attendees = false,
			include_messages = false,
			include_account = false,
			include_deleted = false,
			limit = 20,
			cursor,
			order_by = "last_message_at",
			order_direction = "desc",
		} = options;

		// Build cursor condition for pagination
		const cursorCondition = cursor
			? {
					id: {
						lt: cursor, // Use 'lt' for descending order, 'gt' for ascending
					},
				}
			: {};

		const chats = await this.db.unipileChat.findMany({
			where: {
				unipile_account: {
					user_id: userId,
					...(provider ? { provider } : {}),
					is_deleted: false,
				},
				...(include_deleted ? {} : { is_deleted: false }),
				...cursorCondition,
			},
			include: {
				...(include_attendees
					? {
							UnipileChatAttendee: {
								where: { is_deleted: false },
								include: {
									contact: true,
								},
							},
						}
					: {}),
				...(include_messages
					? {
							UnipileMessage: {
								where: { is_deleted: false },
								orderBy: { sent_at: "desc" },
								take: 5,
							},
						}
					: {}),
				...(include_account ? { unipile_account: true } : {}),
			},
			orderBy: { [order_by]: order_direction },
			take: limit + 1, // Fetch one extra to determine if there are more
		});

		// Determine if there are more results
		const hasMore = chats.length > limit;
		const resultChats = hasMore ? chats.slice(0, -1) : chats;
		const nextCursor = hasMore
			? resultChats[resultChats.length - 1]?.id
			: undefined;

		return {
			chats: resultChats,
			nextCursor,
			hasMore,
		};
	}

	/**
	 * Update last message timestamp for a chat
	 */
	async updateLastMessageAt(
		chatId: string,
		lastMessageAt: Date,
	): Promise<UnipileChat> {
		return await this.db.unipileChat.update({
			where: { id: chatId },
			data: {
				last_message_at: lastMessageAt,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Find attendee by external ID
	 */
	async findAttendeeByExternalId(
		chatId: string,
		externalId: string,
		includeDeleted = false,
	): Promise<UnipileChatAttendee | null> {
		return await this.db.unipileChatAttendee.findFirst({
			where: {
				chat_id: chatId,
				external_id: externalId,
				...(includeDeleted ? {} : { is_deleted: false }),
			},
		});
	}

	/**
	 * Create or update a chat attendee
	 */
	async upsertAttendee(
		chatId: string,
		externalId: string,
		contactId: string | null, // Reference to the contact
		attendeeData: {
			is_self?: number;
			hidden?: number;
		},
	): Promise<UnipileChatAttendee> {
		return await this.db.unipileChatAttendee.upsert({
			where: {
				chat_id_external_id: {
					chat_id: chatId,
					external_id: externalId,
				},
			},
			update: {
				...(contactId
					? { contact: { connect: { id: contactId } } }
					: { contact: { disconnect: true } }),
				is_self: attendeeData.is_self ?? 0,
				hidden: attendeeData.hidden ?? 0,
				updated_at: new Date(),
			},
			create: {
				chat: {
					connect: { id: chatId },
				},
				...(contactId
					? {
							contact: {
								connect: { id: contactId },
							},
						}
					: {}),
				external_id: externalId,
				is_self: attendeeData.is_self ?? 0,
				hidden: attendeeData.hidden ?? 0,
			},
		});
	}

	/**
	 * Get attendees for a chat
	 */
	async getAttendeesByChat(
		chatId: string,
		includeDeleted = false,
	): Promise<UnipileChatAttendee[]> {
		return await this.db.unipileChatAttendee.findMany({
			where: {
				chat_id: chatId,
				...(includeDeleted ? {} : { is_deleted: false }),
			},
			orderBy: { created_at: "asc" },
		});
	}

	/**
	 * Get attendee count for a chat
	 */
	async getAttendeeCount(chatId: string): Promise<number> {
		return await this.db.unipileChatAttendee.count({
			where: {
				chat_id: chatId,
				is_deleted: false,
			},
		});
	}

	/**
	 * Mark chat as deleted (soft delete)
	 */
	async markChatAsDeleted(chatId: string): Promise<UnipileChat> {
		return await this.db.unipileChat.update({
			where: { id: chatId },
			data: {
				is_deleted: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Mark attendee as deleted (soft delete)
	 */
	async markAttendeeAsDeleted(
		attendeeId: string,
	): Promise<UnipileChatAttendee> {
		return await this.db.unipileChatAttendee.update({
			where: { id: attendeeId },
			data: {
				is_deleted: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get chat statistics
	 */
	async getChatStats(unipileAccountId: string): Promise<{
		totalChats: number;
		directChats: number;
		groupChats: number;
		activeChatsWith: number;
	}> {
		const [stats] = await this.db.$queryRaw<
			[
				{
					total_chats: number;
					direct_chats: number;
					group_chats: number;
					active_chats: number;
				},
			]
		>`
			SELECT 
				COUNT(*)::int as total_chats,
				COUNT(*) FILTER (WHERE chat_type = 'direct')::int as direct_chats,
				COUNT(*) FILTER (WHERE chat_type = 'group')::int as group_chats,
				COUNT(*) FILTER (WHERE last_message_at > NOW() - INTERVAL '30 days')::int as active_chats
			FROM "UnipileChat"
			WHERE unipile_account_id = ${unipileAccountId} AND is_deleted = false
		`;

		return {
			totalChats: stats?.total_chats || 0,
			directChats: stats?.direct_chats || 0,
			groupChats: stats?.group_chats || 0,
			activeChatsWith: stats?.active_chats || 0,
		};
	}

	/**
	 * Search chats by name or attendee info
	 */
	async searchChats(
		unipileAccountId: string,
		searchTerm: string,
		limit = 20,
	): Promise<UnipileChat[]> {
		return await this.db.unipileChat.findMany({
			where: {
				unipile_account_id: unipileAccountId,
				is_deleted: false,
				OR: [
					{
						name: {
							contains: searchTerm,
							mode: "insensitive",
						},
					},
					{
						UnipileChatAttendee: {
							some: {
								contact: {
									OR: [
										{
											full_name: {
												contains: searchTerm,
												mode: "insensitive",
											},
										},
										{
											first_name: {
												contains: searchTerm,
												mode: "insensitive",
											},
										},
										{
											last_name: {
												contains: searchTerm,
												mode: "insensitive",
											},
										},
									],
								},
								is_deleted: false,
							},
						},
					},
				],
			},
			include: {
				UnipileChatAttendee: {
					where: { is_deleted: false },
					include: {
						contact: true,
					},
				},
			},
			orderBy: { last_message_at: "desc" },
			take: limit,
		});
	}

	/**
	 * Get chat with full details
	 */
	async getChatWithDetails(chatId: string): Promise<ChatWithDetails | null> {
		return await this.db.unipileChat.findUnique({
			where: { id: chatId },
			include: {
				UnipileChatAttendee: {
					where: { is_deleted: false },
					include: {
						contact: true, // Include the related contact data
					},
				},
				UnipileMessage: {
					where: { is_deleted: false },
					include: {
						UnipileMessageAttachment: {
							where: { is_deleted: false },
						},
					},
					orderBy: { sent_at: "asc" },
				},
				unipile_account: true,
			},
		});
	}

	/**
	 * Bulk create attendees
	 */
	async bulkCreateAttendees(
		attendeesData: Prisma.UnipileChatAttendeeCreateManyInput[],
	): Promise<Prisma.BatchPayload> {
		return await this.db.unipileChatAttendee.createMany({
			data: attendeesData,
			skipDuplicates: true,
		});
	}

	/**
	 * Get recent chats with latest message info
	 */
	async getRecentChats(
		unipileAccountId: string,
		limit = 10,
	): Promise<UnipileChat[]> {
		return await this.db.unipileChat.findMany({
			where: {
				unipile_account_id: unipileAccountId,
				is_deleted: false,
				last_message_at: { not: null },
			},
			include: {
				UnipileChatAttendee: {
					where: { is_deleted: false },
					take: 3, // Show up to 3 attendees
					include: {
						contact: true, // Include the related contact data
					},
				},
				UnipileMessage: {
					where: { is_deleted: false },
					orderBy: { sent_at: "desc" },
					take: 1, // Latest message only
				},
			},
			orderBy: { last_message_at: "desc" },
			take: limit,
		});
	}

	/**
	 * Mark chat as read (set unread_count to 0)
	 */
	async markChatAsRead(chatId: string): Promise<UnipileChat> {
		return await this.db.unipileChat.update({
			where: { id: chatId },
			data: {
				unread_count: 0,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Update chat unread count
	 */
	async updateUnreadCount(
		chatId: string,
		unreadCount: number,
	): Promise<UnipileChat> {
		return await this.db.unipileChat.update({
			where: { id: chatId },
			data: {
				unread_count: unreadCount,
				updated_at: new Date(),
			},
		});
	}
}
