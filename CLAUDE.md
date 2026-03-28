# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LSM (Laboratory Server Management System) v3.1.0 — a full-stack platform for managing lab server resources, GPU allocation, task scheduling, and real-time monitoring.

- **Backend**: Node.js 20 + Express + TypeScript + Prisma (PostgreSQL) + Redis + Socket.IO
- **Frontend**: React 18 + Vite + TypeScript + Ant Design 5 + Zustand + React Query
- **Infrastructure**: Docker Compose, Prometheus + Grafana monitoring
- **Working branch**: `develop` — PRs target `main`

## Commands

### Backend (`src/backend/`)
```bash
npm run dev          # ts-node-dev with auto-reload
npm run build        # TypeScript compilation → dist/
npm run start        # Run production build
npm run lint         # ESLint on src/**/*.ts
npm test             # Jest
npm test -- --testPathPattern=<file>  # Run single test file
npx prisma migrate dev   # Apply DB migrations
npx prisma generate      # Regenerate Prisma client
npx prisma studio        # Open DB browser UI
```

### Frontend (`src/frontend/`)
```bash
npm run dev          # Vite dev server
npm run build        # tsc + vite build
npm run lint         # ESLint on src/**/*.ts,tsx
npm run test         # Vitest (watch mode)
npm run test:run     # Vitest (single run)
npm run test:coverage  # Vitest with coverage
```

### Docker (project root)
```bash
docker-compose up -d          # Start all services (dev)
docker-compose build          # Build images
docker-compose -f docker-compose.prod.yml up -d  # Production
```

Services: `postgres` (5432), `redis` (6379), `backend` (8080), `frontend` (8081), `prometheus` (9090), `grafana` (3000).

## Architecture

### Request Flow
```
Client → Frontend (React/Vite) → Backend API (Express)
                                      ↓
                              Middleware chain:
                              helmet → CORS → rate-limit → CSRF → auth JWT
                                      ↓
                              Routes → Controllers → Services → Prisma/Redis
```

### Backend Structure (`src/backend/src/`)
- **`routes/`** — Route definitions; one file per domain (`auth`, `server`, `gpu`, `task`, `monitoring`, `notification`, `analytics`, `reservation`, `mcp`, `openclaw`, `agent`, etc.)
- **`services/`** — All business logic; 20+ service files. Services own DB calls via Prisma and cache via Redis.
- **`middleware/`** — `security.middleware.ts`, `csrf.middleware.ts`, `auth.middleware.ts`
- **`utils/websocket.ts`** — Socket.IO setup for real-time monitoring and notifications
- **`utils/prisma.ts`** — Shared Prisma client instance
- **`mcp-server/`** — Model Context Protocol integration
- **`scheduler/`** — Cron job handlers; `ai-scheduler/` for intelligent scheduling
- **`prisma/schema.prisma`** — Source of truth for DB schema

### Frontend Structure (`src/frontend/src/`)
- **`pages/`** — Top-level routed views (Dashboard, Server, GPU, Task, Chat, etc.)
- **`components/`** — Reusable UI components organized by domain
- **`services/`** — Axios-based API clients mirroring backend routes
- **`store/`** — Zustand stores for client state
- **`hooks/`** — Custom React hooks (data fetching, WebSocket subscriptions)
- **`i18n/`** — Internationalization config (multi-language support)

### Key Architectural Patterns
- **No global controller layer** — routes call services directly in many cases
- **Service layer owns all DB/cache access** — controllers/routes should not use Prisma directly
- **WebSocket for real-time** — monitoring metrics and notifications pushed via Socket.IO; avoid polling patterns
- **React Query for server state** — use `useQuery`/`useMutation` for API calls, not raw `useEffect` + state
- **Zustand for UI state** — authentication, user preferences, UI toggles

### Special Integrations
- **OpenClaw** (`routes/openclaw.routes.ts`) — Remote operations and orchestration; has security confirmation mechanisms
- **MCP** (`mcp-server/`) — Model Context Protocol for AI/LLM tool integration
- **AI Scheduler** (`services/ai-scheduler/`) — Intelligent GPU/task scheduling
- **Feedback analyzer** — Scheduled service that processes feedback entries

## Environment Configuration

Copy `.env.example` to `.env` for local dev. Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`
- `JWT_SECRET` / `JWT_EXPIRES_IN` (default: 15m)
- `SMTP_*` — Email notification settings
- `CORS_ORIGINS` — Allowed frontend origins
- `SCHEDULER_ENABLED` / `SCHEDULER_INTERVAL_MS`
- `MONITORING_ENABLED`

Production config is in `.env.production` (tracked but gitignored values should be in secrets).

## Testing

- **Backend**: Jest with `__tests__/` directories and `__mocks__/` for test doubles
- **Frontend**: Vitest; test utilities in `src/test/`
- Target coverage: 80%+ (currently 82.5%)

## TypeScript Notes

- **Backend**: `strict: false` — pragmatic for legacy code; avoid tightening globally
- **Frontend**: `strict: true` — enforce types on all new frontend code
- Both target ES2020
