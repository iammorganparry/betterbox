import type { Prisma } from "generated/prisma";

export type UnipileAccount = Prisma.UnipileAccountGetPayload<true>;

export type UnipileAccountWithUser = Prisma.UnipileAccountGetPayload<{
	include: {
		user: true;
	};
}>;

export type UnipileAccountCreateInput = Prisma.UnipileAccountCreateInput;

export type UnipileAccountUpdateInput = Prisma.UnipileAccountUpdateInput;

export type UnipileProvider =
	| "linkedin"
	| "whatsapp"
	| "telegram"
	| "instagram"
	| "messenger"
	| "twitter";
export type UnipileAccountStatus =
	| "connected"
	| "disconnected"
	| "error"
	| "pending";
