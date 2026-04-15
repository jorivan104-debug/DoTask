# Plan de despliegue — Dokploy y Docker Compose

Este documento recoge **el estado aplicado en el repositorio** para desplegar DoTask con **Docker Compose** en **Dokploy** (Traefik, dominios, variables, builds y base de datos). Sirve como referencia operativa junto al [Plan constitutivo](PLAN-CONSTITUTIVO.md).

---

## 1. Arquitectura del stack

| Servicio | Imagen / build | Puerto interno | Rol |
|----------|----------------|------------------|-----|
| `postgres` | `postgres:16-alpine` | 5432 | Base de datos |
| `redis` | `redis:7-alpine` | 6379 | Cache / colas (futuro) |
| `api` | `apps/api/Dockerfile` | 3000 | NestJS + Prisma |
| `web` | `apps/web/Dockerfile` | 80 (nginx) | SPA estática |

- **Monorepo npm** (`package.json` raíz con `workspaces`). Las imágenes usan `context: .` en la raíz del repo.
- **No** se usa `env_file: apps/api/.env` en Compose: los secretos se definen en **Environment** de Dokploy (el archivo `.env` no va en Git).

---

## 2. Red y Traefik (Dokploy)

### Red `dokploy-network`

Traefik de Dokploy descubre contenedores por etiquetas en la red **`dokploy-network`** (red externa gestionada por Dokploy).

En `docker-compose.yml`:

- Al final del archivo: `networks.dokploy-network.external: true`.
- Servicios **`api`** y **`web`**: `networks: [default, dokploy-network]` para que Traefik enrute y, a la vez, sigan resolviendo `postgres` y `redis` por el nombre de servicio en la red por defecto del proyecto.

### Etiqueta `traefik.docker.network`

En **`api`** y **`web`**:

```yaml
labels:
  - "traefik.docker.network=dokploy-network"
```

Evita que Traefik elija la IP de una red interna equivocada y devuelva **404** aunque el DNS sea correcto.

### API (`api.app-sprint.com`)

Etiquetas en el servicio `api` (ajustar el host si cambias dominio):

- `traefik.enable=true`
- `traefik.docker.network=dokploy-network`
- `traefik.http.routers.api.rule=Host(\`api.app-sprint.com\`)`
- `traefik.http.routers.api.entrypoints=websecure`
- `traefik.http.routers.api.tls.certresolver=letsencrypt`
- `traefik.http.routers.api.service=api`
- `traefik.http.services.api.loadbalancer.server.port=3000`

**No** publicar `3000:3000` en el host: suele chocar con otros procesos; Traefik habla con el contenedor por la red Docker.

### Frontend (`dotaskweb.app-sprint.com`)

El dominio del front puede gestionarse desde la **pestaña Domains** de Dokploy (recomendado). En el repo, el servicio `web` incluye red + `traefik.docker.network` para que conviva con las etiquetas que inyecta Dokploy.

- **`expose: "80"`** en lugar de publicar `8080:80` en el host cuando el acceso es solo vía Traefik.

---

## 3. Variables de entorno (Dokploy → Compose)

Interpolación: `${VARIABLE}` en `docker-compose.yml`; valores por defecto solo donde aplica (ver archivo).

### Backend (`api`)

| Variable | Uso |
|----------|-----|
| `NODE_ENV` | `production` en producción |
| `PORT` | Por defecto `3000` |
| `DATABASE_URL` | PostgreSQL (p. ej. servicio `postgres` del mismo compose) |
| `REDIS_URL` | Redis (p. ej. `redis://redis:6379`) |
| `FRONTEND_URL` | URL **HTTPS** del front (CORS en Nest y redirects tras login/logout). Ej.: `https://dotaskweb.app-sprint.com` |
| `WORKOS_API_KEY` | Secreto WorkOS |
| `WORKOS_CLIENT_ID` | Cliente WorkOS |
| `WORKOS_COOKIE_PASSWORD` | Secreto de sesión (AuthKit) |
| `WORKOS_REDIRECT_URI` | Debe coincidir con WorkOS Dashboard, p. ej. `https://api.app-sprint.com/v1/auth/callback` |

### Build del frontend (`web`)

`VITE_API_URL` se inyecta en **tiempo de build** (Vite embebe `import.meta.env`):

- En `docker-compose.yml`: `build.args.VITE_API_URL: ${VITE_API_URL:-https://api.app-sprint.com}`.
- En Dokploy, definir `VITE_API_URL` si el API público no es ese host.

Sin esta variable, el bundle usa rutas relativas al dominio del front y **`/v1/auth/login` no llega al API**.

### Raíz del monorepo (`package.json`)

- **`overrides.vite`**: `^7.1.0` para una sola versión de Vite compatible con `vite-plugin-pwa` y `@tailwindcss/vite` en workspaces.

---

## 4. Dockerfiles

### API (`apps/api/Dockerfile`)

- Build: `npm install --workspace=apps/api`, `prisma generate`, `nest build`.
- Runtime: copia `node_modules` de la **raíz** del monorepo (incluye `.prisma` y `@prisma/client`), `dist` y `prisma` (incluye **`prisma/migrations`**).
- Arranque: `npx prisma migrate deploy && node dist/main.js` — aplica migraciones antes de levantar Nest.

### Web (`apps/web/Dockerfile`)

- `ARG` / `ENV` `VITE_API_URL` antes de `npm run build --workspace=apps/web`.
- Nginx sirve `dist` y `apps/web/nginx.conf` (SPA `try_files` → `index.html`).

---

## 5. Base de datos y Prisma

- Migraciones versionadas en **`apps/api/prisma/migrations/`** (inicial `20260415120000_init`: extensión **`citext`** + tablas del esquema).
- Esquema: `apps/api/prisma/schema.prisma`. La FK `task_comments.user_id` usa **`onDelete: Restrict`** (columna obligatoria; no es válido `SetNull` en PostgreSQL).

Desarrollo local:

```bash
npm run prisma:generate --workspace=apps/api
npm run prisma:migrate --workspace=apps/api
```

---

## 6. WorkOS (dashboard)

- Redirect URI: misma URL que `WORKOS_REDIRECT_URI` (callback del API).
- Orígenes / URLs de producción alineados con `FRONTEND_URL` y dominio del API.

---

## 7. Checklist rápido antes de desplegar

1. En Dokploy: variables del §3 definidas para el entorno del compose.
2. DNS: registros hacia el servidor (A/AAAA) para API y web.
3. WorkOS: redirect URI y cliente de producción.
4. **Preview Compose** en Dokploy: revisar fusión de redes y labels con el `docker-compose.yml` del repo.
5. Tras el primer deploy con DB vacía, confirmar en logs del `api` que **`migrate deploy`** aplicó la migración inicial.

---

## 8. Referencias en el repo

| Archivo | Contenido relevante |
|---------|---------------------|
| `docker-compose.yml` | Servicios, `environment`, redes, labels Traefik |
| `apps/api/Dockerfile` | Build API y `migrate deploy` |
| `apps/web/Dockerfile` | Build con `VITE_API_URL` |
| `apps/api/.env.example` | Plantilla local API |
| `apps/web/.env.example` | Plantilla local web (`VITE_API_URL`) |
| `apps/api/prisma/` | `schema.prisma` + `migrations/` |

---

## 9. Historial de decisiones (resumen)

- Quitar `env_file` apuntando a `apps/api/.env` inexistente en el clone.
- Quitar `version:` obsoleto de Compose.
- Vite 7 + `@vitejs/plugin-react` 5.x + overrides por conflicto con `vite-plugin-pwa`.
- Prisma: copiar `node_modules` desde raíz del build; migraciones en Git para evitar 500 en callback por tablas inexistentes.
- Traefik + `dokploy-network` + sin bind del puerto 3000 del API en el host.
