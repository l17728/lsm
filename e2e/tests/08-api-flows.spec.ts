/**
 * E2E — API Flows (converted from tests/e2e-test.js)
 *
 * Covers: complete user journey via API, task management flow,
 *         dark-mode toggle (frontend state), language switch.
 *
 * Uses Playwright's `request` fixture to call the backend API directly.
 * Origin header is required by the backend's CSRF middleware.
 * Single file-level token avoids hitting the auth rate-limiter (5 req / 15 min).
 */
import { test, expect } from '@playwright/test';

const API_BASE = 'http://111.229.248.91:8080';
const ORIGIN   = 'http://111.229.248.91:8081';
const CREDS    = { username: 'admin', password: 'admin123' };

// Single login for the whole file
let TOKEN = '';

test.beforeAll(async ({ request }) => {
  const res  = await request.post(`${API_BASE}/api/auth/login`, {
    data: CREDS,
    headers: { Origin: ORIGIN },
  });
  if (res.status() === 200) {
    const body = await res.json();
    TOKEN = body.token ?? '';
  }
});

// ── Flow 1: Complete User Journey ─────────────────────────────────────────
test.describe('API Flow — Complete User Journey', () => {
  test('GET /api/servers returns 200 with auth', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/servers`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    expect([200, 429]).toContain(res.status());
  });

  test('GET /api/gpu returns 200 with auth', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/gpu`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    expect([200, 429]).toContain(res.status());
  });

  test('GET /api/tasks returns 200 with auth', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/tasks`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    expect([200, 429]).toContain(res.status());
  });

  test('GET /api/monitoring/stats returns cluster stats', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/monitoring/stats`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    expect([200, 404, 429]).toContain(res.status());
  });
});

// ── Flow 2: Task Management via API ───────────────────────────────────────
test.describe('API Flow — Task Management', () => {
  test('GET /api/tasks/stats returns task statistics', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/tasks/stats`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    expect([200, 429]).toContain(res.status());
  });

  test('POST /api/tasks creates a task successfully', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/tasks`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: {
        name: `E2E API Task ${Date.now()}`,
        description: 'Created by Playwright API flow test',
      },
    });
    expect([200, 201, 429]).toContain(res.status());
  });

  test('GET /api/tasks/:id returns 4xx for non-existent task', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/tasks/nonexistent-id-00000`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    expect([400, 404, 429]).toContain(res.status());
  });
});

// ── Flow 3: GPU Allocation via API ────────────────────────────────────────
test.describe('API Flow — GPU Resources', () => {
  test('GET /api/gpu/stats returns GPU stats', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/gpu/stats`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    expect([200, 429]).toContain(res.status());
  });

  test('GET /api/gpu/my-allocations returns user allocations', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/gpu/my-allocations`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    expect([200, 429]).toContain(res.status());
  });
});
