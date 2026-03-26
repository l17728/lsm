# AGENTS.md

Guidance for AI coding agents working in the LSM (Laboratory Server Management System) codebase.

## Project Overview

LSM is a full-stack platform for managing lab server resources, GPU allocation, task scheduling, and real-time monitoring.
- **Backend**: Node.js 20 + Express + TypeScript + Prisma (PostgreSQL) + Redis + Socket.IO
- **Frontend**: React 18 + Vite + TypeScript + Ant Design 5 + Zustand + React Query
- **Working branch**: `develop` — PRs target `main`

---

## Build/Lint/Test Commands

### Backend (`src/backend/`)

```bash
npm run dev          # Development with auto-reload (ts-node-dev)
npm run build        # TypeScript compilation → dist/
npm run start        # Run production build
npm run lint         # ESLint on src/**/*.ts

# Testing
npm test                          # Run all tests
npm test -- --testPathPattern=server.service.test.ts  # Run single test file
npm test -- --coverage            # Run with coverage
```

### Frontend (`src/frontend/`)

```bash
npm run dev          # Vite dev server (port 8081)
npm run build        # tsc + vite build
npm run lint         # ESLint on src/**/*.ts,tsx

# Testing
npm run test         # Vitest watch mode
npm run test:run     # Vitest single run
npm run test:coverage # Vitest with coverage
```

### Docker (project root)

```bash
docker-compose up -d          # Start all services (dev)
docker-compose -f docker-compose.prod.yml up -d  # Production
```

### Prisma

```bash
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma migrate dev   # Apply DB migrations
npx prisma studio        # Open DB browser UI
```

---

## Code Style Guidelines

### TypeScript Configuration

| Aspect | Backend | Frontend |
|--------|---------|----------|
| Strict mode | `false` (pragmatic legacy) | `true` (enforced) |
| Module | CommonJS | ESNext |
| Target | ES2020 | ES2020 |
| JSX | N/A | react-jsx |

**Important**: Frontend enforces strict types. Backend is more permissive but avoid introducing new `any` types.

### Imports Order

1. External packages (React, Express, Ant Design, etc.)
2. Internal services and utilities
3. Types and interfaces

```typescript
// Backend example
import { Router } from 'express';
import { body, param } from 'express-validator';
import serverService from '../services/server.service';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

// Frontend example
import { useEffect, useState } from 'react'
import { Table, Button, message } from 'antd'
import { serverApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Variables/Functions | camelCase | `getAllServers`, `serverId` |
| Classes | PascalCase | `ServerService`, `GpuAllocation` |
| Interfaces/Types | PascalCase | `CreateServerRequest`, `AuthState` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES`, `CLEANUP_INTERVAL` |
| Database columns | snake_case | `created_at`, `gpu_count` |
| API routes | kebab-case | `/api/gpu/allocate` |

### Service Pattern (Backend)

Services are class-based singletons exported as both named and default:

```typescript
// server.service.ts
export class ServerService {
  async getAllServers() { /* ... */ }
}
export const serverService = new ServerService();
export default serverService;
```

### Route Pattern (Backend)

Routes use Express Router with JSDoc comments:

```typescript
/**
 * @route   GET /api/servers
 * @desc    Get all servers
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const servers = await serverService.getAllServers();
    res.json({ success: true, data: servers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Error Handling

**Backend**: Try/catch with JSON response format:
```typescript
res.status(500).json({
  success: false,
  error: error.message,
});
```

**Frontend**: Ant Design `message` for user feedback:
```typescript
try {
  await serverApi.create(data)
  message.success('Server created')
} catch (error: any) {
  message.error('Failed to create server')
}
```

### State Management (Frontend)

Use **Zustand** for client state, **React Query** for server state:

```typescript
// Zustand store pattern
interface AuthState {
  token: string | null
  user: User | null
  login: (token: string, user: User) => void
  logout: () => void
}
export const useAuthStore = create<AuthState>()(
  persist((set) => ({ /* ... */ }), { name: 'auth-storage' })
)
```

---

## Architecture Patterns

### Backend Structure

- **`routes/`** — Route definitions; one file per domain
- **`services/`** — All business logic; services own DB calls via Prisma and cache via Redis
- **`middleware/`** — `auth.middleware.ts`, `security.middleware.ts`, `csrf.middleware.ts`
- **`utils/prisma.ts`** — Shared Prisma client instance
- **`prisma/schema.prisma`** — Source of truth for DB schema

**Key Rules**:
- No global controller layer — routes call services directly
- Service layer owns all DB/cache access — controllers/routes should not use Prisma directly
- WebSocket for real-time (Socket.IO) — avoid polling patterns

### Frontend Structure

- **`pages/`** — Top-level routed views
- **`components/`** — Reusable UI components
- **`services/api.ts`** — Axios-based API clients
- **`store/`** — Zustand stores for client state
- **`hooks/`** — Custom React hooks

---

## Testing Patterns

### Backend Tests (Jest)

```typescript
// Mock at top of file
const mockPrisma = {
  server: { create: jest.fn(), findMany: jest.fn() },
};
jest.mock('../../utils/prisma', () => ({ default: mockPrisma }));

// Helper factory pattern
const makeServer = (overrides = {}) => ({
  id: 'server-1',
  name: 'Test Server',
  ...overrides,
});

// Test structure
describe('ServerService', () => {
  beforeEach(() => jest.clearAllMocks());
  
  it('should create server', async () => {
    mockPrisma.server.create.mockResolvedValue(makeServer());
    // ...
  });
});
```

### Frontend Tests (Vitest)

```typescript
// Setup file: src/test/setup.ts
// Tests: co-located with source or in __tests__ folders
// Run: npm run test:run
```

---

## Database Schema (Prisma)

- UUID primary keys with `uuid_generate_v4()`
- Timestamps: `createdAt`, `updatedAt` with `@default(now())` and `@updatedAt`
- JSON fields for flexible metadata: `metadata Json? @default("{}")`
- Indexes on frequently queried fields

After schema changes:
```bash
npx prisma migrate dev --name description_of_change
npx prisma generate
```

---

## API Response Format

All API responses follow this structure:

```typescript
// Success
{ success: true, data: <payload> }

// Error
{ success: false, error: { code: string, message: string, requestId: string } }
```

Use `requestId` to correlate frontend errors with backend logs.

---

## Key Files to Reference

| Purpose | File |
|---------|------|
| DB Schema | `src/backend/prisma/schema.prisma` |
| API Client | `src/frontend/src/services/api.ts` |
| Auth Store | `src/frontend/src/store/authStore.ts` |
| Auth Middleware | `src/backend/src/middleware/auth.middleware.ts` |
| Sample Service | `src/backend/src/services/server.service.ts` |
| Sample Route | `src/backend/src/routes/server.routes.ts` |
| Sample Page | `src/frontend/src/pages/Servers.tsx` |
| Jest Config | `src/backend/jest.config.js` |
| Vite Config | `src/frontend/vite.config.ts` |