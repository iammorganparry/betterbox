import type { Prisma } from "generated/prisma";

export type User = Prisma.UserGetPayload<true>;

export type UserWithUnipileAccounts = Prisma.UserGetPayload<{
	include: {
		UnipileAccount: true;
	};
}>;

export type UserCreateInput = Prisma.UserCreateInput;

export type UserUpdateInput = Prisma.UserUpdateInput;
