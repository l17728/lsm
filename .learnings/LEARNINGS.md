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

---

## [LRN-20260327-008] CRITICAL: Not Applying "Fix One, Fix All" Principle

**Logged**: 2026-03-27T16:20:00+08:00
**Priority**: critical
**Status**: pending
**Area**: workflow, quality

### Summary
**发现中文文本问题时，只修复了 Clusters.tsx，没有检查其他页面。这违反了"发现一个错误，解决一类问题"的最高原则。**

### Details
用户报告"预约审批在英文下仍然显示中文"。我修复了 `Clusters.tsx` 中的中文文本，但**没有举一反三检查其他页面**。

**结果**: 其他 7 个页面仍有 200+ 行中文文本：
- ClusterApproval.tsx - 45 行
- Settings.tsx - 61 行
- Users.tsx - 33 行
- Servers.tsx - 32 行
- Tasks.tsx - 27 行
- Reservations.tsx - 13 行
- Dashboard.tsx - 6 行

**根本问题**: 没有执行举一反三的搜索步骤。

### 举一反三检查清单

当发现任何问题时，必须执行：

```
□ 1. 问题根因是什么？
□ 2. 这个模式在代码库中是否重复出现？
□ 3. 使用 grep/搜索工具查找所有类似代码
□ 4. 列出所有需要修复的位置
□ 5. 一次性修复所有实例
```

### 本次遗漏的检查命令

```bash
# 查找所有页面中的中文文本
cd src/frontend && node -e "
const fs = require('fs');
const pages = fs.readdirSync('src/pages').filter(f => f.endsWith('.tsx'));
pages.forEach(file => {
  const content = fs.readFileSync('src/pages/' + file, 'utf8');
  const chineseLines = content.split('\\n').filter(l => l.match(/[\u4e00-\u9fff]/));
  if (chineseLines.length > 0) {
    console.log(file + ': ' + chineseLines.length + ' lines with Chinese');
  }
});
"
```

### Suggested Action
1. 修复所有页面的中文文本
2. 将举一反三检查添加到 AGENTS.md 工作流程

### Metadata
- Source: self_review
- Related Files: src/frontend/src/pages/*.tsx
- Tags: principle, i18n, chinese-text, missed-coverage
- See Also: LRN-0000-0000-PRINCIPLE

---

## [LRN-20260327-007] CRITICAL: Claiming Completion Without Verification

**Logged**: 2026-03-27T13:00:00+08:00
**Priority**: critical
**Status**: pending
**Area**: workflow, testing, quality

### Summary
**声称完成了功能修改，但没有验证修改是否真正生效。用户指出"需求没有实现"，但我之前声称已完成。**

### Details

**错误行为:**
1. 修改了代码文件
2. 提交了 git commit
3. 声称 "✅ 功能已添加"
4. **但没有验证修改是否真正生效！**

**根本原因:**
- 没有运行前端构建/热更新验证修改
- 没有实际测试 UI 交互
- 没有运行 e2e 测试验证功能
- 过度自信，过早宣布完成
- 只修改了代码，没有考虑依赖注入、模块导出等问题

**后果:**
- 用户信任受损
- 浪费用户时间去验证本应已完成的工作
- 代码可能根本无法运行（语法错误、逻辑错误、模块未正确导出）

**具体案例 - 集群服务器管理:**
- 修改了 `Clusters.tsx`，添加了 `ManageServers` Modal
- 但前端服务可能没有热更新
- 没有实际打开浏览器验证 UI 是否正确显示
- 没有测试添加/删除服务器功能是否正常工作

### 必须遵循的验证流程

```
代码修改后必须:

□ 1. 检查 TypeScript 编译错误 (npm run build 或 tsc --noEmit)
□ 2. 检查 LSP diagnostics 
□ 3. 如果修改了前端，验证前端服务已重启/热更新
□ 4. 如果修改了后端，验证后端服务已重启
□ 5. 实际测试 UI 交互（或运行 e2e 测试）
□ 6. 在声称完成前，必须有实际证据（截图、测试结果、API 响应）
```

### E2E 测试的重要性

**e2e 测试是发现功能缺失的最佳方式：**
- 可以自动化验证用户交互流程
- 可以发现 UI 元素不存在、按钮不可点击等问题
- 可以验证 API 端点是否正确响应
- 可以在 CI/CD 中自动运行

**缺失的 e2e 测试用例应该覆盖:**
- 用户登录后能看到正确的功能
- 点击按钮后能看到预期的 UI 变化
- 表单提交后能正确处理数据
- 权限控制是否正确（不同角色看到不同 UI）

### Suggested Action

1. **立即**: 为所有声称已完成的功能添加 e2e 测试验证
2. **流程**: 在 AGENTS.md 中添加验证流程要求
3. **自动化**: 确保 CI/CD 中运行完整的 e2e 测试套件

### Metadata
- Source: user_correction
- Related Files:
  - src/frontend/src/pages/Clusters.tsx
  - e2e/tests/*.spec.ts
- Tags: verification, e2e-testing, workflow, quality, critical
- See Also: LRN-0000-0000-PRINCIPLE (最高原则)

---

## [LRN-20260327-009] CRITICAL: Missing API Import Causes Runtime Error

**Logged**: 2026-03-27T18:00:00+08:00
**Priority**: critical
**Status**: resolved
**Area**: frontend, imports, testing

### Summary
**`Clusters.tsx` 使用了 `authApi.getUsers()` 但没有导入 `authApi`，导致运行时错误 `authApi is not defined`，集群页面无法加载数据。这是一个反复出现的问题！**

### Details

**问题代码:**
```typescript
// 第 25 行 - 只导入了部分 API
import { clusterApi, clusterReservationApi } from '../services/api'

// 第 223 行 - 使用了未导入的 authApi
authApi.getUsers().catch(() => ({ data: { data: [] } })),
```

**错误现象:**
- 浏览器控制台: `ReferenceError: authApi is not defined`
- 集群页面: 数据加载失败，显示空白或错误
- 用户无法看到责任人选择下拉框

**根本原因:**
1. 开发时添加了新 API 调用 (`authApi.getUsers()`)
2. 忘记在文件顶部添加对应的 import
3. TypeScript 编译时没有报错（因为 `authApi` 类型存在于 `api.ts`）
4. 运行时报错

**这是第 N 次发生类似问题！**

### 问题模式

| 次数 | 文件 | 缺失导入 | 影响 |
|------|------|----------|------|
| 1 | Clusters.tsx | `authApi` | 集群数据加载失败 |
| 2 | (之前) | `reservationApi` | 预约页面刷新 |
| 3 | (之前) | 其他 API | 其他功能异常 |

### 为什么 TypeScript 没有捕获？

TypeScript 只检查类型，不会检查运行时变量是否存在。如果 `api.ts` 导出了 `authApi`，TypeScript 会认为它是有效的，即使当前文件没有导入它。

### 修复方案

**1. 添加缺失的导入:**
```typescript
// ✅ 正确 - 导入所有使用的 API
import { clusterApi, clusterReservationApi, authApi } from '../services/api'
```

**2. 创建自动化测试防止复发:**

创建了 `src/frontend/src/__tests__/import-completeness.test.ts`，自动检查所有页面的 API 导入完整性：

```typescript
// 测试会检查：
// 1. 所有 xxxApi. 使用模式
// 2. 对应的 import 语句
// 3. 报告缺失的导入

it('Clusters.tsx should import all used APIs', () => {
  const usedApis = extractApiUsage(content)  // ['clusterApi', 'clusterReservationApi', 'authApi']
  const importedApis = extractApiImports(content)  // 应该匹配
  const missingImports = [...usedApis].filter(api => !importedApis.has(api))
  expect(missingImports).toHaveLength(0)
})
```

**3. 测试覆盖 33 个文件:**
- 15 个页面文件
- 18 个组件文件

### 预防措施

**添加新 API 调用时必须:**
```
□ 1. 确认 API 在 api.ts 中存在
□ 2. 在文件顶部添加 import
□ 3. 运行 import-completeness.test.ts 验证
□ 4. 实际测试页面功能
```

### 检测命令

```bash
# 运行导入完整性测试
cd src/frontend && npm run test:run -- src/__tests__/import-completeness.test.ts

# 手动检查特定文件
grep -n "Api\." src/pages/Clusters.tsx  # 查找 API 使用
grep -n "import.*Api" src/pages/Clusters.tsx  # 查找 API 导入
```

### Metadata
- Source: debugging, user_report
- Related Files:
  - src/frontend/src/pages/Clusters.tsx
  - src/frontend/src/services/api.ts
  - src/frontend/src/__tests__/import-completeness.test.ts
- Tags: imports, runtime-error, testing, automation, recurring-issue
- See Also: LRN-0000-0000-PRINCIPLE (最高原则: 举一反三)

---

## [LRN-20260327-010] CRITICAL: Hardcoded Chinese Text in UI Components

**Logged**: 2026-03-27T18:15:00+08:00
**Priority**: critical
**Status**: pending
**Area**: frontend, i18n, testing

### Summary
**大量组件包含硬编码中文文本，未使用 i18n 国际化。这导致英文界面下仍显示中文。这是反复出现的问题！**

### Details

**问题现象:**
- 英文界面下，侧边栏显示"预约审批"而非"Cluster Approval"
- 多个组件包含硬编码中文文本

**受影响的组件 (测试检测结果):**

| 组件 | 中文文本数 | 状态 |
|------|-----------|------|
| ErrorDetails.tsx | 33 | ❌ 需修复 |
| CalendarView.tsx | 22 | ❌ 需修复 |
| BatchProgressBar.tsx | 17 | ❌ 需修复 |
| AdvancedSearch.tsx | 16 | ❌ 需修复 |
| ReservationCard.tsx | 15 | ❌ 需修复 |
| ErrorDisplay.tsx | 14 | ❌ 需修复 |
| NotificationCenter.tsx | 13 | ❌ 需修复 |
| ChatWindow.tsx | 12 | ❌ 需修复 |
| ConfirmDialog.tsx | 12 | ❌ 需修复 |
| ChatInput.tsx | 15 | ❌ 需修复 |

### 已创建的测试

**文件**: `src/frontend/src/__tests__/i18n-completeness.test.ts`

```typescript
// 测试会检查：
// 1. 所有页面和组件的中文硬编码文本
// 2. 关键组件 (Sidebar, Header) 零容忍
// 3. i18n 键的完整性 (en.json 和 zh.json 匹配)

describe('i18n Completeness', () => {
  // 检查页面
  // 检查组件
  // 关键组件零容忍
  // i18n 键覆盖
})
```

### 正确的国际化方式

**错误:**
```typescript
// ❌ 硬编码中文
label: '预约审批',
placeholder: '输入消息...'
```

**正确:**
```typescript
// ✅ 使用 i18n
import { useTranslation } from 'react-i18next'

const { t } = useTranslation()
label: t('navigation.clusterApproval'),
placeholder: t('chat.inputPlaceholder')
```

### 预防措施

**添加 UI 文本时必须:**
```
□ 1. 在 en.json 和 zh.json 中添加对应的 key
□ 2. 使用 t('key') 而非硬编码文本
□ 3. 运行 i18n-completeness.test.ts 验证
□ 4. 切换语言验证显示正确
```

### 检测命令

```bash
# 运行 i18n 完整性测试
cd src/frontend && npm run test:run -- src/__tests__/i18n-completeness.test.ts

# 手动检查中文文本
grep -rn "[\u4e00-\u9fff]" src/pages/*.tsx src/components/*.tsx
```

### Suggested Action

1. 逐步修复各组件的中文文本
2. 将测试加入 CI/CD 流程
3. 新增 UI 文本时强制要求国际化

### Metadata
- Source: debugging, user_report, testing
- Related Files:
  - src/frontend/src/components/*.tsx
  - src/frontend/src/pages/*.tsx
  - src/frontend/src/__tests__/i18n-completeness.test.ts
  - src/frontend/src/i18n/locales/en.json
  - src/frontend/src/i18n/locales/zh.json
- Tags: i18n, chinese-text, testing, automation, recurring-issue
- See Also: LRN-0000-0000-PRINCIPLE, LRN-20260327-008

---

## [LRN-20260328-001] CRITICAL: Undefined Property Access Crashes Pages

**Logged**: 2026-03-28T10:30:00+08:00
**Priority**: critical
**Status**: resolved
**Area**: frontend, null-safety, testing

### Summary
**多个页面因 undefined 属性访问而崩溃，包括 ReservationForm、CalendarView、MyReservations。这是反复出现的问题！每次添加新功能都会引入类似问题。**

### Details

**发现的崩溃问题:**

1. **ReservationForm.tsx** - `server.gpus.length` 当 `gpus` 为 undefined 时崩溃
2. **CalendarView.tsx** - `r.purpose.slice()` 当 `purpose` 为 undefined 时崩溃
3. **MyReservations.tsx** - 语法错误导致页面无法加载

**根本原因:**

1. API 返回的数据结构可能与前端接口定义不完全匹配
2. 前端代码直接访问可能为 undefined 的属性
3. 没有对从 API 获取的数据进行防御性编程
4. 没有足够的测试覆盖这些边缘情况

### 修复方案

**1. 添加空值保护:**
```typescript
// ❌ 错误 - 直接访问可能为 undefined 的属性
server.gpus.length
r.purpose.slice(0, 10)

// ✅ 正确 - 添加空值保护
(server.gpus || []).length
(r.purpose || '').slice(0, 10)
```

**2. 更新类型定义:**
```typescript
// 接口定义应明确可选字段
export interface Server {
  id: string
  name: string
  gpus?: GPU[]  // 可选
  availableGpus?: GPU[]  // 可选
  availableGpuCount: number
  status: 'online' | 'offline' | 'maintenance'
}
```

**3. 创建安全访问工具:**
创建了 `src/frontend/src/utils/safeAccess.ts`:
```typescript
export function safeArray<T>(value: T[] | undefined | null): T[] {
  return value ?? [];
}

export function safeString(value: string | undefined | null): string {
  return value ?? '';
}

export function safeSlice(value: string | undefined | null, start: number, end?: number): string {
  return (value ?? '').slice(start, end);
}
```

### 预防措施

**访问可能为 undefined 的数据时必须:**
```
□ 1. 检查属性是否存在于接口定义中
□ 2. 使用可选链 (?.) 或空值合并 (??)
□ 3. 为数组添加默认空数组
□ 4. 为字符串添加默认空字符串
□ 5. 添加单元测试覆盖 undefined/null 场景
```

### 已创建的测试

1. `e2e/tests/16-calendarview-null-safety.spec.ts` - CalendarView 空值安全测试
2. `e2e/tests/17-reservation-regression.spec.ts` - 预约页面回归测试
3. `src/frontend/src/components/reservation/__tests__/CalendarView.null-safety.test.tsx` - 单元测试

### API 端点问题

**发现的 API 问题:**

1. `/api/reservations/quota` - 缺失，导致 ReservationForm 无法加载配额
2. `/api/reservations/my` - 路由冲突，被 `/:id` 匹配
3. `/api/clusters/available-for-reservation` - 缺失，普通用户无法获取可预约集群

**修复:**
- 添加了 `/api/reservations/quota` 端点
- 添加了 `/api/reservations/my` 端点（在 `/:id` 之前定义）
- 添加了 `/api/clusters/available-for-reservation` 端点（所有认证用户可访问）

### Metadata
- Source: debugging, user_report
- Related Files:
  - src/frontend/src/pages/ReservationForm.tsx
  - src/frontend/src/components/reservation/CalendarView.tsx
  - src/frontend/src/pages/MyReservations.tsx
  - src/frontend/src/utils/safeAccess.ts
  - src/backend/src/routes/reservation.routes.ts
  - src/backend/src/routes/cluster.routes.ts
- Tags: null-safety, undefined, crashes, testing, api-design
- See Also: LRN-0000-0000-PRINCIPLE

---

## [LRN-20260328-002] API Route Order Conflicts with Dynamic Parameters

**Logged**: 2026-03-28T10:45:00+08:00
**Priority**: high
**Status**: resolved
**Area**: backend, routing

### Summary
**`/api/reservations/my` 被 `/:id` 路由拦截，导致普通用户无法访问自己的预约列表。Express 路由顺序问题再次出现！**

### Details

**问题代码:**
```typescript
// ❌ 错误顺序 - /my 被 /:id 拦截
router.get('/:id', ...)  // 匹配所有 /xxx，包括 /my
router.get('/my', ...)   // 永远不会被执行
```

**现象:**
- 请求 `/api/reservations/my?page=1&limit=10`
- 被 `/:id` 匹配，`id = 'my'`
- 验证器报错 `Valid reservation ID required`
- 返回 400 错误

**正确顺序:**
```typescript
// ✅ 正确 - 静态路由在动态参数路由之前
router.get('/my', ...)        // 静态路由
router.get('/calendar', ...)  // 静态路由
router.get('/quota', ...)     // 静态路由
router.get('/:id', ...)       // 动态路由 - 最后定义
```

### 关键规则

**Express 路由匹配规则:**
1. 按定义顺序从上到下匹配
2. 第一个匹配的路由处理请求
3. `:id` 匹配任何字符串，包括 `my`、`calendar`、`quota`
4. **静态路由必须在动态参数路由之前定义**

### 检查清单

**添加新路由时必须:**
```
□ 1. 确认是否是静态路由
□ 2. 如果是静态路由，确保在所有动态参数路由之前
□ 3. 如果是动态路由，确保在所有静态路由之后
□ 4. 测试所有路由端点是否可访问
```

### Metadata
- Source: debugging, api-design
- Related Files:
  - src/backend/src/routes/reservation.routes.ts
  - src/backend/src/routes/cluster.routes.ts
- Tags: express, routing, order, dynamic-parameters, api
- See Also: LRN-20260327-003

---

## [LRN-20260328-003] Permission-Based API Endpoints for Regular Users

**Logged**: 2026-03-28T11:00:00+08:00
**Priority**: high
**Status**: resolved
**Area**: backend, permissions, api-design

### Summary
**普通用户（USER 角色）无法访问 `/api/clusters` 获取集群列表进行预约，因为该端点需要 MANAGER 权限。需要为普通用户提供专门的可访问端点。**

### Details

**问题:**
- `ClusterReservationForm` 调用 `clusterApi.getAll()` 获取集群列表
- `/api/clusters` 端点需要 `requireManager` 权限
- 普通用户无法获取可预约的集群列表
- 页面显示"操作失败"

**解决方案:**

添加新的端点，专门为普通用户提供可预约的集群列表:

```typescript
// 新端点：所有认证用户可访问
router.get('/available-for-reservation', authenticate, async (req, res) => {
  const clusters = await clusterService.getAllClusters({ status: 'AVAILABLE' });
  // 返回精简的集群信息，仅包含预约所需字段
  res.json({ success: true, data: availableClusters });
});

// 原端点：仅 MANAGER 及以上可访问
router.get('/', authenticate, requireManager, async (req, res) => {
  // 返回完整集群信息，包括敏感数据
});
```

### API 设计原则

**权限分层:**
1. **公开端点** - 无需认证，仅基础信息
2. **认证端点** - 需登录，业务相关数据
3. **管理端点** - 需特定角色，敏感操作

**对于预约场景:**
- 普通用户需要查看可预约资源
- 但不应看到敏感配置信息
- 创建单独的端点，返回精简数据

### 检查清单

**设计 API 时必须:**
```
□ 1. 明确目标用户角色
□ 2. 确定返回数据的敏感程度
□ 3. 选择合适的权限中间件
□ 4. 考虑是否需要多个端点服务不同角色
□ 5. 文档中说明权限要求
```

### Metadata
- Source: api-design, debugging
- Related Files:
  - src/backend/src/routes/cluster.routes.ts
  - src/frontend/src/services/api.ts
  - src/frontend/src/pages/ClusterReservationForm.tsx
- Tags: permissions, api-design, roles, authentication
- See Also: LRN-20260327-005