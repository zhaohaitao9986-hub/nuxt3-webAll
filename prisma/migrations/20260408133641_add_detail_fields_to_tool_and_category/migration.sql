-- AlterTable
ALTER TABLE "ai_tools" ADD COLUMN     "feature" TEXT[],
ADD COLUMN     "pricing" TEXT[];

-- AlterTable
ALTER TABLE "category_level2" ADD COLUMN     "advantages" TEXT,
ADD COLUMN     "faq" TEXT[],
ADD COLUMN     "feature" TEXT[],
ADD COLUMN     "how_do_work" TEXT,
ADD COLUMN     "what_is_summary" TEXT,
ADD COLUMN     "who_is_use" TEXT;
