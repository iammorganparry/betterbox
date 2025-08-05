import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "~/db";
import { unipileProfileViews } from "~/db/schema/tables2";

export class ProfileViewsService {
	/**
	 * Get profile views for a user with analytics and pagination
	 */
	async getProfileViewsByUser(
		userId: string,
		options: {
			limit?: number;
			offset?: number;
		} = {},
	) {
		const { limit = 50, offset = 0 } = options;

		// Get profile views with visitor analytics
		const profileViewsQuery = db
			.select({
				id: unipileProfileViews.id,
				viewer_profile_id: unipileProfileViews.viewer_profile_id,
				viewer_name: unipileProfileViews.viewer_name,
				viewer_headline: unipileProfileViews.viewer_headline,
				viewer_image_url: unipileProfileViews.viewer_image_url,
				viewed_at: unipileProfileViews.viewed_at,
				provider: unipileProfileViews.provider,
				created_at: unipileProfileViews.created_at,
				// Calculate visit count for this viewer
				visit_count: sql<number>`(
					SELECT COUNT(*) 
					FROM ${unipileProfileViews} pv2 
					WHERE pv2.user_id = ${unipileProfileViews.user_id} 
					AND pv2.viewer_profile_id = ${unipileProfileViews.viewer_profile_id}
					AND pv2.is_deleted = false
				)`.as("visit_count"),
				// Get first visit date
				first_visit: sql<Date>`(
					SELECT MIN(viewed_at) 
					FROM ${unipileProfileViews} pv3 
					WHERE pv3.user_id = ${unipileProfileViews.user_id} 
					AND pv3.viewer_profile_id = ${unipileProfileViews.viewer_profile_id}
					AND pv3.is_deleted = false
				)`.as("first_visit"),
				// Get last visit date (excluding current)
				last_visit: sql<Date>`(
					SELECT MAX(viewed_at) 
					FROM ${unipileProfileViews} pv4 
					WHERE pv4.user_id = ${unipileProfileViews.user_id} 
					AND pv4.viewer_profile_id = ${unipileProfileViews.viewer_profile_id}
					AND pv4.id != ${unipileProfileViews.id}
					AND pv4.is_deleted = false
				)`.as("last_visit"),
			})
			.from(unipileProfileViews)
			.where(
				and(
					eq(unipileProfileViews.user_id, userId),
					eq(unipileProfileViews.is_deleted, false),
				),
			)
			.orderBy(desc(unipileProfileViews.viewed_at))
			.limit(limit)
			.offset(offset);

		const profileViews = await profileViewsQuery;

		// Get total count for pagination
		const totalCountResult = await db
			.select({ count: count() })
			.from(unipileProfileViews)
			.where(
				and(
					eq(unipileProfileViews.user_id, userId),
					eq(unipileProfileViews.is_deleted, false),
				),
			);

		const totalCount = totalCountResult[0]?.count || 0;

		// Process the results to add analytics
		const processedViews = profileViews.map((view) => {
			const isRepeatVisitor = view.visit_count > 1;
			const daysSinceFirst = view.first_visit
				? Math.floor(
						(new Date().getTime() - new Date(view.first_visit).getTime()) /
							(1000 * 60 * 60 * 24),
					)
				: 0;
			const daysSinceLast = view.last_visit
				? Math.floor(
						(new Date(view.viewed_at).getTime() -
							new Date(view.last_visit).getTime()) /
							(1000 * 60 * 60 * 24),
					)
				: null;

			// Determine visit frequency category
			let visitFrequency: "single" | "occasional" | "regular" | "frequent" =
				"single";
			if (view.visit_count > 1) {
				if (view.visit_count >= 10) visitFrequency = "frequent";
				else if (view.visit_count >= 5) visitFrequency = "regular";
				else visitFrequency = "occasional";
			}

			// Determine trend (increasing, stable, decreasing engagement)
			let trend: "new" | "returning" | "engaged" = "new";
			if (isRepeatVisitor) {
				if (daysSinceLast !== null && daysSinceLast <= 7) {
					trend = "engaged"; // Visited again within a week
				} else {
					trend = "returning"; // Returning but not recently
				}
			}

			return {
				...view,
				isRepeatVisitor,
				visitFrequency,
				trend,
				daysSinceFirst,
				daysSinceLast,
			};
		});

		return {
			profileViews: processedViews,
			totalCount,
			hasMore: offset + limit < totalCount,
		};
	}

	/**
	 * Get profile views count for a user
	 */
	async getProfileViewsCount(userId: string): Promise<number> {
		const result = await db
			.select({ count: count() })
			.from(unipileProfileViews)
			.where(
				and(
					eq(unipileProfileViews.user_id, userId),
					eq(unipileProfileViews.is_deleted, false),
				),
			);

		return result[0]?.count || 0;
	}

	/**
	 * Get analytics summary for a user's profile views
	 */
	async getProfileViewsAnalytics(userId: string) {
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		// Get total views
		const totalViewsResult = await db
			.select({ count: count() })
			.from(unipileProfileViews)
			.where(
				and(
					eq(unipileProfileViews.user_id, userId),
					eq(unipileProfileViews.is_deleted, false),
				),
			);

		// Get views in last 30 days
		const last30DaysResult = await db
			.select({ count: count() })
			.from(unipileProfileViews)
			.where(
				and(
					eq(unipileProfileViews.user_id, userId),
					eq(unipileProfileViews.is_deleted, false),
					gte(unipileProfileViews.viewed_at, thirtyDaysAgo),
				),
			);

		// Get views in last 7 days
		const last7DaysResult = await db
			.select({ count: count() })
			.from(unipileProfileViews)
			.where(
				and(
					eq(unipileProfileViews.user_id, userId),
					eq(unipileProfileViews.is_deleted, false),
					gte(unipileProfileViews.viewed_at, sevenDaysAgo),
				),
			);

		// Get unique viewers
		const uniqueViewersResult = await db
			.selectDistinct({
				viewer_profile_id: unipileProfileViews.viewer_profile_id,
			})
			.from(unipileProfileViews)
			.where(
				and(
					eq(unipileProfileViews.user_id, userId),
					eq(unipileProfileViews.is_deleted, false),
				),
			);

		// Get repeat visitors (viewers with more than 1 view)
		const repeatVisitorsResult = await db
			.select({
				viewer_profile_id: unipileProfileViews.viewer_profile_id,
				visit_count: count(),
			})
			.from(unipileProfileViews)
			.where(
				and(
					eq(unipileProfileViews.user_id, userId),
					eq(unipileProfileViews.is_deleted, false),
				),
			)
			.groupBy(unipileProfileViews.viewer_profile_id)
			.having(sql`COUNT(*) > 1`);

		return {
			totalViews: totalViewsResult[0]?.count || 0,
			viewsLast30Days: last30DaysResult[0]?.count || 0,
			viewsLast7Days: last7DaysResult[0]?.count || 0,
			uniqueViewers: uniqueViewersResult.length,
			repeatVisitors: repeatVisitorsResult.length,
			repeatVisitorRate:
				uniqueViewersResult.length > 0
					? (
							(repeatVisitorsResult.length / uniqueViewersResult.length) *
							100
						).toFixed(1)
					: "0",
		};
	}
}
