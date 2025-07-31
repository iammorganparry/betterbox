import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { UnipileAccountStatus } from "generated/prisma";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Input schemas
const credentialsAuthSchema = z.object({
	username: z.string().min(1, "Email is required"),
	password: z.string().min(1, "Password is required"),
});

const cookieAuthSchema = z.object({
	access_token: z.string().min(1, "LinkedIn access token is required"),
	user_agent: z.string().min(1, "User agent is required"),
});

const checkpointSchema = z.object({
	checkpointId: z.string().min(1, "Checkpoint ID is required"),
	checkpointType: z.string().min(1, "Checkpoint type is required"),
	value: z.string().min(1, "Verification code is required"),
});

const disconnectSchema = z.object({
	accountId: z.string().min(1, "Account ID is required"),
});

export const linkedinRouter = createTRPCRouter({
	/**
	 * Get user's LinkedIn accounts
	 */
	getLinkedinAccount: protectedProcedure.query(async ({ ctx }) => {
		try {
			const accounts = await ctx.services.unipileAccountService.getUserAccounts(
				ctx.userId,
				"linkedin",
			);

			return { accounts };
		} catch (error) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to fetch LinkedIn accounts",
			});
		}
	}),

	/**
	 * Authenticate with username/password
	 */
	authenticateWithCredentials: protectedProcedure
		.input(credentialsAuthSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const result =
					await ctx.services.linkedinAuthService.authenticateWithCredentials(
						input,
					);

				if (result.success && result.account_id && !result.checkpoint_type) {
					// Store account in database using service
					await ctx.services.unipileAccountService.upsertUnipileAccount(
						ctx.userId,
						result.account_id,
						"linkedin",
						{
							status: (result.status as UnipileAccountStatus) || UnipileAccountStatus.connected,
						},
					);

					// Trigger historical sync
					await ctx.services.historicalSyncService.triggerSync({
						user_id: ctx.userId,
						account_id: result.account_id,
						provider: "linkedin",
						limit: 1000,
					});
				}

				return result;
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Authentication failed",
				});
			}
		}),

	/**
	 * Authenticate with cookies
	 */
	authenticateWithCookies: protectedProcedure
		.input(cookieAuthSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const result =
					await ctx.services.linkedinAuthService.authenticateWithCookies(input);

				if (result.success && result.account_id && !result.checkpoint_type) {
					// Store account in database using service
					await ctx.services.unipileAccountService.upsertUnipileAccount(
						ctx.userId,
						result.account_id,
						"linkedin",
						{
							status: (result.status as UnipileAccountStatus) || UnipileAccountStatus.connected,
						},
					);

					// Trigger historical sync
					await ctx.services.historicalSyncService.triggerSync({
						user_id: ctx.userId,
						account_id: result.account_id,
						provider: "linkedin",
						limit: 1000,
					});
				}

				return result;
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Authentication failed",
				});
			}
		}),

	/**
	 * Resolve checkpoint (2FA, OTP, etc.)
	 */
	resolveCheckpoint: protectedProcedure
		.input(checkpointSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const result = await ctx.services.linkedinAuthService.resolveCheckpoint(
					input.checkpointId,
					input.checkpointType,
					input.value,
				);

				if (result.success && result.account_id) {
					// Store account in database using service
					await ctx.services.unipileAccountService.upsertUnipileAccount(
						ctx.userId,
						result.account_id,
						"linkedin",
						{
							status: (result.status as UnipileAccountStatus) || UnipileAccountStatus.connected,
						},
					);

					// Trigger historical sync
					await ctx.services.historicalSyncService.triggerSync({
						user_id: ctx.userId,
						account_id: result.account_id,
						provider: "linkedin",
						limit: 1000,
					});
				}

				return result;
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Checkpoint resolution failed",
				});
			}
		}),

	/**
	 * Disconnect LinkedIn account
	 */
	disconnect: protectedProcedure
		.input(disconnectSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				// Find the account using service
				const accounts =
					await ctx.services.unipileAccountService.getUserAccounts(
						ctx.userId,
						"linkedin",
					);
				const account = accounts.find(
					(acc) => acc.account_id === input.accountId && !acc.is_deleted,
				);

				if (!account) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "LinkedIn account not found",
					});
				}

				// Disconnect from Unipile
				const result = await ctx.services.linkedinAuthService.disconnectAccount(
					input.accountId,
				);

				if (result.success) {
					// Mark as deleted using service
					await ctx.services.unipileAccountService.markAccountAsDeleted(
						ctx.userId,
						input.accountId,
						"linkedin",
					);
				}

				return result;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to disconnect account",
				});
			}
		}),

	/**
	 * Get checkpoint type information
	 */
	getCheckpointInfo: protectedProcedure
		.input(z.object({ checkpointType: z.string() }))
		.query(({ ctx, input }) => {
			return ctx.services.linkedinAuthService.getCheckpointTypeInfo(
				input.checkpointType,
			);
		}),
});
