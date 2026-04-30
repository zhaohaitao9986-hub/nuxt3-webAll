/*
  Warnings:

  - The `faq` column on the `category_level2` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "category_level2" DROP COLUMN "faq",
ADD COLUMN     "faq" JSONB;
