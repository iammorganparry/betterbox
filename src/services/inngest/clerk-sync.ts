import { eq } from "drizzle-orm";
import { messages, profileViews, users } from "~/db/schema";
import { inngest } from "../inngest";

type CreateUserData = typeof users.$inferInsert;
type UpdateUserData = Partial<CreateUserData>;

/**
 * Sync user data when a new user is created in Clerk
 */
export const userCreated = inngest.createFunction(
	{ id: "user-created" },
	{ event: "clerk/user.created" },
	async ({ event, step, services }) => {
		const { data } = event;
		const db = services.db;

		// Extract user data from Clerk webhook
		const userData = {
			id: data.id,
			email: data.email_addresses[0]?.email_address || "",
			first_name: data.first_name,
			last_name: data.last_name,
			image_url: data.image_url,
			// All new users require onboarding completion
			onboarding_required: true,
			onboarding_completed_at: null,
		};

		// Create user in database
		const user = await step.run("create-user-in-db", async () => {
			const result = await db.insert(users).values(userData).returning();
			if (!result[0]) {
				throw new Error("Failed to create user");
			}
			return result[0];
		});

		// Set Clerk metadata to enforce onboarding
		await step.run("set-clerk-onboarding-metadata", async () => {
			try {
				// Note: This would require Clerk Admin API integration
				// For now, we'll rely on database flags and middleware
				console.log(`User ${user.id} created with onboarding requirement`);
				return { success: true };
			} catch (error) {
				console.error("Failed to set Clerk metadata:", error);
				// Don't fail the entire function if metadata update fails
				return { success: false, error };
			}
		});

		return {
			user,
			message: "User created successfully with onboarding requirement",
			onboardingRequired: true,
		};
	},
);

/**
 * Update user data when user is updated in Clerk
 */
export const userUpdated = inngest.createFunction(
	{ id: "user-updated" },
	{ event: "clerk/user.updated" },
	async ({ event, step, services }) => {
		const db = services.db;
		const { data } = event;

		const userData = {
			email: data.email_addresses[0]?.email_address,
			first_name: data.first_name,
			last_name: data.last_name,
			image_url: data.image_url,
		};

		// Update user in database
		const user = await step.run("update-user-in-db", async () => {
			const result = await db
				.update(users)
				.set({
					...userData,
					updated_at: new Date(),
				})
				.where(eq(users.id, data.id))
				.returning();

			if (!result[0]) {
				throw new Error(`User not found: ${data.id}`);
			}
			return result[0];
		});

		return { user, message: "User updated successfully" };
	},
);

/**
 * Handle user deletion by marking as deleted (soft delete)
 */
export const userDeleted = inngest.createFunction(
	{ id: "user-deleted" },
	{ event: "clerk/user.deleted" },
	async ({ event, step, services }) => {
		const db = services.db;
		const { data } = event;

		// Soft delete user
		const user = await step.run("soft-delete-user", async () => {
			const result = await db
				.update(users)
				.set({
					is_deleted: true,
					updated_at: new Date(),
				})
				.where(eq(users.id, data.id))
				.returning();

			if (!result[0]) {
				throw new Error(`User not found: ${data.id}`);
			}
			return result[0];
		});

		// Clean up related data if needed
		await step.run("cleanup-user-data", async () => {
			// Mark user's messages as deleted
			await db
				.update(messages)
				.set({
					is_deleted: true,
					updated_at: new Date(),
				})
				.where(eq(messages.user_id, user.id));

			// Mark user's profile views as deleted
			await db
				.update(profileViews)
				.set({
					is_deleted: true,
					updated_at: new Date(),
				})
				.where(eq(profileViews.user_id, user.id));
		});

		return { user, message: "User deleted successfully" };
	},
);
