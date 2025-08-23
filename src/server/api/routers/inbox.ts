import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { env } from "~/env";
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
				const result =
					await ctx.services.unipileChatService.getChatsByUserPaginated(
						ctx.userId,
						input.provider,
						{
							limit: input.limit,
							cursor: input.cursor,
							order_by: "last_message_at",
							order_direction: "desc",
						},
					);

				return {
					chats: result.chats,
					nextCursor: result.nextCursor,
					hasMore: result.hasMore,
				};
			} catch (error) {
				console.error("❌ Error in getChats:", error);
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
				if (chatDetails.unipileAccount.user_id !== ctx.userId) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only view your own chats",
					});
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
							order_direction: "desc", // Get newest first from DB
						},
					);

				// Ensure all attachments are available before returning
				const messagesWithValidAttachments = await Promise.all(
					messages.map(async (message) => {
						if (!message.unipileMessageAttachments?.length) {
							return message;
						}

						console.log(
							`🔍 Checking ${message.unipileMessageAttachments.length} attachments for message ${message.id}`,
						);

						const validatedAttachments = await Promise.all(
							message.unipileMessageAttachments.map(async (attachment) => {
								try {
									const validatedAttachment =
										await ctx.services.unipileMessageService.ensureAttachmentAvailable(
											attachment,
											chatDetails.unipileAccount.account_id,
											ctx.services.unipileService,
											ctx.services.r2Service,
										);

									// Log which URL source we're using for debugging
									const urlSource = validatedAttachment.r2_url
										? "R2"
										: validatedAttachment.url
											? "Unipile"
											: validatedAttachment.content
												? "Base64"
												: "None";

									if (urlSource !== "None") {
										console.log(
											`📎 Attachment ${attachment.id} using ${urlSource} source`,
										);
									}

									return validatedAttachment;
								} catch (error) {
									console.error(
										`❌ Failed to validate attachment ${attachment.id}:`,
										error,
									);
									return attachment; // Return original attachment if validation fails
								}
							}),
						);

						return {
							...message,
							unipileMessageAttachments: validatedAttachments,
						};
					}),
				);

				// Reverse to show chronologically (oldest at top, newest at bottom)
				return messagesWithValidAttachments.reverse();
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
				if (message.unipileAccount.user_id !== ctx.userId) {
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
				if (chatDetails.unipileAccount.user_id !== ctx.userId) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only view your own chats",
					});
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

				if (!chat) {
					console.error("❌ Chat not found for ID:", input.chatId);
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Chat not found",
					});
				}

				// Verify the chat belongs to the current user
				if (chat.unipileAccount.user_id !== ctx.userId) {
					console.error(
						"❌ Permission denied. Chat belongs to user:",
						chat.unipileAccount.user_id,
						"but current user is:",
						ctx.userId,
					);
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only mark your own chats as read",
					});
				}

				// Skip if already read (unread_count is 0)
				if (chat.unread_count === 0) {
					console.log("ℹ️ Chat already marked as read");
					return { success: true, message: "Chat is already marked as read" };
				}

				// Use injected Unipile service instance
				console.log("🔧 Using injected Unipile service");

				const unipileService = ctx.services.unipileService;

				// Mark as read in Unipile first
				console.log("🔄 Calling Unipile patchChat with:", {
					externalId: chat.external_id,
					action: "setReadStatus",
					value: true,
					accountId: chat.unipileAccount.account_id,
				});

				const unipileResponse = await unipileService.patchChat(
					chat.external_id, // Use external chat ID for Unipile
					{ action: "setReadStatus", value: true }, // Use correct action name
					chat.unipileAccount.account_id, // Use the account_id from the database
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
				if (chat.unipileAccount.user_id !== ctx.userId) {
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
				const { services } = ctx;
				const { unipileChatService, unipileMessageService } = services;
				// First, get the chat details to find the external ID and account
				const chat = await unipileChatService.getChatWithDetails(input.chatId);

				if (!chat) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Chat not found",
					});
				}

				// Verify the chat belongs to the current user
				if (chat.unipileAccount.user_id !== ctx.userId) {
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

				const unipileService = ctx.services.unipileService;

				// Upload attachments to R2 first (if any)
				let attachmentsWithR2: Array<{
					original: {
						type: string;
						url?: string;
						filename?: string;
						data?: string;
					};
					r2Key?: string;
					r2Url?: string;
				}> = [];

				if (input.attachments?.length) {
					const r2Service = ctx.services.r2Service;
					console.log(
						`📤 Uploading ${input.attachments.length} attachments to R2...`,
					);

					attachmentsWithR2 = await Promise.all(
						input.attachments.map(async (attachment, index) => {
							try {
								// Convert base64 to Uint8Array for R2 upload
								if (attachment.data) {
									const base64Data = attachment.data.includes(",")
										? attachment.data.split(",")[1] || attachment.data
										: attachment.data;

									const binaryData = Uint8Array.from(atob(base64Data), (c) =>
										c.charCodeAt(0),
									);

									// Generate unique R2 key
									const r2Key = r2Service.generateAttachmentKey(
										`temp-${Date.now()}`, // We'll update this with real message ID later
										attachment.filename,
										attachment.type,
									);

									// Upload to R2
									const r2Url = await r2Service.upload(
										r2Key,
										binaryData,
										attachment.type,
										{
											originalFilename:
												attachment.filename || `attachment-${index + 1}`,
											messageId: "pending", // Will update after we get real message ID
										},
									);

									console.log(
										`✅ Uploaded attachment ${index + 1} to R2: ${r2Key}`,
									);

									return {
										original: attachment,
										r2Key,
										r2Url,
									};
								}

								return { original: attachment };
							} catch (error) {
								console.error(
									`❌ Failed to upload attachment ${index + 1} to R2:`,
									error,
								);
								// Continue without R2 upload - fallback to original flow
								return { original: attachment };
							}
						}),
					);
				}

				// Send message through Unipile (still using original attachments)
				const sendMessageResponse = await unipileService.sendMessage(
					{
						chat_id: chat.external_id, // Use external chat ID for Unipile
						text: input.content,
						attachments: input.attachments,
					},
					chat.unipileAccount.account_id, // Use the account_id from the database
				);

				if (sendMessageResponse.object !== "MessageSent") {
					throw new TRPCError({
						code: "BAD_GATEWAY",
						message: "Failed to send message through Unipile",
					});
				}

				// Only save locally if we have a definitive Unipile message ID
				// This prevents duplicates when sync processes the same message later
				let savedMessage = null;
				if (sendMessageResponse.message_id) {
					// Fetch the complete message details from Unipile to get proper attachment references
					let fullMessageDetails = null;
					if (input.attachments?.length) {
						try {
							console.log(
								"🔍 Fetching full message details from Unipile to get attachment URLs...",
							);
							fullMessageDetails = await unipileService.getMessage(
								sendMessageResponse.message_id,
								chat.unipileAccount.account_id,
							);
							console.log("✅ Retrieved full message details from Unipile");
						} catch (error) {
							console.warn(
								"⚠️ Failed to fetch full message details from Unipile:",
								error,
							);
							// Continue without full details - we'll use fallback attachment handling
						}
					}

					savedMessage = await unipileMessageService.upsertMessage(
						chat.unipileAccount.id,
						sendMessageResponse.message_id, // Use actual message ID to match sync process
						{
							chat_id: chat.id,
							external_chat_id: chat.external_id,
							sender_id: chat.unipileAccount.account_id,
							message_type: "text",
							content: input.content,
							is_read: true,
							is_outgoing: true, // This is an outgoing message
							sent_at: new Date(),
							sender_urn: null,
							attendee_type: null,
							attendee_distance: null,
							seen: 1,
							hidden: 0,
							deleted: 0,
							edited: 0,
							is_event: 0,
							delivered: 1,
							behavior: 0,
							event_type: 0,
							replies: 0,
							subject: null,
							parent: null,
						},
					);

					// Save attachments using R2 + Unipile data
					if (attachmentsWithR2.length && savedMessage) {
						const unipileAttachments = fullMessageDetails?.attachments || [];
						console.log(
							`📎 Saving ${attachmentsWithR2.length} attachments for sent message (${unipileAttachments.length} from Unipile)`,
						);

						for (let i = 0; i < attachmentsWithR2.length; i++) {
							const attachmentWithR2 = attachmentsWithR2[i];
							const originalAttachment = attachmentWithR2?.original;
							const unipileAttachment = unipileAttachments?.[i]; // Match by index

							if (!originalAttachment) continue;

							// Use real Unipile attachment data if available, otherwise fall back to original
							const attachmentExternalId =
								unipileAttachment?.id || `sent-${savedMessage.id}-${i}`;
							const attachmentUrl =
								unipileAttachment?.url || originalAttachment.url;
							const attachmentFilename =
								unipileAttachment?.filename ||
								originalAttachment.filename ||
								`attachment-${i + 1}`;
							const attachmentMimeType =
								unipileAttachment?.mime_type || originalAttachment.type;
							const attachmentSize =
								unipileAttachment?.file_size || unipileAttachment?.size;
							const urlExpiresAt = unipileAttachment?.url_expires_at
								? BigInt(unipileAttachment.url_expires_at)
								: undefined;

							try {
								await unipileMessageService.upsertAttachment(
									savedMessage.id,
									attachmentExternalId,
									{
										url: attachmentUrl,
										filename: attachmentFilename,
										file_size:
											typeof attachmentSize === "object"
												? attachmentSize.width * attachmentSize.height
												: attachmentSize || null,
										mime_type: attachmentMimeType,
										content:
											!attachmentUrl && !attachmentWithR2?.r2Url
												? originalAttachment.data
												: undefined, // Only store base64 if no URL and no R2
										unavailable: unipileAttachment?.unavailable || false,
										url_expires_at: urlExpiresAt,
										width:
											typeof unipileAttachment?.size === "object"
												? unipileAttachment.size.width
												: undefined,
										height:
											typeof unipileAttachment?.size === "object"
												? unipileAttachment.size.height
												: undefined,
										duration: unipileAttachment?.duration,
										sticker: unipileAttachment?.sticker || false,
										gif: unipileAttachment?.gif || false,
										voice_note: unipileAttachment?.voice_note || false,
										starts_at: unipileAttachment?.starts_at
											? BigInt(unipileAttachment.starts_at)
											: undefined,
										expires_at: unipileAttachment?.expires_at
											? BigInt(unipileAttachment.expires_at)
											: undefined,
										time_range: unipileAttachment?.time_range,
										// R2 fields
										r2_key: attachmentWithR2?.r2Key,
										r2_url: attachmentWithR2?.r2Url,
										r2_uploaded_at: attachmentWithR2?.r2Url
											? new Date()
											: undefined,
									},
									{
										attachment_type: originalAttachment.type.startsWith(
											"image/",
										)
											? "img"
											: originalAttachment.type.startsWith("video/")
												? "video"
												: originalAttachment.type.startsWith("audio/")
													? "audio"
													: "file",
									},
								);
								console.log(
									`✅ Saved attachment ${i + 1} for sent message with${unipileAttachment ? " real" : " fallback"} data${attachmentWithR2?.r2Url ? " + R2" : ""}`,
								);
							} catch (error) {
								console.error(`❌ Failed to save attachment ${i + 1}:`, error);
								// Don't throw - let the message send succeed even if attachment save fails
							}
						}
					}
				}

				// Update chat's last_message_at timestamp
				await ctx.services.unipileChatService.updateLastMessageAt(
					input.chatId,
					new Date(),
				);

				return {
					success: true,
					message: "Message sent successfully",
					messageId: sendMessageResponse.message_id,
					chatId: input.chatId,
					unipileResponse: sendMessageResponse,
					savedMessage,
					localSave: savedMessage ? "immediate" : "will_sync_later",
				};
			} catch (error) {
				console.error("❌ Error in sendMessage:", error);
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

				if (chat.unipileAccount.user_id !== ctx.userId) {
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
				const chats = folderAssignments.map((assignment) => assignment.chat);

				return folderAssignments;
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

				if (chat.unipileAccount.user_id !== ctx.userId) {
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

	/**
	 * Get user's LinkedIn profile information for message display
	 */
	getUserLinkedInProfile: protectedProcedure
		.input(
			z.object({
				unipileAccountId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			try {
				const { UserLinkedInProfileService } = await import(
					"~/services/db/user-linkedin-profile.service"
				);
				const userLinkedInProfileService = new UserLinkedInProfileService();

				const profile = await userLinkedInProfileService.getUserLinkedInProfile(
					input.unipileAccountId,
				);

				return profile;
			} catch (error) {
				console.error("❌ Error in getUserLinkedInProfile:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch user LinkedIn profile",
				});
			}
		}),

	/**
	 * Get user's profile views with pagination (Gold subscription required)
	 */
	getProfileViews: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(50),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				const { subscriptionService } = ctx.services;

				// Check if user has Gold access
				const hasGoldAccess = await subscriptionService.hasGoldAccess(
					ctx.userId,
				);
				if (!hasGoldAccess) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Profile Views requires a Gold subscription or higher",
					});
				}

				const { ProfileViewsService } = await import(
					"~/services/db/profile-views.service"
				);
				const profileViewsService = new ProfileViewsService();

				const result = await profileViewsService.getProfileViewsByUser(
					ctx.userId,
					{
						limit: input.limit,
						offset: input.offset,
					},
				);

				return result;
			} catch (error) {
				console.error("❌ Error in getProfileViews:", error);
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch profile views",
				});
			}
		}),

	/**
	 * Get profile views analytics for the authenticated user (Gold subscription required)
	 */
	getProfileViewsAnalytics: protectedProcedure.query(async ({ ctx }) => {
		try {
			const { subscriptionService } = ctx.services;

			// Check if user has Gold access
			const hasGoldAccess = await subscriptionService.hasGoldAccess(ctx.userId);
			if (!hasGoldAccess) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Profile Views analytics requires a Gold subscription or higher",
				});
			}

			const { ProfileViewsService } = await import(
				"~/services/db/profile-views.service"
			);
			const profileViewsService = new ProfileViewsService();

			const analytics = await profileViewsService.getProfileViewsAnalytics(
				ctx.userId,
			);

			return analytics;
		} catch (error) {
			console.error("❌ Error in getProfileViewsAnalytics:", error);
			if (error instanceof TRPCError) {
				throw error;
			}
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to fetch profile views analytics",
			});
		}
	}),

	/**
	 * Get sync status for user's accounts
	 */
	getSyncStatus: protectedProcedure.query(async ({ ctx }) => {
		try {
			return await ctx.services.unipileAccountService.getSyncStatus(ctx.userId);
		} catch (error) {
			console.error("❌ Error in getSyncStatus:", error);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to fetch sync status",
			});
		}
	}),

	/**
	 * Get account statistics including sync status
	 */
	getAccountStats: protectedProcedure.query(async ({ ctx }) => {
		try {
			return await ctx.services.unipileAccountService.getAccountStats(
				ctx.userId,
			);
		} catch (error) {
			console.error("❌ Error in getAccountStats:", error);
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to fetch account statistics",
			});
		}
	}),
});
