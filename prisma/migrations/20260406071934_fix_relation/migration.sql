-- CreateTable
CREATE TABLE "category_level1" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_level1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_level2" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "tool_count" INTEGER NOT NULL DEFAULT 0,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "level1Id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_level2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tool_categories" (
    "aiToolId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "ai_tool_categories_pkey" PRIMARY KEY ("aiToolId","categoryId")
);

-- CreateTable
CREATE TABLE "ai_tools" (
    "id" SERIAL NOT NULL,
    "website" TEXT,
    "collected_count" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "handle" TEXT NOT NULL,
    "image" TEXT,
    "month_visited_count" BIGINT NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "what_is_summary" TEXT,
    "is_ad" BOOLEAN NOT NULL DEFAULT false,
    "website_name" TEXT,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "website_logo" TEXT,
    "pros" TEXT[],
    "cons" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_tools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_level1_handle_key" ON "category_level1"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "category_level2_handle_key" ON "category_level2"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "ai_tools_handle_key" ON "ai_tools"("handle");

-- AddForeignKey
ALTER TABLE "category_level2" ADD CONSTRAINT "category_level2_level1Id_fkey" FOREIGN KEY ("level1Id") REFERENCES "category_level1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_categories" ADD CONSTRAINT "ai_tool_categories_aiToolId_fkey" FOREIGN KEY ("aiToolId") REFERENCES "ai_tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_categories" ADD CONSTRAINT "ai_tool_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category_level2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
