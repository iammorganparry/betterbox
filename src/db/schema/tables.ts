import { relations } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	integer,
	json,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import {
	subscriptionPlanEnum,
	subscriptionStatusEnum,
	unipileAccountStatusEnum,
	unipileAccountTypeEnum,
	unipileAttachmentTypeEnum,
	unipileAttendeeTypeEnum,
	unipileChatTypeEnum,
	unipileContentTypeEnum,
	unipileMessageTypeEnum,
	unipileNetworkDistanceEnum,
	unipileProviderEnum,
} from "./enums";

// Post table (legacy)
export const posts = pgTable(
	"post",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		created_at: timestamp("createdAt").defaultNow().notNull(),
		updated_at: timestamp("updatedAt").defaultNow().notNull(),
	},
	(table) => ({
		nameIdx: index("post_name_idx").on(table.name),
	}),
);

// User table
export const users = pgTable("user", {
	id: text("id").primaryKey(), // Clerk user ID
	email: text("email").unique().notNull(),
	first_name: text("first_name"),
	last_name: text("last_name"),
	image_url: text("image_url"),
	stripe_customer_id: text("stripe_customer_id").unique(),
	// Onboarding enforcement fields
	onboarding_required: boolean("onboarding_required").default(true).notNull(),
	onboarding_completed_at: timestamp("onboarding_completed_at"),
	payment_method_added: boolean("payment_method_added")
		.default(false)
		.notNull(),
	is_deleted: boolean("is_deleted").default(false).notNull(),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Profile table
export const profiles = pgTable("profile", {
	id: uuid("id").defaultRandom().primaryKey(),
	linkedin_urn: text("linkedin_urn").unique().notNull(),
	linkedin_url: text("linkedin_url").notNull(),
	is_deleted: boolean("is_deleted").default(false).notNull(),
});

// ProfileView table
export const profileViews = pgTable("profile_view", {
	id: uuid("id").defaultRandom().primaryKey(),
	user_id: text("user_id")
		.references(() => users.id)
		.notNull(),
	profile_id: text("profile_id").notNull(),
	is_deleted: boolean("is_deleted").default(false).notNull(),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Message table (legacy)
export const messages = pgTable(
	"message",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		user_id: text("user_id")
			.references(() => users.id)
			.notNull(),
		message: text("message").notNull(),
		is_read: boolean("is_read").default(false).notNull(),
		is_deleted: boolean("is_deleted").default(false).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index("Message_user_id_idx").on(table.user_id),
	}),
);

// UnipileAccount table
export const unipileAccounts = pgTable(
	"unipile_account",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		user_id: text("user_id")
			.references(() => users.id)
			.notNull(),
		provider: unipileProviderEnum("provider").notNull(), // "linkedin", "whatsapp", etc.
		account_id: text("account_id").notNull(), // Unipile account ID
		status: unipileAccountStatusEnum("status").default("connected").notNull(),
		is_deleted: boolean("is_deleted").default(false).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index("UnipileAccount_user_id_idx").on(table.user_id),
		uniqueUserProviderAccount: unique(
			"UnipileAccount_user_id_provider_account_id_key",
		).on(table.user_id, table.provider, table.account_id),
	}),
);

// UnipileChat table
export const unipileChats = pgTable(
	"unipile_chat",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		unipile_account_id: uuid("unipile_account_id")
			.references(() => unipileAccounts.id)
			.notNull(),
		external_id: text("external_id").notNull(), // Chat ID from provider
		provider: unipileProviderEnum("provider").default("linkedin").notNull(),
		account_type: unipileAccountTypeEnum("account_type"),
		chat_type: unipileChatTypeEnum("chat_type").default("direct").notNull(),
		name: text("name"), // Chat name (for group chats)
		last_message_at: timestamp("last_message_at"),
		unread_count: integer("unread_count").default(0).notNull(),
		archived: integer("archived").default(0).notNull(),
		read_only: integer("read_only").default(0).notNull(),
		muted_until: bigint("muted_until", { mode: "bigint" }),
		organization_id: text("organization_id"),
		mailbox_id: text("mailbox_id"),
		mailbox_name: text("mailbox_name"),
		content_type: unipileContentTypeEnum("content_type"),
		disabled_features: json("disabled_features"),
		is_deleted: boolean("is_deleted").default(false).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		unipileAccountIdIdx: index("UnipileChat_unipile_account_id_idx").on(
			table.unipile_account_id,
		),
		lastMessageAtIdx: index("UnipileChat_last_message_at_idx").on(
			table.last_message_at,
		),
		uniqueAccountExternal: unique(
			"UnipileChat_unipile_account_id_external_id_key",
		).on(table.unipile_account_id, table.external_id),
	}),
);

// UnipileContact table
export const unipileContacts = pgTable(
	"unipile_contact",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		unipile_account_id: uuid("unipile_account_id")
			.references(() => unipileAccounts.id)
			.notNull(),
		external_id: text("external_id").notNull(),
		provider_url: text("provider_url"),
		full_name: text("full_name"),
		first_name: text("first_name"),
		last_name: text("last_name"),
		headline: text("headline"),
		profile_image_url: text("profile_image_url"),
		last_interaction: timestamp("last_interaction"),
		is_connection: boolean("is_connection").default(false).notNull(),
		member_urn: text("member_urn"),
		network_distance: unipileNetworkDistanceEnum("network_distance"),
		occupation: text("occupation"),
		location: text("location"),
		pending_invitation: boolean("pending_invitation").default(false).notNull(),
		contact_info: json("contact_info"),
		is_deleted: boolean("is_deleted").default(false).notNull(),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		unipileAccountIdIdx: index("UnipileContact_unipile_account_id_idx").on(
			table.unipile_account_id,
		),
		uniqueAccountExternal: unique(
			"UnipileContact_unipile_account_id_external_id_key",
		).on(table.unipile_account_id, table.external_id),
	}),
);

// Continue in next file due to length...
