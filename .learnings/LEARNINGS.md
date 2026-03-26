# LSM Project Learnings

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

## [LRN-20260325-004] Token Refresh Test Scenarios

**Logged**: 2026-03-25T17:15:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
Comprehensive test scenarios for JWT refresh token functionality

### Details
When implementing or testing token refresh, cover these scenarios:

**Happy Path:**
1. Login returns both access and refresh tokens
2. Refresh with valid token returns new tokens
3. Token rotation - old refresh token is invalidated
4. New access token works for protected endpoints

**Error Cases:**
1. Refresh with invalid/expired token → 401
2. Refresh without token → 400
3. Refresh with empty token → 400
4. Reuse of rotated refresh token → 401

**Security:**
1. Tampered access token rejected
2. Expired access token rejected
3. Missing authorization header rejected
4. Malformed authorization header rejected

**Frontend:**
1. Auto-refresh on 401 response
2. Request queue during refresh
3. Session persistence after reload
4. Logout clears tokens

### Suggested Action
Use this checklist when testing token-based authentication systems

### Metadata
- Source: testing
- Tags: tests, authentication, jwt, checklist