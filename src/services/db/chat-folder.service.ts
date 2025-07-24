import type { PrismaClient, ChatFolder, ChatFolderAssignment } from "../../../generated/prisma";

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
  constructor(private db: PrismaClient) {}

  /**
   * Create a new chat folder for a user
   */
  async createFolder(
    userId: string,
    data: ChatFolderCreateData
  ): Promise<ChatFolder> {
    return await this.db.chatFolder.create({
      data: {
        user_id: userId,
        name: data.name,
        color: data.color,
        sort_order: data.sort_order ?? 0,
        is_default: data.is_default ?? false,
      },
    });
  }

  /**
   * Get all folders for a user
   */
  async getFoldersByUser(
    userId: string,
    options: ChatFolderQueryOptions = {}
  ): Promise<ChatFolder[]> {
    const {
      include_deleted = false,
      order_by = "sort_order",
      order_direction = "asc",
    } = options;

    return await this.db.chatFolder.findMany({
      where: {
        user_id: userId,
        is_deleted: include_deleted ? undefined : false,
      },
      orderBy: {
        [order_by]: order_direction,
      },
    });
  }

  /**
   * Get a folder by ID with ownership validation
   */
  async getFolderById(folderId: string, userId: string): Promise<ChatFolder | null> {
    return await this.db.chatFolder.findFirst({
      where: {
        id: folderId,
        user_id: userId,
        is_deleted: false,
      },
    });
  }

  /**
   * Update a folder
   */
  async updateFolder(
    folderId: string,
    userId: string,
    data: ChatFolderUpdateData
  ): Promise<ChatFolder> {
    return await this.db.chatFolder.update({
      where: {
        id: folderId,
        user_id: userId,
      },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Soft delete a folder
   */
  async deleteFolder(folderId: string, userId: string): Promise<ChatFolder> {
    return await this.db.chatFolder.update({
      where: {
        id: folderId,
        user_id: userId,
      },
      data: {
        is_deleted: true,
        updated_at: new Date(),
      },
    });
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
    assignedById: string
  ): Promise<ChatFolderAssignment> {
    return await this.db.chatFolderAssignment.create({
      data: {
        chat_id: chatId,
        folder_id: folderId,
        assigned_by_id: assignedById,
      },
    });
  }

  /**
   * Remove a chat from a folder
   */
  async removeChatFromFolder(
    chatId: string,
    folderId: string
  ): Promise<ChatFolderAssignment> {
    const assignment = await this.db.chatFolderAssignment.findFirst({
      where: {
        chat_id: chatId,
        folder_id: folderId,
        is_deleted: false,
      },
    });

    if (!assignment) {
      throw new Error("Assignment not found");
    }

    return await this.db.chatFolderAssignment.update({
      where: {
        id: assignment.id,
      },
      data: {
        is_deleted: true,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Get all folder assignments for a chat
   */
  async getChatFolders(chatId: string): Promise<ChatFolderAssignment[]> {
    return await this.db.chatFolderAssignment.findMany({
      where: {
        chat_id: chatId,
        is_deleted: false,
      },
      include: {
        folder: true,
      },
    });
  }

  /**
   * Get all chats in a folder
   */
  async getChatsInFolder(folderId: string): Promise<ChatFolderAssignment[]> {
    return await this.db.chatFolderAssignment.findMany({
      where: {
        folder_id: folderId,
        is_deleted: false,
      },
      include: {
        chat: {
          include: {
            UnipileChatAttendee: {
              include: {
                contact: true,
              },
            },
            UnipileMessage: {
              take: 1,
              orderBy: {
                sent_at: "desc",
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get folders with chat counts for a user
   */
  async getFoldersWithChatCounts(userId: string): Promise<
    (ChatFolder & { chat_count: number })[]
  > {
    const folders = await this.db.chatFolder.findMany({
      where: {
        user_id: userId,
        is_deleted: false,
      },
      include: {
        _count: {
          select: {
            ChatFolderAssignment: {
              where: {
                is_deleted: false,
              },
            },
          },
        },
      },
      orderBy: {
        sort_order: "asc",
      },
    });

    return folders.map((folder: any) => ({
      ...folder,
      chat_count: folder._count.ChatFolderAssignment,
    }));
  }

  /**
   * Check if a chat is assigned to a specific folder
   */
  async isChatInFolder(chatId: string, folderId: string): Promise<boolean> {
    const assignment = await this.db.chatFolderAssignment.findFirst({
      where: {
        chat_id: chatId,
        folder_id: folderId,
        is_deleted: false,
      },
    });

    return !!assignment;
  }

  /**
   * Bulk assign multiple chats to a folder
   */
  async bulkAssignChatsToFolder(
    chatIds: string[],
    folderId: string,
    assignedById: string
  ): Promise<ChatFolderAssignment[]> {
    const assignments = chatIds.map((chatId) => ({
      chat_id: chatId,
      folder_id: folderId,
      assigned_by_id: assignedById,
    }));

    // Use createMany to insert all assignments at once
    await this.db.chatFolderAssignment.createMany({
      data: assignments,
      skipDuplicates: true, // Skip if assignment already exists
    });

    // Return the created assignments
    return await this.db.chatFolderAssignment.findMany({
      where: {
        chat_id: { in: chatIds },
        folder_id: folderId,
        is_deleted: false,
      },
    });
  }
} 