import {
	bigint,
	boolean,
	index,
	integer,
	json,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import {
	subscriptionPlanEnum,
	subscriptionStatusEnum,
	unipileAttachmentTypeEnum,
	unipileAttendeeTypeEnum,
	unipileMessageTypeEnum,
	unipileProviderEnum,
} from "./enums";
import {
	unipileAccounts,
	unipileChats,
	unipileContacts,
	users,
} from "./tables";

// UnipileChatAttendee table
export const unipileChatAttendees = pgTable(
	"unipile_chat_attendee",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		chat_id: uuid("chat_id")
			.references(() => unipileChats.id)
			.notNull(),
		contact_id: uuid("contact_id").references(() => unipileContacts.id),
		external_id: text("external_id").notNull(),
		is_self: integer("is_self").default(0).notNull(),
		hidden: integer("hidden").default(0).notNull(),
		is_deleted: boolean("is_deleted").default(false).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		chatIdIdx: index("UnipileChatAttendee_chat_id_idx").on(table.chat_id),
		contactIdIdx: index("UnipileChatAttendee_contact_id_idx").on(
			table.contact_id,
		),
		uniqueChatExternal: unique(
			"UnipileChatAttendee_chat_id_external_id_key",
		).on(table.chat_id, table.external_id),
	}),
);

// UnipileMessage table
export const unipileMessages = pgTable(
	"unipile_message",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		unipile_account_id: uuid("unipile_account_id")
			.references(() => unipileAccounts.id)
			.notNull(),
		chat_id: uuid("chat_id").references(() => unipileChats.id),
		external_id: text("external_id").notNull(),
		external_chat_id: text("external_chat_id"),
		sender_id: text("sender_id"),
		recipient_id: text("recipient_id"),
		message_type: text("message_type").default("text").notNull(),
		content: text("content"),
		is_read: boolean("is_read").default(false).notNull(),
		is_outgoing: boolean("is_outgoing").default(false).notNull(),
		sent_at: timestamp("sent_at"),
		sender_urn: text("sender_urn"),
		attendee_type: unipileAttendeeTypeEnum("attendee_type"),
		attendee_distance: integer("attendee_distance"),
		seen: integer("seen").default(0).notNull(),
		hidden: integer("hidden").default(0).notNull(),
		deleted: integer("deleted").default(0).notNull(),
		edited: integer("edited").default(0).notNull(),
		is_event: integer("is_event").default(0).notNull(),
		delivered: integer("delivered").default(0).notNull(),
		behavior: integer("behavior").default(0).notNull(),
		event_type: integer("event_type").default(0).notNull(),
		replies: integer("replies").default(0).notNull(),
		subject: text("subject"),
		parent: text("parent"),
		metadata: json("metadata"),
		is_deleted: boolean("is_deleted").default(false).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		unipileAccountIdIdx: index("UnipileMessage_unipile_account_id_idx").on(
			table.unipile_account_id,
		),
		chatIdIdx: index("UnipileMessage_chat_id_idx").on(table.chat_id),
		sentAtIdx: index("UnipileMessage_sent_at_idx").on(table.sent_at),
		uniqueAccountExternal: unique(
			"UnipileMessage_unipile_account_id_external_id_key",
		).on(table.unipile_account_id, table.external_id),
	}),
);

// UnipileMessageAttachment table
export const unipileMessageAttachments = pgTable(
	"unipile_message_attachment",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		message_id: uuid("message_id")
			.references(() => unipileMessages.id)
			.notNull(),
		external_id: text("external_id").notNull(),
		attachment_type: unipileAttachmentTypeEnum("attachment_type").notNull(),
		url: text("url"),
		filename: text("filename"),
		file_size: integer("file_size"),
		mime_type: text("mime_type"),
		unavailable: boolean("unavailable").default(false).notNull(),
		url_expires_at: bigint("url_expires_at", { mode: "bigint" }),
		width: integer("width"),
		height: integer("height"),
		duration: integer("duration"),
		sticker: boolean("sticker").default(false).notNull(),
		gif: boolean("gif").default(false).notNull(),
		voice_note: boolean("voice_note").default(false).notNull(),
		starts_at: bigint("starts_at", { mode: "bigint" }),
		expires_at: bigint("expires_at", { mode: "bigint" }),
		time_range: integer("time_range"),
		is_deleted: boolean("is_deleted").default(false).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		messageIdIdx: index("UnipileMessageAttachment_message_id_idx").on(
			table.message_id,
		),
		uniqueMessageExternal: unique(
			"UnipileMessageAttachment_message_id_external_id_key",
		).on(table.message_id, table.external_id),
	}),
);

// ChatFolder table
export const chatFolders = pgTable(
	"chat_folder",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		user_id: text("user_id")
			.references(() => users.id)
			.notNull(),
		name: text("name").notNull(),
		color: text("color"),
		sort_order: integer("sort_order").default(0).notNull(),
		is_default: boolean("is_default").default(false).notNull(),
		is_deleted: boolean("is_deleted").default(false).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index("ChatFolder_user_id_idx").on(table.user_id),
		uniqueUserName: unique("ChatFolder_user_id_name_key").on(
			table.user_id,
			table.name,
		),
	}),
);

// ChatFolderAssignment table
export const chatFolderAssignments = pgTable(
	"chat_folder_assignment",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		chat_id: uuid("chat_id")
			.references(() => unipileChats.id)
			.notNull(),
		folder_id: uuid("folder_id")
			.references(() => chatFolders.id)
			.notNull(),
		assigned_by_id: text("assigned_by_id")
			.references(() => users.id)
			.notNull(),
		is_deleted: boolean("is_deleted").default(false).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		chatIdIdx: index("ChatFolderAssignment_chat_id_idx").on(table.chat_id),
		folderIdIdx: index("ChatFolderAssignment_folder_id_idx").on(
			table.folder_id,
		),
		uniqueChatFolder: unique("ChatFolderAssignment_chat_id_folder_id_key").on(
			table.chat_id,
			table.folder_id,
		),
	}),
);

// UnipileProfileView table
export const unipileProfileViews = pgTable(
	"unipile_profile_view",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		user_id: text("user_id").notNull(),
		viewer_profile_id: text("viewer_profile_id"),
		viewer_name: text("viewer_name"),
		viewer_headline: text("viewer_headline"),
		viewer_image_url: text("viewer_image_url"),
		viewed_at: timestamp("viewed_at").notNull(),
		provider: unipileProviderEnum("provider").default("linkedin").notNull(),
		is_deleted: boolean("is_deleted").default(false).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index("UnipileProfileView_user_id_idx").on(table.user_id),
		viewedAtIdx: index("UnipileProfileView_viewed_at_idx").on(table.viewed_at),
	}),
);

// Subscription table
export const subscriptions = pgTable(
	"subscription",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		user_id: text("user_id")
			.references(() => users.id)
			.unique()
			.notNull(),
		stripe_subscription_id: text("stripe_subscription_id").unique(),
		stripe_customer_id: text("stripe_customer_id"),
		plan: subscriptionPlanEnum("plan").default("FREE").notNull(),
		status: subscriptionStatusEnum("status").default("ACTIVE").notNull(),
		current_period_start: timestamp("current_period_start"),
		current_period_end: timestamp("current_period_end"),
		trial_start: timestamp("trial_start"),
		trial_end: timestamp("trial_end"),
		cancel_at_period_end: boolean("cancel_at_period_end")
			.default(false)
			.notNull(),
		canceled_at: timestamp("canceled_at"),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
		is_deleted: boolean("is_deleted").default(false).notNull(),
	},
	(table) => ({
		statusIdx: index("Subscription_status_idx").on(table.status),
		trialEndIdx: index("Subscription_trial_end_idx").on(table.trial_end),
	}),
);

// PaymentMethod table
export const paymentMethods = pgTable(
	"payment_method",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		subscription_id: uuid("subscription_id")
			.references(() => subscriptions.id)
			.notNull(),
		stripe_payment_method_id: text("stripe_payment_method_id")
			.unique()
			.notNull(),
		type: text("type").notNull(),
		card_brand: text("card_brand"),
		card_last4: text("card_last4"),
		card_exp_month: integer("card_exp_month"),
		card_exp_year: integer("card_exp_year"),
		is_default: boolean("is_default").default(false).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
		is_deleted: boolean("is_deleted").default(false).notNull(),
	},
	(table) => ({
		subscriptionIdIdx: index("PaymentMethod_subscription_id_idx").on(
			table.subscription_id,
		),
		stripePaymentMethodIdIdx: index(
			"PaymentMethod_stripe_payment_method_id_idx",
		).on(table.stripe_payment_method_id),
	}),
);
