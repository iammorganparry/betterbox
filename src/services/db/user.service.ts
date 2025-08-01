import { eq } from "drizzle-orm";
import type { Database } from "~/db";
import { users } from "~/db/schema";

export type User = typeof users.$inferSelect;
export type CreateUserData = typeof users.$inferInsert;
export type UpdateUserData = Partial<CreateUserData>;

export class UserService {
	constructor(private readonly db: Database) {}

	async findById(id: string): Promise<User | null> {
		const result = await this.db
			.select()
			.from(users)
			.where(eq(users.id, id))
			.limit(1);
		return result[0] || null;
	}

	async findByClerkId(clerkId: string): Promise<User | null> {
		const result = await this.db
			.select()
			.from(users)
			.where(eq(users.id, clerkId))
			.limit(1);
		return result[0] || null;
	}

	async findByEmail(email: string): Promise<User | null> {
		const result = await this.db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);
		return result[0] || null;
	}

	async create(data: CreateUserData): Promise<User> {
		const result = await this.db.insert(users).values(data).returning();
		if (!result[0]) {
			throw new Error("Failed to create user");
		}
		return result[0];
	}

	async update(id: string, data: UpdateUserData): Promise<User> {
		const result = await this.db
			.update(users)
			.set(data)
			.where(eq(users.id, id))
			.returning();
		if (!result[0]) {
			throw new Error("Failed to update user");
		}
		return result[0];
	}

	async delete(id: string): Promise<User> {
		const result = await this.db
			.delete(users)
			.where(eq(users.id, id))
			.returning();
		if (!result[0]) {
			throw new Error("Failed to delete user");
		}
		return result[0];
	}
}
