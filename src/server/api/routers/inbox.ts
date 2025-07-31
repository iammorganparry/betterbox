import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { createUnipileService } from "~/services/unipile/unipile.service";
import { env } from "~/env";

export const inboxRouter = createTRPCRouter({
	/**
	 * Get user's chats/conversations
	 */
	getChats: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(50),
				cursor: z.string().optional(),
				provider: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				const result =
					await ctx.services.unipileChatService.getChatsByUserPaginated(
						ctx.userId,
						input.provider,
						{
							limit: input.limit,
							cursor: input.cursor,
							include_attendees: true,
							include_account: true,
							include_messages: true,
							order_by: "last_message_at",
							order_direction: "desc",
						},
					);

				// Apply contact limits and obfuscation
				// Type assertion: we know the chats include the required relations because
				// we set include_attendees: true and include_messages: true
				const chatsWithDetails = result.chats as any;
				const filteredChats =
					await ctx.services.contactLimitService.applyContactLimitsToChats(
						ctx.userId,
						chatsWithDetails,
					);

				return {
					chats: filteredChats,
					nextCursor: result.nextCursor,
					hasMore: result.hasMore,
				};
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch chats",
				});
			}
		}),

	/**
	 * Get messages for a specific chat
	 */
	getChatMessages: protectedProcedure
		.input(
			z.object({
				chatId: z.string(),
				limit: z.number().min(1).max(100).default(50),
				cursor: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				// First, verify the chat exists and belongs to the user
				const chatDetails =
					await ctx.services.unipileChatService.getChatWithDetails(
						input.chatId,
					);

				if (!chatDetails) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Chat not found",
					});
				}

				// Verify the chat belongs to the current user
				if (chatDetails.unipile_account.user_id !== ctx.userId) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only view your own chats",
					});
				}

				// Check if this chat is obfuscated due to contact limits
				const limitStatus =
					await ctx.services.contactLimitService.getContactLimitStatus(
						ctx.userId,
					);

				if (limitStatus.isExceeded) {
					// Apply contact limits to this single chat
					const filteredChats =
						await ctx.services.contactLimitService.applyContactLimitsToChats(
							ctx.userId,
							[chatDetails],
						);

					const filteredChat = filteredChats[0];

					// If the chat is obfuscated (contact name became "Premium Contact"), deny access
					const isObfuscated = filteredChat?.UnipileChatAttendee?.some(
						(attendee) => attendee.contact?.full_name === "Premium Contact",
					);

					if (isObfuscated) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"This contact is beyond your current plan's limit. Upgrade to view messages from this contact.",
						});
					}
				}

				const messages =
					await ctx.services.unipileMessageService.getMessagesByChat(
						input.chatId,
						{
							limit: input.limit,
							include_chat: true,
							include_account: true,
							include_attachments: true,
							order_by: "sent_at",
							order_direction: "asc",
						},
					);

				return messages;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch messages",
				});
			}
		}),

	/**
	 * Get user's contacts
	 */
	getContacts: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(50),
				cursor: z.string().optional(),
				search: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				const contacts =
					await ctx.services.unipileContactService.getContactsByUser(
						ctx.userId,
						undefined,
						{
							limit: input.limit,
							order_by: "last_interaction",
							order_direction: "desc",
							include_deleted: false,
						},
					);

				return contacts;
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch contacts",
				});
			}
		}),

	/**
	 * Mark message as read
	 */
	markMessageAsRead: protectedProcedure
		.input(
			z.object({
				messageId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const result =
					await ctx.services.unipileMessageService.markMessageAsRead(
						input.messageId,
					);

				return result;
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to mark message as read",
				});
			}
		}),

	/**
	 * Delete message (soft delete)
	 */
	deleteMessage: protectedProcedure
		.input(
			z.object({
				messageId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				// First, verify the message exists and belongs to the user
				const message =
					await ctx.services.unipileMessageService.getMessageWithDetails(
						input.messageId,
					);

				if (!message) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Message not found",
					});
				}

				// Verify the message belongs to the current user
				if (message.unipile_account.user_id !== ctx.userId) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only delete your own messages",
					});
				}

				// Perform soft delete
				const result =
					await ctx.services.unipileMessageService.markMessageAsDeleted(
						input.messageId,
					);

				return result;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete message",
				});
			}
		}),

	/**
	 * Get chat details with attendees
	 */
	getChatDetails: protectedProcedure
		.input(
			z.object({
				chatId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				const chatDetails =
					await ctx.services.unipileChatService.getChatWithDetails(
						input.chatId,
					);

				if (!chatDetails) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Chat not found",
					});
				}

				// Verify the chat belongs to the current user
				if (chatDetails.unipile_account.user_id !== ctx.userId) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only view your own chats",
					});
				}

				// Check if this chat is obfuscated due to contact limits
				const limitStatus =
					await ctx.services.contactLimitService.getContactLimitStatus(
						ctx.userId,
					);

				if (limitStatus.isExceeded) {
					// Apply contact limits to this single chat
					const filteredChats =
						await ctx.services.contactLimitService.applyContactLimitsToChats(
							ctx.userId,
							[chatDetails],
						);

					const filteredChat = filteredChats[0];

					// If the chat is obfuscated (contact name became "Premium Contact"), deny access
					const isObfuscated = filteredChat?.UnipileChatAttendee?.some(
						(attendee) => attendee.contact?.full_name === "Premium Contact",
					);

					if (isObfuscated) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"This contact is beyond your current plan's limit. Upgrade to view this conversation.",
						});
					}
				}

				return chatDetails;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch chat details",
				});
			}
		}),

	/**
	 * Mark chat as read
	 */
	markChatAsRead: protectedProcedure
		.input(
			z.object({
				chatId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				console.log("🔍 Starting markChatAsRead for chatId:", input.chatId);

				// First, get the chat details to find the external ID and account
				const chat = await ctx.services.unipileChatService.getChatWithDetails(
					input.chatId,
				);

				console.log("📊 Chat details retrieved:", {
					found: !!chat,
					externalId: chat?.external_id,
					unreadCount: chat?.unread_count,
					accountId: chat?.unipile_account?.account_id,
					userId: chat?.unipile_account?.user_id,
					accountProvider: chat?.unipile_account?.provider,
					accountStatus: chat?.unipile_account?.status,
					chatProvider: chat?.provider,
					chatName: chat?.name,
					chatCreatedAt: chat?.created_at,
					chatUpdatedAt: chat?.updated_at,
				});

				if (!chat) {
					console.error("❌ Chat not found for ID:", input.chatId);
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Chat not found",
					});
				}

				// Verify the chat belongs to the current user
				if (chat.unipile_account.user_id !== ctx.userId) {
					console.error(
						"❌ Permission denied. Chat belongs to user:",
						chat.unipile_account.user_id,
						"but current user is:",
						ctx.userId,
					);
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only mark your own chats as read",
					});
				}

				// Check if this chat is obfuscated due to contact limits
				const limitStatus =
					await ctx.services.contactLimitService.getContactLimitStatus(
						ctx.userId,
					);

				if (limitStatus.isExceeded) {
					// Apply contact limits to this single chat
					const filteredChats =
						await ctx.services.contactLimitService.applyContactLimitsToChats(
							ctx.userId,
							[chat],
						);

					const filteredChat = filteredChats[0];

					// If the chat is obfuscated (contact name became "Premium Contact"), deny marking as read
					const isObfuscated = filteredChat?.UnipileChatAttendee?.some(
						(attendee) => attendee.contact?.full_name === "Premium Contact",
					);

					if (isObfuscated) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"Cannot interact with premium contacts. Upgrade your plan to access this contact.",
						});
					}
				}

				// Skip if already read (unread_count is 0)
				if (chat.unread_count === 0) {
					console.log("ℹ️ Chat already marked as read");
					return { success: true, message: "Chat is already marked as read" };
				}

				// Create Unipile service instance
				console.log("🔧 Creating Unipile service with env vars:", {
					hasApiKey: !!env.UNIPILE_API_KEY,
					hasDsn: !!env.UNIPILE_DSN,
					apiKeyLength: env.UNIPILE_API_KEY?.length,
					dsn: env.UNIPILE_DSN,
				});

				const unipileService = createUnipileService({
					apiKey: env.UNIPILE_API_KEY,
					dsn: env.UNIPILE_DSN,
				});

				// Mark as read in Unipile first
				console.log("🔄 Calling Unipile patchChat with:", {
					externalId: chat.external_id,
					action: "setReadStatus",
					value: true,
					accountId: chat.unipile_account.account_id,
				});

				const unipileResponse = await unipileService.patchChat(
					chat.external_id, // Use external chat ID for Unipile
					{ action: "setReadStatus", value: true }, // Use correct action name
					chat.unipile_account.account_id, // Use the account_id from the database
				);

				console.log("📥 Unipile response received:", {
					object: unipileResponse.object,
				});

				// Check if response is valid (API returns {"object": "ChatPatched"})
				if (unipileResponse.object !== "ChatPatched") {
					console.error(
						"❌ Unipile API returned unexpected response:",
						unipileResponse,
					);
					throw new TRPCError({
						code: "BAD_GATEWAY",
						message: `Unexpected response from Unipile: ${unipileResponse.object || "Unknown response"}`,
					});
				}

				// Check if Unipile operation was successful
				if (unipileResponse.object !== "ChatPatched") {
					console.error("❌ Unipile API operation failed:", unipileResponse);
					throw new TRPCError({
						code: "BAD_GATEWAY",
						message: "Failed to mark chat as read in Unipile",
					});
				}

				// Update the database
				console.log("💾 Updating database for chatId:", input.chatId);
				const updatedChat =
					await ctx.services.unipileChatService.markChatAsRead(input.chatId);

				console.log("✅ Chat marked as read successfully:", {
					chatId: updatedChat.id,
					newUnreadCount: updatedChat.unread_count,
				});

				return {
					success: true,
					message: "Chat marked as read",
					chat: updatedChat,
					unipileResponse,
				};
			} catch (error) {
				console.error("❌ Error in markChatAsRead:", {
					chatId: input.chatId,
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					type: error?.constructor?.name,
				});

				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to mark chat as read: ${error instanceof Error ? error.message : String(error)}`,
					cause: error,
				});
			}
		}),

	/**
	 * Soft delete a chat
	 */
	softDeleteChat: protectedProcedure
		.input(
			z.object({
				chatId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				// First, get the chat details to verify ownership
				const chat = await ctx.services.unipileChatService.getChatWithDetails(
					input.chatId,
				);

				if (!chat) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Chat not found",
					});
				}

				// Verify the chat belongs to the current user
				if (chat.unipile_account.user_id !== ctx.userId) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only delete your own chats",
					});
				}

				// Perform soft delete
				const deletedChat =
					await ctx.services.unipileChatService.markChatAsDeleted(input.chatId);

				return {
					success: true,
					message: "Chat deleted successfully",
					chat: deletedChat,
				};
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete chat",
					cause: error,
				});
			}
		}),

	/**
	 * Send a message to a chat
	 */
	sendMessage: protectedProcedure
		.input(
			z.object({
				chatId: z.string(),
				content: z
					.string()
					.min(1, "Message content cannot be empty")
					.max(2000, "Message content too long"),
				attachments: z
					.array(
						z.object({
							type: z.string(),
							url: z.string().optional(),
							filename: z.string().optional(),
							data: z.string().optional(), // Base64 encoded
						}),
					)
					.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				// First, get the chat details to find the external ID and account
				const chat = await ctx.services.unipileChatService.getChatWithDetails(
					input.chatId,
				);

				if (!chat) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Chat not found",
					});
				}

				// Verify the chat belongs to the current user
				if (chat.unipile_account.user_id !== ctx.userId) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only send messages to your own chats",
					});
				}

				// Check if this chat is obfuscated due to contact limits
				const limitStatus =
					await ctx.services.contactLimitService.getContactLimitStatus(
						ctx.userId,
					);

				if (limitStatus.isExceeded) {
					// Apply contact limits to this single chat
					const filteredChats =
						await ctx.services.contactLimitService.applyContactLimitsToChats(
							ctx.userId,
							[chat],
						);

					const filteredChat = filteredChats[0];

					// If the chat is obfuscated (contact name became "Premium Contact"), deny sending messages
					const isObfuscated = filteredChat?.UnipileChatAttendee?.some(
						(attendee) => attendee.contact?.full_name === "Premium Contact",
					);

					if (isObfuscated) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"Cannot send messages to premium contacts. Upgrade your plan to message this contact.",
						});
					}
				}

				// Check if the chat is read-only
				if (chat.read_only === 1) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Cannot send messages to a read-only chat",
					});
				}

				// Create Unipile service instance
				const unipileService = createUnipileService({
					apiKey: env.UNIPILE_API_KEY,
					dsn: env.UNIPILE_DSN,
				});

				// Send message through Unipile
				const sendMessageResponse = await unipileService.sendMessage(
					{
						chat_id: chat.external_id, // Use external chat ID for Unipile
						text: input.content,
						attachments: input.attachments,
					},
					chat.unipile_account.account_id, // Use the account_id from the database
				);

				if (sendMessageResponse.status === "failed") {
					throw new TRPCError({
						code: "BAD_GATEWAY",
						message:
							sendMessageResponse.error ||
							"Failed to send message through Unipile",
					});
				}

				// Always create a local copy of the sent message for immediate display
				// This ensures the user sees their message right away, regardless of Unipile response
				const messageId =
					sendMessageResponse.message?.id ||
					`local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

				const savedMessage =
					await ctx.services.unipileMessageService.upsertMessage(
						chat.unipile_account.id,
						messageId,
						{
							content: input.content,
							is_read: true, // User's own message is considered read
						},
						{
							chat: { connect: { id: chat.id } },
							external_chat_id: chat.external_id,
							sender_id:
								sendMessageResponse.message?.sender_id ||
								chat.unipile_account.account_id,
							message_type:
								sendMessageResponse.message?.message_type?.toLowerCase() ||
								"text",
							content: input.content,
							is_read: true,
							is_outgoing: true, // This is an outgoing message
							sent_at: sendMessageResponse.message?.timestamp
								? new Date(sendMessageResponse.message.timestamp)
								: new Date(),
							sender_urn: sendMessageResponse.message?.sender_urn,
							attendee_type: sendMessageResponse.message?.attendee_type,
							attendee_distance: sendMessageResponse.message?.attendee_distance,
							seen: sendMessageResponse.message?.seen || 1,
							hidden: sendMessageResponse.message?.hidden || 0,
							deleted: sendMessageResponse.message?.deleted || 0,
							edited: sendMessageResponse.message?.edited || 0,
							is_event: sendMessageResponse.message?.is_event || 0,
							delivered: sendMessageResponse.message?.delivered || 1,
							behavior: sendMessageResponse.message?.behavior || 0,
							event_type: sendMessageResponse.message?.event_type || 0,
							replies: sendMessageResponse.message?.replies || 0,
							subject: sendMessageResponse.message?.subject,
							parent: sendMessageResponse.message?.parent,
						},
					);

				// Update chat's last_message_at timestamp
				await ctx.services.unipileChatService.updateLastMessageAt(
					input.chatId,
					new Date(),
				);

				return {
					success: true,
					message: "Message sent successfully",
					messageId: sendMessageResponse.id,
					chatId: input.chatId,
					unipileResponse: sendMessageResponse,
					savedMessage,
				};
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to send message",
					cause: error,
				});
			}
		}),

	/**
	 * Get user's chat folders
	 */
	getFolders: protectedProcedure.query(async ({ ctx }) => {
		try {
			return await ctx.services.chatFolderService.getFoldersWithChatCounts(
				ctx.userId,
			);
		} catch (error) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to fetch folders",
			});
		}
	}),

	/**
	 * Create a new chat folder
	 */
	createFolder: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(50),
				color: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				return await ctx.services.chatFolderService.createFolder(
					ctx.userId,
					input,
				);
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create folder",
				});
			}
		}),

	/**
	 * Update a chat folder
	 */
	updateFolder: protectedProcedure
		.input(
			z.object({
				folderId: z.string(),
				name: z.string().min(1).max(50).optional(),
				color: z.string().optional(),
				sort_order: z.number().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				const { folderId, ...updateData } = input;
				return await ctx.services.chatFolderService.updateFolder(
					folderId,
					ctx.userId,
					updateData,
				);
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update folder",
				});
			}
		}),

	/**
	 * Delete a chat folder
	 */
	deleteFolder: protectedProcedure
		.input(
			z.object({
				folderId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				return await ctx.services.chatFolderService.deleteFolder(
					input.folderId,
					ctx.userId,
				);
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete folder",
				});
			}
		}),

	/**
	 * Assign a chat to a folder
	 */
	assignChatToFolder: protectedProcedure
		.input(
			z.object({
				chatId: z.string(),
				folderId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				// Verify the chat belongs to the user
				const chat = await ctx.services.unipileChatService.getChatWithDetails(
					input.chatId,
				);

				if (!chat) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Chat not found",
					});
				}

				if (chat.unipile_account.user_id !== ctx.userId) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only assign your own chats",
					});
				}

				// Verify the folder belongs to the user
				const folder = await ctx.services.chatFolderService.getFolderById(
					input.folderId,
					ctx.userId,
				);

				if (!folder) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Folder not found",
					});
				}

				// Check if chat is already in the folder
				const isAlreadyInFolder =
					await ctx.services.chatFolderService.isChatInFolder(
						input.chatId,
						input.folderId,
					);

				const assignment =
					await ctx.services.chatFolderService.assignChatToFolder(
						input.chatId,
						input.folderId,
						ctx.userId,
					);

				return {
					assignment,
					wasAlreadyInFolder: isAlreadyInFolder,
					message: isAlreadyInFolder
						? "Chat was already in this folder"
						: "Chat assigned to folder successfully",
				};
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to assign chat to folder",
				});
			}
		}),

	/**
	 * Remove a chat from a folder
	 */
	removeChatFromFolder: protectedProcedure
		.input(
			z.object({
				chatId: z.string(),
				folderId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				return await ctx.services.chatFolderService.removeChatFromFolder(
					input.chatId,
					input.folderId,
				);
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to remove chat from folder",
				});
			}
		}),

	/**
	 * Get chats in a specific folder
	 */
	getChatsInFolder: protectedProcedure
		.input(
			z.object({
				folderId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				// Verify the folder belongs to the user
				const folder = await ctx.services.chatFolderService.getFolderById(
					input.folderId,
					ctx.userId,
				);

				if (!folder) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Folder not found",
					});
				}

				const folderAssignments =
					await ctx.services.chatFolderService.getChatsInFolder(input.folderId);

				// Extract chats from folder assignments (with type assertion for included data)
				const chats = folderAssignments.map(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(assignment) => (assignment as any).chat,
				);

				// Apply contact limits and obfuscation to the chats
				const filteredChats =
					await ctx.services.contactLimitService.applyContactLimitsToChats(
						ctx.userId,
						chats,
					);

				// Reconstruct the folder assignments with filtered chats
				const filteredAssignments = folderAssignments.map(
					(assignment, index) => ({
						...assignment,
						chat: filteredChats[index],
					}),
				);

				return filteredAssignments;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				console.error(
					"[getChatsInFolder] Error fetching chats in folder:",
					error,
				);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch chats in folder",
				});
			}
		}),

	/**
	 * Get folders that a chat is assigned to
	 */
	getChatFolders: protectedProcedure
		.input(
			z.object({
				chatId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				// Verify the chat belongs to the user
				const chat = await ctx.services.unipileChatService.getChatWithDetails(
					input.chatId,
				);

				if (!chat) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Chat not found",
					});
				}

				if (chat.unipile_account.user_id !== ctx.userId) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only view your own chats",
					});
				}

				return await ctx.services.chatFolderService.getChatFolders(
					input.chatId,
				);
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch chat folders",
				});
			}
		}),
});
