-- Tareas al estilo Microsoft To Do.
--   1. Se elimina el nivel "hito": las listas pasan a colgar del proyecto.
--   2. Las subtareas se convierten en pasos (checklist), como en To Do.
--   3. Estados de To Do (sin "cancelada") e importancia en lugar de prioridad.
--   4. Inicio, zona horaria, repetición, categorías por espacio y recursos vinculados.

-- ---------------------------------------------------------------------------
-- 1. Listas → proyecto
-- ---------------------------------------------------------------------------
ALTER TABLE "task_lists" ADD COLUMN "project_id" UUID;

UPDATE "task_lists" l
SET "project_id" = m."project_id"
FROM "milestones" m
WHERE m."id" = l."milestone_id";

-- Si un proyecto tenía varios hitos con listas, el nombre del hito pasa a la lista
-- ("Hito 1 – Diseño") para no perder el contexto ni chocar nombres repetidos.
UPDATE "task_lists" l
SET "name" = m."name" || ' – ' || l."name"
FROM "milestones" m
WHERE m."id" = l."milestone_id"
  AND m."project_id" IN (
    SELECT m2."project_id"
    FROM "milestones" m2
    JOIN "task_lists" l2 ON l2."milestone_id" = m2."id"
    GROUP BY m2."project_id"
    HAVING COUNT(DISTINCT m2."id") > 1
  );

-- Un hito sin listas se conserva como una lista vacía con su nombre.
INSERT INTO "task_lists" ("id", "milestone_id", "project_id", "name", "sort_order", "created_at", "updated_at")
SELECT gen_random_uuid(), m."id", m."project_id", m."name", 0, m."created_at", NOW()
FROM "milestones" m
WHERE NOT EXISTS (SELECT 1 FROM "task_lists" l WHERE l."milestone_id" = m."id");

-- Orden: primero por hito y luego por lista, como se veía antes.
UPDATE "task_lists" l
SET "sort_order" = o."rn"
FROM (
  SELECT l2."id",
         ROW_NUMBER() OVER (
           PARTITION BY l2."project_id"
           ORDER BY m."sort_order", m."created_at", l2."sort_order", l2."created_at"
         ) - 1 AS "rn"
  FROM "task_lists" l2
  JOIN "milestones" m ON m."id" = l2."milestone_id"
) o
WHERE o."id" = l."id";

ALTER TABLE "task_lists" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "task_lists" ADD CONSTRAINT "task_lists_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "task_lists_project_id_sort_order_idx" ON "task_lists"("project_id", "sort_order");

ALTER TABLE "task_lists" DROP CONSTRAINT "task_lists_milestone_id_fkey";
DROP INDEX "task_lists_milestone_id_sort_order_idx";
ALTER TABLE "task_lists" DROP COLUMN "milestone_id";
DROP TABLE "milestones";

-- ---------------------------------------------------------------------------
-- 2. Subtareas → pasos
-- ---------------------------------------------------------------------------
CREATE TABLE "task_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "is_checked" BOOLEAN NOT NULL DEFAULT false,
    "checked_at" TIMESTAMPTZ,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "task_steps_task_id_sort_order_idx" ON "task_steps"("task_id", "sort_order");
ALTER TABLE "task_steps" ADD CONSTRAINT "task_steps_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cada subtarea (a cualquier profundidad) se asigna a su tarea raíz.
CREATE TEMP TABLE "subtask_roots" ON COMMIT DROP AS
WITH RECURSIVE up ("id", "ancestor") AS (
  SELECT "id", "parent_task_id" FROM "tasks" WHERE "parent_task_id" IS NOT NULL
  UNION ALL
  SELECT up."id", t."parent_task_id"
  FROM up JOIN "tasks" t ON t."id" = up."ancestor"
  WHERE t."parent_task_id" IS NOT NULL
)
SELECT up."id", up."ancestor" AS "root_id"
FROM up JOIN "tasks" r ON r."id" = up."ancestor"
WHERE r."parent_task_id" IS NULL;

INSERT INTO "task_steps" ("task_id", "title", "is_checked", "checked_at", "sort_order", "created_at")
SELECT r."root_id",
       t."title",
       t."status" = 'completed',
       CASE WHEN t."status" = 'completed' THEN COALESCE(t."completed_at", t."updated_at") END,
       ROW_NUMBER() OVER (PARTITION BY r."root_id" ORDER BY t."sort_order", t."created_at") - 1,
       t."created_at"
FROM "tasks" t
JOIN "subtask_roots" r ON r."id" = t."id";

-- Un paso solo tiene título: fechas, responsable y notas de la subtarea pasan a las notas de la tarea.
UPDATE "tasks" p
SET "notes" = CONCAT_WS(E'\n\n', NULLIF(p."notes", ''), x."extra")
FROM (
  SELECT r."root_id",
         'Detalles de subtareas convertidas en pasos:' || E'\n' || string_agg(
           '- ' || t."title"
             || COALESCE(' · vence ' || to_char(t."due_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC', '')
             || COALESCE(' · responsable ' || u."display_name", '')
             || COALESCE(E'\n  ' || replace(NULLIF(t."notes", ''), E'\n', E'\n  '), ''),
           E'\n' ORDER BY t."sort_order", t."created_at"
         ) AS "extra"
  FROM "tasks" t
  JOIN "subtask_roots" r ON r."id" = t."id"
  LEFT JOIN "users" u ON u."id" = t."assignee_id"
  WHERE t."due_at" IS NOT NULL OR t."assignee_id" IS NOT NULL OR NULLIF(t."notes", '') IS NOT NULL
  GROUP BY r."root_id"
) x
WHERE p."id" = x."root_id";

-- Los comentarios de las subtareas se conservan en la tarea raíz.
UPDATE "task_comments" c
SET "task_id" = r."root_id"
FROM "subtask_roots" r
WHERE c."task_id" = r."id";

DELETE FROM "tasks" WHERE "id" IN (SELECT "id" FROM "subtask_roots");

ALTER TABLE "tasks" DROP CONSTRAINT "tasks_parent_task_id_fkey";
DROP INDEX "tasks_parent_task_id_idx";
ALTER TABLE "tasks" DROP COLUMN "parent_task_id";

-- ---------------------------------------------------------------------------
-- 3. Estado e importancia
-- ---------------------------------------------------------------------------
UPDATE "tasks" SET "status" = 'not_started' WHERE "status" = 'pending';
UPDATE "tasks" SET "status" = 'deferred' WHERE "status" = 'cancelled';
UPDATE "tasks" SET "status" = 'not_started'
WHERE "status" NOT IN ('not_started', 'in_progress', 'waiting_on_others', 'deferred', 'completed');
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'not_started';
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_check"
  CHECK ("status" IN ('not_started', 'in_progress', 'waiting_on_others', 'deferred', 'completed'));

ALTER TABLE "tasks" ADD COLUMN "importance" TEXT NOT NULL DEFAULT 'normal';
UPDATE "tasks" SET "importance" = CASE "priority" WHEN 'high' THEN 'high' WHEN 'low' THEN 'low' ELSE 'normal' END;
ALTER TABLE "tasks" DROP COLUMN "priority";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_importance_check" CHECK ("importance" IN ('low', 'normal', 'high'));

-- ---------------------------------------------------------------------------
-- 4. Campos nuevos, categorías y recursos vinculados
-- ---------------------------------------------------------------------------
ALTER TABLE "tasks" ADD COLUMN "notes_updated_at" TIMESTAMPTZ;
ALTER TABLE "tasks" ADD COLUMN "start_at" TIMESTAMPTZ;
ALTER TABLE "tasks" ADD COLUMN "timezone" TEXT;
ALTER TABLE "tasks" ADD COLUMN "recurrence" JSONB;
ALTER TABLE "tasks" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'user';

CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_workspace_id_name_key" ON "categories"("workspace_id", "name");
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "task_categories" (
    "task_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    CONSTRAINT "task_categories_pkey" PRIMARY KEY ("task_id", "category_id")
);
CREATE INDEX "task_categories_category_id_idx" ON "task_categories"("category_id");
ALTER TABLE "task_categories" ADD CONSTRAINT "task_categories_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_categories" ADD CONSTRAINT "task_categories_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "task_linked_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "application_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "external_id" TEXT,
    "web_url" TEXT,
    "mime_type" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_linked_resources_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "task_linked_resources_task_id_idx" ON "task_linked_resources"("task_id");
CREATE INDEX "task_linked_resources_application_name_web_url_idx" ON "task_linked_resources"("application_name", "web_url");
ALTER TABLE "task_linked_resources" ADD CONSTRAINT "task_linked_resources_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
