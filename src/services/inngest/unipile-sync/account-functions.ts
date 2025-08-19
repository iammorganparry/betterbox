import type { UnipileAccountStatus } from "../../db/unipile-account.service";
import { inngest } from "../../inngest";
import {
	type AccountStatusEvent,
	type UnipileApiAccountStatus,
	getCurrentSyncConfig,
	getUserChannelId,
	normalizeAccountType,
	normalizeProvider,
} from "./shared";

/**
 * Handle Unipile account status updates (real-time)
 */
export const unipileAccountStatusUpdate = inngest.createFunction(
	{ id: "unipile-account-status-update" },
	{ event: "unipile/account.status" },
	async ({ event, step, services }) => {
		const { data } = event;

		const { userService, unipileAccountService } = services;

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
			return await userService.findByClerkId(user_identifier);
		});

		if (!user) {
			throw new Error(`User not found for identifier: ${user_identifier}`);
		}

		// Upsert the Unipile account
		const account = await step.run("upsert-unipile-account", async () => {
			return await unipileAccountService.upsertUnipileAccount(
				user.id,
				account_id,
				provider,
				{ status: status as "error" | "connected" | "disconnected" },
			);
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
 * Handle Unipile account connection/update events (from hosted auth)
 */
export const unipileAccountConnected = inngest.createFunction(
	{ id: "unipile-account-connected" },
	{ event: "unipile/account.connected" },
	async ({ event, step, services }) => {
		const { data } = event;
		const { userService, unipileAccountService } = services;
		// Extract account data from webhook
		const { account_id, provider, status, user_identifier } = data;

		// Find the user by their identifier (should be the Clerk user ID we sent)
		const user = await step.run("find-user", async () => {
			return await userService.findByClerkId(user_identifier);
		});

		if (!user) {
			throw new Error(`User not found for identifier: ${user_identifier}`);
		}

		// Upsert the Unipile account using the service
		const account = await step.run("upsert-unipile-account", async () => {
			return await unipileAccountService.upsertUnipileAccount(
				user.id,
				account_id,
				provider,
				{ status: (status || "connected") as UnipileAccountStatus },
			);
		});

		// Trigger historical sync if this is a new connection
		if (status === "connected") {
			await step.sendEvent("trigger-historical-sync", {
				name: "unipile/sync.historical_messages",
				data: {
					user_id: user.id,
					account_id,
					provider,
					dsn: process.env.UNIPILE_DSN || "",
					api_key: process.env.UNIPILE_API_KEY || "",
					limit: getCurrentSyncConfig().chat.maxChats,
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
	async ({ event, step, services }) => {
		const { data } = event;
		const { userService, unipileAccountService } = services;
		// Extract account data from webhook
		const { account_id, provider, user_identifier } = data;

		// Find the user by their identifier (should be the Clerk user ID we sent)
		const user = await step.run("find-user", async () => {
			return await userService.findByClerkId(user_identifier);
		});

		if (!user) {
			throw new Error(`User not found for identifier: ${user_identifier}`);
		}

		// Mark account as deleted using the service
		const result = await step.run("disconnect-account", async () => {
			return await unipileAccountService.markAccountAsDeleted(
				user.id,
				account_id,
				provider,
			);
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
