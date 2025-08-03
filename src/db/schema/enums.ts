import { pgEnum } from "drizzle-orm/pg-core";

// Unipile API Enums
export const unipileAccountTypeEnum = pgEnum("unipile_account_type", [
	"LINKEDIN",
	"WHATSAPP",
	"TELEGRAM",
	"INSTAGRAM",
	"FACEBOOK",
]);

export const unipileProviderEnum = pgEnum("unipile_provider", [
	"linkedin",
	"whatsapp",
	"telegram",
	"instagram",
	"facebook",
]);

export const unipileAccountStatusEnum = pgEnum("unipile_account_status", [
	"connected",
	"disconnected",
	"error",
]);

export const unipileChatTypeEnum = pgEnum("unipile_chat_type", [
	"direct",
	"group",
]);

export const unipileContentTypeEnum = pgEnum("unipile_content_type", [
	"inmail",
	"sponsored",
	"linkedin_offer",
]);

export const unipileNetworkDistanceEnum = pgEnum("unipile_network_distance", [
	"SELF",
	"FIRST",
	"SECOND",
	"THIRD",
	"OUT_OF_NETWORK",
	"DISTANCE_1",
	"DISTANCE_2",
	"DISTANCE_3",
]);

export const unipileMessageTypeEnum = pgEnum("unipile_message_type", [
	"MESSAGE",
	"EVENT",
	"SYSTEM",
]);

export const unipileAttendeeTypeEnum = pgEnum("unipile_attendee_type", [
	"MEMBER",
	"ADMIN",
	"GUEST",
	"ORGANIZATION",
]);

export const unipileAttachmentTypeEnum = pgEnum("unipile_attachment_type", [
	"img",
	"video",
	"audio",
	"file",
	"linkedin_post",
	"video_meeting",
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
	"FREE",
	"STARTER",
	"PROFESSIONAL",
	"ENTERPRISE",
	"GOLD",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
	"ACTIVE",
	"CANCELED",
	"PAST_DUE",
	"UNPAID",
	"TRIALING",
	"INCOMPLETE",
	"INCOMPLETE_EXPIRED",
]);
