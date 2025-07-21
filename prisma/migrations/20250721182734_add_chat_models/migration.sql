-- AlterTable
ALTER TABLE "UnipileMessage" ADD COLUMN     "external_chat_id" TEXT,
ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "UnipileChat" (
    "id" TEXT NOT NULL,
    "unipile_account_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'linkedin',
    "chat_type" TEXT NOT NULL DEFAULT 'direct',
    "name" TEXT,
    "last_message_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnipileChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnipileChatAttendee" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "name" TEXT,
    "display_name" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "username" TEXT,
    "profile_image_url" TEXT,
    "profile_url" TEXT,
    "headline" TEXT,
    "is_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnipileChatAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnipileMessageAttachment" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "attachment_type" TEXT NOT NULL,
    "url" TEXT,
    "filename" TEXT,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnipileMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnipileChat_unipile_account_id_idx" ON "UnipileChat"("unipile_account_id");

-- CreateIndex
CREATE INDEX "UnipileChat_last_message_at_idx" ON "UnipileChat"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "UnipileChat_unipile_account_id_external_id_key" ON "UnipileChat"("unipile_account_id", "external_id");

-- CreateIndex
CREATE INDEX "UnipileChatAttendee_chat_id_idx" ON "UnipileChatAttendee"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "UnipileChatAttendee_chat_id_external_id_key" ON "UnipileChatAttendee"("chat_id", "external_id");

-- CreateIndex
CREATE INDEX "UnipileMessageAttachment_message_id_idx" ON "UnipileMessageAttachment"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "UnipileMessageAttachment_message_id_external_id_key" ON "UnipileMessageAttachment"("message_id", "external_id");

-- CreateIndex
CREATE INDEX "UnipileMessage_sent_at_idx" ON "UnipileMessage"("sent_at");

-- AddForeignKey
ALTER TABLE "UnipileChat" ADD CONSTRAINT "UnipileChat_unipile_account_id_fkey" FOREIGN KEY ("unipile_account_id") REFERENCES "UnipileAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnipileChatAttendee" ADD CONSTRAINT "UnipileChatAttendee_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "UnipileChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnipileMessage" ADD CONSTRAINT "UnipileMessage_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "UnipileChat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnipileMessageAttachment" ADD CONSTRAINT "UnipileMessageAttachment_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "UnipileMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
