import { db } from "~/db";
import { users } from "./schema";

async function main() {
	console.log("🌱 Starting database seeding...");

	// Create the user
	const user = await db
		.insert(users)
		.values({
			id: "user_30elKhSkkHBlgx6B5jROzXiHtXT",
			email: "morgan@trigify.io",
			first_name: "Morgan",
			last_name: "Parry",
		})
		.onConflictDoUpdate({
			target: [users.id],
			set: {
				email: "morgan@trigify.io",
				first_name: "Morgan",
				last_name: "Parry",
			},
		});

	console.log("✅ User created/updated:", user);
	console.log("🌱 Database seeding completed!");
}

main()
	.then(async () => {
		await db.$client.end();
	})
	.catch(async (e) => {
		console.error("❌ Error during seeding:", e);
		await db.$client.end();
		process.exit(1);
	});
