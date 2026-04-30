-- AlterTable
ALTER TABLE "ai_tools" ADD COLUMN     "add_time" TEXT,
ADD COLUMN     "company_info" TEXT,
ADD COLUMN     "faq" JSONB,
ADD COLUMN     "for_jobs" TEXT[],
ADD COLUMN     "social_email" TEXT,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "use_cases" TEXT[],
ADD COLUMN     "website_type" TEXT;
