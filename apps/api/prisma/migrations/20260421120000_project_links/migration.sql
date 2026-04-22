-- CreateTable
CREATE TABLE "project_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_links_project_id_sort_order_idx" ON "project_links"("project_id", "sort_order");

-- AddForeignKey
ALTER TABLE "project_links" ADD CONSTRAINT "project_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
