import { eq, and, desc, asc, count, inArray } from "drizzle-orm";
import type { db } from "~/db";
import {
	chatFolders,
	chatFolderAssignments,
	type unipileChats,
} from "~/db/schema";
import type { ChatWithDetails } from "./unipile-chat.service";

// Use Drizzle's inferred types
export type ChatFolder = typeof chatFolders.$inferSelect;
export type ChatFolderAssignment = typeof chatFolderAssignments.$inferSelect & {
	chat: ChatWithDetails;
};
export type CreateChatFolderData = typeof chatFolders.$inferInsert;
export type UpdateChatFolderData = Partial<CreateChatFolderData>;
export type CreateChatFolderAssignmentData =
	typeof chatFolderAssignments.$inferInsert;

export interface ChatFolderCreateData {
	name: string;
	color?: string;
	sort_order?: number;
	is_default?: boolean;
}

export interface ChatFolderUpdateData {
	name?: string;
	color?: string;
	sort_order?: number;
}

export interface ChatFolderQueryOptions {
	include_deleted?: boolean;
	order_by?: "name" | "sort_order" | "created_at";
	order_direction?: "asc" | "desc";
}

export interface ChatFolderAssignmentCreateData {
	chat_id: string;
	folder_id: string;
}

export class ChatFolderService {
	constructor(private drizzleDb: typeof db) {}

	/**
	 * Create a new chat folder for a user
	 */
	async createFolder(
		userId: string,
		data: ChatFolderCreateData,
	): Promise<ChatFolder> {
		const result = await this.drizzleDb
			.insert(chatFolders)
			.values({
				user_id: userId,
				name: data.name,
				color: data.color ?? null,
				sort_order: data.sort_order ?? 0,
				is_default: data.is_default ?? false,
				is_deleted: false,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returning();

		if (!result[0]) {
			throw new Error("Failed to create chat folder");
		}
		return result[0];
	}

	/**
	 * Get all folders for a user
	 */
	async getFoldersByUser(
		userId: string,
		options: ChatFolderQueryOptions = {},
	): Promise<ChatFolder[]> {
		const {
			include_deleted = false,
			order_by = "sort_order",
			order_direction = "asc",
		} = options;

		const whereConditions = [eq(chatFolders.user_id, userId)];

		if (!include_deleted) {
			whereConditions.push(eq(chatFolders.is_deleted, false));
		}

		const orderByColumn =
			order_by === "sort_order"
				? chatFolders.sort_order
				: order_by === "name"
					? chatFolders.name
					: chatFolders.created_at;

		const orderFn = order_direction === "desc" ? desc : asc;

		return await this.drizzleDb
			.select()
			.from(chatFolders)
			.where(and(...whereConditions))
			.orderBy(orderFn(orderByColumn));
	}

	/**
	 * Get a folder by ID with ownership validation
	 */
	async getFolderById(
		folderId: string,
		userId: string,
	): Promise<ChatFolder | null> {
		const result = await this.drizzleDb
			.select()
			.from(chatFolders)
			.where(
				and(
					eq(chatFolders.id, folderId),
					eq(chatFolders.user_id, userId),
					eq(chatFolders.is_deleted, false),
				),
			)
			.limit(1);

		return result[0] || null;
	}

	/**
	 * Update a folder
	 */
	async updateFolder(
		folderId: string,
		userId: string,
		data: ChatFolderUpdateData,
	): Promise<ChatFolder> {
		const result = await this.drizzleDb
			.update(chatFolders)
			.set({
				...data,
				updated_at: new Date(),
			})
			.where(
				and(
					eq(chatFolders.id, folderId),
					eq(chatFolders.user_id, userId),
					eq(chatFolders.is_deleted, false),
				),
			)
			.returning();

		if (!result[0]) {
			throw new Error("Failed to update chat folder");
		}

		return result[0];
	}

	/**
	 * Soft delete a folder
	 */
	async deleteFolder(folderId: string, userId: string): Promise<ChatFolder> {
		const result = await this.drizzleDb
			.update(chatFolders)
			.set({
				is_deleted: true,
				updated_at: new Date(),
			})
			.where(
				and(
					eq(chatFolders.id, folderId),
					eq(chatFolders.user_id, userId),
					eq(chatFolders.is_deleted, false),
				),
			)
			.returning();

		if (!result[0]) {
			throw new Error("Failed to delete chat folder");
		}

		return result[0];
	}

	/**
	 * Create default "All Chats" folder for a new user
	 */
	async createDefaultFolder(userId: string): Promise<ChatFolder> {
		return await this.createFolder(userId, {
			name: "All Chats",
			is_default: true,
			sort_order: 0,
		});
	}

	/**
	 * Assign a chat to a folder
	 */
	async assignChatToFolder(
		chatId: string,
		folderId: string,
		assignedById: string,
	): Promise<ChatFolderAssignment> {
		// First, check if an assignment already exists (including soft-deleted ones)
		const existingAssignment =
			await this.drizzleDb.query.chatFolderAssignments.findFirst({
				where: (table, { eq, and }) =>
					and(eq(table.chat_id, chatId), eq(table.folder_id, folderId)),
				with: {
					chat: true,
				},
			});

		let assignmentId: string;

		if (existingAssignment) {
			// If assignment exists, update it (restore if soft-deleted)
			const result = await this.drizzleDb
				.update(chatFolderAssignments)
				.set({
					is_deleted: false,
					assigned_by_id: assignedById,
					updated_at: new Date(),
				})
				.where(eq(chatFolderAssignments.id, existingAssignment.id))
				.returning();

			if (!result[0]) {
				throw new Error("Failed to assign chat to folder");
			}
			assignmentId = result[0].id;
		} else {
			// If no assignment exists, create a new one
			const result = await this.drizzleDb
				.insert(chatFolderAssignments)
				.values({
					chat_id: chatId,
					folder_id: folderId,
					assigned_by_id: assignedById,
				})
				.returning();

			if (!result[0]) {
				throw new Error("Failed to assign chat to folder");
			}
			assignmentId = result[0].id;
		}

		// Return the assignment with full details
		const returnedResult =
			await this.drizzleDb.query.chatFolderAssignments.findFirst({
				where: (table, { eq }) => eq(table.id, assignmentId),
				with: {
					chat: {
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
							unipileAccount: true,
						},
					},
				},
			});

		if (!returnedResult) {
			throw new Error("Failed to assign chat to folder");
		}

		return returnedResult;
	}

	/**
	 * Remove a chat from a folder
	 */
	async removeChatFromFolder(
		chatId: string,
		folderId: string,
	): Promise<ChatFolderAssignment> {
		const assignment =
			await this.drizzleDb.query.chatFolderAssignments.findFirst({
				where: (table, { eq }) =>
					and(eq(table.chat_id, chatId), eq(table.folder_id, folderId)),
				with: {
					chat: true,
				},
			});

		if (!assignment) {
			throw new Error("Assignment not found");
		}

		const result = await this.drizzleDb
			.update(chatFolderAssignments)
			.set({
				is_deleted: true,
				updated_at: new Date(),
			})
			.where(eq(chatFolderAssignments.id, assignment.id))
			.returning();

		const resultId = result[0]?.id;

		if (!resultId) {
			throw new Error("Failed to remove chat from folder");
		}

		const returnedResult =
			await this.drizzleDb.query.chatFolderAssignments.findFirst({
				where: (table, { eq }) => eq(table.id, resultId),
				with: {
					chat: {
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
							unipileAccount: true,
						},
					},
				},
			});

		if (!returnedResult) {
			throw new Error("Failed to remove chat from folder");
		}

		return returnedResult;
	}

	/**
	 * Get all folder assignments for a chat
	 */
	async getChatFolders(chatId: string): Promise<ChatFolderAssignment[]> {
		const result = await this.drizzleDb.query.chatFolderAssignments.findMany({
			where: (table, { eq }) =>
				and(eq(table.chat_id, chatId), eq(table.is_deleted, false)),
			with: {
				chat: {
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
						unipileAccount: true,
					},
				},
			},
		});

		if (!result) {
			throw new Error("Failed to get chat folders");
		}

		return result;
	}

	/**
	 * Get all chats in a folder
	 */
	async getChatsInFolder(folderId: string): Promise<ChatFolderAssignment[]> {
		const result = await this.drizzleDb.query.chatFolderAssignments.findMany({
			where: (table, { eq }) =>
				and(eq(table.folder_id, folderId), eq(table.is_deleted, false)),
			with: {
				chat: {
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
						unipileAccount: true,
					},
				},
			},
		});

		if (!result) {
			throw new Error("Failed to get chats in folder");
		}

		return result;
	}

	/**
	 * Get folders with chat counts for a user
	 */
	async getFoldersWithChatCounts(
		userId: string,
	): Promise<(ChatFolder & { chat_count: number })[]> {
		const result = await this.drizzleDb.query.chatFolders.findMany({
			where: (table, { eq, and }) =>
				and(eq(table.user_id, userId), eq(table.is_deleted, false)),
			with: {
				chatFolderAssignments: {
					where: (assignments, { eq }) => eq(assignments.is_deleted, false),
				},
			},
			orderBy: (table) => [asc(table.sort_order), asc(table.name)],
		});

		return result.map((folder) => ({
			...folder,
			chat_count: folder.chatFolderAssignments.length,
		}));
	}

	/**
	 * Check if a chat is assigned to a specific folder
	 */
	async isChatInFolder(chatId: string, folderId: string): Promise<boolean> {
		const assignment = await this.drizzleDb
			.select()
			.from(chatFolderAssignments)
			.where(
				and(
					eq(chatFolderAssignments.chat_id, chatId),
					eq(chatFolderAssignments.folder_id, folderId),
					eq(chatFolderAssignments.is_deleted, false),
				),
			);

		return !!assignment[0];
	}

	/**
	 * Bulk assign multiple chats to a folder
	 */
	async bulkAssignChatsToFolder(
		chatIds: string[],
		folderId: string,
		assignedById: string,
	): Promise<ChatFolderAssignment[]> {
		// First, restore any existing soft-deleted assignments
		await this.drizzleDb
			.update(chatFolderAssignments)
			.set({
				is_deleted: false,
				assigned_by_id: assignedById,
				updated_at: new Date(),
			})
			.where(
				and(
					inArray(chatFolderAssignments.chat_id, chatIds),
					eq(chatFolderAssignments.folder_id, folderId),
					eq(chatFolderAssignments.is_deleted, true),
				),
			);

		// Then create new assignments for chats not already assigned
		const existingAssignments = await this.drizzleDb
			.select()
			.from(chatFolderAssignments)
			.where(
				and(
					inArray(chatFolderAssignments.chat_id, chatIds),
					eq(chatFolderAssignments.folder_id, folderId),
					eq(chatFolderAssignments.is_deleted, false),
				),
			);

		const existingChatIds = new Set(existingAssignments.map((a) => a.chat_id));
		const newChatIds = chatIds.filter((chatId) => !existingChatIds.has(chatId));

		if (newChatIds.length > 0) {
			const newAssignments = newChatIds.map((chatId) => ({
				chat_id: chatId,
				folder_id: folderId,
				assigned_by_id: assignedById,
			}));

			await this.drizzleDb.insert(chatFolderAssignments).values(newAssignments);
		}

		// Return all current assignments
		return await this.getChatsInFolder(folderId);
	}
}
