/*
  Warnings:

  - The `social_email` column on the `ai_tools` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ai_tools" DROP COLUMN "social_email",
ADD COLUMN     "social_email" TEXT[];
