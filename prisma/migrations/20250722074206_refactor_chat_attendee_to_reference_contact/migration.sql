/*
  Warnings:

  - You are about to drop the column `contact_info` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `display_name` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `first_name` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `headline` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `is_contact` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `last_name` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `member_urn` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `network_distance` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `occupation` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `pending_invitation` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `profile_image_url` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `profile_url` on the `UnipileChatAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `UnipileChatAttendee` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UnipileChatAttendee" DROP COLUMN "contact_info",
DROP COLUMN "display_name",
DROP COLUMN "first_name",
DROP COLUMN "headline",
DROP COLUMN "is_contact",
DROP COLUMN "last_name",
DROP COLUMN "location",
DROP COLUMN "member_urn",
DROP COLUMN "name",
DROP COLUMN "network_distance",
DROP COLUMN "occupation",
DROP COLUMN "pending_invitation",
DROP COLUMN "profile_image_url",
DROP COLUMN "profile_url",
DROP COLUMN "username",
ADD COLUMN     "contact_id" TEXT;

-- CreateIndex
CREATE INDEX "UnipileChatAttendee_contact_id_idx" ON "UnipileChatAttendee"("contact_id");

-- AddForeignKey
ALTER TABLE "UnipileChatAttendee" ADD CONSTRAINT "UnipileChatAttendee_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "UnipileContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
