import type {
	unipileAccountStatusEnum,
	unipileAccounts,
	users,
} from "~/db/schema";

export type UnipileAccount = typeof unipileAccounts.$inferSelect;

export type UnipileAccountWithUser = UnipileAccount & {
	user: typeof users.$inferSelect;
};

export type UnipileAccountCreateInput = typeof unipileAccounts.$inferInsert;

export type UnipileAccountUpdateInput = Partial<UnipileAccountCreateInput>;

export type UnipileProvider =
	| "linkedin"
	| "whatsapp"
	| "telegram"
	| "instagram"
	| "messenger"
	| "twitter";

export type UnipileAccountStatus =
	(typeof unipileAccountStatusEnum.enumValues)[number];
