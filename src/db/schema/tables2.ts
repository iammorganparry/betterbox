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
  unique
} from 'drizzle-orm/pg-core';
import {
  unipileMessageTypeEnum,
  unipileAttendeeTypeEnum,
  unipileAttachmentTypeEnum,
  subscriptionPlanEnum,
  subscriptionStatusEnum
} from './enums';
import { unipileAccounts, unipileChats, unipileContacts, users } from './tables';

// UnipileChatAttendee table
export const unipileChatAttendees = pgTable('UnipileChatAttendee', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatId: uuid('chat_id').references(() => unipileChats.id).notNull(),
  contactId: uuid('contact_id').references(() => unipileContacts.id),
  externalId: text('external_id').notNull(),
  isSelf: integer('is_self').default(0).notNull(),
  hidden: integer('hidden').default(0).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  chatIdIdx: index('UnipileChatAttendee_chat_id_idx').on(table.chatId),
  contactIdIdx: index('UnipileChatAttendee_contact_id_idx').on(table.contactId),
  uniqueChatExternal: unique('UnipileChatAttendee_chat_id_external_id_key')
    .on(table.chatId, table.externalId)
}));

// UnipileMessage table
export const unipileMessages = pgTable('UnipileMessage', {
  id: uuid('id').defaultRandom().primaryKey(),
  unipileAccountId: uuid('unipile_account_id').references(() => unipileAccounts.id).notNull(),
  chatId: uuid('chat_id').references(() => unipileChats.id),
  externalId: text('external_id').notNull(),
  externalChatId: text('external_chat_id'),
  senderId: text('sender_id'),
  recipientId: text('recipient_id'),
  messageType: text('message_type').default('text').notNull(),
  content: text('content'),
  isRead: boolean('is_read').default(false).notNull(),
  isOutgoing: boolean('is_outgoing').default(false).notNull(),
  sentAt: timestamp('sent_at'),
  senderUrn: text('sender_urn'),
  attendeeType: unipileAttendeeTypeEnum('attendee_type'),
  attendeeDistance: integer('attendee_distance'),
  seen: integer('seen').default(0).notNull(),
  hidden: integer('hidden').default(0).notNull(),
  deleted: integer('deleted').default(0).notNull(),
  edited: integer('edited').default(0).notNull(),
  isEvent: integer('is_event').default(0).notNull(),
  delivered: integer('delivered').default(0).notNull(),
  behavior: integer('behavior').default(0).notNull(),
  eventType: integer('event_type').default(0).notNull(),
  replies: integer('replies').default(0).notNull(),
  subject: text('subject'),
  parent: text('parent'),
  metadata: json('metadata'),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  unipileAccountIdIdx: index('UnipileMessage_unipile_account_id_idx').on(table.unipileAccountId),
  chatIdIdx: index('UnipileMessage_chat_id_idx').on(table.chatId),
  sentAtIdx: index('UnipileMessage_sent_at_idx').on(table.sentAt),
  uniqueAccountExternal: unique('UnipileMessage_unipile_account_id_external_id_key')
    .on(table.unipileAccountId, table.externalId)
}));

// UnipileMessageAttachment table
export const unipileMessageAttachments = pgTable('UnipileMessageAttachment', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: uuid('message_id').references(() => unipileMessages.id).notNull(),
  externalId: text('external_id').notNull(),
  attachmentType: unipileAttachmentTypeEnum('attachment_type').notNull(),
  url: text('url'),
  filename: text('filename'),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  unavailable: boolean('unavailable').default(false).notNull(),
  urlExpiresAt: bigint('url_expires_at', { mode: 'bigint' }),
  width: integer('width'),
  height: integer('height'),
  duration: integer('duration'),
  sticker: boolean('sticker').default(false).notNull(),
  gif: boolean('gif').default(false).notNull(),
  voiceNote: boolean('voice_note').default(false).notNull(),
  startsAt: bigint('starts_at', { mode: 'bigint' }),
  expiresAt: bigint('expires_at', { mode: 'bigint' }),
  timeRange: integer('time_range'),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  messageIdIdx: index('UnipileMessageAttachment_message_id_idx').on(table.messageId),
  uniqueMessageExternal: unique('UnipileMessageAttachment_message_id_external_id_key')
    .on(table.messageId, table.externalId)
}));

// ChatFolder table
export const chatFolders = pgTable('ChatFolder', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  color: text('color'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('ChatFolder_user_id_idx').on(table.userId),
  uniqueUserName: unique('ChatFolder_user_id_name_key').on(table.userId, table.name)
}));

// ChatFolderAssignment table
export const chatFolderAssignments = pgTable('ChatFolderAssignment', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatId: uuid('chat_id').references(() => unipileChats.id).notNull(),
  folderId: uuid('folder_id').references(() => chatFolders.id).notNull(),
  assignedById: text('assigned_by_id').references(() => users.id).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  chatIdIdx: index('ChatFolderAssignment_chat_id_idx').on(table.chatId),
  folderIdIdx: index('ChatFolderAssignment_folder_id_idx').on(table.folderId),
  uniqueChatFolder: unique('ChatFolderAssignment_chat_id_folder_id_key')
    .on(table.chatId, table.folderId)
}));

// UnipileProfileView table
export const unipileProfileViews = pgTable('UnipileProfileView', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  viewerProfileId: text('viewer_profile_id'),
  viewerName: text('viewer_name'),
  viewerHeadline: text('viewer_headline'),
  viewerImageUrl: text('viewer_image_url'),
  viewedAt: timestamp('viewed_at').notNull(),
  provider: text('provider').default('linkedin').notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('UnipileProfileView_user_id_idx').on(table.userId),
  viewedAtIdx: index('UnipileProfileView_viewed_at_idx').on(table.viewedAt)
}));

// Subscription table
export const subscriptions = pgTable('Subscription', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id).unique().notNull(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeCustomerId: text('stripe_customer_id'),
  plan: subscriptionPlanEnum('plan').default('FREE').notNull(),
  status: subscriptionStatusEnum('status').default('ACTIVE').notNull(),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  canceledAt: timestamp('canceled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull()
}, (table) => ({
  statusIdx: index('Subscription_status_idx').on(table.status),
  trialEndIdx: index('Subscription_trial_end_idx').on(table.trialEnd)
}));

// PaymentMethod table
export const paymentMethods = pgTable('PaymentMethod', {
  id: uuid('id').defaultRandom().primaryKey(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id).notNull(),
  stripePaymentMethodId: text('stripe_payment_method_id').unique().notNull(),
  type: text('type').notNull(),
  cardBrand: text('card_brand'),
  cardLast4: text('card_last4'),
  cardExpMonth: integer('card_exp_month'),
  cardExpYear: integer('card_exp_year'),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull()
}, (table) => ({
  subscriptionIdIdx: index('PaymentMethod_subscription_id_idx').on(table.subscriptionId),
  stripePaymentMethodIdIdx: index('PaymentMethod_stripe_payment_method_id_idx')
    .on(table.stripePaymentMethodId)
}));