-- Inicio de sesión con Google en lugar de WorkOS.
-- Las cuentas existentes se conservan: en su primer login con Google se vinculan
-- por correo verificado y se rellena google_sub.
ALTER TABLE "users" ADD COLUMN "google_sub" TEXT;
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

ALTER TABLE "users" DROP COLUMN "workos_user_id";
