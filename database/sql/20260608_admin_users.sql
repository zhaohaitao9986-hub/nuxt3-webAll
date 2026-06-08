-- Admin users table for nuxt3-webAll after switching business tables to AISeekTools V2.
-- Run this file in pgAdmin against the backend PostgreSQL database.
--
-- Purpose:
--   1. Keep frontend/public users in V2 "users" untouched.
--   2. Move backend login and permission management to "admin_users".
--   3. Optionally copy old V1 admin accounts from "users" when those legacy columns still exist.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role') THEN
    CREATE TYPE "admin_role" AS ENUM ('ADMIN', 'SUPERADMIN');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "avatar" TEXT,
  "role" "admin_role" NOT NULL DEFAULT 'ADMIN',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "admin_users"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "password_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "avatar" TEXT,
  ADD COLUMN IF NOT EXISTS "role" "admin_role" DEFAULT 'ADMIN',
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_key"
  ON "admin_users"("email");

CREATE INDEX IF NOT EXISTS "idx_admin_users_role"
  ON "admin_users"("role");

CREATE INDEX IF NOT EXISTS "idx_admin_users_active"
  ON "admin_users"("is_active");

COMMENT ON TABLE "admin_users" IS 'Backend admin login accounts. Public/frontend users remain in the V2 users table.';
COMMENT ON COLUMN "admin_users"."password_hash" IS 'bcrypt password hash used by the backend admin login API.';
COMMENT ON COLUMN "admin_users"."role" IS 'Backend admin role: ADMIN or SUPERADMIN.';

-- Optional legacy migration:
-- If this database still has the old V1 admin fields on "users", copy ADMIN/SUPERADMIN
-- accounts into "admin_users". This block safely does nothing on a pure V2 database.
DO $$
DECLARE
  avatar_expr TEXT := 'NULL';
  created_expr TEXT := 'CURRENT_TIMESTAMP';
  updated_expr TEXT := 'CURRENT_TIMESTAMP';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'password'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'isActive'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'avatar'
    ) THEN
      avatar_expr := '"avatar"';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'createdAt'
    ) THEN
      created_expr := 'COALESCE("createdAt", CURRENT_TIMESTAMP)';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'updatedAt'
    ) THEN
      updated_expr := 'COALESCE("updatedAt", CURRENT_TIMESTAMP)';
    END IF;

    EXECUTE format(
      'INSERT INTO "admin_users" (
        "name",
        "email",
        "password_hash",
        "avatar",
        "role",
        "is_active",
        "created_at",
        "updated_at"
      )
      SELECT
        "name",
        lower("email"),
        "password",
        %s,
        "role"::text::"admin_role",
        "isActive",
        %s,
        %s
      FROM "users"
      WHERE "role"::text IN (''ADMIN'', ''SUPERADMIN'')
        AND "password" IS NOT NULL
        AND "email" IS NOT NULL
      ON CONFLICT ("email") DO UPDATE SET
        "name" = EXCLUDED."name",
        "password_hash" = EXCLUDED."password_hash",
        "avatar" = EXCLUDED."avatar",
        "role" = EXCLUDED."role",
        "is_active" = EXCLUDED."is_active",
        "updated_at" = CURRENT_TIMESTAMP',
      avatar_expr,
      created_expr,
      updated_expr
    );
  END IF;
END $$;

-- Ensure the initial super admin account exists.
INSERT INTO "admin_users" (
  "name",
  "email",
  "password_hash",
  "role",
  "is_active",
  "created_at",
  "updated_at"
)
VALUES (
  'zhaohaitao',
  'zhaohaitao9986@gmail.com',
  '$2b$10$eDAvJAQFutfe4/YG.q7SzepuAOo5eVWuX2y2gtIzuqguYJmKEj0Zu',
  'SUPERADMIN',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "password_hash" = EXCLUDED."password_hash",
  "role" = EXCLUDED."role",
  "is_active" = true,
  "updated_at" = CURRENT_TIMESTAMP;

COMMIT;
