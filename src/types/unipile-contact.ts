import type { unipileContacts } from "~/db/schema";
import type { UnipileAccount } from "./unipile-account";

export type UnipileContact = typeof unipileContacts.$inferSelect;

export type UnipileContactWithAccount = UnipileContact & {
	unipile_account: UnipileAccount;
};

export type UnipileContactCreateInput = UnipileContact;

export type UnipileContactUpdateInput = UnipileContact;
