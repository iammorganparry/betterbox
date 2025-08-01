import { inngest } from "../inngest";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { users, messages, profileViews } from "~/db/schema";

type CreateUserData = typeof users.$inferInsert;
type UpdateUserData = Partial<CreateUserData>;

/**
 * Sync user data when a new user is created in Clerk
 */
export const userCreated = inngest.createFunction(
	{ id: "user-created" },
	{ event: "clerk/user.created" },
	async ({ event, step }) => {
		const { data } = event;

		// Extract user data from Clerk webhook
		const userData = {
			id: data.id,
			email: data.email_addresses[0]?.email_address,
			first_name: data.first_name,
			last_name: data.last_name,
			image_url: data.image_url,
		};

		// Create user in database
		const user = await step.run("create-user-in-db", async () => {
			const result = await db.insert(users).values(userData).returning();
			if (!result[0]) {
				throw new Error("Failed to create user");
			}
			return result[0];
		});

		return { user, message: "User created successfully" };
	},
);

/**
 * Update user data when user is updated in Clerk
 */
export const userUpdated = inngest.createFunction(
	{ id: "user-updated" },
	{ event: "clerk/user.updated" },
	async ({ event, step }) => {
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
	async ({ event, step }) => {
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
