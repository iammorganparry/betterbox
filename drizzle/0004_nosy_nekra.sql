ALTER TABLE "unipile_message_attachment" ADD COLUMN "r2_key" text;--> statement-breakpoint
ALTER TABLE "unipile_message_attachment" ADD COLUMN "r2_url" text;--> statement-breakpoint
ALTER TABLE "unipile_message_attachment" ADD COLUMN "r2_uploaded_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UnipileMessageAttachment_r2_key_idx" ON "unipile_message_attachment" USING btree ("r2_key");