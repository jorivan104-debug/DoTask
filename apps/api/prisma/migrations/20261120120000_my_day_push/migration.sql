-- Mi día (personal por usuario) y notificaciones push.

ALTER TABLE "tasks" ADD COLUMN "reminder_sent_at" TIMESTAMPTZ;
ALTER TABLE "tasks" ADD COLUMN "overdue_notified_at" TIMESTAMPTZ;
CREATE INDEX "tasks_due_at_idx" ON "tasks"("due_at");
CREATE INDEX "tasks_remind_at_idx" ON "tasks"("remind_at");

-- Las tareas que ya vencieron o cuyo recordatorio ya pasó no deben notificarse
-- de golpe al desplegar esta versión.
UPDATE "tasks" SET "overdue_notified_at" = NOW() WHERE "due_at" IS NOT NULL AND "due_at" <= NOW();
UPDATE "tasks" SET "reminder_sent_at" = NOW() WHERE "remind_at" IS NOT NULL AND "remind_at" <= NOW();

CREATE TABLE "my_day_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "my_day_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "my_day_entries_user_id_task_id_key" ON "my_day_entries"("user_id", "task_id");
CREATE INDEX "my_day_entries_user_id_day_idx" ON "my_day_entries"("user_id", "day");
ALTER TABLE "my_day_entries" ADD CONSTRAINT "my_day_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "my_day_entries" ADD CONSTRAINT "my_day_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ,
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
