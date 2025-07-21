import type { Prisma } from "generated/prisma";
import type { UnipileAccount } from "./unipile-account";

export type UnipileContact = Prisma.UnipileContactGetPayload<true>;

export type UnipileContactWithAccount = Prisma.UnipileContactGetPayload<{
	include: {
		unipile_account: true;
	};
}>;

export type UnipileContactCreateInput = Prisma.UnipileContactCreateInput;

export type UnipileContactUpdateInput = Prisma.UnipileContactUpdateInput;
