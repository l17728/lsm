# AGENTS.md

Guidance for AI coding agents working in the LSM (Laboratory Server Management System) codebase.

---

## 🚨 最高原则：发现一个错误，解决一类问题

> **这是最高优先级的指导原则，所有代理必须遵循。**

当发现任何 bug、错误或问题时：

1. **不要只修复眼前的单个实例**
2. **必须搜索整个代码库，找出所有类似的模式**
3. **一次性解决整类问题**

### 执行检查清单

```
□ 问题根因是什么？
□ 这个模式在代码库中是否重复出现？
□ 使用 grep/ast-grep 搜索所有类似代码
□ 列出所有需要修复的位置
□ 一次性修复所有实例
□ 运行完整测试验证
□ 更新 .learnings/LEARNINGS.md
```

### 案例：express-validator validationResult

- **发现**: `server.routes.ts` 缺少 `validationResult()` 检查
- **举一反三**: 搜索发现同样问题存在于 `task.routes.ts`, `gpu.routes.ts`, `monitoring.routes.ts`
- **结果**: 一次性修复所有受影响的 11 个路由

---

## Project Overview

LSM is a full-stack platform for managing lab server resources, GPU allocation, task scheduling, and real-time monitoring.
- **Backend**: Node.js 20 + Express + TypeScript + Prisma (PostgreSQL) + Redis + Socket.IO
- **Frontend**: React 18 + Vite + TypeScript + Ant Design 5 + Zustand + React Query
- **Working branch**: `develop` — PRs target `main`

---

## ⚠️ CRITICAL: Windows Local Deployment Configuration

> **READ THIS FIRST** if setting up or troubleshooting local development environment on Windows.

### Current Configuration (Port 5432)

The project uses these ports. **Verify they match before debugging connection issues:**

| Service | Port | Check Command |
|---------|------|---------------|
| PostgreSQL | 5432 | `netstat -ano \| findstr :5432` |
| Redis | 6379 | `netstat -ano \| findstr :6379` |
| Backend API | 8080 | `netstat -ano \| findstr :8080` |
| Frontend | 8081 | `netstat -ano \| findstr :8081` |

### Configuration Files to Check

1. **Backend .env** (`src/backend/.env`):
   ```env
   DATABASE_URL=postgresql://postgres:postgre@localhost:5432/lsm
   ```

2. **Prisma Schema** (`src/backend/prisma/schema.prisma`):
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = "postgresql://postgres:postgre@localhost:5432/lsm"
   }
   ```

3. **Frontend .env** (`src/frontend/.env`):
   ```env
   VITE_API_BASE_URL=http://localhost:8080/api
   VITE_WS_URL=ws://localhost:8080
   ```

### Common Issues & Solutions

| Issue | Detection | Solution |
|-------|-----------|----------|
| **Multiple PostgreSQL instances** | `netstat -ano \| findstr :543` shows 2+ ports | Choose ONE instance, update all config files |
| **Database migration P3005** | "Database schema is not empty" | `npx prisma migrate resolve --applied <migration_name>` |
| **Frontend .env missing** | File doesn't exist | Create from template above |
| **Port mismatch** | Config says 5433, service on 5432 | Update config files to match actual port |

### Pre-Configuration Checklist

```powershell
# Run these BEFORE starting configuration
netstat -ano | findstr ":5432 :6379 :8080 :8081"  # Check actual ports
tasklist | findstr -i postgres                     # Check PG instances
tasklist | findstr -i redis                        # Check Redis
```

### Multiple Database Instances Warning

**CRITICAL**: Windows may have multiple PostgreSQL instances running. ALWAYS:
1. Check with `netstat -ano | findstr :543`
2. Confirm with user which instance to use
3. Update ALL config files consistently (`.env`, `schema.prisma`)
4. Clean up unused instances: `taskkill /PID <pid> /F`

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