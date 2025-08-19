ALTER TYPE "public"."unipile_account_status" ADD VALUE 'syncing';--> statement-breakpoint
ALTER TABLE "unipile_account" ADD COLUMN "sync_status" text;--> statement-breakpoint
ALTER TABLE "unipile_account" ADD COLUMN "sync_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "unipile_account" ADD COLUMN "sync_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "unipile_account" ADD COLUMN "sync_progress" json;--> statement-breakpoint
ALTER TABLE "unipile_account" ADD COLUMN "sync_error" text;--> statement-breakpoint
ALTER TABLE "unipile_account" ADD COLUMN "last_sync_at" timestamp;