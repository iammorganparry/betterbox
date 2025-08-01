import { db } from "~/db";

async function main() {
	console.log("🌱 Starting database seeding...");

	// Create the user
	const user = await db.user.upsert({
		where: { id: "user_30Ah4rGa8g3GnLpXGLnHXyuzVew" },
		update: {
			email: "morgan@trigify.io",
			first_name: "Morgan",
			last_name: "Parry",
		},
		create: {
			id: "user_30Ah4rGa8g3GnLpXGLnHXyuzVew",
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
		await db.$disconnect();
	})
	.catch(async (e) => {
		console.error("❌ Error during seeding:", e);
		await db.$disconnect();
		process.exit(1);
	});
