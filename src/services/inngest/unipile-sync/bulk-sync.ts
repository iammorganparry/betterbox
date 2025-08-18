import { inngest } from "../../inngest";
import {
	getCurrentSyncConfig,
	createUnipileService,
	createEnrichedContactFromSender,
	type UnipileApiMessage,
} from "./shared";

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
	async ({ event, step, services }) => {
		const { data } = event;
		const syncConfig = getCurrentSyncConfig();
		const {
			unipileAccountService: accountService,
			unipileMessageService: messageService,
			unipileContactService: contactService,
			unipileChatService: chatService,
		} = services;
		const { account_id, provider, messages } = data;

		// Find the Unipile account using the service
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await accountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
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
					// Process messages and contacts in parallel batches
					const messagePromises = batch.map(
						async (messageData: UnipileApiMessage) => {
							// Use is_sender field when available, fallback to sender ID matching
							const isOutgoing =
								messageData.is_sender === 1 ||
								messageData.sender_id === account_id ||
								messageData.sender_id === unipileAccount.account_id;

							// Find the internal chat record by external chat ID if available
							let internalChat = null;
							if (messageData.chat_id) {
								try {
									internalChat = await chatService.findChatByExternalId(
										unipileAccount.id,
										messageData.chat_id,
									);
								} catch (error) {
									console.warn(
										`Failed to find internal chat for external chat ID ${messageData.chat_id}:`,
										error,
									);
								}
							}

							// Upsert message using the service
							const message = await messageService.upsertMessage(
								unipileAccount.id,
								messageData.id,

								{
									...(internalChat ? { chat_id: internalChat.id } : {}), // Link to internal chat if found
									chat_id: internalChat?.id, // Link to internal chat record
									external_chat_id: messageData.chat_id, // Store external API chat ID
									sender_id: messageData.sender_id,
									recipient_id: undefined, // Not available in new API structure
									message_type:
										messageData.message_type?.toLowerCase() || "text",
									content: messageData.text || undefined,
									is_read: messageData.seen === 1,
									// Only update is_outgoing if we have reliable data (is_sender field)
									...(messageData.is_sender !== undefined && {
										is_outgoing: messageData.is_sender === 1,
									}),
									sent_at: messageData.timestamp
										? new Date(messageData.timestamp)
										: new Date(),
								},
							);

							// Create enriched contact if this is from someone else
							if (!isOutgoing && messageData.sender_id) {
								// Create enriched contact if profile enrichment is enabled
								if (syncConfig.enableProfileEnrichment) {
									if (
										!process.env.UNIPILE_API_KEY ||
										!process.env.UNIPILE_DSN
									) {
										throw new Error(
											"Unipile credentials missing but profile enrichment is enabled",
										);
									}

									const unipileService = createUnipileService({
										apiKey: process.env.UNIPILE_API_KEY,
										dsn: process.env.UNIPILE_DSN,
									});

									await createEnrichedContactFromSender(
										unipileService,
										contactService,
										unipileAccount.id,
										account_id,
										messageData.sender_id,
										messageData.sender_urn,
									);
								} else {
									// Fallback to basic contact creation using available message data
									const sender = messageData.sender;
									const fullName =
										sender?.display_name ||
										sender?.name ||
										(sender?.first_name && sender?.last_name
											? `${sender.first_name} ${sender.last_name}`
											: undefined) ||
										messageData.sender_urn ||
										undefined;

									await contactService.upsertContact(
										unipileAccount.id,
										messageData.sender_id,
										{
											full_name: fullName,
											first_name: sender?.first_name,
											last_name: sender?.last_name,
											headline: sender?.headline,
											profile_image_url:
												sender?.profile_picture_url || sender?.avatar_url,
											provider_url: sender?.profile_url,
											last_interaction: new Date(),
										},
									);
								}
							}

							return message;
						},
					);

					await Promise.all(messagePromises);
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
