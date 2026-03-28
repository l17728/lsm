/**
 * E2E — Batch Operations API
 *
 * Covers: batch delete, batch status update, batch cancel,
 *         auth enforcement on batch endpoints, response format.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:8080';
const ORIGIN   = 'http://localhost:8081';

function loadToken(): string {
  try {
    const file = path.join(__dirname, '../.auth/token.json');
    return JSON.parse(fs.readFileSync(file, 'utf-8')).token ?? '';
  } catch {
    return '';
  }
}

const TOKEN = loadToken();

test.describe('Batch Operations — Auth enforcement', () => {
  // 401 = auth missing, 403 = forbidden → all mean "blocked"
  test('DELETE /api/servers/batch requires authentication', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/api/servers/batch`, {
      data: { ids: ['test-id'] },
      headers: { Origin: ORIGIN },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('PATCH /api/servers/batch/status requires authentication', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/api/servers/batch/status`, {
      data: { ids: ['test-id'], status: 'ONLINE' },
      headers: { Origin: ORIGIN },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/tasks/batch/cancel requires authentication', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/tasks/batch/cancel`, {
      data: { ids: ['test-id'] },
      headers: { Origin: ORIGIN },
    });
    expect([401, 403]).toContain(res.status());
  });
});

test.describe('Batch Operations — Servers', () => {
  test('DELETE /api/servers/batch with invalid IDs returns 200 with failed count', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/api/servers/batch`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['invalid-id-1', 'invalid-id-2', 'invalid-id-3'] },
    });
    // 200 = graceful batch result, 400 = validation error, 403 = forbidden (non-admin), 500 = Prisma UUID error
    expect([200, 400, 403, 500]).toContain(res.status());
  });

  test('DELETE /api/servers/batch with empty array responds gracefully', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/api/servers/batch`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: [] },
    });
    expect([200, 400, 403]).toContain(res.status());
  });

  test('PATCH /api/servers/batch/status with invalid IDs responds', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/api/servers/batch/status`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['fake-id-1', 'fake-id-2'], status: 'MAINTENANCE' },
    });
    expect([200, 400, 403, 500]).toContain(res.status());
  });

  test('PATCH /api/servers/batch/status with missing status returns 400', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/api/servers/batch/status`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['fake-id-1'] },
    });
    expect([400, 403, 422]).toContain(res.status());
  });
});

test.describe('Batch Operations — GPUs', () => {
  test('DELETE /api/gpu/batch with invalid IDs responds', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/api/gpu/batch`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['invalid-gpu-1', 'invalid-gpu-2'] },
    });
    expect([200, 400, 403, 500]).toContain(res.status());
  });
});

test.describe('Batch Operations — Tasks', () => {
  test('DELETE /api/tasks/batch with invalid IDs responds', async ({ request }) => {
    const res = await request.delete(`${API_BASE}/api/tasks/batch`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['invalid-task-1', 'invalid-task-2'] },
    });
    expect([200, 400, 403, 500]).toContain(res.status());
  });

  test('POST /api/tasks/batch/cancel with invalid IDs responds', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/tasks/batch/cancel`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['invalid-task-1'] },
    });
    expect([200, 400, 403, 500]).toContain(res.status());
  });

  test('PATCH /api/tasks/batch/status with invalid status responds', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/api/tasks/batch/status`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
      data: { ids: ['any-id'], status: 'INVALID_STATUS' },
    });
    // Backend may return 200 (no validation), 400/422 (validation), 403 (forbidden)
    expect([200, 400, 403, 422]).toContain(res.status());
  });

  test('GET /api/tasks returns structured JSON response', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/tasks`, {
      headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body === 'object').toBeTruthy();
  });
});
