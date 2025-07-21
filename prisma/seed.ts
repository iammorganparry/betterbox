import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
	console.log("🌱 Starting database seeding...");

	// Create the user
	const user = await prisma.user.upsert({
		where: { clerk_id: "user_30Ah4rGa8g3GnLpXGLnHXyuzVew" },
		update: {
			email: "morgan@trigify.io",
			first_name: "Morgan",
			last_name: "Parry",
		},
		create: {
			clerk_id: "user_30Ah4rGa8g3GnLpXGLnHXyuzVew",
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
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error("❌ Error during seeding:", e);
		await prisma.$disconnect();
		process.exit(1);
	});
