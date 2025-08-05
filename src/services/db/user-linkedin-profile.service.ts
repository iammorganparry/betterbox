import { eq } from "drizzle-orm";
import { db } from "~/db";
import { unipileAccounts } from "~/db/schema/tables";
import type { UnipileApiUserProfile } from "~/types/unipile-api";

export class UserLinkedInProfileService {
	/**
	 * Update the user's LinkedIn profile information in the database
	 */
	async updateUserLinkedInProfile(
		unipileAccountId: string,
		profileData: UnipileApiUserProfile,
	): Promise<void> {
		const fullName = [profileData.first_name, profileData.last_name]
			.filter(Boolean)
			.join(" ");

		await db
			.update(unipileAccounts)
			.set({
				linkedin_profile_name: fullName || null,
				linkedin_profile_picture_url:
					profileData.profile_picture_url_large ||
					profileData.profile_picture_url ||
					null,
				linkedin_profile_synced_at: new Date(),
				updated_at: new Date(),
			})
			.where(eq(unipileAccounts.id, unipileAccountId));
	}

	/**
	 * Get the user's LinkedIn profile information from the database
	 */
	async getUserLinkedInProfile(unipileAccountId: string) {
		const account = await db
			.select({
				linkedin_profile_name: unipileAccounts.linkedin_profile_name,
				linkedin_profile_picture_url:
					unipileAccounts.linkedin_profile_picture_url,
				linkedin_profile_synced_at: unipileAccounts.linkedin_profile_synced_at,
			})
			.from(unipileAccounts)
			.where(eq(unipileAccounts.id, unipileAccountId))
			.limit(1);

		return account[0] || null;
	}

	/**
	 * Check if the user's LinkedIn profile needs to be synced
	 * (if it hasn't been synced in the last 24 hours)
	 */
	needsProfileSync(lastSyncedAt: Date | null): boolean {
		if (!lastSyncedAt) return true;

		const twentyFourHoursAgo = new Date();
		twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

		return lastSyncedAt < twentyFourHoursAgo;
	}
}
