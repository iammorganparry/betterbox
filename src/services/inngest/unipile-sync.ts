import { inngest } from "../inngest";
import { db } from "~/server/db";
import { createUnipileClient } from "~/lib/http";
import type { Prisma } from "../../../generated/prisma";
import type {
	UnipileApiResponse,
	UnipileApiChat,
	UnipileApiMessage,
	UnipileApiAccountStatus,
	UnipileHistoricalSyncRequest,
} from "~/types/unipile-api";
import type { AccountStatusEvent } from "~/types/realtime";
import { getUserChannelId } from "~/types/realtime";

/**
 * Handle Unipile account status updates (real-time)
 */
export const unipileAccountStatusUpdate = inngest.createFunction(
	{ id: "unipile-account-status-update" },
	{ event: "unipile/account.status" },
	async ({ event, step }) => {
		const { data } = event;

		// Extract account data from Unipile webhook
		const {
			account_id,
			status,
			provider,
			provider_data,
			user_identifier,
		}: UnipileApiAccountStatus & { user_identifier: string } = data;

		// Find the user by their identifier (could be email or clerk_id)
		const user = await step.run("find-user", async () => {
			return await db.user.findFirst({
				where: {
					OR: [{ email: user_identifier }, { clerk_id: user_identifier }],
				},
			});
		});

		if (!user) {
			throw new Error(`User not found for identifier: ${user_identifier}`);
		}

		// Upsert the Unipile account
		const account = await step.run("upsert-unipile-account", async () => {
			return await db.unipileAccount.upsert({
				where: {
					user_id_provider_account_id: {
						user_id: user.id,
						provider,
						account_id,
					},
				},
				update: {
					status,
					updated_at: new Date(),
				},
				create: {
					user_id: user.id,
					provider,
					account_id,
					status,
				},
			});
		});

		// Publish realtime update to user's channel
		await step.run("publish-account-status", async () => {
			const accountStatusEvent: AccountStatusEvent = {
				account_id,
				provider,
				status,
				error_message:
					status === "error" ? "Account connection error" : undefined,
			};

			return step.sendEvent("realtime-account-status", {
				name: "realtime/publish",
				data: {
					channel: getUserChannelId(user.id),
					topic: "account:status",
					payload: accountStatusEvent,
				},
			});
		});

		return { account, message: "Account status updated successfully" };
	},
);

/**
 * Handle new messages from Unipile (real-time)
 */
export const unipileNewMessage = inngest.createFunction(
	{ id: "unipile-new-message" },
	{ event: "unipile/message.new" },
	async ({ event, step }) => {
		const { data } = event;

		const {
			account_id,
			provider,
			message,
			chat_id,
			sender,
			recipient,
			timestamp,
		} = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await db.unipileAccount.findFirst({
				where: {
					account_id,
					provider,
					is_deleted: false,
				},
				include: {
					user: true,
				},
			});
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Determine if this is an outgoing message (sent by our user)
		const isOutgoing = sender?.id === account_id;

		// Upsert the message
		const savedMessage = await step.run("upsert-message", async () => {
			return await db.unipileMessage.upsert({
				where: {
					unipile_account_id_external_id: {
						unipile_account_id: unipileAccount.id,
						external_id: message.id,
					},
				},
				update: {
					content: message.text || message.content,
					is_read: message.is_read || false,
					updated_at: new Date(),
				},
				create: {
					unipile_account_id: unipileAccount.id,
					external_id: message.id,
					chat_id,
					sender_id: sender?.id,
					recipient_id: recipient?.id,
					message_type: message.type || "text",
					content: message.text || message.content,
					is_read: message.is_read || false,
					is_outgoing: isOutgoing,
					sent_at: timestamp ? new Date(timestamp) : new Date(),
				},
			});
		});

		// If this is a new contact, upsert them
		if (!isOutgoing && sender) {
			await step.run("upsert-contact", async () => {
				return await db.unipileContact.upsert({
					where: {
						unipile_account_id_external_id: {
							unipile_account_id: unipileAccount.id,
							external_id: sender.id,
						},
					},
					update: {
						full_name: sender.display_name || sender.name,
						first_name: sender.first_name,
						last_name: sender.last_name,
						headline: sender.headline,
						profile_image_url: sender.profile_picture_url || sender.avatar_url,
						provider_url: sender.profile_url,
						last_interaction: new Date(),
						updated_at: new Date(),
					},
					create: {
						unipile_account_id: unipileAccount.id,
						external_id: sender.id,
						full_name: sender.display_name || sender.name,
						first_name: sender.first_name,
						last_name: sender.last_name,
						headline: sender.headline,
						profile_image_url: sender.profile_picture_url || sender.avatar_url,
						provider_url: sender.profile_url,
						last_interaction: new Date(),
					},
				});
			});
		}

		return { message: savedMessage, account: unipileAccount };
	},
);

/**
 * Handle LinkedIn profile views from Unipile (real-time)
 */
export const unipileProfileView = inngest.createFunction(
	{ id: "unipile-profile-view" },
	{ event: "unipile/profile.view" },
	async ({ event, step }) => {
		const { data } = event;

		const { account_id, provider = "linkedin", viewer, viewed_at } = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await db.unipileAccount.findFirst({
				where: {
					account_id,
					provider,
					is_deleted: false,
				},
				include: {
					user: true,
				},
			});
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Create the profile view record
		const profileView = await step.run("create-profile-view", async () => {
			return await db.unipileProfileView.create({
				data: {
					user_id: unipileAccount.user_id,
					viewer_profile_id: viewer?.id,
					viewer_name: viewer?.display_name || viewer?.name,
					viewer_headline: viewer?.headline,
					viewer_image_url: viewer?.profile_picture_url || viewer?.avatar_url,
					viewed_at: viewed_at ? new Date(viewed_at) : new Date(),
					provider,
				},
			});
		});

		// Also upsert the viewer as a contact if they're not already
		if (viewer?.id) {
			await step.run("upsert-viewer-contact", async () => {
				return await db.unipileContact.upsert({
					where: {
						unipile_account_id_external_id: {
							unipile_account_id: unipileAccount.id,
							external_id: viewer.id,
						},
					},
					update: {
						full_name: viewer.display_name || viewer.name,
						first_name: viewer.first_name,
						last_name: viewer.last_name,
						headline: viewer.headline,
						profile_image_url: viewer.profile_picture_url || viewer.avatar_url,
						provider_url: viewer.profile_url,
						last_interaction: new Date(),
						updated_at: new Date(),
					},
					create: {
						unipile_account_id: unipileAccount.id,
						external_id: viewer.id,
						full_name: viewer.display_name || viewer.name,
						first_name: viewer.first_name,
						last_name: viewer.last_name,
						headline: viewer.headline,
						profile_image_url: viewer.profile_picture_url || viewer.avatar_url,
						provider_url: viewer.profile_url,
						last_interaction: new Date(),
					},
				});
			});
		}

		return { profileView, message: "Profile view recorded successfully" };
	},
);

/**
 * Fetch and seed historical messages from Unipile API
 * This function is triggered after user onboarding to fetch historical data
 */
export const unipileHistoricalMessageSync = inngest.createFunction(
	{ id: "unipile-historical-message-sync" },
	{ event: "unipile/sync.historical_messages" },
	async ({ event, step }) => {
		const { data } = event;
		const {
			user_id,
			account_id,
			provider,
			dsn,
			api_key,
			limit = 1000,
		}: UnipileHistoricalSyncRequest = data;

		// Find the user and Unipile account
		const user = await step.run("find-user", async () => {
			return await db.user.findUnique({
				where: { id: user_id },
			});
		});

		if (!user) {
			throw new Error(`User not found: ${user_id}`);
		}

		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await db.unipileAccount.findFirst({
				where: {
					user_id,
					account_id,
					provider,
					is_deleted: false,
				},
			});
		});

		if (!unipileAccount) {
			throw new Error(
				`Unipile account not found for user ${user_id}: ${account_id} (${provider})`,
			);
		}

		let totalProcessed = 0;
		let cursor: string | null = null;
		const pageSize = 100;

		// Create Unipile client for this API key and DSN
		const unipileClient = createUnipileClient(api_key, dsn);

		// Fetch messages in paginated chunks
		while (totalProcessed < limit) {
			const chats = await step.run(
				`fetch-chats-${Math.floor(totalProcessed / pageSize)}`,
				async (): Promise<UnipileApiResponse<UnipileApiChat>> => {
					const params = new URLSearchParams({
						account_id,
						limit: Math.min(pageSize, limit - totalProcessed).toString(),
					});

					if (cursor) {
						params.set("cursor", cursor);
					}

					const response = await unipileClient.get<
						UnipileApiResponse<UnipileApiChat>
					>(`/chats?${params.toString()}`);

					return response.data;
				},
			);

			if (!chats.data || chats.data.length === 0) {
				break; // No more chats
			}

			// Process messages for each chat in this batch
			const processedBatch = await step.run(
				`process-chat-batch-${Math.floor(totalProcessed / pageSize)}`,
				async () => {
					let batchProcessed = 0;

					for (const chat of chats.data) {
						// Fetch messages for this chat
						try {
							const messagesResponse = await unipileClient.get<
								UnipileApiResponse<UnipileApiMessage>
							>(`/chats/${chat.id}/messages`);

							const messagesData = messagesResponse.data;
							const chatMessages = messagesData.data || [];

							for (const messageData of chatMessages) {
								const isOutgoing = messageData.sender?.id === account_id;

								// Upsert message
								await db.unipileMessage.upsert({
									where: {
										unipile_account_id_external_id: {
											unipile_account_id: unipileAccount.id,
											external_id: messageData.id,
										},
									},
									update: {
										content: messageData.text || messageData.content || null,
										is_read: messageData.is_read || false,
										updated_at: new Date(),
									},
									create: {
										unipile_account_id: unipileAccount.id,
										external_id: messageData.id,
										chat_id: chat.id,
										sender_id: messageData.sender?.id || null,
										recipient_id: messageData.recipient?.id || null,
										message_type: messageData.type || "text",
										content: messageData.text || messageData.content || null,
										is_read: messageData.is_read || false,
										is_outgoing: isOutgoing,
										sent_at: messageData.timestamp
											? new Date(messageData.timestamp)
											: new Date(),
									},
								});

								// Upsert contact if this is from someone else
								if (!isOutgoing && messageData.sender) {
									await db.unipileContact.upsert({
										where: {
											unipile_account_id_external_id: {
												unipile_account_id: unipileAccount.id,
												external_id: messageData.sender.id,
											},
										},
										update: {
											full_name:
												messageData.sender.display_name ||
												messageData.sender.name,
											first_name: messageData.sender.first_name,
											last_name: messageData.sender.last_name,
											headline: messageData.sender.headline,
											profile_image_url:
												messageData.sender.profile_picture_url ||
												messageData.sender.avatar_url,
											provider_url: messageData.sender.profile_url,
											last_interaction: new Date(),
											updated_at: new Date(),
										},
										create: {
											unipile_account_id: unipileAccount.id,
											external_id: messageData.sender.id,
											full_name:
												messageData.sender.display_name ||
												messageData.sender.name,
											first_name: messageData.sender.first_name,
											last_name: messageData.sender.last_name,
											headline: messageData.sender.headline,
											profile_image_url:
												messageData.sender.profile_picture_url ||
												messageData.sender.avatar_url,
											provider_url: messageData.sender.profile_url,
											last_interaction: new Date(),
										},
									});
								}

								batchProcessed++;
							}
						} catch (error) {
							console.warn(
								`Failed to fetch messages for chat ${chat.id}:`,
								error,
							);
						}
					}

					return batchProcessed;
				},
			);

			totalProcessed += processedBatch;
			cursor = chats.pagination?.next_cursor || null;

			// Break if no more pages
			if (!cursor || !chats.pagination?.has_more) {
				break;
			}
		}

		// Update sync status
		await step.run("update-sync-status", async () => {
			return await db.unipileAccount.update({
				where: { id: unipileAccount.id },
				data: {
					status: "connected",
					updated_at: new Date(),
				},
			});
		});

		return {
			user_id,
			account_id,
			provider,
			totalProcessed,
			message: "Historical message sync completed successfully",
		};
	},
);

/**
 * Handle Unipile account connection/update events (from hosted auth)
 */
export const unipileAccountConnected = inngest.createFunction(
	{ id: "unipile-account-connected" },
	{ event: "unipile/account.connected" },
	async ({ event, step }) => {
		const { data } = event;

		// Extract account data from webhook
		const { account_id, provider, status, user_identifier } = data;

		// Find the user by their identifier (should be the Clerk user ID we sent)
		const user = await step.run("find-user", async () => {
			return await db.user.findFirst({
				where: {
					OR: [{ clerk_id: user_identifier }, { email: user_identifier }],
				},
			});
		});

		if (!user) {
			throw new Error(`User not found for identifier: ${user_identifier}`);
		}

		// Upsert the Unipile account
		const account = await step.run("upsert-unipile-account", async () => {
			return await db.unipileAccount.upsert({
				where: {
					user_id_provider_account_id: {
						user_id: user.id,
						provider,
						account_id,
					},
				},
				update: {
					status: status || "connected",
					updated_at: new Date(),
				},
				create: {
					user_id: user.id,
					provider,
					account_id,
					status: status || "connected",
				},
			});
		});

		// Trigger historical sync if this is a new connection
		if (status === "connected") {
			await step.sendEvent("trigger-historical-sync", {
				name: "unipile/sync.historical_messages",
				data: {
					user_id: user.id,
					account_id,
					provider,
					dsn: process.env.UNIPILE_DSN,
					api_key: process.env.UNIPILE_API_KEY,
					limit: 1000,
				},
			});
		}

		return { account, message: "Account connected successfully" };
	},
);

/**
 * Handle Unipile account disconnection events
 */
export const unipileAccountDisconnected = inngest.createFunction(
	{ id: "unipile-account-disconnected" },
	{ event: "unipile/account.disconnected" },
	async ({ event, step }) => {
		const { data } = event;

		// Extract account data from webhook
		const { account_id, provider, user_identifier } = data;

		// Find the user by their identifier (should be the Clerk user ID we sent)
		const user = await step.run("find-user", async () => {
			return await db.user.findFirst({
				where: {
					OR: [{ clerk_id: user_identifier }, { email: user_identifier }],
				},
			});
		});

		if (!user) {
			throw new Error(`User not found for identifier: ${user_identifier}`);
		}

		// Mark account as deleted
		const result = await step.run("disconnect-account", async () => {
			return await db.unipileAccount.updateMany({
				where: {
					user_id: user.id,
					provider,
					account_id,
				},
				data: {
					is_deleted: true,
					status: "disconnected",
					updated_at: new Date(),
				},
			});
		});

		return {
			result,
			message: "Account disconnected successfully",
			user_id: user.id,
			account_id,
			provider,
		};
	},
);

/**
 * Bulk sync messages from Unipile (for webhook bulk sync events)
 * This function handles large message imports efficiently from webhooks
 */
export const unipileBulkMessageSync = inngest.createFunction(
	{
		id: "unipile-bulk-message-sync",
		// No batching for bulk sync as it's already processing in bulk
	},
	{ event: "unipile/messages.bulk_sync" },
	async ({ event, step }) => {
		const { data } = event;
		const { account_id, provider, messages } = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await db.unipileAccount.findFirst({
				where: {
					account_id,
					provider,
					is_deleted: false,
				},
				include: {
					user: true,
				},
			});
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		let processedCount = 0;
		const batchSize = 100; // Increased batch size for bulk operations

		// Process messages in batches
		for (let i = 0; i < messages.length; i += batchSize) {
			const batch = messages.slice(i, i + batchSize);

			await step.run(
				`process-message-batch-${Math.floor(i / batchSize)}`,
				async () => {
					// Prepare batch data
					const messageUpserts = [];
					const contactUpserts = [];

					for (const messageData of batch) {
						const isOutgoing = messageData.sender?.id === account_id;

						messageUpserts.push({
							where: {
								unipile_account_id_external_id: {
									unipile_account_id: unipileAccount.id,
									external_id: messageData.id,
								},
							},
							update: {
								content: messageData.text || messageData.content,
								is_read: messageData.is_read || false,
								updated_at: new Date(),
							},
							create: {
								unipile_account_id: unipileAccount.id,
								external_id: messageData.id,
								chat_id: messageData.chat_id,
								sender_id: messageData.sender?.id,
								recipient_id: messageData.recipient?.id,
								message_type: messageData.type || "text",
								content: messageData.text || messageData.content,
								is_read: messageData.is_read || false,
								is_outgoing: isOutgoing,
								sent_at: messageData.timestamp
									? new Date(messageData.timestamp)
									: new Date(),
							},
						});

						// Collect contact data if this is from someone else
						if (!isOutgoing && messageData.sender) {
							contactUpserts.push({
								where: {
									unipile_account_id_external_id: {
										unipile_account_id: unipileAccount.id,
										external_id: messageData.sender.id,
									},
								},
								update: {
									full_name:
										messageData.sender.display_name || messageData.sender.name,
									last_interaction: new Date(),
									updated_at: new Date(),
								},
								create: {
									unipile_account_id: unipileAccount.id,
									external_id: messageData.sender.id,
									full_name:
										messageData.sender.display_name || messageData.sender.name,
									last_interaction: new Date(),
								},
							});
						}
					}

					// Execute batch upserts
					const messagePromises = messageUpserts.map((upsert) =>
						db.unipileMessage.upsert(upsert),
					);
					await Promise.all(messagePromises);

					// Execute contact upserts
					if (contactUpserts.length > 0) {
						const contactPromises = contactUpserts.map((upsert) =>
							db.unipileContact.upsert(upsert),
						);
						await Promise.all(contactPromises);
					}

					processedCount += batch.length;
					return processedCount;
				},
			);
		}

		return {
			processedCount,
			totalMessages: messages.length,
			message: "Bulk message sync completed successfully",
		};
	},
);
