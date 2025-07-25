/*
  Warnings:

  - A unique constraint covering the columns `[stripe_customer_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'GOLD');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'UNPAID', 'TRIALING', 'INCOMPLETE', 'INCOMPLETE_EXPIRED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripe_customer_id" TEXT;

-- CreateTable
CREATE TABLE "ChatFolder" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatFolderAssignment" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "assigned_by_id" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatFolderAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "stripe_customer_id" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "trial_start" TIMESTAMP(3),
    "trial_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "stripe_payment_method_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "card_brand" TEXT,
    "card_last4" TEXT,
    "card_exp_month" INTEGER,
    "card_exp_year" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatFolder_user_id_idx" ON "ChatFolder"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatFolder_user_id_name_key" ON "ChatFolder"("user_id", "name");

-- CreateIndex
CREATE INDEX "ChatFolderAssignment_chat_id_idx" ON "ChatFolderAssignment"("chat_id");

-- CreateIndex
CREATE INDEX "ChatFolderAssignment_folder_id_idx" ON "ChatFolderAssignment"("folder_id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatFolderAssignment_chat_id_folder_id_key" ON "ChatFolderAssignment"("chat_id", "folder_id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_user_id_key" ON "Subscription"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripe_subscription_id_key" ON "Subscription"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_trial_end_idx" ON "Subscription"("trial_end");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_stripe_payment_method_id_key" ON "PaymentMethod"("stripe_payment_method_id");

-- CreateIndex
CREATE INDEX "PaymentMethod_subscription_id_idx" ON "PaymentMethod"("subscription_id");

-- CreateIndex
CREATE INDEX "PaymentMethod_stripe_payment_method_id_idx" ON "PaymentMethod"("stripe_payment_method_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripe_customer_id_key" ON "User"("stripe_customer_id");

-- AddForeignKey
ALTER TABLE "ChatFolder" ADD CONSTRAINT "ChatFolder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatFolderAssignment" ADD CONSTRAINT "ChatFolderAssignment_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "UnipileChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatFolderAssignment" ADD CONSTRAINT "ChatFolderAssignment_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "ChatFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatFolderAssignment" ADD CONSTRAINT "ChatFolderAssignment_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
