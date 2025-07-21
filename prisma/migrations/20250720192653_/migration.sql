/*
  Warnings:

  - You are about to drop the column `userId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `profileId` on the `ProfileView` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ProfileView` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clerk_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_id` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profile_id` to the `ProfileView` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `ProfileView` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clerk_id` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProfileView" DROP CONSTRAINT "ProfileView_userId_fkey";

-- DropIndex
DROP INDEX "Message_userId_idx";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "userId",
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProfileView" DROP COLUMN "profileId",
DROP COLUMN "userId",
ADD COLUMN     "profile_id" TEXT NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
DROP COLUMN "password",
ADD COLUMN     "clerk_id" TEXT NOT NULL,
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "last_name" TEXT;

-- CreateIndex
CREATE INDEX "Message_user_id_idx" ON "Message"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerk_id_key" ON "User"("clerk_id");

-- AddForeignKey
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
