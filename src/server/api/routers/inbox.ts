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
				const chats = await ctx.services.unipileChatService.getChatsByUser(
					ctx.userId,
					input.provider,
					{
						limit: input.limit,
						include_attendees: true,
						include_account: true,
						include_messages: true,
						order_by: "last_message_at",
						order_direction: "desc",
					},
				);

				return chats;
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

				return chatDetails;
			} catch (error) {
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
						message: "You can only mark your own chats as read",
					});
				}

				// Skip if already read (unread_count is 0)
				if (chat.unread_count === 0) {
					return { success: true, message: "Chat is already marked as read" };
				}

				// Create Unipile service instance
				const unipileService = createUnipileService({
					apiKey: env.UNIPILE_API_KEY,
					dsn: env.UNIPILE_DSN,
				});

				// Mark as read in Unipile first
				const unipileResponse = await unipileService.patchChat(
					chat.external_id, // Use external chat ID for Unipile
					{ action: "mark_as_read" },
					chat.unipile_account.account_id, // Use the account_id from the database
				);

				if (!unipileResponse.success) {
					throw new TRPCError({
						code: "BAD_GATEWAY",
						message: "Failed to mark chat as read in Unipile",
					});
				}

				// Update the database
				const updatedChat =
					await ctx.services.unipileChatService.markChatAsRead(input.chatId);

				return {
					success: true,
					message: "Chat marked as read",
					chat: updatedChat,
					unipileResponse,
				};
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to mark chat as read",
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

				// Store the message in our database if Unipile returns message data
				let savedMessage = null;
				if (sendMessageResponse.message) {
					const messageData = sendMessageResponse.message;
					savedMessage = await ctx.services.unipileMessageService.upsertMessage(
						chat.unipile_account.id,
						messageData.id,
						{
							content: messageData.text || input.content,
							is_read: true, // User's own message is considered read
						},
						{
							chat: { connect: { id: chat.id } },
							external_chat_id: chat.external_id,
							sender_id: messageData.sender_id,
							message_type: messageData.message_type?.toLowerCase() || "text",
							content: messageData.text || input.content,
							is_read: true,
							is_outgoing: true, // This is an outgoing message
							sent_at: messageData.timestamp
								? new Date(messageData.timestamp)
								: new Date(),
							sender_urn: messageData.sender_urn,
							attendee_type: messageData.attendee_type,
							attendee_distance: messageData.attendee_distance,
							seen: messageData.seen || 1,
							hidden: messageData.hidden || 0,
							deleted: messageData.deleted || 0,
							edited: messageData.edited || 0,
							is_event: messageData.is_event || 0,
							delivered: messageData.delivered || 1,
							behavior: messageData.behavior || 0,
							event_type: messageData.event_type || 0,
							replies: messageData.replies || 0,
							subject: messageData.subject,
							parent: messageData.parent,
						},
					);
				}

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
});
