import { eq, and, desc, asc, count, inArray } from "drizzle-orm";
import type { db } from "~/db";
import { chatFolders, chatFolderAssignments, unipileChats } from "~/db/schema";

// Use Drizzle's inferred types
export type ChatFolder = typeof chatFolders.$inferSelect;
export type ChatFolderAssignment = typeof chatFolderAssignments.$inferSelect;
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
		const result = await (
			await this.drizzleDb
				.select()
				.from(chatFolders)
				.where(eq(chatFolders.id, folderId))
				.limit(1)
		)[0];

		if (!result) {
			return null;
		}

		return result;
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
			.where(eq(chatFolders.id, folderId))
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
		const result = await (
			await this.drizzleDb
				.update(chatFolders)
				.set({
					is_deleted: true,
					updated_at: new Date(),
				})
				.where(eq(chatFolders.id, folderId))
				.returning()
		)[0];

		if (!result) {
			throw new Error("Failed to delete chat folder");
		}

		return result;
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
		const [existingAssignment] = await this.drizzleDb
			.select()
			.from(chatFolderAssignments)
			.where(
				and(
					eq(chatFolderAssignments.chat_id, chatId),
					eq(chatFolderAssignments.folder_id, folderId),
				),
			)
			.limit(1);

		if (!existingAssignment) {
			throw new Error("Assignment not found");
		}

		// If assignment exists, update it (restore if soft-deleted)
		const folderAssignment = await (
			await this.drizzleDb
				.update(chatFolderAssignments)
				.set({
					is_deleted: false,
					assigned_by_id: assignedById,
					updated_at: new Date(),
				})
				.where(eq(chatFolderAssignments.id, existingAssignment.id))
				.returning()
		)[0];

		if (!folderAssignment) {
			throw new Error("Failed to assign chat to folder");
		}

		// If no assignment exists, create a new one
		const result = await (
			await this.drizzleDb
				.insert(chatFolderAssignments)
				.values({
					chat_id: chatId,
					folder_id: folderId,
					assigned_by_id: assignedById,
				})
				.returning()
		)[0];

		if (!result) {
			throw new Error("Failed to assign chat to folder");
		}

		return result;
	}

	/**
	 * Remove a chat from a folder
	 */
	async removeChatFromFolder(
		chatId: string,
		folderId: string,
	): Promise<ChatFolderAssignment> {
		const [assignment] = await this.drizzleDb
			.select()
			.from(chatFolderAssignments)
			.where(
				and(
					eq(chatFolderAssignments.chat_id, chatId),
					eq(chatFolderAssignments.folder_id, folderId),
					eq(chatFolderAssignments.is_deleted, false),
				),
			)
			.limit(1);

		if (!assignment) {
			throw new Error("Assignment not found");
		}

		const result = await await this.drizzleDb
			.update(chatFolderAssignments)
			.set({
				is_deleted: true,
				updated_at: new Date(),
			})
			.where(eq(chatFolderAssignments.id, assignment.id))
			.returning();

		if (!result[0]) {
			throw new Error("Failed to remove chat from folder");
		}

		return result[0];
	}

	/**
	 * Get all folder assignments for a chat
	 */
	async getChatFolders(chatId: string): Promise<ChatFolderAssignment[]> {
		const result = await this.drizzleDb
			.select()
			.from(chatFolderAssignments)
			.where(
				and(
					eq(chatFolderAssignments.chat_id, chatId),
					eq(chatFolderAssignments.is_deleted, false),
				),
			)
			.innerJoin(
				chatFolders,
				eq(chatFolderAssignments.folder_id, chatFolders.id),
			);

		if (!result) {
			throw new Error("Failed to get chat folders");
		}

		return result.map((row) => row.chat_folder_assignment);
	}

	/**
	 * Get all chats in a folder
	 */
	async getChatsInFolder(folderId: string): Promise<ChatFolderAssignment[]> {
		const result = await this.drizzleDb
			.select()
			.from(chatFolderAssignments)
			.where(
				and(
					eq(chatFolderAssignments.folder_id, folderId),
					eq(chatFolderAssignments.is_deleted, false),
				),
			)
			.innerJoin(
				unipileChats,
				eq(chatFolderAssignments.chat_id, unipileChats.id),
			);

		if (!result) {
			throw new Error("Failed to get chats in folder");
		}

		return result.map((row) => row.chat_folder_assignment);
	}

	/**
	 * Get folders with chat counts for a user
	 */
	async getFoldersWithChatCounts(
		userId: string,
	): Promise<(ChatFolder & { chat_count: number })[]> {
		const result = await this.drizzleDb
			.select({
				chat_folder: chatFolders,
				chat_count: count(chatFolderAssignments.id),
			})
			.from(chatFolders)
			.where(
				and(eq(chatFolders.user_id, userId), eq(chatFolders.is_deleted, false)),
			)
			.innerJoin(
				chatFolderAssignments,
				eq(chatFolders.id, chatFolderAssignments.folder_id),
			)
			.groupBy(chatFolders.id)
			.orderBy(asc(chatFolders.sort_order));

		if (!result[0]) {
			throw new Error("Failed to get folders with chat counts");
		}

		if (!result) {
			throw new Error("Failed to get folders with chat counts");
		}

		return result.map((row) => ({
			...row.chat_folder,
			chat_count: row.chat_count,
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
		return await this.drizzleDb
			.select()
			.from(chatFolderAssignments)
			.where(
				and(
					inArray(chatFolderAssignments.chat_id, chatIds),
					eq(chatFolderAssignments.folder_id, folderId),
					eq(chatFolderAssignments.is_deleted, false),
				),
			);
	}
}
