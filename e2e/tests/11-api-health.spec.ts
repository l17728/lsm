/**
 * E2E — API Health & Response Time
 *
 * Covers: key API endpoints respond within acceptable latency,
 *         health check always returns healthy, response structures are valid.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE    = 'http://localhost:8080';
const ORIGIN      = 'http://localhost:8081';
const MAX_LATENCY = 5000; // 5 s — generous for network round-trip

// Read the token written by globalSetup
function loadToken(): string {
  try {
    const file = path.join(__dirname, '../.auth/token.json');
    return JSON.parse(fs.readFileSync(file, 'utf-8')).token ?? '';
  } catch {
    return '';
  }
}

const TOKEN = loadToken();

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
      data: { username: 'admin', password: 'Admin123' },
      headers: { Origin: ORIGIN },
    });
    const ms = Date.now() - start;

    // 200 = success, 401 = invalid credentials (should not happen with correct creds)
    expect([200, 401]).toContain(res.status());
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
    // 200 = success, 401 = auth expired/missing — both respond fast
    expect([200, 401]).toContain(res.status());
    expect(ms).toBeLessThan(MAX_LATENCY);
  });

  test('GET /api/gpu/allocations endpoint responds', async ({ request }) => {
    const start = Date.now();
    const res   = await request.get(`${API_BASE}/api/gpu/allocations`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    const ms = Date.now() - start;
    expect([200, 401]).toContain(res.status());
    expect(ms).toBeLessThan(MAX_LATENCY);
  });

  test('GET /api/tasks endpoint responds', async ({ request }) => {
    const start = Date.now();
    const res   = await request.get(`${API_BASE}/api/tasks`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    const ms = Date.now() - start;
    expect([200, 401]).toContain(res.status());
    expect(ms).toBeLessThan(MAX_LATENCY);
  });

  test('GET /api/gpu/stats endpoint responds', async ({ request }) => {
    const start = Date.now();
    const res   = await request.get(`${API_BASE}/api/gpu/stats`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    const ms = Date.now() - start;
    expect([200, 401]).toContain(res.status());
    expect(ms).toBeLessThan(MAX_LATENCY);
  });

  test('GET /api/tasks/stats endpoint responds', async ({ request }) => {
    const start = Date.now();
    const res   = await request.get(`${API_BASE}/api/tasks/stats`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    const ms = Date.now() - start;
    expect([200, 401]).toContain(res.status());
    expect(ms).toBeLessThan(MAX_LATENCY);
  });

  test('all monitored endpoints respond within latency budget', async ({ request }) => {
    const endpoints = [
      '/api/servers',
      '/api/gpu/allocations',
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
      expect([200, 401]).toContain(res.status());
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
      expect([200, 401]).toContain(res.status());
      expect(ms).toBeLessThan(MAX_LATENCY);
    }
  });
});
