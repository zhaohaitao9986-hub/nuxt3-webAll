-- AISeekTools V2 content generation workflow tables.
-- Run this file in pgAdmin after the V2 public schema and admin_users.sql.
--
-- Important V2 rule:
--   Published generated content must be written to "content_pages" and its typed child tables
--   such as "category_content_pages", "tutorial_pages", "comparison_pages", and
--   "alternative_pages". This script intentionally does not create a separate
--   published-content table.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_generation_task_status') THEN
    CREATE TYPE "content_generation_task_status" AS ENUM (
      'DRAFT',
      'PENDING',
      'GENERATING',
      'FAILED',
      'REVIEW',
      'APPROVED',
      'REJECTED',
      'PUBLISHED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "content_generation_prompt_versions" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "system_prompt" TEXT NOT NULL,
  "user_prompt_template" TEXT NOT NULL,
  "config_json" JSONB,
  "rules_json" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_admin_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "content_generation_prompt_versions"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER,
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "system_prompt" TEXT,
  ADD COLUMN IF NOT EXISTS "user_prompt_template" TEXT,
  ADD COLUMN IF NOT EXISTS "config_json" JSONB,
  ADD COLUMN IF NOT EXISTS "rules_json" JSONB,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "created_by_admin_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "content_generation_tasks" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "slug" VARCHAR(255),
  "content_type" "content_page_type" NOT NULL DEFAULT 'BUYER_GUIDE',
  "target_type" VARCHAR(64),
  "category_id" INTEGER,
  "tool_id" INTEGER,
  "limit_count" INTEGER NOT NULL DEFAULT 10,
  "status" "content_generation_task_status" NOT NULL DEFAULT 'DRAFT',

  "source_data_json" JSONB,
  "prompt_version_id" INTEGER,
  "prompt_json" JSONB,
  "raw_output" TEXT,
  "generated_content_json" JSONB,
  "final_content_json" JSONB,
  "validation_json" JSONB,
  "error_message" TEXT,
  "reject_reason" TEXT,

  "content_page_id" INTEGER,
  "created_by_admin_id" INTEGER,
  "approved_by_admin_id" INTEGER,
  "rejected_by_admin_id" INTEGER,
  "published_by_admin_id" INTEGER,
  "generated_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "content_generation_tasks_limit_count_check"
    CHECK ("limit_count" BETWEEN 1 AND 30)
);

ALTER TABLE "content_generation_tasks"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "content_type" "content_page_type" DEFAULT 'BUYER_GUIDE',
  ADD COLUMN IF NOT EXISTS "target_type" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "category_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "tool_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "limit_count" INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "status" "content_generation_task_status" DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "source_data_json" JSONB,
  ADD COLUMN IF NOT EXISTS "prompt_version_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "prompt_json" JSONB,
  ADD COLUMN IF NOT EXISTS "raw_output" TEXT,
  ADD COLUMN IF NOT EXISTS "generated_content_json" JSONB,
  ADD COLUMN IF NOT EXISTS "final_content_json" JSONB,
  ADD COLUMN IF NOT EXISTS "validation_json" JSONB,
  ADD COLUMN IF NOT EXISTS "error_message" TEXT,
  ADD COLUMN IF NOT EXISTS "reject_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "content_page_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "created_by_admin_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "approved_by_admin_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "rejected_by_admin_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "published_by_admin_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "content_generation_task_events" (
  "id" SERIAL PRIMARY KEY,
  "task_id" INTEGER NOT NULL,
  "actor_admin_id" INTEGER,
  "actor_email" VARCHAR(255),
  "event_type" VARCHAR(64) NOT NULL,
  "from_status" "content_generation_task_status",
  "to_status" "content_generation_task_status",
  "message" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "content_generation_task_events"
  ADD COLUMN IF NOT EXISTS "task_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "actor_admin_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "actor_email" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "from_status" "content_generation_task_status",
  ADD COLUMN IF NOT EXISTS "to_status" "content_generation_task_status",
  ADD COLUMN IF NOT EXISTS "message" TEXT,
  ADD COLUMN IF NOT EXISTS "payload" JSONB,
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_generation_prompt_versions_created_by_admin_id_fkey'
  ) THEN
    ALTER TABLE "content_generation_prompt_versions"
      ADD CONSTRAINT "content_generation_prompt_versions_created_by_admin_id_fkey"
      FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_generation_tasks_category_id_fkey'
  ) THEN
    ALTER TABLE "content_generation_tasks"
      ADD CONSTRAINT "content_generation_tasks_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "category_level2"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_generation_tasks_tool_id_fkey'
  ) THEN
    ALTER TABLE "content_generation_tasks"
      ADD CONSTRAINT "content_generation_tasks_tool_id_fkey"
      FOREIGN KEY ("tool_id") REFERENCES "ai_tools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_generation_tasks_content_page_id_fkey'
  ) THEN
    ALTER TABLE "content_generation_tasks"
      ADD CONSTRAINT "content_generation_tasks_content_page_id_fkey"
      FOREIGN KEY ("content_page_id") REFERENCES "content_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_generation_tasks_prompt_version_id_fkey'
  ) THEN
    ALTER TABLE "content_generation_tasks"
      ADD CONSTRAINT "content_generation_tasks_prompt_version_id_fkey"
      FOREIGN KEY ("prompt_version_id") REFERENCES "content_generation_prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_generation_tasks_created_by_admin_id_fkey'
  ) THEN
    ALTER TABLE "content_generation_tasks"
      ADD CONSTRAINT "content_generation_tasks_created_by_admin_id_fkey"
      FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_generation_tasks_approved_by_admin_id_fkey'
  ) THEN
    ALTER TABLE "content_generation_tasks"
      ADD CONSTRAINT "content_generation_tasks_approved_by_admin_id_fkey"
      FOREIGN KEY ("approved_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_generation_tasks_rejected_by_admin_id_fkey'
  ) THEN
    ALTER TABLE "content_generation_tasks"
      ADD CONSTRAINT "content_generation_tasks_rejected_by_admin_id_fkey"
      FOREIGN KEY ("rejected_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_generation_tasks_published_by_admin_id_fkey'
  ) THEN
    ALTER TABLE "content_generation_tasks"
      ADD CONSTRAINT "content_generation_tasks_published_by_admin_id_fkey"
      FOREIGN KEY ("published_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_generation_task_events_task_id_fkey'
  ) THEN
    ALTER TABLE "content_generation_task_events"
      ADD CONSTRAINT "content_generation_task_events_task_id_fkey"
      FOREIGN KEY ("task_id") REFERENCES "content_generation_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_generation_task_events_actor_admin_id_fkey'
  ) THEN
    ALTER TABLE "content_generation_task_events"
      ADD CONSTRAINT "content_generation_task_events_actor_admin_id_fkey"
      FOREIGN KEY ("actor_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "content_generation_prompt_versions_name_version_key"
  ON "content_generation_prompt_versions"("name", "version");

CREATE INDEX IF NOT EXISTS "idx_content_generation_prompt_versions_active"
  ON "content_generation_prompt_versions"("is_active");

CREATE INDEX IF NOT EXISTS "idx_content_generation_tasks_status_type"
  ON "content_generation_tasks"("status", "content_type");

CREATE INDEX IF NOT EXISTS "idx_content_generation_tasks_category"
  ON "content_generation_tasks"("category_id");

CREATE INDEX IF NOT EXISTS "idx_content_generation_tasks_tool"
  ON "content_generation_tasks"("tool_id");

CREATE INDEX IF NOT EXISTS "idx_content_generation_tasks_content_page"
  ON "content_generation_tasks"("content_page_id");

CREATE INDEX IF NOT EXISTS "idx_content_generation_tasks_created_at"
  ON "content_generation_tasks"("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_content_generation_tasks_updated_at"
  ON "content_generation_tasks"("updated_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_content_generation_tasks_keyword"
  ON "content_generation_tasks" USING GIN (
    to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("slug", '') || ' ' || coalesce("target_type", ''))
  );

CREATE INDEX IF NOT EXISTS "idx_content_generation_task_events_task"
  ON "content_generation_task_events"("task_id");

CREATE INDEX IF NOT EXISTS "idx_content_generation_task_events_type"
  ON "content_generation_task_events"("event_type");

CREATE INDEX IF NOT EXISTS "idx_content_generation_task_events_created_at"
  ON "content_generation_task_events"("created_at" DESC);

COMMENT ON TABLE "content_generation_tasks" IS 'Workflow tasks for AI content generation. Published content is linked through content_page_id to V2 content_pages.';
COMMENT ON COLUMN "content_generation_tasks"."content_page_id" IS 'Published V2 content_pages.id created from this task; NULL before publish.';
COMMENT ON COLUMN "content_generation_tasks"."source_data_json" IS 'Snapshot of V2 tool/category/source data used for generation.';
COMMENT ON COLUMN "content_generation_tasks"."prompt_json" IS 'Rendered prompt payload sent to the AI model.';
COMMENT ON COLUMN "content_generation_tasks"."generated_content_json" IS 'Original generated content before human editing.';
COMMENT ON COLUMN "content_generation_tasks"."final_content_json" IS 'Human-reviewed final content used to write content_pages and typed child tables.';
COMMENT ON TABLE "content_generation_prompt_versions" IS 'Versioned prompt templates and generation settings.';
COMMENT ON TABLE "content_generation_task_events" IS 'Audit trail for generation, review, rejection, publication, and status changes.';

COMMIT;
