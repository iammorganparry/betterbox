-- AlterTable
ALTER TABLE "UnipileChat" ADD COLUMN     "account_type" TEXT,
ADD COLUMN     "archived" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "content_type" TEXT,
ADD COLUMN     "disabled_features" JSONB,
ADD COLUMN     "mailbox_id" TEXT,
ADD COLUMN     "mailbox_name" TEXT,
ADD COLUMN     "muted_until" BIGINT,
ADD COLUMN     "organization_id" TEXT,
ADD COLUMN     "read_only" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unread_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UnipileChatAttendee" ADD COLUMN     "contact_info" JSONB,
ADD COLUMN     "hidden" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_self" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "member_urn" TEXT,
ADD COLUMN     "network_distance" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "pending_invitation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UnipileContact" ADD COLUMN     "contact_info" JSONB,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "member_urn" TEXT,
ADD COLUMN     "network_distance" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "pending_invitation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UnipileMessage" ADD COLUMN     "attendee_distance" INTEGER,
ADD COLUMN     "attendee_type" TEXT,
ADD COLUMN     "behavior" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "delivered" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "edited" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "event_type" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hidden" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_event" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parent" TEXT,
ADD COLUMN     "replies" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seen" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sender_urn" TEXT,
ADD COLUMN     "subject" TEXT;

-- AlterTable
ALTER TABLE "UnipileMessageAttachment" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "expires_at" BIGINT,
ADD COLUMN     "gif" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "starts_at" BIGINT,
ADD COLUMN     "sticker" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "time_range" INTEGER,
ADD COLUMN     "unavailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "url_expires_at" BIGINT,
ADD COLUMN     "voice_note" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "width" INTEGER;
