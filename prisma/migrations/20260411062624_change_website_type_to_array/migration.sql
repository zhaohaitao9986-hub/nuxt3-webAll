/*
  Warnings:

  - The `website_type` column on the `ai_tools` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ai_tools" DROP COLUMN "website_type",
ADD COLUMN     "website_type" TEXT[];
