/**
 * E2E — Security & Rate Limiting (converted from tests/rate-limit-test.js)
 *
 * Covers: unauthenticated access rejection, auth endpoint behavior,
 *         response headers, basic security headers.
 *
 * NOTE: The live server applies API rate limiting (100 req/15 min).
 *       429 is treated as "access blocked" for enforcement tests, and as
 *       a valid "endpoint responds" signal for header/latency tests.
 */
import { test, expect } from '@playwright/test';

const API_BASE = 'http://111.229.248.91:8080';
const ORIGIN   = 'http://111.229.248.91:8081';

test.describe('Security — Authentication enforcement', () => {
  // 401 = auth missing, 403 = forbidden, 429 = rate limited before auth → all "blocked"
  test('GET /api/servers without token is blocked', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/servers`, {
      headers: { Origin: ORIGIN },
    });
    expect([401, 403, 429]).toContain(res.status());
  });

  test('GET /api/gpu without token is blocked', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/gpu`, {
      headers: { Origin: ORIGIN },
    });
    expect([401, 403, 429]).toContain(res.status());
  });

  test('GET /api/tasks without token is blocked', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/tasks`, {
      headers: { Origin: ORIGIN },
    });
    expect([401, 403, 429]).toContain(res.status());
  });

  test('GET /api/monitoring/stats without token is blocked', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/monitoring/stats`, {
      headers: { Origin: ORIGIN },
    });
    expect([401, 403, 429]).toContain(res.status());
  });
});

test.describe('Security — Auth endpoint behavior', () => {
  test('POST /api/auth/login with valid credentials returns token or 429', async ({ request }) => {
    const res  = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: 'admin', password: 'admin123' },
      headers: { Origin: ORIGIN },
    });
    // 200 = success, 429 = rate-limited (auth rate limit is 5/15 min on live server)
    expect([200, 429]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.token).toBeTruthy();
      expect(typeof body.token).toBe('string');
    }
  });

  test('POST /api/auth/login with wrong password is rejected', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: 'admin', password: 'wrongpassword123' },
      headers: { Origin: ORIGIN },
    });
    // 401 = wrong creds, 400 = validation, 429 = rate limited — all mean "rejected"
    expect([401, 400, 429]).toContain(res.status());
  });

  test('POST /api/auth/login with empty body returns 4xx', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: {},
      headers: { Origin: ORIGIN },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/auth/login with non-existent user is rejected', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: 'no_such_user_xyz', password: 'any' },
      headers: { Origin: ORIGIN },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Security — Response headers', () => {
  test('health endpoint responds with JSON content-type', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    expect(res.status()).toBe(200);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('application/json');
  });

  test('API responses do not expose X-Powered-By (Helmet removes it)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('invalid API route returns 4xx not 5xx', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/this-route-does-not-exist`, {
      headers: { Origin: ORIGIN },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('Security — Token validation', () => {
  test('API with malformed Bearer token is blocked', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/servers`, {
      headers: { Authorization: 'Bearer invalid.token.here', Origin: ORIGIN },
    });
    expect([401, 403, 429]).toContain(res.status());
  });

  test('API with fake JWT is blocked', async ({ request }) => {
    const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlIiwiaWF0IjoxfQ.fakeSignature';
    const res = await request.get(`${API_BASE}/api/servers`, {
      headers: { Authorization: `Bearer ${fakeJwt}`, Origin: ORIGIN },
    });
    expect([401, 403, 429]).toContain(res.status());
  });
});
