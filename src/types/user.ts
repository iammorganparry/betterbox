import { users, unipileAccounts } from '~/db/schema';

export type User = typeof users.$inferSelect;

export type UserWithUnipileAccounts = User & {
	UnipileAccount: (typeof unipileAccounts.$inferSelect)[];
};

export type UserCreateInput = typeof users.$inferInsert;

export type UserUpdateInput = Partial<UserCreateInput>;
