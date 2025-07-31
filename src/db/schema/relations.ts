import { relations } from 'drizzle-orm';
import {
  users,
  posts,
  profiles,
  profileViews,
  messages,
  unipileAccounts,
  unipileChats,
  unipileContacts,
  chatFolders,
  chatFolderAssignments,
  unipileProfileViews,
  subscriptions,
  paymentMethods
} from './tables';
import {
  unipileChatAttendees,
  unipileMessages,
  unipileMessageAttachments
} from './tables2';

// User relations
export const usersRelations = relations(users, ({ many, one }) => ({
  messages: many(messages),
  profileViews: many(profileViews),
  unipileAccounts: many(unipileAccounts),
  subscription: one(subscriptions),
  chatFolders: many(chatFolders),
  chatFolderAssignments: many(chatFolderAssignments)
}));

// Message relations
export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id]
  })
}));

// ProfileView relations
export const profileViewsRelations = relations(profileViews, ({ one }) => ({
  user: one(users, {
    fields: [profileViews.userId],
    references: [users.id]
  })
}));

// UnipileAccount relations
export const unipileAccountsRelations = relations(unipileAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [unipileAccounts.userId],
    references: [users.id]
  }),
  unipileMessages: many(unipileMessages),
  unipileContacts: many(unipileContacts),
  unipileChats: many(unipileChats)
}));

// UnipileChat relations
export const unipileChatsRelations = relations(unipileChats, ({ one, many }) => ({
  unipileAccount: one(unipileAccounts, {
    fields: [unipileChats.unipileAccountId],
    references: [unipileAccounts.id]
  }),
  unipileMessages: many(unipileMessages),
  unipileChatAttendees: many(unipileChatAttendees),
  chatFolderAssignments: many(chatFolderAssignments)
}));

// UnipileChatAttendee relations
export const unipileChatAttendeesRelations = relations(unipileChatAttendees, ({ one }) => ({
  chat: one(unipileChats, {
    fields: [unipileChatAttendees.chatId],
    references: [unipileChats.id]
  }),
  contact: one(unipileContacts, {
    fields: [unipileChatAttendees.contactId],
    references: [unipileContacts.id]
  })
}));

// UnipileMessage relations
export const unipileMessagesRelations = relations(unipileMessages, ({ one, many }) => ({
  unipileAccount: one(unipileAccounts, {
    fields: [unipileMessages.unipileAccountId],
    references: [unipileAccounts.id]
  }),
  chat: one(unipileChats, {
    fields: [unipileMessages.chatId],
    references: [unipileChats.id]
  }),
  unipileMessageAttachments: many(unipileMessageAttachments)
}));

// UnipileMessageAttachment relations
export const unipileMessageAttachmentsRelations = relations(unipileMessageAttachments, ({ one }) => ({
  message: one(unipileMessages, {
    fields: [unipileMessageAttachments.messageId],
    references: [unipileMessages.id]
  })
}));

// UnipileContact relations
export const unipileContactsRelations = relations(unipileContacts, ({ one, many }) => ({
  unipileAccount: one(unipileAccounts, {
    fields: [unipileContacts.unipileAccountId],
    references: [unipileAccounts.id]
  }),
  unipileChatAttendees: many(unipileChatAttendees)
}));

// ChatFolder relations
export const chatFoldersRelations = relations(chatFolders, ({ one, many }) => ({
  user: one(users, {
    fields: [chatFolders.userId],
    references: [users.id]
  }),
  chatFolderAssignments: many(chatFolderAssignments)
}));

// ChatFolderAssignment relations
export const chatFolderAssignmentsRelations = relations(chatFolderAssignments, ({ one }) => ({
  chat: one(unipileChats, {
    fields: [chatFolderAssignments.chatId],
    references: [unipileChats.id]
  }),
  folder: one(chatFolders, {
    fields: [chatFolderAssignments.folderId],
    references: [chatFolders.id]
  }),
  assignedBy: one(users, {
    fields: [chatFolderAssignments.assignedById],
    references: [users.id]
  })
}));

// Subscription relations
export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id]
  }),
  paymentMethods: many(paymentMethods)
}));

// PaymentMethod relations
export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [paymentMethods.subscriptionId],
    references: [subscriptions.id]
  })
}));