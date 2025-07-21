import { PrismaClient } from "generated/prisma";

import { env } from "~/env";

import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const createPrismaClient = () =>
	new PrismaClient({
		adapter,
		log:
			env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
	});

const globalForPrisma = globalThis as unknown as {
	prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
