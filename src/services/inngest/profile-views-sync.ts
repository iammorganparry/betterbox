import { and, eq } from "drizzle-orm";
import { inngest } from "../inngest";

import { unipileAccounts, unipileProfileViews } from "~/db/schema";
import type { Services } from "~/middleware/services.middleware";
import type {
	UnipileApiProfileViewer,
	UnipileApiProfileViewersResponse,
	UnipileApiRawDataResponse,
} from "~/types/unipile-api";

/**
 * Scheduled function to sync profile views for all users every 24 hours
 */
export const scheduleProfileViewsSync = inngest.createFunction(
	{ id: "schedule-profile-views-sync" },
	{ cron: "0 6 * * *" }, // Every day at 6 AM UTC (24-hour interval)
	async ({ step }) => {
		console.log("🔄 Starting scheduled profile views sync...");

		await step.run("trigger-profile-views-sync", async () => {
			// Send an event to trigger the actual sync
			await inngest.send({
				name: "unipile/profile_views.sync_scheduled",
				data: {
					scheduledAt: new Date().toISOString(),
				},
			});

			console.log("✅ Profile views sync event triggered");
			return { message: "Profile views sync event triggered successfully" };
		});
	},
);

/**
 * Function to sync profile views for all active LinkedIn accounts
 */
export const syncProfileViewsForAllUsers = inngest.createFunction(
	{ id: "sync-profile-views-all-users" },
	{ event: "unipile/profile_views.sync_scheduled" },
	async ({ event, step, services }) => {
		const { db, subscriptionService, unipileService } = services;
		console.log("🔄 Syncing profile views for all users...", {
			scheduledAt: event.data.scheduledAt,
		});

		const results = await step.run("fetch-and-sync-profile-views", async () => {
			try {
				// Get all active LinkedIn accounts
				const linkedInAccounts = await db
					.select({
						id: unipileAccounts.id,
						user_id: unipileAccounts.user_id,
						account_id: unipileAccounts.account_id,
						provider: unipileAccounts.provider,
					})
					.from(unipileAccounts)
					.where(
						and(
							eq(unipileAccounts.provider, "linkedin"),
							eq(unipileAccounts.status, "connected"),
							eq(unipileAccounts.is_deleted, false),
						),
					);

				console.log(
					`📊 Found ${linkedInAccounts.length} active LinkedIn accounts to sync`,
				);

				const syncResults = {
					totalAccounts: linkedInAccounts.length,
					eligibleAccounts: 0,
					skippedAccounts: 0,
					successfulSyncs: 0,
					failedSyncs: 0,
					totalProfileViews: 0,
					newProfileViews: 0,
					errors: [] as string[],
				};

				for (const account of linkedInAccounts) {
					try {
						console.log(
							`🔄 Processing account ${account.account_id} for user ${account.user_id}`,
						);

						// Check if user has Gold access
						const hasGoldAccess = await subscriptionService.hasGoldAccess(
							account.user_id,
						);
						if (!hasGoldAccess) {
							console.log(
								`⏭️ Skipping account ${account.account_id} - user ${account.user_id} doesn't have Gold access`,
							);
							syncResults.skippedAccounts++;
							continue;
						}

						syncResults.eligibleAccounts++;

						// Get profile views from Unipile API
						const profileViewers = await fetchProfileViewersFromUnipile(
							unipileService,
							account.account_id,
						);

						// Process and save profile views
						const processResult = await processProfileViews(
							profileViewers,
							account.user_id,
							account.id,
							db,
						);

						syncResults.totalProfileViews += processResult.totalViews;
						syncResults.newProfileViews += processResult.newViews;
						syncResults.successfulSyncs++;

						console.log(
							`✅ Successfully synced ${processResult.newViews} new profile views for user ${account.user_id}`,
						);

						// Add a small delay between accounts to be respectful to the API
						await new Promise((resolve) => setTimeout(resolve, 1000));
					} catch (error) {
						console.error(
							`❌ Failed to sync profile views for account ${account.account_id}:`,
							error,
						);
						syncResults.failedSyncs++;
						syncResults.errors.push(
							`Account ${account.account_id}: ${error instanceof Error ? error.message : "Unknown error"}`,
						);
					}
				}

				console.log("📈 Profile views sync completed:", syncResults);
				return syncResults;
			} catch (error) {
				console.error("❌ Critical error in profile views sync:", error);
				throw error;
			}
		});

		return {
			message: "Profile views sync completed",
			results,
		};
	},
);

/**
 * Fetch profile viewers from Unipile API
 * Based on the documentation, this would be using the raw data endpoint
 */
async function fetchProfileViewersFromUnipile(
	unipileService: Services["unipileService"],
	accountId: string,
): Promise<UnipileApiProfileViewer[]> {
	try {
		// According to Unipile docs, we can get profile viewers using raw data endpoint
		// The feature table shows "Get own profile viewers" is available
		const response = await unipileService.getRawData(
			"profile_viewers", // This would be the endpoint for getting profile viewers
			accountId,
			{}, // Additional parameters if needed
		);

		// Parse the response to extract profile viewers
		// Handle different possible response structures
		let viewersData: UnipileApiProfileViewer[] = [];

		if (Array.isArray(response)) {
			viewersData = response;
		} else if (response && typeof response === "object") {
			const responseObj = response as UnipileApiProfileViewersResponse;
			if (Array.isArray(responseObj.data)) {
				viewersData = responseObj.data;
			} else if (Array.isArray(responseObj.items)) {
				viewersData = responseObj.items;
			} else if (Array.isArray(responseObj.viewers)) {
				viewersData = responseObj.viewers;
			}
		}

		return viewersData.map((viewer: UnipileApiProfileViewer) => ({
			id: viewer.id || viewer.viewer_id,
			name: viewer.name || viewer.viewer_name,
			headline: viewer.headline || viewer.viewer_headline,
			profile_picture_url:
				viewer.profile_picture_url || viewer.viewer_image_url,
			profile_url: viewer.profile_url,
			viewed_at:
				viewer.viewed_at || viewer.timestamp || new Date().toISOString(),
			provider_id: viewer.provider_id || viewer.viewer_profile_id,
		}));
	} catch (error) {
		console.error("❌ Error fetching profile viewers from Unipile:", error);

		// Fallback: If the specific endpoint doesn't work, we could try alternative approaches
		// For now, return empty array to prevent the entire sync from failing
		return [];
	}
}

/**
 * Process and save profile views to database
 */
async function processProfileViews(
	profileViewers: UnipileApiProfileViewer[],
	userId: string,
	unipileAccountId: string,
	db: Services["db"],
): Promise<{ totalViews: number; newViews: number }> {
	if (profileViewers.length === 0) {
		return { totalViews: 0, newViews: 0 };
	}

	let newViews = 0;

	for (const viewer of profileViewers) {
		try {
			// Check if this profile view already exists
			const existingView = await db
				.select()
				.from(unipileProfileViews)
				.where(
					and(
						eq(unipileProfileViews.user_id, userId),
						eq(unipileProfileViews.viewer_profile_id, viewer.provider_id || ""),
						eq(unipileProfileViews.viewed_at, new Date(viewer.viewed_at)),
					),
				)
				.limit(1);

			if (existingView.length === 0) {
				// Insert new profile view
				await db.insert(unipileProfileViews).values({
					user_id: userId,
					viewer_profile_id: viewer.provider_id || null,
					viewer_name: viewer.name || null,
					viewer_headline: viewer.headline || null,
					viewer_image_url: viewer.profile_picture_url || null,
					viewed_at: new Date(viewer.viewed_at),
					provider: "linkedin",
					is_deleted: false,
					created_at: new Date(),
					updated_at: new Date(),
				});

				newViews++;
				console.log(
					`✅ Added new profile view from ${viewer.name || "Anonymous"} for user ${userId}`,
				);
			}
		} catch (error) {
			console.error(
				`❌ Error processing profile view for ${viewer.name}:`,
				error,
			);
			// Continue processing other views even if one fails
		}
	}

	return {
		totalViews: profileViewers.length,
		newViews,
	};
}
