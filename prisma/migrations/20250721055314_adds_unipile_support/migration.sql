-- CreateTable
CREATE TABLE "UnipileAccount" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "provider_data" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnipileAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnipileMessage" (
    "id" TEXT NOT NULL,
    "unipile_account_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "chat_id" TEXT,
    "sender_id" TEXT,
    "recipient_id" TEXT,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_outgoing" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnipileMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnipileContact" (
    "id" TEXT NOT NULL,
    "unipile_account_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "provider_url" TEXT,
    "full_name" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "headline" TEXT,
    "profile_image_url" TEXT,
    "contact_data" JSONB,
    "last_interaction" TIMESTAMP(3),
    "is_connection" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnipileContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnipileProfileView" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "viewer_profile_id" TEXT,
    "viewer_name" TEXT,
    "viewer_headline" TEXT,
    "viewer_image_url" TEXT,
    "viewed_at" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'linkedin',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnipileProfileView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnipileAccount_user_id_idx" ON "UnipileAccount"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "UnipileAccount_user_id_provider_account_id_key" ON "UnipileAccount"("user_id", "provider", "account_id");

-- CreateIndex
CREATE INDEX "UnipileMessage_unipile_account_id_idx" ON "UnipileMessage"("unipile_account_id");

-- CreateIndex
CREATE INDEX "UnipileMessage_chat_id_idx" ON "UnipileMessage"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "UnipileMessage_unipile_account_id_external_id_key" ON "UnipileMessage"("unipile_account_id", "external_id");

-- CreateIndex
CREATE INDEX "UnipileContact_unipile_account_id_idx" ON "UnipileContact"("unipile_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "UnipileContact_unipile_account_id_external_id_key" ON "UnipileContact"("unipile_account_id", "external_id");

-- CreateIndex
CREATE INDEX "UnipileProfileView_user_id_idx" ON "UnipileProfileView"("user_id");

-- CreateIndex
CREATE INDEX "UnipileProfileView_viewed_at_idx" ON "UnipileProfileView"("viewed_at");

-- AddForeignKey
ALTER TABLE "UnipileAccount" ADD CONSTRAINT "UnipileAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnipileMessage" ADD CONSTRAINT "UnipileMessage_unipile_account_id_fkey" FOREIGN KEY ("unipile_account_id") REFERENCES "UnipileAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnipileContact" ADD CONSTRAINT "UnipileContact_unipile_account_id_fkey" FOREIGN KEY ("unipile_account_id") REFERENCES "UnipileAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
