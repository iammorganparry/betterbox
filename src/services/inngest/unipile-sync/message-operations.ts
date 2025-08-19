import { inngest } from "../../inngest";

/**
 * Handle message read events from Unipile (real-time)
 */
export const unipileMessageRead = inngest.createFunction(
	{
		id: "unipile-message-read",
		concurrency: {
			limit: 1,
			key: "event.data.message_id",
		},
	},
	{ event: "unipile/message_read" },
	async ({ event, step, services }) => {
		const { data } = event;
		const { unipileAccountService, unipileMessageService } = services;

		const { account_id, provider, message_id, read_by } = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await unipileAccountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Update message read status
		await step.run("update-message-read-status", async () => {
			return await unipileMessageService.upsertMessage(
				unipileAccount.id,
				message_id,
				{ is_read: true },
			);
		});

		return { message: "Message marked as read successfully" };
	},
);

/**
 * Handle message reactions from Unipile (real-time)
 */
export const unipileMessageReaction = inngest.createFunction(
	{
		id: "unipile-message-reaction",
		concurrency: {
			limit: 1,
			key: "event.data.message_id",
		},
	},
	{ event: "unipile/message_reaction" },
	async ({ event, step, services }) => {
		const { data } = event;
		const { unipileAccountService, unipileMessageService } = services;

		const { account_id, provider, message_id, reaction, reactor_id } = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await unipileAccountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Handle message reaction (you may need to implement this method)
		await step.run("handle-message-reaction", async () => {
			// This would need to be implemented in your message service
			console.log("Message reaction received:", {
				message_id,
				reaction,
				reactor_id,
			});
			// TODO: Implement reaction handling in message service
		});

		return { message: "Message reaction handled successfully" };
	},
);

/**
 * Handle message edits from Unipile (real-time)
 */
export const unipileMessageEdited = inngest.createFunction(
	{
		id: "unipile-message-edited",
		concurrency: {
			limit: 1,
			key: "event.data.message_id",
		},
	},
	{ event: "unipile/message_edited" },
	async ({ event, step, services }) => {
		const { data } = event;
		const { unipileAccountService, unipileMessageService } = services;

		const { account_id, provider, message_id, new_content, edited_at } = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await unipileAccountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Update message content
		await step.run("update-message-content", async () => {
			return await unipileMessageService.upsertMessage(
				unipileAccount.id,
				message_id,
				{
					content: new_content,
					edited: 1,
				},
			);
		});

		return { message: "Message edited successfully" };
	},
);

/**
 * Handle message deletions from Unipile (real-time)
 */
export const unipileMessageDeleted = inngest.createFunction(
	{ id: "unipile-message-deleted" },
	{ event: "unipile/message_deleted" },
	async ({ event, step, services }) => {
		const { data } = event;
		const { unipileAccountService, unipileMessageService } = services;

		const { account_id, provider, message_id, deleted_at, deleted_by } = data;

		// Find the Unipile account
		const unipileAccount = await step.run("find-unipile-account", async () => {
			return await unipileAccountService.findUnipileAccountByProvider(
				account_id,
				provider,
				{ include_user: true },
			);
		});

		if (!unipileAccount) {
			throw new Error(`Unipile account not found: ${account_id} (${provider})`);
		}

		// Mark message as deleted
		await step.run("mark-message-deleted", async () => {
			return await unipileMessageService.upsertMessage(
				unipileAccount.id,
				message_id,
				{
					is_deleted: true,
					deleted: 1,
				},
			);
		});

		return { message: "Message deleted successfully" };
	},
);
