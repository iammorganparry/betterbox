import type { Prisma, PrismaClient } from "../../../generated/prisma";
import type { User } from "../../../generated/prisma";

export class UserService {
	constructor(private readonly db: PrismaClient) {}

	async findById(id: string): Promise<User | null> {
		return await this.db.user.findUnique({
			where: { id },
		});
	}

	async findByClerkId(clerkId: string): Promise<User | null> {
		return await this.db.user.findUnique({
			where: { id: clerkId },
		});
	}

	async findByEmail(email: string): Promise<User | null> {
		return await this.db.user.findUnique({
			where: { email },
		});
	}

	async create(data: Prisma.UserCreateInput): Promise<User> {
		return await this.db.user.create({ data });
	}

	async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
		return await this.db.user.update({
			where: { id },
			data,
		});
	}

	async delete(id: string): Promise<User> {
		return await this.db.user.delete({
			where: { id },
		});
	}
}
