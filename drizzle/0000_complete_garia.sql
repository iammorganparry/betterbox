CREATE TYPE "public"."subscription_plan" AS ENUM('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'GOLD');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'CANCELED', 'PAST_DUE', 'UNPAID', 'TRIALING', 'INCOMPLETE', 'INCOMPLETE_EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."unipile_account_status" AS ENUM('connected', 'disconnected', 'error');--> statement-breakpoint
CREATE TYPE "public"."unipile_account_type" AS ENUM('LINKEDIN', 'WHATSAPP', 'TELEGRAM', 'INSTAGRAM', 'FACEBOOK');--> statement-breakpoint
CREATE TYPE "public"."unipile_attachment_type" AS ENUM('img', 'video', 'audio', 'file', 'linkedin_post', 'video_meeting');--> statement-breakpoint
CREATE TYPE "public"."unipile_attendee_type" AS ENUM('MEMBER', 'ADMIN', 'GUEST', 'ORGANIZATION');--> statement-breakpoint
CREATE TYPE "public"."unipile_chat_type" AS ENUM('direct', 'group');--> statement-breakpoint
CREATE TYPE "public"."unipile_content_type" AS ENUM('inmail', 'sponsored', 'linkedin_offer');--> statement-breakpoint
CREATE TYPE "public"."unipile_message_type" AS ENUM('MESSAGE', 'EVENT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."unipile_network_distance" AS ENUM('SELF', 'FIRST', 'SECOND', 'THIRD', 'OUT_OF_NETWORK', 'DISTANCE_1', 'DISTANCE_2', 'DISTANCE_3');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Post" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ProfileView" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"linkedin_urn" text NOT NULL,
	"linkedin_url" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "Profile_linkedin_urn_unique" UNIQUE("linkedin_urn")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UnipileAccount" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"account_id" text NOT NULL,
	"status" "unipile_account_status" DEFAULT 'connected' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UnipileAccount_user_id_provider_account_id_key" UNIQUE("user_id","provider","account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UnipileChat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unipile_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"provider" text DEFAULT 'linkedin' NOT NULL,
	"account_type" "unipile_account_type",
	"chat_type" "unipile_chat_type" DEFAULT 'direct' NOT NULL,
	"name" text,
	"last_message_at" timestamp,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"archived" integer DEFAULT 0 NOT NULL,
	"read_only" integer DEFAULT 0 NOT NULL,
	"muted_until" bigint,
	"organization_id" text,
	"mailbox_id" text,
	"mailbox_name" text,
	"content_type" "unipile_content_type",
	"disabled_features" json,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UnipileChat_unipile_account_id_external_id_key" UNIQUE("unipile_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UnipileContact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unipile_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"provider_url" text,
	"full_name" text,
	"first_name" text,
	"last_name" text,
	"headline" text,
	"profile_image_url" text,
	"last_interaction" timestamp,
	"is_connection" boolean DEFAULT false NOT NULL,
	"member_urn" text,
	"network_distance" "unipile_network_distance",
	"occupation" text,
	"location" text,
	"pending_invitation" boolean DEFAULT false NOT NULL,
	"contact_info" json,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UnipileContact_unipile_account_id_external_id_key" UNIQUE("unipile_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"image_url" text,
	"stripe_customer_id" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email"),
	CONSTRAINT "User_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ChatFolderAssignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"folder_id" uuid NOT NULL,
	"assigned_by_id" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ChatFolderAssignment_chat_id_folder_id_key" UNIQUE("chat_id","folder_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ChatFolder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ChatFolder_user_id_name_key" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PaymentMethod" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"stripe_payment_method_id" text NOT NULL,
	"type" text NOT NULL,
	"card_brand" text,
	"card_last4" text,
	"card_exp_month" integer,
	"card_exp_year" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "PaymentMethod_stripe_payment_method_id_unique" UNIQUE("stripe_payment_method_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"plan" "subscription_plan" DEFAULT 'FREE' NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "Subscription_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "Subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UnipileChatAttendee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"contact_id" uuid,
	"external_id" text NOT NULL,
	"is_self" integer DEFAULT 0 NOT NULL,
	"hidden" integer DEFAULT 0 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UnipileChatAttendee_chat_id_external_id_key" UNIQUE("chat_id","external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UnipileMessageAttachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"attachment_type" "unipile_attachment_type" NOT NULL,
	"url" text,
	"filename" text,
	"file_size" integer,
	"mime_type" text,
	"unavailable" boolean DEFAULT false NOT NULL,
	"url_expires_at" bigint,
	"width" integer,
	"height" integer,
	"duration" integer,
	"sticker" boolean DEFAULT false NOT NULL,
	"gif" boolean DEFAULT false NOT NULL,
	"voice_note" boolean DEFAULT false NOT NULL,
	"starts_at" bigint,
	"expires_at" bigint,
	"time_range" integer,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UnipileMessageAttachment_message_id_external_id_key" UNIQUE("message_id","external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UnipileMessage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unipile_account_id" uuid NOT NULL,
	"chat_id" uuid,
	"external_id" text NOT NULL,
	"external_chat_id" text,
	"sender_id" text,
	"recipient_id" text,
	"message_type" text DEFAULT 'text' NOT NULL,
	"content" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_outgoing" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp,
	"sender_urn" text,
	"attendee_type" "unipile_attendee_type",
	"attendee_distance" integer,
	"seen" integer DEFAULT 0 NOT NULL,
	"hidden" integer DEFAULT 0 NOT NULL,
	"deleted" integer DEFAULT 0 NOT NULL,
	"edited" integer DEFAULT 0 NOT NULL,
	"is_event" integer DEFAULT 0 NOT NULL,
	"delivered" integer DEFAULT 0 NOT NULL,
	"behavior" integer DEFAULT 0 NOT NULL,
	"event_type" integer DEFAULT 0 NOT NULL,
	"replies" integer DEFAULT 0 NOT NULL,
	"subject" text,
	"parent" text,
	"metadata" json,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UnipileMessage_unipile_account_id_external_id_key" UNIQUE("unipile_account_id","external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UnipileProfileView" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"viewer_profile_id" text,
	"viewer_name" text,
	"viewer_headline" text,
	"viewer_image_url" text,
	"viewed_at" timestamp NOT NULL,
	"provider" text DEFAULT 'linkedin' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Message" ADD CONSTRAINT "Message_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UnipileAccount" ADD CONSTRAINT "UnipileAccount_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UnipileChat" ADD CONSTRAINT "UnipileChat_unipile_account_id_UnipileAccount_id_fk" FOREIGN KEY ("unipile_account_id") REFERENCES "public"."UnipileAccount"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UnipileContact" ADD CONSTRAINT "UnipileContact_unipile_account_id_UnipileAccount_id_fk" FOREIGN KEY ("unipile_account_id") REFERENCES "public"."UnipileAccount"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChatFolderAssignment" ADD CONSTRAINT "ChatFolderAssignment_chat_id_UnipileChat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."UnipileChat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChatFolderAssignment" ADD CONSTRAINT "ChatFolderAssignment_folder_id_ChatFolder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."ChatFolder"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChatFolderAssignment" ADD CONSTRAINT "ChatFolderAssignment_assigned_by_id_User_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ChatFolder" ADD CONSTRAINT "ChatFolder_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_subscription_id_Subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."Subscription"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UnipileChatAttendee" ADD CONSTRAINT "UnipileChatAttendee_chat_id_UnipileChat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."UnipileChat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UnipileChatAttendee" ADD CONSTRAINT "UnipileChatAttendee_contact_id_UnipileContact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."UnipileContact"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UnipileMessageAttachment" ADD CONSTRAINT "UnipileMessageAttachment_message_id_UnipileMessage_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."UnipileMessage"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UnipileMessage" ADD CONSTRAINT "UnipileMessage_unipile_account_id_UnipileAccount_id_fk" FOREIGN KEY ("unipile_account_id") REFERENCES "public"."UnipileAccount"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UnipileMessage" ADD CONSTRAINT "UnipileMessage_chat_id_UnipileChat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."UnipileChat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_user_id_idx" ON "Message" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Post_name_idx" ON "Post" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileAccount_user_id_idx" ON "UnipileAccount" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileChat_unipile_account_id_idx" ON "UnipileChat" USING btree ("unipile_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileChat_last_message_at_idx" ON "UnipileChat" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileContact_unipile_account_id_idx" ON "UnipileContact" USING btree ("unipile_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ChatFolderAssignment_chat_id_idx" ON "ChatFolderAssignment" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ChatFolderAssignment_folder_id_idx" ON "ChatFolderAssignment" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ChatFolder_user_id_idx" ON "ChatFolder" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PaymentMethod_subscription_id_idx" ON "PaymentMethod" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PaymentMethod_stripe_payment_method_id_idx" ON "PaymentMethod" USING btree ("stripe_payment_method_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Subscription_trial_end_idx" ON "Subscription" USING btree ("trial_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileChatAttendee_chat_id_idx" ON "UnipileChatAttendee" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileChatAttendee_contact_id_idx" ON "UnipileChatAttendee" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileMessageAttachment_message_id_idx" ON "UnipileMessageAttachment" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileMessage_unipile_account_id_idx" ON "UnipileMessage" USING btree ("unipile_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileMessage_chat_id_idx" ON "UnipileMessage" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileMessage_sent_at_idx" ON "UnipileMessage" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileProfileView_user_id_idx" ON "UnipileProfileView" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileProfileView_viewed_at_idx" ON "UnipileProfileView" USING btree ("viewed_at");