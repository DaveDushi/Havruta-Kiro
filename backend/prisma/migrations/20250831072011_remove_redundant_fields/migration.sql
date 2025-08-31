/*
  Warnings:

  - You are about to drop the column `creatorId` on the `havrutot` table. All the data in the column will be lost.
  - You are about to drop the column `currentSection` on the `havrutot` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "havrutot" DROP CONSTRAINT "havrutot_creatorId_fkey";

-- AlterTable
ALTER TABLE "havrutot" DROP COLUMN "creatorId",
DROP COLUMN "currentSection";
