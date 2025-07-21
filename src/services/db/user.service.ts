import { db } from "~/server/db";
import type { Prisma, PrismaClient } from "generated/prisma";
import type { User, UserCreateInput, UserUpdateInput } from "~/types/user";

export class UserService {
	constructor(private readonly db: PrismaClient) {}

	/**
	 * Find user by ID
	 */
	public async findById(id: string): Promise<User | null> {
		return await this.db.user.findUnique({
			where: { id },
		});
	}

	/**
	 * Find user by Clerk ID
	 */
	public async findByClerkId(clerkId: string): Promise<User | null> {
		return await db.user.findUnique({
			where: { clerk_id: clerkId },
		});
	}

	/**
	 * Find user by email
	 */
	public async findByEmail(email: string): Promise<User | null> {
		return await db.user.findUnique({
			where: { email },
		});
	}

	/**
	 * Find user by identifier (email or clerk_id)
	 * Useful for webhook processing where we might get either
	 */
	public async findByIdentifier(identifier: string): Promise<User | null> {
		return await db.user.findFirst({
			where: {
				OR: [{ email: identifier }, { clerk_id: identifier }],
			},
		});
	}

	/**
	 * Create a new user
	 */
	public async create(data: UserCreateInput): Promise<User> {
		return await db.user.create({
			data,
		});
	}

	/**
	 * Update user by ID
	 */
	public async update(id: string, data: UserUpdateInput): Promise<User> {
		return await db.user.update({
			where: { id },
			data: {
				...data,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Update user by Clerk ID
	 */
	public async updateByClerkId(
		clerkId: string,
		data: UserUpdateInput,
	): Promise<User> {
		return await db.user.update({
			where: { clerk_id: clerkId },
			data: {
				...data,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Soft delete user
	 */
	public async softDelete(id: string): Promise<User> {
		return await db.user.update({
			where: { id },
			data: {
				is_deleted: true,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Hard delete user (use with caution)
	 */
	public async hardDelete(id: string): Promise<User> {
		return await db.user.delete({
			where: { id },
		});
	}

	/**
	 * Upsert user by Clerk ID
	 * Useful for Clerk webhook processing
	 */
	public async upsertByClerkId(
		clerkId: string,
		createData: UserCreateInput,
		updateData?: UserUpdateInput,
	): Promise<User> {
		return await db.user.upsert({
			where: { clerk_id: clerkId },
			create: createData,
			update: {
				...updateData,
				updated_at: new Date(),
			},
		});
	}

	/**
	 * Get user with their Unipile accounts
	 */
	public async findWithUnipileAccounts(id: string) {
		return await db.user.findUnique({
			where: { id },
			include: {
				UnipileAccount: {
					where: { is_deleted: false },
				},
			},
		});
	}

	/**
	 * Get user statistics
	 */
	public async getUserStats(id: string) {
		const user = await db.user.findUnique({
			where: { id },
			include: {
				UnipileAccount: {
					where: { is_deleted: false },
					include: {
						UnipileMessage: {
							where: { is_deleted: false },
						},
						UnipileContact: {
							where: { is_deleted: false },
						},
					},
				},
			},
		});

		if (!user) return null;

		const totalAccounts = user.UnipileAccount.length;
		const totalMessages = user.UnipileAccount.reduce(
			(sum, account) => sum + account.UnipileMessage.length,
			0,
		);
		const totalContacts = user.UnipileAccount.reduce(
			(sum, account) => sum + account.UnipileContact.length,
			0,
		);

		return {
			user,
			stats: {
				totalAccounts,
				totalMessages,
				totalContacts,
			},
		};
	}

	/**
	 * Check if user exists by identifier
	 */
	public async exists(identifier: string): Promise<boolean> {
		const user = await this.findByIdentifier(identifier);
		return !!user;
	}

	/**
	 * List users with pagination
	 */
	public async list(
		options: {
			page?: number;
			limit?: number;
			search?: string;
			includeDeleted?: boolean;
		} = {},
	) {
		const { page = 1, limit = 50, search, includeDeleted = false } = options;
		const skip = (page - 1) * limit;

		const whereClause: Prisma.UserWhereInput = {
			...(includeDeleted ? {} : { is_deleted: false }),
			...(search
				? {
						OR: [
							{ email: { contains: search, mode: "insensitive" } },
							{ first_name: { contains: search, mode: "insensitive" } },
							{ last_name: { contains: search, mode: "insensitive" } },
						],
					}
				: {}),
		};

		const [users, total] = await Promise.all([
			db.user.findMany({
				where: whereClause,
				skip,
				take: limit,
				orderBy: { created_at: "desc" },
			}),
			db.user.count({ where: whereClause }),
		]);

		return {
			users,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		};
	}
}
