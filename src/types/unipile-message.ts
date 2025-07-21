import type { Prisma } from "generated/prisma";
import type { UnipileAccount } from "./unipile-account";

export type UnipileMessage = Prisma.UnipileMessageGetPayload<true>;

export type UnipileMessageWithAccount = Prisma.UnipileMessageGetPayload<{
	include: {
		unipile_account: true;
	};
}>;

export type UnipileMessageCreateInput = Prisma.UnipileMessageCreateInput;

export type UnipileMessageUpdateInput = Prisma.UnipileMessageUpdateInput;

export type UnipileMessageType =
	| "text"
	| "file"
	| "image"
	| "video"
	| "audio"
	| "system"
	| "link";
