/*
  Warnings:

  - The `status` column on the `UnipileAccount` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `chat_type` column on the `UnipileChat` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `account_type` column on the `UnipileChat` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `content_type` column on the `UnipileChat` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `network_distance` column on the `UnipileChatAttendee` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `network_distance` column on the `UnipileContact` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `attendee_type` column on the `UnipileMessage` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `attachment_type` on the `UnipileMessageAttachment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UnipileAccountType" AS ENUM ('LINKEDIN', 'WHATSAPP', 'TELEGRAM', 'INSTAGRAM', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "UnipileAccountStatus" AS ENUM ('connected', 'disconnected', 'error');

-- CreateEnum
CREATE TYPE "UnipileChatType" AS ENUM ('direct', 'group');

-- CreateEnum
CREATE TYPE "UnipileContentType" AS ENUM ('inmail', 'sponsored', 'linkedin_offer');

-- CreateEnum
CREATE TYPE "UnipileNetworkDistance" AS ENUM ('SELF', 'FIRST', 'SECOND', 'THIRD', 'OUT_OF_NETWORK');

-- CreateEnum
CREATE TYPE "UnipileMessageType" AS ENUM ('MESSAGE', 'EVENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UnipileAttendeeType" AS ENUM ('MEMBER', 'ADMIN', 'GUEST');

-- CreateEnum
CREATE TYPE "UnipileAttachmentType" AS ENUM ('img', 'video', 'audio', 'file', 'linkedin_post', 'video_meeting');

-- AlterTable
ALTER TABLE "UnipileAccount" DROP COLUMN "status",
ADD COLUMN     "status" "UnipileAccountStatus" NOT NULL DEFAULT 'connected';

-- AlterTable
ALTER TABLE "UnipileChat" DROP COLUMN "chat_type",
ADD COLUMN     "chat_type" "UnipileChatType" NOT NULL DEFAULT 'direct',
DROP COLUMN "account_type",
ADD COLUMN     "account_type" "UnipileAccountType",
DROP COLUMN "content_type",
ADD COLUMN     "content_type" "UnipileContentType";

-- AlterTable
ALTER TABLE "UnipileChatAttendee" DROP COLUMN "network_distance",
ADD COLUMN     "network_distance" "UnipileNetworkDistance";

-- AlterTable
ALTER TABLE "UnipileContact" DROP COLUMN "network_distance",
ADD COLUMN     "network_distance" "UnipileNetworkDistance";

-- AlterTable
ALTER TABLE "UnipileMessage" DROP COLUMN "attendee_type",
ADD COLUMN     "attendee_type" "UnipileAttendeeType";

-- AlterTable
ALTER TABLE "UnipileMessageAttachment" DROP COLUMN "attachment_type",
ADD COLUMN     "attachment_type" "UnipileAttachmentType" NOT NULL;
