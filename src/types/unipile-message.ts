import type {
	unipileMessages,
	unipileAccounts,
} from "~/db/schema";

export type UnipileMessage = typeof unipileMessages.$inferSelect;

export type UnipileMessageWithAccount = UnipileMessage & {
	unipile_account: typeof unipileAccounts.$inferSelect;
};

export type UnipileMessageCreateInput = typeof unipileMessages.$inferInsert;

export type UnipileMessageUpdateInput = Partial<UnipileMessageCreateInput>;

export type UnipileMessageType =
	| "text"
	| "file"
	| "image"
	| "video"
	| "audio"
	| "system"
	| "link";
