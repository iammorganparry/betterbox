import {
	eq,
	and,
	or,
	count,
	desc,
	asc,
	sql,
	getTableColumns,
} from "drizzle-orm";
import type { db } from "~/db";
import {
	unipileChats,
	unipileChatAttendees,
	type unipileMessages,
	type unipileMessageAttachments,
	unipileAccounts,
	type unipileContacts,
} from "~/db/schema";

// Use Drizzle's inferred types
export type UnipileChat = typeof unipileChats.$inferSelect;
export type UnipileChatAttendee = typeof unipileChatAttendees.$inferSelect;
export type CreateChatData = typeof unipileChats.$inferInsert;
export type UpdateChatData = Partial<CreateChatData>;
export type CreateAttendeeData = typeof unipileChatAttendees.$inferInsert;
export type UpdateAttendeeData = Partial<CreateAttendeeData>;

// Chat with various include options
export type ChatWithAttendees = UnipileChat & {
	unipileChatAttendees: UnipileChatAttendee[];
};

export type ChatWithMessages = UnipileChat & {
	unipileMessages: (typeof unipileMessages.$inferSelect)[];
};

export type ChatWithDetails = UnipileChat & {
	unipileChatAttendees: (typeof unipileChatAttendees.$inferSelect & {
		contact: typeof unipileContacts.$inferSelect | null;
	})[];
	unipileMessages: (typeof unipileMessages.$inferSelect & {
		unipileMessageAttachments: (typeof unipileMessageAttachments.$inferSelect)[];
	})[];
	unipileAccount: typeof unipileAccounts.$inferSelect;
};

export type AttendeeWithChat = UnipileChatAttendee & {
	chat: UnipileChat;
};

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
	chats: ChatWithDetails[];
	nextCursor?: string;
	hasMore: boolean;
}

export type PaginatedChatsWithDetails = {
	chats: ChatWithDetails[];
	nextCursor?: string;
	hasMore: boolean;
};

export class UnipileChatService {
	constructor(private readonly drizzleDb: typeof db) {}

	/**
	 * Find chat by external ID
	 */
	async findChatByExternalId(
		unipileAccountId: string,
		externalId: string,
		includeDeleted = false,
	): Promise<UnipileChat | null> {
		const whereConditions = [
			eq(unipileChats.unipile_account_id, unipileAccountId),
			eq(unipileChats.external_id, externalId),
		];

		if (!includeDeleted) {
			whereConditions.push(eq(unipileChats.is_deleted, false));
		}

		const result = await this.drizzleDb
			.select()
			.from(unipileChats)
			.where(and(...whereConditions))
			.limit(1);

		return result[0] || null;
	}

	/**
	 * Create or update a chat
	 */
	async upsertChat(
		unipileAccountId: string,
		externalId: string,
		updateData: Partial<UpdateChatData>,
		createData?: Partial<CreateChatData>,
	): Promise<UnipileChat> {
		const insertData: CreateChatData = {
			unipile_account_id: unipileAccountId,
			external_id: externalId,
			provider: "linkedin",
			chat_type: "direct",
			is_deleted: false,
			created_at: new Date(),
			updated_at: new Date(),
			...createData,
		};

		const result = await this.drizzleDb
			.insert(unipileChats)
			.values(insertData)
			.onConflictDoUpdate({
				target: [unipileChats.unipile_account_id, unipileChats.external_id],
				set: {
					...updateData,
					updated_at: new Date(),
				},
			})
			.returning();

		if (!result[0]) {
			throw new Error("Failed to upsert chat");
		}

		return result[0];
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

		const whereConditions = [
			eq(unipileChats.unipile_account_id, unipileAccountId),
		];

		if (!include_deleted) {
			whereConditions.push(eq(unipileChats.is_deleted, false));
		}

		// For simple cases without complex relations, use basic select
		if (!include_attendees && !include_messages) {
			return await this.drizzleDb
				.select()
				.from(unipileChats)
				.where(and(...whereConditions))
				.orderBy(
					order_direction === "desc"
						? desc(unipileChats[order_by])
						: asc(unipileChats[order_by]),
				)
				.limit(limit || 100)
				.offset(offset || 0);
		}

		// For complex queries, return basic data for now
		// TODO: Implement proper relations with Drizzle
		return await this.drizzleDb
			.select()
			.from(unipileChats)
			.where(and(...whereConditions))
			.orderBy(
				order_direction === "desc"
					? desc(unipileChats[order_by])
					: asc(unipileChats[order_by]),
			)
			.limit(limit || 100)
			.offset(offset || 0);
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

		// Use basic join for user chats
		// TODO: Implement proper relations with Drizzle
		const whereConditions = [];

		if (!include_deleted) {
			whereConditions.push(eq(unipileChats.is_deleted, false));
		}

		const result = await this.drizzleDb
			.select()
			.from(unipileChats)
			.innerJoin(
				unipileAccounts,
				eq(unipileChats.unipile_account_id, unipileAccounts.id),
			)
			.where(
				and(
					eq(unipileAccounts.user_id, userId),
					eq(unipileAccounts.is_deleted, false),
					...(provider ? [eq(unipileAccounts.provider, provider)] : []),
					...whereConditions,
				),
			)
			.orderBy(
				order_direction === "desc"
					? desc(unipileChats[order_by])
					: asc(unipileChats[order_by]),
			)
			.limit(limit || 100)
			.offset(offset || 0);

		// Extract just the chat data from join results
		return result.map((row) => row.unipile_chat);
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
			include_deleted = false,
			limit = 20,
			cursor,
			order_by = "last_message_at",
			order_direction = "desc",
		} = options;

		// Build cursor condition for pagination
		const whereConditions = [
			eq(unipileAccounts.user_id, userId),
			eq(unipileAccounts.is_deleted, false),
		];

		if (provider) {
			whereConditions.push(eq(unipileAccounts.provider, provider));
		}

		if (!include_deleted) {
			whereConditions.push(eq(unipileChats.is_deleted, false));
		}

		if (cursor) {
			whereConditions.push(
				order_direction === "desc"
					? sql`${unipileChats.id} < ${cursor}`
					: sql`${unipileChats.id} > ${cursor}`,
			);
		}

		const chats = await this.drizzleDb.query.unipileChats.findMany({
			where: and(...whereConditions),
			orderBy:
				order_direction === "desc"
					? desc(unipileChats.last_message_at)
					: asc(unipileChats.last_message_at),
			limit: limit + 1,
			with: {
				unipileChatAttendees: {
					with: {
						contact: true,
					},
				},
				unipileMessages: {
					with: {
						unipileMessageAttachments: true,
					},
				},
			},
		});

		// Determine if there are more results
		const hasMore = chats.length > limit;
		const resultChats = hasMore ? chats.slice(0, -1) : chats;
		const nextCursor = hasMore
			? resultChats[resultChats.length - 1]?.id
			: undefined;

		// Extract just the chat data from join results
		const chatData = resultChats.map((row) => row);

		return {
			chats: chatData as ChatWithDetails[],
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
		const result = await this.drizzleDb
			.update(unipileChats)
			.set({
				last_message_at: lastMessageAt,
				updated_at: new Date(),
			})
			.where(eq(unipileChats.id, chatId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to update last message timestamp");
		}

		return result[0];
	}

	/**
	 * Find attendee by external ID
	 */
	async findAttendeeByExternalId(
		chatId: string,
		externalId: string,
		includeDeleted = false,
	): Promise<UnipileChatAttendee | null> {
		const whereConditions = [
			eq(unipileChatAttendees.chat_id, chatId),
			eq(unipileChatAttendees.external_id, externalId),
		];

		if (!includeDeleted) {
			whereConditions.push(eq(unipileChatAttendees.is_deleted, false));
		}

		const result = await this.drizzleDb
			.select()
			.from(unipileChatAttendees)
			.where(and(...whereConditions))
			.limit(1);

		return result[0] || null;
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
		const insertData: CreateAttendeeData = {
			chat_id: chatId,
			contact_id: contactId,
			external_id: externalId,
			is_self: attendeeData.is_self ?? 0,
			hidden: attendeeData.hidden ?? 0,
			is_deleted: false,
			created_at: new Date(),
			updated_at: new Date(),
		};

		const result = await this.drizzleDb
			.insert(unipileChatAttendees)
			.values(insertData)
			.onConflictDoUpdate({
				target: [
					unipileChatAttendees.chat_id,
					unipileChatAttendees.external_id,
				],
				set: {
					contact_id: contactId,
					is_self: attendeeData.is_self ?? 0,
					hidden: attendeeData.hidden ?? 0,
					updated_at: new Date(),
				},
			})
			.returning();

		if (!result[0]) {
			throw new Error("Failed to upsert attendee");
		}

		return result[0];
	}

	/**
	 * Get attendees for a chat
	 */
	async getAttendeesByChat(
		chatId: string,
		includeDeleted = false,
	): Promise<UnipileChatAttendee[]> {
		const whereConditions = [eq(unipileChatAttendees.chat_id, chatId)];

		if (!includeDeleted) {
			whereConditions.push(eq(unipileChatAttendees.is_deleted, false));
		}

		return await this.drizzleDb
			.select()
			.from(unipileChatAttendees)
			.where(and(...whereConditions))
			.orderBy(asc(unipileChatAttendees.created_at));
	}

	/**
	 * Get attendee count for a chat
	 */
	async getAttendeeCount(chatId: string): Promise<number> {
		const result = await this.drizzleDb
			.select({ count: count() })
			.from(unipileChatAttendees)
			.where(
				and(
					eq(unipileChatAttendees.chat_id, chatId),
					eq(unipileChatAttendees.is_deleted, false),
				),
			);

		return result[0]?.count || 0;
	}

	/**
	 * Mark chat as deleted (soft delete)
	 */
	async markChatAsDeleted(chatId: string): Promise<UnipileChat> {
		const result = await this.drizzleDb
			.update(unipileChats)
			.set({
				is_deleted: true,
				updated_at: new Date(),
			})
			.where(eq(unipileChats.id, chatId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to mark chat as deleted");
		}

		return result[0];
	}

	/**
	 * Mark attendee as deleted (soft delete)
	 */
	async markAttendeeAsDeleted(
		attendeeId: string,
	): Promise<UnipileChatAttendee> {
		const result = await this.drizzleDb
			.update(unipileChatAttendees)
			.set({
				is_deleted: true,
				updated_at: new Date(),
			})
			.where(eq(unipileChatAttendees.id, attendeeId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to mark attendee as deleted");
		}

		return result[0];
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
		const result = await this.drizzleDb.execute(sql`
			SELECT 
				COUNT(*)::int as total_chats,
				COUNT(*) FILTER (WHERE chat_type = 'direct')::int as direct_chats,
				COUNT(*) FILTER (WHERE chat_type = 'group')::int as group_chats,
				COUNT(*) FILTER (WHERE last_message_at > NOW() - INTERVAL '30 days')::int as active_chats
			FROM "unipile_chat"
			WHERE unipile_account_id = ${unipileAccountId} AND is_deleted = false
		`);

		const stats = result[0] as
			| {
					total_chats: number;
					direct_chats: number;
					group_chats: number;
					active_chats: number;
			  }
			| undefined;

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
		// For now, return basic search by name only
		// TODO: Implement full-text search with attendee info using Drizzle
		return await this.drizzleDb
			.select()
			.from(unipileChats)
			.where(
				and(
					eq(unipileChats.unipile_account_id, unipileAccountId),
					eq(unipileChats.is_deleted, false),
					sql`${unipileChats.name} ILIKE ${`%${searchTerm}%`}`,
				),
			)
			.orderBy(desc(unipileChats.last_message_at))
			.limit(limit);
	}

	/**
	 * Get chat with full details
	 *
	 */
	async getChatWithDetails(chatId: string): Promise<ChatWithDetails | null> {
		// TODO: Implement with proper Drizzle relations
		// For now, return basic chat info
		const result = await this.drizzleDb.query.unipileChats.findFirst({
			where: eq(unipileChats.id, chatId),
			with: {
				unipileChatAttendees: {
					where: (table, { eq }) => eq(table.is_deleted, false),
					with: {
						contact: true,
					},
				},
				unipileMessages: {
					where: (table, { eq }) => eq(table.is_deleted, false),
					with: {
						unipileMessageAttachments: {
							where: (table, { eq }) => eq(table.is_deleted, false),
						},
					},
				},
				unipileAccount: true,
			},
		});

		return result || null;
	}

	/**
	 * Bulk create attendees
	 */
	async bulkCreateAttendees(
		attendeesData: CreateAttendeeData[],
	): Promise<{ count: number }> {
		const result = await this.drizzleDb
			.insert(unipileChatAttendees)
			.values(attendeesData)
			.onConflictDoNothing()
			.returning({ id: unipileChatAttendees.id });

		return { count: result.length };
	}

	/**
	 * Get recent chats with latest message info
	 */
	async getRecentChats(
		unipileAccountId: string,
		limit = 10,
	): Promise<UnipileChat[]> {
		return await this.drizzleDb
			.select()
			.from(unipileChats)
			.where(
				and(
					eq(unipileChats.unipile_account_id, unipileAccountId),
					eq(unipileChats.is_deleted, false),
					sql`${unipileChats.last_message_at} IS NOT NULL`,
				),
			)
			.orderBy(desc(unipileChats.last_message_at))
			.limit(limit);
	}

	/**
	 * Mark chat as read (set unread_count to 0)
	 */
	async markChatAsRead(chatId: string): Promise<UnipileChat> {
		const result = await this.drizzleDb
			.update(unipileChats)
			.set({
				unread_count: 0,
				updated_at: new Date(),
			})
			.where(eq(unipileChats.id, chatId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to mark chat as read");
		}

		return result[0];
	}

	/**
	 * Update chat unread count
	 */
	async updateUnreadCount(
		chatId: string,
		unreadCount: number,
	): Promise<UnipileChat> {
		const result = await this.drizzleDb
			.update(unipileChats)
			.set({
				unread_count: unreadCount,
				updated_at: new Date(),
			})
			.where(eq(unipileChats.id, chatId))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to update unread count");
		}

		return result[0];
	}
}
