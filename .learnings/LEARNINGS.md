# LSM Project Learnings

## 🚨 最高原则 (HIGHEST PRIORITY PRINCIPLE)

## [LRN-0000-0000-PRINCIPLE] 发现一个错误解决一类问题

**Priority**: CRITICAL
**Status**: permanent
**Area**: all

### Summary
**发现一个错误时，必须举一反三，查找并修复同类问题，而非仅修复单个实例**

### Details

这是代码质量和效率的最高原则。当发现一个 bug 或问题时：

1. **不要只修复眼前的单个问题**
2. **必须搜索整个代码库，找出所有类似的模式**
3. **一次性解决整类问题**

### 实际案例

**2026-03-27 修复 ValidationResult 问题:**

1. **发现**: `server.routes.test.ts` 测试失败，原因是 UUID 验证问题
2. **深入调查**: 发现 `server.routes.ts` 定义了验证规则但没有 `validationResult()` 检查
3. **举一反三**: 搜索所有路由文件，发现同样问题存在于：
   - `task.routes.ts` (7 个路由)
   - `gpu.routes.ts` (3 个路由)
   - `monitoring.routes.ts` (1 个路由)
4. **一次性修复**: 修复所有受影响的文件
5. **验证**: 运行完整测试套件确认修复

**如果不举一反三的后果:**
- 其他路由文件仍然存在漏洞
- 后续可能再次遇到相同错误
- 安全风险持续存在

### 执行检查清单

当发现任何错误时，必须执行：

```
□ 问题根因是什么？
□ 这个模式在代码库中是否重复出现？
□ 搜索所有类似代码：grep/ast-grep/全局搜索
□ 列出所有需要修复的位置
□ 一次性修复所有实例
□ 更新学习记录
□ 考虑添加自动化检查防止复发
```

### 搜索工具优先级

1. `grep` / `rg` - 文本模式搜索
2. `ast-grep` - AST 结构化搜索
3. `glob` - 文件名模式
4. `librarian` - 外部资源搜索
5. `explore` agent - 代码库探索

### Metadata
- Source: hard_earned_experience
- Tags: principle, best-practice, efficiency, quality, security
- See Also: LRN-20260327-002, LRN-20260327-005

---

## [LRN-20260325-001] JWT Refresh Token Implementation

**Logged**: 2026-03-25T17:15:00+08:00
**Priority**: high
**Status**: resolved
**Area**: backend, frontend, tests

### Summary
Complete JWT refresh token implementation with logging, rotation, and comprehensive test coverage

### Details
Successfully implemented JWT refresh token mechanism for the LSM project:

**Backend Changes:**
1. Updated Prisma schema to add `refreshToken` and `refreshExpiresAt` fields to Session model
2. Added `refreshToken()` method to AuthService with token rotation (new refresh token on each refresh)
3. Added `revokeRefreshToken()` and `cleanupExpiredSessions()` methods
4. Added comprehensive logging using `safeLogger` for all auth operations
5. Modified login to return both access token (15min) and refresh token (7 days)

**Frontend Changes:**
1. Updated `authStore.ts` to include `refreshToken` state and `updateTokens()` action
2. Enhanced `api.ts` with automatic token refresh on 401 responses
3. Implemented request queue to handle concurrent requests during refresh
4. Updated Login.tsx to store refresh token on successful login

**Test Coverage Added:**
1. Backend unit tests: 6 tests for refresh token functionality
2. Backend integration tests: 8 tests for /api/auth/refresh endpoint
3. Frontend unit tests: 14 tests for API client token refresh logic
4. E2E tests: 15 tests for token refresh flow scenarios

### Key Decisions
- Token rotation: Each refresh generates new access AND refresh tokens (old refresh token invalidated)
- Access token expiry: 15 minutes
- Refresh token expiry: 7 days
- Logging: Use `safeLogger` which automatically masks sensitive fields like tokens

### Suggested Action
Consider adding refresh token reuse detection to identify potential token theft

### Metadata
- Source: implementation
- Related Files: 
  - src/backend/src/services/auth.service.ts
  - src/backend/src/routes/auth.routes.ts
  - src/backend/prisma/schema.prisma
  - src/frontend/src/services/api.ts
  - src/frontend/src/store/authStore.ts
- Tags: jwt, authentication, security, refresh-token, token-rotation

---

## [LRN-20260325-002] Pre-existing Test Issues

**Logged**: 2026-03-25T17:15:00+08:00
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
Several pre-existing test issues discovered during testing phase

### Details

**Issue 1: MCP Server Tests Stack Overflow**
- Location: `src/mcp-server/__tests__/gpu.test.ts` and `tasks.test.ts`
- Cause: Circular dependency in Jest mock setup with `require()` pattern
- Error: `RangeError: Maximum call stack size exceeded`

**Issue 2: Frontend Page Tests Missing Dependency**
- Location: All frontend page tests in `src/pages/__tests__/`
- Error: `Cannot find module '@testing-library/dom'`
- Cause: Missing peer dependency

**Issue 3: Auth Validation Middleware**
- Tests `should reject login with missing fields` and `should reject invalid role` fail
- Cause: Validation middleware doesn't properly validate all edge cases
- Status: Pre-existing issue, not related to refresh token changes

### Suggested Action
1. Fix MCP server test mocks - use jest.mock() at module level
2. Install @testing-library/dom in frontend
3. Review validation middleware for edge cases

### Metadata
- Source: testing
- Related Files: 
  - src/mcp-server/__tests__/*.test.ts
  - src/pages/__tests__/*.test.tsx
  - src/backend/src/middleware/validation.middleware.ts
- Tags: tests, mocking, dependencies

---

## [LRN-20260325-003] SafeLogger Pattern for Security

**Logged**: 2026-03-25T17:15:00+08:00
**Priority**: high
**Status**: resolved
**Area**: backend, security

### Summary
Use `safeLogger` from `logging.middleware.ts` for all security-sensitive operations

### Details
The project has a `SafeLogger` class that automatically masks sensitive fields including:
- passwords, passwordHash, newPassword, oldPassword
- token, accessToken, refreshToken
- jwtSecret, secret, apiKey
- authorization, cookie, session

This prevents accidental logging of sensitive data.

**Correct Usage:**
```typescript
import { safeLogger } from '../middleware/logging.middleware';

safeLogger.info('Login successful', { userId, username });
safeLogger.warn('Login failed', { username, reason });
safeLogger.error('Auth error', { operation: 'refresh', error });
```

**Incorrect Usage:**
```typescript
console.log(`Token: ${token}`); // NEVER do this
```

### Suggested Action
Review all authentication and security-related code to ensure `safeLogger` is used consistently

### Metadata
- Source: best_practice
- Related Files: src/backend/src/middleware/logging.middleware.ts
- Tags: security, logging, pii, masking

---

## [LRN-20260326-001] Multiple PostgreSQL Instances Detection

**Logged**: 2026-03-26T14:30:00+08:00
**Priority**: critical
**Status**: resolved
**Area**: config, infra

### Summary
ALWAYS check for multiple running instances before assuming database connection issues

### Details
When configuring the project, discovered TWO PostgreSQL instances running simultaneously:
- Port 5432: System service (PID 23208) - the one being used
- Port 5433: User directory instance (PID 5916) - manually created during troubleshooting

The `.env` and `schema.prisma` were configured for port 5433, but the actual working instance was on 5432.

**Root Cause**: Previous troubleshooting session left a manual PostgreSQL instance running, and configuration files were updated to point to it, but later the system service was used.

**Detection Command:**
```powershell
# Check all PostgreSQL ports
netstat -ano | findstr ":5432 :5433 :5434"

# Check PostgreSQL processes
tasklist | findstr -i postgres
```

### Critical Lessons
1. **Always verify actual port before modifying config** - Don't assume, check with `netstat`
2. **Document instance selection** - When multiple instances exist, clearly document which one to use
3. **Clean up troubleshooting artifacts** - Remove temporary instances/services after debugging
4. **Ask user which instance to use** - When multiple exist, don't guess

### Suggested Action
Add a pre-flight check script to detect multiple database instances

### Metadata
- Source: troubleshooting
- Related Files: 
  - src/backend/.env
  - src/backend/prisma/schema.prisma
  - .sisyphus/learning/WINDOWS_DEPLOYMENT_CHECKLIST.md
- Tags: postgresql, multiple-instances, configuration, ports
- See Also: LRN-20260325-001 (Windows deployment experience)

---

## [LRN-20260326-002] Prisma Migration Baseline for Existing Database

**Logged**: 2026-03-26T14:45:00+08:00
**Priority**: high
**Status**: resolved
**Area**: backend, database

### Summary
For databases with existing data but missing migration records, use `prisma migrate resolve --applied` NOT `prisma migrate deploy`

### Details
When running `npx prisma migrate deploy`, got error:
```
Error: P3005
The database schema is not empty. Read more about how to baseline an existing production database
```

This happens when:
- Database already has tables/data
- `_prisma_migrations` table is missing or incomplete
- Migrations exist in `prisma/migrations/` but weren't tracked

**Wrong Approach:**
```bash
npx prisma migrate deploy  # Fails with P3005
npx prisma migrate dev     # May cause issues in production
```

**Correct Approach:**
```bash
# Mark each migration as already applied
npx prisma migrate resolve --applied 20260313000000_init
npx prisma migrate resolve --applied 20260314183050_add_reservation_system
npx prisma migrate resolve --applied 20260325000000_add_refresh_token
```

### Decision Tree
```
Database state?
├─ Empty → npx prisma migrate deploy
├─ Has data + migrations applied → Check with npx prisma migrate status
└─ Has data + missing migration records → npx prisma migrate resolve --applied <migration_name>
```

### Suggested Action
Add this to troubleshooting guide for Prisma migrations

### Metadata
- Source: troubleshooting
- Related Files: src/backend/prisma/migrations/
- Tags: prisma, migration, baseline, existing-database
- See Also: https://pris.ly/d/migrate-baseline

---

## [LRN-20260326-003] Frontend .env File Often Missing

**Logged**: 2026-03-26T14:50:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend, config

### Summary
Frontend `.env` file is NOT tracked in git and may be missing after clone/pull

### Details
The `src/frontend/.env` file is typically in `.gitignore`, so it won't exist after:
- Fresh clone
- Pulling from another machine
- Initial setup

**Required frontend .env content:**
```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8080/api

# WebSocket Configuration
VITE_WS_URL=ws://localhost:8080

# Environment
VITE_APP_ENV=development
```

**Pre-flight Check:**
```powershell
# Check if frontend .env exists
if (-not (Test-Path "src/frontend/.env")) {
    Write-Host "Missing src/frontend/.env - creating..."
    # Create the file
}
```

### Suggested Action
1. Add `.env.example` file to `src/frontend/` for reference
2. Add check in setup script to create .env if missing
3. Document required environment variables in README

### Metadata
- Source: configuration
- Related Files: 
  - src/frontend/.env
  - src/frontend/.gitignore
- Tags: frontend, env, configuration, vite
- See Also: LRN-20260325-001

---

## [LRN-20260326-004] Configuration Port Mismatch Detection

**Logged**: 2026-03-26T15:00:00+08:00
**Priority**: high
**Status**: resolved
**Area**: config

### Summary
Configuration files must match actual running service ports - verify with netstat before assuming connection issues

### Details
When debugging connection issues, the configuration showed port 5433 but the service was actually running on 5432. This caused wasted time investigating wrong causes.

**Pre-configuration Checklist:**
```
1. Check what ports services are ACTUALLY running on:
   netstat -ano | findstr ":5432 :6379 :8080 :8081"

2. Verify .env files match actual ports:
   - src/backend/.env → DATABASE_URL port
   - src/backend/prisma/schema.prisma → datasource url port
   - src/frontend/.env → VITE_API_BASE_URL port

3. Cross-reference all config files use same values
```

### Suggested Action
Create a configuration validation script that checks consistency across all config files

### Metadata
- Source: troubleshooting
- Related Files: 
  - src/backend/.env
  - src/backend/prisma/schema.prisma
  - src/frontend/.env
- Tags: configuration, ports, consistency, netstat
- See Also: LRN-20260326-001

---

## [LRN-20260327-001] UUID Validation Format in Tests

**Logged**: 2026-03-27T11:20:00+08:00
**Priority**: high
**Status**: resolved
**Area**: tests, backend

### Summary
express-validator 的 `isUUID()` 要求有效的 UUID 版本格式，全零 UUID 格式会被拒绝

### Details
测试使用的 UUID `00000000-0000-0000-0000-000000000001` 被 express-validator 的 `isUUID()` 验证器拒绝，导致返回 400 错误。

**问题原因:**
- UUID 第3段（版本位）应包含 `1-5` 的版本号
- `00000000-0000-0000-0000-...` 第3段是 `0000`，无版本号
- express-validator 使用 `validator.js` 的 `isUUID()` 方法，默认检查版本

**有效 UUID 格式:**
```typescript
// ❌ 错误 - 无版本号
'00000000-0000-0000-0000-000000000001'

// ✅ 正确 - UUID v4 格式
'550e8400-e29b-41d4-a716-446655440001'
//             ^^^^ 第3段以 4 开头表示 v4

// ✅ 其他有效格式
'6ba7b810-9dad-11d1-80b4-00c04fd430c8'  // v1
'6ba7b811-9dad-21d1-80b4-00c04fd430c8'  // v2
'6ba7b812-9dad-31d1-80b4-00c04fd430c8'  // v3
'6ba7b814-9dad-41d1-80b4-00c04fd430c8'  // v4
'6ba7b815-9dad-51d1-80b4-00c04fd430c8'  // v5
```

**修复示例:**
```typescript
// 测试中使用的 UUID 应该符合 v4 格式
const validUUID = '550e8400-e29b-41d4-a716-446655440001';
```

### Suggested Action
搜索项目中所有测试文件，确保 UUID 格式正确

### Metadata
- Source: debugging
- Related Files: 
  - src/backend/src/__tests__/integration/server.routes.test.ts
  - src/backend/src/routes/server.routes.ts
- Tags: uuid, validation, express-validator, testing
- See Also: LRN-20260327-002

---

## [LRN-20260327-002] express-validator Requires Explicit validationResult Check

**Logged**: 2026-03-27T11:20:00+08:00
**Priority**: high
**Status**: resolved
**Area**: backend, tests

### Summary
express-validator 的验证中间件不会自动返回 400 错误，必须在路由处理函数中显式调用 `validationResult(req)` 检查

### Details
添加了验证中间件后，期望验证失败时自动返回 400 错误，但实际上验证器只是标记错误，不会自动中断请求。

**错误理解:**
```typescript
// ❌ 错误 - 以为验证失败会自动返回 400
router.patch('/:id/status', 
  requireManager,
  [
    param('id').isUUID().withMessage('Valid server ID required'),
    body('status').isIn(['ONLINE', 'OFFLINE']).withMessage('Invalid status'),
  ],
  async (req, res) => {
    // 验证失败时这里仍然会被执行！
    const server = await serverService.updateServerStatus(id, status);
    res.json({ success: true, data: server });
  }
);
```

**正确实现:**
```typescript
// ✅ 正确 - 显式检查验证结果
router.patch('/:id/status', 
  requireManager,
  [
    param('id').isUUID().withMessage('Valid server ID required'),
    body('status').isIn(['ONLINE', 'OFFLINE']).withMessage('Invalid status'),
  ],
  async (req, res) => {
    // 必须显式检查！
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg,
      });
    }
    // 验证通过后才执行业务逻辑
    const server = await serverService.updateServerStatus(id, status);
    res.json({ success: true, data: server });
  }
);
```

### Key Points
1. 验证中间件只是标记错误，不会自动返回响应
2. 必须在处理函数开头调用 `validationResult(req)`
3. 返回第一个错误信息：`errors.array()[0].msg`
4. 使用 `return` 确保不继续执行后续代码

### Suggested Action
审查所有使用 express-validator 的路由，确保都有 validationResult 检查

### Metadata
- Source: debugging
- Related Files: 
  - src/backend/src/routes/server.routes.ts
  - src/backend/src/routes/*.routes.ts
- Tags: express-validator, validation, middleware, express

---

## [LRN-20260327-003] Express Route Order Matters for Dynamic Parameters

**Logged**: 2026-03-27T11:20:00+08:00
**Priority**: high
**Status**: resolved
**Area**: backend

### Summary
Express 路由按定义顺序匹配，动态参数路由（如 `/:id`）会匹配所有路径，包括 `/batch`

### Details
当 `/batch` 路由定义在 `/:id` 路由之后时，请求 `/api/servers/batch` 会被 `/:id` 匹配（`id='batch'`），导致错误。

**错误顺序:**
```typescript
// ❌ 错误 - /batch 会被 /:id 拦截
router.get('/:id', ...);        // 匹配所有 /xxx
router.delete('/:id', ...);     // 匹配所有 /xxx
router.delete('/batch', ...);   // 永远不会被执行！
router.patch('/batch/status', ...); // 永远不会被执行！
```

**正确顺序:**
```typescript
// ✅ 正确 - 静态路由在动态参数路由之前
router.get('/stats', ...);          // 静态
router.get('/available', ...);      // 静态
router.delete('/batch', ...);       // 静态 - 在 /:id 之前！
router.patch('/batch/status', ...); // 静态 - 在 /:id 之前！
router.get('/:id', ...);            // 动态 - 最后定义
router.put('/:id', ...);            // 动态
router.delete('/:id', ...);         // 动态
```

### Route Matching Rules
1. Express 按定义顺序从上到下匹配
2. 第一个匹配的路由处理请求
3. `:id` 匹配任何字符串，包括 `batch`、`stats` 等
4. 静态路径必须定义在动态参数路径之前

### Suggested Action
审查所有路由文件，确保静态路由在动态参数路由之前

### Metadata
- Source: debugging
- Related Files: 
  - src/backend/src/routes/server.routes.ts
  - src/backend/src/routes/*.routes.ts
- Tags: express, routing, order, dynamic-parameters

---

## [LRN-20260327-004] Test Data Must Match Validation Rules

**Logged**: 2026-03-27T11:20:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
测试数据必须包含所有必需字段，否则会因验证失败而非业务逻辑问题导致测试失败

### Details
创建服务器的测试缺少 `cpuCores` 和 `totalMemory` 字段，导致 express-validator 返回 400 错误。

**错误测试数据:**
```typescript
// ❌ 缺少必需字段
.send({ name: 'Test Server', hostname: 'srv01.local', ipAddress: '10.0.0.1' });
```

**正确测试数据:**
```typescript
// ✅ 包含所有必需字段
.send({ 
  name: 'Test Server', 
  hostname: 'srv01.local', 
  ipAddress: '10.0.0.1', 
  cpuCores: 8, 
  totalMemory: 64 
});
```

### Best Practices
1. 查看路由的验证规则了解必需字段
2. 使用工厂函数创建测试数据
3. 添加注释说明每个字段的用途

### Suggested Action
创建测试数据工厂函数，统一管理测试数据

### Metadata
- Source: debugging
- Related Files: 
  - src/backend/src/__tests__/integration/api.test.ts
  - src/backend/src/routes/server.routes.ts
- Tags: testing, validation, test-data

---

## [LRN-20260327-005] Missing validationResult Check in Multiple Routes

**Logged**: 2026-03-27T11:30:00+08:00
**Priority**: high
**Status**: pending
**Area**: backend, security

### Summary
多个路由文件定义了 express-validator 验证规则但未调用 `validationResult()` 检查，导致验证规则无效

### Details
审查发现以下路由文件定义了验证规则但未检查验证结果：

**受影响的路由文件:**
1. `task.routes.ts` - 定义了 UUID 验证但未检查
2. `reservation.routes.ts` - 需要检查
3. `gpu.routes.ts` - 需要检查
4. 其他使用 `param('id').isUUID()` 的路由

**问题示例:**
```typescript
// ❌ 错误 - 定义了验证但未检查
router.put('/:id',
  [
    param('id').isUUID().withMessage('Valid task ID required'),
    body('name').optional().isLength({ min: 1 }),
  ],
  async (req, res) => {
    // 验证失败时这里仍然会被执行！
    const task = await taskService.updateTask(id, data, userId);
    res.json({ success: true, data: task });
  }
);
```

**影响:**
- 无效的 ID 格式会被接受
- 安全漏洞：攻击者可以传入任意字符串
- 数据完整性风险

### Suggested Action
1. 审查所有路由文件，确保验证规则都有对应的 `validationResult()` 检查
2. 更新测试使用有效的 UUID 格式
3. 添加自动化检查来捕获这类问题

### Metadata
- Source: code_review
- Related Files: 
  - src/backend/src/routes/task.routes.ts
  - src/backend/src/routes/reservation.routes.ts
  - src/backend/src/routes/gpu.routes.ts
  - src/backend/src/routes/*.routes.ts
- Tags: express-validator, validation, security, bug
- See Also: LRN-20260327-002

### Resolution
- **Resolved**: 2026-03-27T12:00:00+08:00
- **Files Fixed**: 
  - src/backend/src/routes/task.routes.ts (7 routes)
  - src/backend/src/routes/gpu.routes.ts (3 routes)
  - src/backend/src/routes/monitoring.routes.ts (1 route)
  - src/backend/src/routes/alert-rules.routes.ts (route order)
- **Notes**: 添加了 `validationResult` 检查到所有定义验证规则的路由

---

## [LRN-20260327-006] Route Order Fix in alert-rules.routes.ts

**Logged**: 2026-03-27T11:30:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: backend

### Summary
`alert-rules.routes.ts` 中 `/metrics` 路由在 `/:id` 之后定义，导致路由冲突

### Details
发现并修复了 `alert-rules.routes.ts` 中的路由顺序问题：

**问题:**
- Line 31: `router.get('/:id', ...)` - 动态参数路由
- Line 188: `router.get('/metrics', ...)` - 静态路由在动态路由之后

这意味着 `/api/alert-rules/metrics` 会被 `/:id` 匹配（id='metrics'），导致错误。

**修复:**
将 `/metrics` 路由移到 `/:id` 之前，并添加注释说明路由顺序的重要性。

### Metadata
- Source: code_review
- Related Files: src/backend/src/routes/alert-rules.routes.ts
- Tags: express, routing, order, fix
- See Also: LRN-20260327-003