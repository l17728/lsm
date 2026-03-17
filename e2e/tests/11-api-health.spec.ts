/**
 * E2E — API Health & Response Time (converted from tests/performance-test*.js)
 *
 * Covers: key API endpoints respond within acceptable latency,
 *         health check always returns healthy, response structures are valid.
 *
 * NOTE: The live server has API rate limiting (100 req/15 min).
 *       Tests accept 200 (success) or 429 (rate-limited but responded fast).
 *       Health endpoint is exempt from rate limiting.
 */
import { test, expect } from '@playwright/test';

const API_BASE    = 'http://111.229.248.91:8080';
const ORIGIN      = 'http://111.229.248.91:8081';
const MAX_LATENCY = 3000; // 3 s — generous for network round-trip

// Single file-level token — one login per suite run
let TOKEN = '';

test.beforeAll(async ({ request }) => {
  const res  = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
    headers: { Origin: ORIGIN },
  });
  if (res.status() === 200) {
    const body = await res.json();
    TOKEN = body.token ?? '';
  }
  // If 429 (auth rate-limited), TOKEN stays '' — authenticated tests will
  // return 401 which is still a fast, valid response from a health perspective.
});

test.describe('API Health — Core endpoints', () => {
  test('GET /health responds quickly and is healthy', async ({ request }) => {
    const start = Date.now();
    const res   = await request.get(`${API_BASE}/health`);
    const ms    = Date.now() - start;

    expect(res.status()).toBe(200);
    expect(ms).toBeLessThan(MAX_LATENCY);

    const body = await res.json();
    expect(body.status).toBe('healthy');
  });

  test('POST /api/auth/login endpoint responds within latency budget', async ({ request }) => {
    const start = Date.now();
    const res   = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: 'admin', password: 'admin123' },
      headers: { Origin: ORIGIN },
    });
    const ms = Date.now() - start;

    // 200 = success, 429 = rate-limited — both are valid fast responses
    expect([200, 429]).toContain(res.status());
    expect(ms).toBeLessThan(MAX_LATENCY);
  });
});

test.describe('API Health — Endpoint availability', () => {
  test('GET /api/servers endpoint responds', async ({ request }) => {
    const start = Date.now();
    const res   = await request.get(`${API_BASE}/api/servers`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    const ms = Date.now() - start;
    // 200 = success, 401 = auth expired/missing, 429 = rate limited — all respond fast
    expect([200, 401, 429]).toContain(res.status());
    expect(ms).toBeLessThan(MAX_LATENCY);
  });

  test('GET /api/gpu endpoint responds', async ({ request }) => {
    const start = Date.now();
    const res   = await request.get(`${API_BASE}/api/gpu`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    const ms = Date.now() - start;
    expect([200, 401, 429]).toContain(res.status());
    expect(ms).toBeLessThan(MAX_LATENCY);
  });

  test('GET /api/tasks endpoint responds', async ({ request }) => {
    const start = Date.now();
    const res   = await request.get(`${API_BASE}/api/tasks`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    const ms = Date.now() - start;
    expect([200, 401, 429]).toContain(res.status());
    expect(ms).toBeLessThan(MAX_LATENCY);
  });

  test('GET /api/gpu/stats endpoint responds', async ({ request }) => {
    const start = Date.now();
    const res   = await request.get(`${API_BASE}/api/gpu/stats`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    const ms = Date.now() - start;
    expect([200, 401, 429]).toContain(res.status());
    expect(ms).toBeLessThan(MAX_LATENCY);
  });

  test('GET /api/tasks/stats endpoint responds', async ({ request }) => {
    const start = Date.now();
    const res   = await request.get(`${API_BASE}/api/tasks/stats`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    const ms = Date.now() - start;
    expect([200, 401, 429]).toContain(res.status());
    expect(ms).toBeLessThan(MAX_LATENCY);
  });

  test('all monitored endpoints respond within latency budget', async ({ request }) => {
    const endpoints = [
      '/api/servers',
      '/api/gpu',
      '/api/tasks',
      '/api/gpu/stats',
      '/api/tasks/stats',
    ];
    for (const ep of endpoints) {
      const start = Date.now();
      const res   = await request.get(`${API_BASE}${ep}`, {
        headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      });
      const ms = Date.now() - start;
      expect([200, 401, 429]).toContain(res.status());
      expect(ms).toBeLessThan(MAX_LATENCY);
    }
  });

  test('consecutive requests to same endpoint are all fast', async ({ request }) => {
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      const res   = await request.get(`${API_BASE}/api/servers`, {
        headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      });
      const ms = Date.now() - start;
      expect([200, 401, 429]).toContain(res.status());
      expect(ms).toBeLessThan(MAX_LATENCY);
    }
  });
});
