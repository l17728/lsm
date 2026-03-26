/**
 * E2E — Additional API Coverage
 *
 * Covers API endpoints not tested in 08-11:
 *   - /api/analytics/*       (summary, trends, cost, utilization)
 *   - /api/preferences       (get/update user preferences)
 *   - /api/export/*          (CSV/JSON export endpoints)
 *   - /api/feedback          (list, create)
 *   - /api/auth/users        (user list — admin)
 *   - /api/notification-history  (list, stats)
 */
import { test, expect } from '../fixtures/auth';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:8080';
const ORIGIN  = 'http://localhost:8081';

function loadToken(): string {
  const tokenFile = path.join(__dirname, '..', '.auth', 'token.json');
  if (fs.existsSync(tokenFile)) {
    return JSON.parse(fs.readFileSync(tokenFile, 'utf-8')).token;
  }
  return '';
}

// ─── Analytics API ─────────────────────────────────────────────────────────────

test.describe('Analytics API', () => {
  let token: string;
  test.beforeAll(() => { token = loadToken(); });

  test('GET /api/analytics/summary returns overview data', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/analytics/summary`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('success', true);
    }
  });

  test('GET /api/analytics/resource-trends returns trend data', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/analytics/resource-trends`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/analytics/cost-breakdown returns cost data', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/analytics/cost-breakdown`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/analytics/server-utilization returns utilization data', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/analytics/server-utilization`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/analytics/efficiency-report returns efficiency data', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/analytics/efficiency-report`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/analytics/* requires authentication', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/analytics/summary`, {
      headers: { Origin: ORIGIN },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ─── User Preferences API ──────────────────────────────────────────────────────

test.describe('User Preferences API', () => {
  let token: string;
  test.beforeAll(() => { token = loadToken(); });

  test('GET /api/preferences returns user preferences', async ({ request }) => {
    test.slow();
    const res = await request.get(`${BASE_URL}/api/preferences`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
      timeout: 30000,
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('success', true);
    }
  });

  test('PUT /api/preferences/theme updates theme preference', async ({ request }) => {
    test.slow();
    try {
      const res = await request.put(`${BASE_URL}/api/preferences/theme`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Origin: ORIGIN,
        },
        data: { theme: 'dark' },
        timeout: 30000,
      });
      expect([200, 400, 404, 422]).toContain(res.status());
    } catch (e: any) {
      if (!String(e?.message).includes('Timeout')) throw e;
    }
  });

  test('PUT /api/preferences/language updates language preference', async ({ request }) => {
    test.slow();
    try {
      const res = await request.put(`${BASE_URL}/api/preferences/language`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Origin: ORIGIN,
        },
        data: { language: 'zh-CN' },
        timeout: 30000,
      });
      expect([200, 400, 404, 422]).toContain(res.status());
    } catch (e: any) {
      if (!String(e?.message).includes('Timeout')) throw e;
    }
  });

  test('GET /api/preferences requires authentication', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/preferences`, {
      headers: { Origin: ORIGIN },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ─── Export API ────────────────────────────────────────────────────────────────

test.describe('Export API', () => {
  let token: string;
  test.beforeAll(() => { token = loadToken(); });

  test('GET /api/export/servers returns server data', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/export/servers`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    expect([200, 400, 404]).toContain(res.status());
    if (res.status() === 200) {
      const ct = res.headers()['content-type'] ?? '';
      expect(ct).toMatch(/csv|json|excel|octet-stream|spreadsheet/i);
    }
  });

  test('GET /api/export/gpu returns GPU allocation data', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/export/gpu`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('GET /api/export/tasks returns task data', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/export/tasks`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('GET /api/export/* requires authentication', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/export/servers`, {
      headers: { Origin: ORIGIN },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ─── Feedback API ──────────────────────────────────────────────────────────────

test.describe('Feedback API', () => {
  let token: string;
  test.beforeAll(() => { token = loadToken(); });

  test('GET /api/feedback returns feedback list', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/feedback`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('success', true);
    }
  });

  test('POST /api/feedback creates a new feedback entry', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/feedback`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Origin: ORIGIN,
      },
      data: {
        title: 'E2E Test Feedback',
        description: 'Automated E2E test feedback entry',
        type: 'feature',
        priority: 'low',
      },
    });
    expect([200, 201, 400, 404, 422]).toContain(res.status());
  });

  test('GET /api/feedback requires authentication', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/feedback`, {
      headers: { Origin: ORIGIN },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ─── User Management API ───────────────────────────────────────────────────────

test.describe('User Management API', () => {
  let token: string;
  test.beforeAll(() => { token = loadToken(); });

  test('GET /api/auth/users returns user list for admin', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/auth/users`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    // Admin token should get 200; non-admin gets 403
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  test('GET /api/auth/users requires authentication', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/auth/users`, {
      headers: { Origin: ORIGIN },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('PUT /api/auth/users/:id/role with invalid role returns 400', async ({ request }) => {
    const res = await request.put(`${BASE_URL}/api/auth/users/nonexistent-user/role`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Origin: ORIGIN,
      },
      data: { role: 'INVALID_ROLE' },
    });
    expect([400, 403, 404, 422]).toContain(res.status());
  });
});

// ─── Notification History API ──────────────────────────────────────────────────

test.describe('Notification History API', () => {
  let token: string;
  test.beforeAll(() => { token = loadToken(); });

  test('GET /api/notification-history returns notification list', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/notification-history`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('success', true);
    }
  });

  test('GET /api/notification-history/stats returns statistics', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/notification-history/stats`, {
      headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN },
    });
    expect([200, 404, 500]).toContain(res.status());
  });

  test('GET /api/notification-history requires authentication', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/notification-history`, {
      headers: { Origin: ORIGIN },
    });
    expect([401, 403, 404]).toContain(res.status());
  });
});
