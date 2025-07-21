import { inngest } from "../inngest";
import { db } from "~/server/db";

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
			clerk_id: data.id,
			email: data.email_addresses[0]?.email_address,
			first_name: data.first_name,
			last_name: data.last_name,
			image_url: data.image_url,
		};

		// Create user in database
		const user = await step.run("create-user-in-db", async () => {
			return await db.user.create({
				data: userData,
			});
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
			return await db.user.update({
				where: { clerk_id: data.id },
				data: {
					...userData,
					updated_at: new Date(),
				},
			});
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
			return await db.user.update({
				where: { clerk_id: data.id },
				data: {
					is_deleted: true,
					updated_at: new Date(),
				},
			});
		});

		// Clean up related data if needed
		await step.run("cleanup-user-data", async () => {
			// Mark user's messages as deleted
			await db.message.updateMany({
				where: { user_id: user.id },
				data: { is_deleted: true },
			});

			// Mark user's profile views as deleted
			await db.profileView.updateMany({
				where: { user_id: user.id },
				data: { is_deleted: true },
			});
		});

		return { user, message: "User deleted successfully" };
	},
);
