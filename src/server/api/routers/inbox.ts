import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

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
});
