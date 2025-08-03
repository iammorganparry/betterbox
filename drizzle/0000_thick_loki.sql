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
CREATE TYPE "public"."unipile_provider" AS ENUM('linkedin', 'whatsapp', 'telegram', 'instagram', 'facebook');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile_view" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"linkedin_urn" text NOT NULL,
	"linkedin_url" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "profile_linkedin_urn_unique" UNIQUE("linkedin_urn")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unipile_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" "unipile_provider" NOT NULL,
	"account_id" text NOT NULL,
	"status" "unipile_account_status" DEFAULT 'connected' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UnipileAccount_user_id_provider_account_id_key" UNIQUE("user_id","provider","account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unipile_chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unipile_account_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"provider" "unipile_provider" DEFAULT 'linkedin' NOT NULL,
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
CREATE TABLE IF NOT EXISTS "unipile_contact" (
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
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"image_url" text,
	"stripe_customer_id" text,
	"onboarding_required" boolean DEFAULT true NOT NULL,
	"onboarding_completed_at" timestamp,
	"payment_method_added" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_folder_assignment" (
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
CREATE TABLE IF NOT EXISTS "chat_folder" (
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
CREATE TABLE IF NOT EXISTS "payment_method" (
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
	CONSTRAINT "payment_method_stripe_payment_method_id_unique" UNIQUE("stripe_payment_method_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription" (
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
	CONSTRAINT "subscription_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unipile_chat_attendee" (
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
CREATE TABLE IF NOT EXISTS "unipile_message_attachment" (
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
CREATE TABLE IF NOT EXISTS "unipile_message" (
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
CREATE TABLE IF NOT EXISTS "unipile_profile_view" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"viewer_profile_id" text,
	"viewer_name" text,
	"viewer_headline" text,
	"viewer_image_url" text,
	"viewed_at" timestamp NOT NULL,
	"provider" "unipile_provider" DEFAULT 'linkedin' NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message" ADD CONSTRAINT "message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profile_view" ADD CONSTRAINT "profile_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_account" ADD CONSTRAINT "unipile_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_chat" ADD CONSTRAINT "unipile_chat_unipile_account_id_unipile_account_id_fk" FOREIGN KEY ("unipile_account_id") REFERENCES "public"."unipile_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_contact" ADD CONSTRAINT "unipile_contact_unipile_account_id_unipile_account_id_fk" FOREIGN KEY ("unipile_account_id") REFERENCES "public"."unipile_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_folder_assignment" ADD CONSTRAINT "chat_folder_assignment_chat_id_unipile_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."unipile_chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_folder_assignment" ADD CONSTRAINT "chat_folder_assignment_folder_id_chat_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."chat_folder"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_folder_assignment" ADD CONSTRAINT "chat_folder_assignment_assigned_by_id_user_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_folder" ADD CONSTRAINT "chat_folder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_method" ADD CONSTRAINT "payment_method_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_chat_attendee" ADD CONSTRAINT "unipile_chat_attendee_chat_id_unipile_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."unipile_chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_chat_attendee" ADD CONSTRAINT "unipile_chat_attendee_contact_id_unipile_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."unipile_contact"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_message_attachment" ADD CONSTRAINT "unipile_message_attachment_message_id_unipile_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."unipile_message"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_message" ADD CONSTRAINT "unipile_message_unipile_account_id_unipile_account_id_fk" FOREIGN KEY ("unipile_account_id") REFERENCES "public"."unipile_account"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unipile_message" ADD CONSTRAINT "unipile_message_chat_id_unipile_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."unipile_chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_user_id_idx" ON "message" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_name_idx" ON "post" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileAccount_user_id_idx" ON "unipile_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileChat_unipile_account_id_idx" ON "unipile_chat" USING btree ("unipile_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileChat_last_message_at_idx" ON "unipile_chat" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileContact_unipile_account_id_idx" ON "unipile_contact" USING btree ("unipile_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ChatFolderAssignment_chat_id_idx" ON "chat_folder_assignment" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ChatFolderAssignment_folder_id_idx" ON "chat_folder_assignment" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ChatFolder_user_id_idx" ON "chat_folder" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PaymentMethod_subscription_id_idx" ON "payment_method" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PaymentMethod_stripe_payment_method_id_idx" ON "payment_method" USING btree ("stripe_payment_method_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Subscription_trial_end_idx" ON "subscription" USING btree ("trial_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileChatAttendee_chat_id_idx" ON "unipile_chat_attendee" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileChatAttendee_contact_id_idx" ON "unipile_chat_attendee" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileMessageAttachment_message_id_idx" ON "unipile_message_attachment" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileMessage_unipile_account_id_idx" ON "unipile_message" USING btree ("unipile_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileMessage_chat_id_idx" ON "unipile_message" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileMessage_sent_at_idx" ON "unipile_message" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileProfileView_user_id_idx" ON "unipile_profile_view" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileProfileView_viewed_at_idx" ON "unipile_profile_view" USING btree ("viewed_at");