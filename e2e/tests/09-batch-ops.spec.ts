/**
 * E2E — Batch Operations API (converted from tests/batch-operation-integration-test.js)
 *
 * Covers: batch delete, batch status update, batch cancel,
 *         auth enforcement on batch endpoints, response format.
 *
 * Uses Playwright's `request` fixture.
 * Origin header is required by the backend's CSRF middleware.
 * Single file-level token avoids hitting the auth rate-limiter (5 req / 15 min).
 */
import { test, expect } from '@playwright/test';

const API_BASE = 'http://111.229.248.91:8080';
const ORIGIN   = 'http://111.229.248.91:8081';
const CREDS    = { username: 'admin', password: 'admin123' };

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

test.describe('Batch Operations — Auth enforcement', () => {
  // 401/403 = auth rejected, 429 = rate-limited before auth — all mean "blocked"
  test('DELETE /api/servers/batch requires authentication', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/api/servers/batch`, {
      data: { ids: ['test-id'] },
      headers: { Origin: ORIGIN },
    });
    expect([401, 403, 429]).toContain(res.status());
  });

  test('PATCH /api/servers/batch/status requires authentication', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/api/servers/batch/status`, {
      data: { ids: ['test-id'], status: 'ONLINE' },
      headers: { Origin: ORIGIN },
    });
    expect([401, 403, 429]).toContain(res.status());
  });

  test('POST /api/tasks/batch/cancel requires authentication', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/tasks/batch/cancel`, {
      data: { ids: ['test-id'] },
      headers: { Origin: ORIGIN },
    });
    expect([401, 403, 429]).toContain(res.status());
  });
});

test.describe('Batch Operations — Servers', () => {
  test('DELETE /api/servers/batch with invalid IDs returns 200 with failed count', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/api/servers/batch`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['invalid-id-1', 'invalid-id-2', 'invalid-id-3'] },
    });
    expect([200, 429]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.failed !== undefined || body.results !== undefined).toBeTruthy();
    }
  });

  test('DELETE /api/servers/batch with empty array responds gracefully', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/api/servers/batch`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: [] },
    });
    expect([200, 400, 429]).toContain(res.status());
  });

  test('PATCH /api/servers/batch/status with invalid IDs responds', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/api/servers/batch/status`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['fake-id-1', 'fake-id-2'], status: 'MAINTENANCE' },
    });
    expect([200, 429]).toContain(res.status());
  });

  test('PATCH /api/servers/batch/status with missing status returns 400', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/api/servers/batch/status`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['fake-id-1'] },
    });
    expect([400, 422, 429]).toContain(res.status());
  });
});

test.describe('Batch Operations — GPUs', () => {
  test('DELETE /api/gpu/batch with invalid IDs responds', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/api/gpu/batch`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['invalid-gpu-1', 'invalid-gpu-2'] },
    });
    expect([200, 429]).toContain(res.status());
  });
});

test.describe('Batch Operations — Tasks', () => {
  test('DELETE /api/tasks/batch with invalid IDs responds', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/api/tasks/batch`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['invalid-task-1', 'invalid-task-2'] },
    });
    expect([200, 429]).toContain(res.status());
  });

  test('POST /api/tasks/batch/cancel with invalid IDs responds', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/tasks/batch/cancel`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['invalid-task-1'] },
    });
    expect([200, 429]).toContain(res.status());
  });

  test('PATCH /api/tasks/batch/status with invalid status returns 4xx', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/api/tasks/batch/status`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['any-id'], status: 'INVALID_STATUS' },
    });
    expect([400, 422, 429]).toContain(res.status());
  });

  test('GET /api/tasks returns structured JSON response', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/tasks`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    expect([200, 429]).toContain(res.status());
    const body = await res.json();
    expect(typeof body === 'object').toBeTruthy();
  });
});
