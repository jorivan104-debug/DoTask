# DoTask

Aplicación de gestión de tareas en equipo, tipo Microsoft To Do, multiplataforma.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **PWA**: Workbox (vite-plugin-pwa)
- **Móvil**: Capacitor (Android / iOS)
- **Backend**: NestJS + Prisma
- **Base de datos**: PostgreSQL
- **Cache / Colas**: Redis + BullMQ
- **Autenticación**: cuenta de Google (OAuth 2.0 / OpenID Connect) y sesión propia firmada
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
- Un ID de cliente OAuth de Google (tipo «Aplicación web») con la URI de redirección `http://localhost:3000/v1/auth/callback`

### Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar Postgres y Redis (puertos solo en 127.0.0.1)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis

# 3. Configurar variables de entorno
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Editar ambos archivos con tus credenciales de Google, SESSION_SECRET y DB

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
- Login con Google: flujo de código con `state` y PKCE (S256); se verifica el `id_token` y se exige correo verificado. Las cuentas previas se vinculan por correo en el primer acceso.
- Toda entrada se valida con los esquemas Zod de `packages/shared` (campos desconocidos → 400).
- Cada ruta comprueba la membresía del espacio y la cadena proyecto → hito → lista → tarea.
- `helmet`, límite de 120 peticiones/min por cliente y 5/min en `invitations/accept` y `dev-login`.

## Conector de Claude (MCP)

DoTask expone un servidor MCP remoto en `https://api.app-sprint.com/mcp` para añadirlo en Claude como conector personalizado.

- **Lectura** (scope `tasks:read`): `list_workspaces`, `list_projects` (proyectos con hitos y listas), `list_lists`, `list_members`, `list_tasks` (filtros por espacio, lista, estado, fechas, texto y asignadas a mí) y `get_task`.
- **Creación** (scope `tasks:write`): `create_project` (con hito «Backlog» y lista «Tareas», como en la app), `create_milestone`, `create_list` y `create_task` (título, notas, fecha límite, recordatorio, prioridad, responsable —`me`, correo o id de un miembro— y subtareas). Solo crean: no editan ni borran.
- Todo se limita a los espacios del usuario y reutiliza los servicios y esquemas de la API REST, así que Claude puede hacer lo mismo que el usuario en la app y nada más. Si el cliente no pide scopes, se conceden ambos; un token antiguo de solo lectura no ve las herramientas de creación hasta reconectar el conector.
- **Autorización**: servidor OAuth 2.1 propio (Google no admite el registro dinámico de clientes): `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/oauth/register`, `/oauth/authorize` (pide el login con Google y una pantalla «Permitir»), `/oauth/token` (PKCE S256 obligatorio, tokens de 1 h y refresco de 30 días).
- Los tokens son valores firmados con `SESSION_SECRET` (sin tablas nuevas). No se revocan uno a uno: cambiar `SESSION_SECRET` invalida todos (y las sesiones web).
- El token del conector solo sirve en `/mcp`; la API REST sigue exigiendo la cookie de la web.

## Apps de Windows y Android

- **Windows** (`apps/desktop`): Electron que abre la web. Como Google no permite iniciar sesión en ventanas embebidas, el login se hace en el navegador del sistema y vuelve a la app con `dotask://auth` protegido con PKCE (`/v1/auth/login?client=desktop` → `/app/abrir` → `/v1/auth/desktop/exchange`).
- **Android** (`apps/android`): Trusted Web Activity (Chrome a pantalla completa). Requiere `apps/web/public/.well-known/assetlinks.json` con la huella SHA-256 de la clave de firma.
- **Publicación**: `.github/workflows/release-apps.yml` compila ambas y las sube a GitHub Releases al subir una etiqueta `apps-vX.Y.Z`. La página de inicio enlaza a `releases/latest/download/DoTask-Setup.exe` y `DoTask.apk`.
- Secretos de Actions para Android: `ANDROID_KEYSTORE_BASE64` y `ANDROID_KEYSTORE_PASSWORD`. **Guarda una copia de la clave**: sin ella no se pueden publicar actualizaciones que se instalen encima de la app.

## Despliegue (Dokploy / Docker)

La configuración aplicada en el repo (Compose, Traefik, variables, builds con `VITE_API_URL`, migraciones Prisma, red `dokploy-network`) está descrita en **[docs/DEPLOY-DOKPLOY.md](docs/DEPLOY-DOKPLOY.md)**.
