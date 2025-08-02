ALTER TABLE "user" ADD COLUMN "onboarding_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "payment_method_added" boolean DEFAULT false NOT NULL;