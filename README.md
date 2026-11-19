# DoTask

Aplicación de gestión de tareas en equipo, tipo Microsoft To Do, multiplataforma.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **PWA**: Workbox (vite-plugin-pwa)
- **Móvil**: Capacitor (Android / iOS)
- **Backend**: NestJS + Prisma
- **Base de datos**: PostgreSQL
- **Cache / Colas**: Redis + BullMQ
- **Autenticación**: WorkOS (AuthKit)
- **Despliegue**: Dokploy (Docker)

## Estructura

```
DoTask/
├── apps/
│   ├── web/          # Frontend React + Vite + PWA
│   └── api/          # Backend NestJS + Prisma
├── packages/
│   └── shared/       # Tipos y validaciones compartidas (Zod)
├── docs/             # Plan constitutivo, despliegue Dokploy (DEPLOY-DOKPLOY.md)
├── docker-compose.yml
└── README.md
```

## Desarrollo local

### Requisitos

- Node.js >= 20
- PostgreSQL 16+ (o usar docker-compose)
- Redis 7+ (o usar docker-compose)
- Cuenta en WorkOS con AuthKit configurado

### Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar Postgres y Redis (puertos solo en 127.0.0.1)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis

# 3. Configurar variables de entorno
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Editar ambos archivos con tus valores de WorkOS y DB

# 4. Generar cliente Prisma y ejecutar migraciones
npm run prisma:generate --workspace=apps/api
npm run prisma:migrate --workspace=apps/api

# 5. Ejecutar las pruebas del API
npm run test:api

# 6. Iniciar backend
npm run dev:api

# 7. En otra terminal, iniciar frontend
npm run dev:web
```

El frontend estará en `http://localhost:5173` y el API en `http://localhost:3000`.

## Modelo de datos

```
Workspace → Project → Milestone → TaskList → Task
```

Consultar [docs/PLAN-CONSTITUTIVO.md](docs/PLAN-CONSTITUTIVO.md) para el detalle completo de arquitectura, base de datos y decisiones técnicas.

## Seguridad del API

- Sesión: cookie `dotask_session` **firmada** (HMAC-SHA256, caducidad 7 días) con `SESSION_SECRET`. Las cookies antiguas sin firmar se rechazan.
- El guard acepta también `Authorization: Bearer` de WorkOS AuthKit (para el conector MCP de Claude) si se define `WORKOS_AUTHKIT_DOMAIN`.
- Toda entrada se valida con los esquemas Zod de `packages/shared` (campos desconocidos → 400).
- Cada ruta comprueba la membresía del espacio y la cadena proyecto → hito → lista → tarea.
- `helmet`, límite de 120 peticiones/min por cliente y 5/min en `invitations/accept` y `dev-login`.

## Despliegue (Dokploy / Docker)

La configuración aplicada en el repo (Compose, Traefik, variables, builds con `VITE_API_URL`, migraciones Prisma, red `dokploy-network`) está descrita en **[docs/DEPLOY-DOKPLOY.md](docs/DEPLOY-DOKPLOY.md)**.
