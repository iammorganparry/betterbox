/*
  Warnings:

  - You are about to drop the column `provider_data` on the `UnipileAccount` table. All the data in the column will be lost.
  - You are about to drop the column `contact_data` on the `UnipileContact` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `UnipileMessage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UnipileAccount" DROP COLUMN "provider_data";

-- AlterTable
ALTER TABLE "UnipileContact" DROP COLUMN "contact_data";

-- AlterTable
ALTER TABLE "UnipileMessage" DROP COLUMN "metadata";
