import { relations } from "drizzle-orm";
import {
	messages,
	posts,
	profileViews,
	profiles,
	unipileAccounts,
	unipileChats,
	unipileContacts,
	users,
} from "./tables";
import {
	chatFolderAssignments,
	chatFolders,
	paymentMethods,
	subscriptions,
	unipileChatAttendees,
	unipileMessageAttachments,
	unipileMessages,
	unipileProfileViews,
} from "./tables2";

// User relations
export const usersRelations = relations(users, ({ many, one }) => ({
	messages: many(messages),
	profileViews: many(profileViews),
	unipileAccounts: many(unipileAccounts),
	subscription: one(subscriptions),
	chatFolders: many(chatFolders),
	chatFolderAssignments: many(chatFolderAssignments),
}));

// Message relations
export const messagesRelations = relations(messages, ({ one }) => ({
	user: one(users, {
		fields: [messages.user_id],
		references: [users.id],
	}),
}));

// ProfileView relations
export const profileViewsRelations = relations(profileViews, ({ one }) => ({
	user: one(users, {
		fields: [profileViews.user_id],
		references: [users.id],
	}),
}));

// UnipileAccount relations
export const unipileAccountsRelations = relations(
	unipileAccounts,
	({ one, many }) => ({
		user: one(users, {
			fields: [unipileAccounts.user_id],
			references: [users.id],
		}),
		unipileMessages: many(unipileMessages),
		unipileContacts: many(unipileContacts),
		unipileChats: many(unipileChats),
	}),
);

// UnipileChat relations
export const unipileChatsRelations = relations(
	unipileChats,
	({ one, many }) => ({
		unipileAccount: one(unipileAccounts, {
			fields: [unipileChats.unipile_account_id],
			references: [unipileAccounts.id],
		}),
		unipileMessages: many(unipileMessages),
		unipileChatAttendees: many(unipileChatAttendees),
		chatFolderAssignments: many(chatFolderAssignments),
	}),
);

// UnipileChatAttendee relations
export const unipileChatAttendeesRelations = relations(
	unipileChatAttendees,
	({ one }) => ({
		chat: one(unipileChats, {
			fields: [unipileChatAttendees.chat_id],
			references: [unipileChats.id],
		}),
		contact: one(unipileContacts, {
			fields: [unipileChatAttendees.contact_id],
			references: [unipileContacts.id],
		}),
	}),
);

// UnipileMessage relations
export const unipileMessagesRelations = relations(
	unipileMessages,
	({ one, many }) => ({
		unipileAccount: one(unipileAccounts, {
			fields: [unipileMessages.unipile_account_id],
			references: [unipileAccounts.id],
		}),
		chat: one(unipileChats, {
			fields: [unipileMessages.chat_id],
			references: [unipileChats.id],
		}),
		unipileMessageAttachments: many(unipileMessageAttachments),
	}),
);

// UnipileMessageAttachment relations
export const unipileMessageAttachmentsRelations = relations(
	unipileMessageAttachments,
	({ one }) => ({
		message: one(unipileMessages, {
			fields: [unipileMessageAttachments.message_id],
			references: [unipileMessages.id],
		}),
	}),
);

// UnipileContact relations
export const unipileContactsRelations = relations(
	unipileContacts,
	({ one, many }) => ({
		unipileAccount: one(unipileAccounts, {
			fields: [unipileContacts.unipile_account_id],
			references: [unipileAccounts.id],
		}),
		unipileChatAttendees: many(unipileChatAttendees),
	}),
);

// ChatFolder relations
export const chatFoldersRelations = relations(chatFolders, ({ one, many }) => ({
	user: one(users, {
		fields: [chatFolders.user_id],
		references: [users.id],
	}),
	chatFolderAssignments: many(chatFolderAssignments),
}));

// ChatFolderAssignment relations
export const chatFolderAssignmentsRelations = relations(
	chatFolderAssignments,
	({ one }) => ({
		chat: one(unipileChats, {
			fields: [chatFolderAssignments.chat_id],
			references: [unipileChats.id],
		}),
		folder: one(chatFolders, {
			fields: [chatFolderAssignments.folder_id],
			references: [chatFolders.id],
		}),
		assignedBy: one(users, {
			fields: [chatFolderAssignments.assigned_by_id],
			references: [users.id],
		}),
	}),
);

// Subscription relations
export const subscriptionsRelations = relations(
	subscriptions,
	({ one, many }) => ({
		user: one(users, {
			fields: [subscriptions.user_id],
			references: [users.id],
		}),
		paymentMethods: many(paymentMethods),
	}),
);

// PaymentMethod relations
export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
	subscription: one(subscriptions, {
		fields: [paymentMethods.subscription_id],
		references: [subscriptions.id],
	}),
}));
