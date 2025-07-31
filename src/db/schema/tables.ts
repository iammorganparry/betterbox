import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  bigint,
  json,
  index,
  unique,
  serial
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import {
  unipileAccountTypeEnum,
  unipileAccountStatusEnum,
  unipileChatTypeEnum,
  unipileContentTypeEnum,
  unipileNetworkDistanceEnum,
  unipileMessageTypeEnum,
  unipileAttendeeTypeEnum,
  unipileAttachmentTypeEnum,
  subscriptionPlanEnum,
  subscriptionStatusEnum
} from './enums';

// Post table (legacy)
export const posts = pgTable('Post', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull()
}, (table) => ({
  nameIdx: index('Post_name_idx').on(table.name)
}));

// User table
export const users = pgTable('User', {
  id: text('id').primaryKey(), // Clerk user ID
  email: text('email').unique().notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  imageUrl: text('image_url'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Profile table
export const profiles = pgTable('Profile', {
  id: uuid('id').defaultRandom().primaryKey(),
  linkedinUrn: text('linkedin_urn').unique().notNull(),
  linkedinUrl: text('linkedin_url').notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull()
});

// ProfileView table
export const profileViews = pgTable('ProfileView', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  profileId: text('profile_id').notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Message table (legacy)
export const messages = pgTable('Message', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('Message_user_id_idx').on(table.userId)
}));

// UnipileAccount table
export const unipileAccounts = pgTable('UnipileAccount', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  provider: text('provider').notNull(), // "linkedin", "whatsapp", etc.
  accountId: text('account_id').notNull(), // Unipile account ID
  status: unipileAccountStatusEnum('status').default('connected').notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('UnipileAccount_user_id_idx').on(table.userId),
  uniqueUserProviderAccount: unique('UnipileAccount_user_id_provider_account_id_key')
    .on(table.userId, table.provider, table.accountId)
}));

// UnipileChat table
export const unipileChats = pgTable('UnipileChat', {
  id: uuid('id').defaultRandom().primaryKey(),
  unipileAccountId: uuid('unipile_account_id').references(() => unipileAccounts.id).notNull(),
  externalId: text('external_id').notNull(), // Chat ID from provider
  provider: text('provider').default('linkedin').notNull(),
  accountType: unipileAccountTypeEnum('account_type'),
  chatType: unipileChatTypeEnum('chat_type').default('direct').notNull(),
  name: text('name'), // Chat name (for group chats)
  lastMessageAt: timestamp('last_message_at'),
  unreadCount: integer('unread_count').default(0).notNull(),
  archived: integer('archived').default(0).notNull(),
  readOnly: integer('read_only').default(0).notNull(),
  mutedUntil: bigint('muted_until', { mode: 'bigint' }),
  organizationId: text('organization_id'),
  mailboxId: text('mailbox_id'),
  mailboxName: text('mailbox_name'),
  contentType: unipileContentTypeEnum('content_type'),
  disabledFeatures: json('disabled_features'),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  unipileAccountIdIdx: index('UnipileChat_unipile_account_id_idx').on(table.unipileAccountId),
  lastMessageAtIdx: index('UnipileChat_last_message_at_idx').on(table.lastMessageAt),
  uniqueAccountExternal: unique('UnipileChat_unipile_account_id_external_id_key')
    .on(table.unipileAccountId, table.externalId)
}));

// UnipileContact table
export const unipileContacts = pgTable('UnipileContact', {
  id: uuid('id').defaultRandom().primaryKey(),
  unipileAccountId: uuid('unipile_account_id').references(() => unipileAccounts.id).notNull(),
  externalId: text('external_id').notNull(),
  providerUrl: text('provider_url'),
  fullName: text('full_name'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  headline: text('headline'),
  profileImageUrl: text('profile_image_url'),
  lastInteraction: timestamp('last_interaction'),
  isConnection: boolean('is_connection').default(false).notNull(),
  memberUrn: text('member_urn'),
  networkDistance: unipileNetworkDistanceEnum('network_distance'),
  occupation: text('occupation'),
  location: text('location'),
  pendingInvitation: boolean('pending_invitation').default(false).notNull(),
  contactInfo: json('contact_info'),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  unipileAccountIdIdx: index('UnipileContact_unipile_account_id_idx').on(table.unipileAccountId),
  uniqueAccountExternal: unique('UnipileContact_unipile_account_id_external_id_key')
    .on(table.unipileAccountId, table.externalId)
}));

// Continue in next file due to length...