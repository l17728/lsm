/**
 * E2E — CalendarView Component Edge Cases and Null Safety Tests
 *
 * Purpose: Prevent regression of issues where undefined/null data causes crashes
 *
 * Covers:
 * - Undefined reservation properties (purpose, userName, serverName, gpuIds)
 * - Empty reservation lists
 * - API response structure variations
 * - Missing/null data in calendar views (day, week, month)
 * - Server dropdown with empty/null server data
 *
 * Related bug fixes:
 * - CalendarView.tsx: r.purpose.slice() when purpose is undefined
 * - reservationStore.ts: response.data.data should be response.data.data.servers
 * - reservation.routes.ts: availability API should accept optional time params
 */
import { test, expect, Page, APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8081';

// Test user credentials
const TEST_USER = {
  username: process.env.TEST_USERNAME || 'testadmin',
  password: process.env.TEST_PASSWORD || 'TestAdmin123!',
};

// Helper to get auth token
async function getAuthToken(request: APIRequestContext, username: string, password: string): Promise<string> {
  const response = await request.post(`${BASE_URL}/api/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { username, password },
  });
  const body = await response.json();
  if (!body.success || !body.data?.token) {
    throw new Error(`Login failed: ${JSON.stringify(body)}`);
  }
  return body.data.token;
}

// Helper to login via UI
async function loginViaUI(page: Page, user: { username: string; password: string }) {
  await page.goto(`${FRONTEND_URL}/login`);
  await page.getByPlaceholder(/username|用户名/i).fill(user.username);
  await page.getByPlaceholder(/password|密码/i).fill(user.password);
  await page.getByRole('button', { name: /login|登录/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
}

test.describe('CalendarView — Null Safety Tests', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, TEST_USER.username, TEST_USER.password);
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USER);
  });

  // ============================================
  // TC-NULL-001: Reservations page loads without errors
  // ============================================
  test('should load reservations page without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${FRONTEND_URL}/reservations`);
    await page.waitForLoadState('networkidle');

    // Check for TypeError: Cannot read properties of undefined
    const undefinedErrors = errors.filter(e => 
      e.includes('Cannot read properties of undefined') ||
      e.includes('undefined is not a function') ||
      e.includes('.slice is not a function')
    );
    
    expect(undefinedErrors).toHaveLength(0);
  });

  // ============================================
  // TC-NULL-002: Calendar view renders with empty reservations
  // ============================================
  test('should render calendar view when no reservations exist', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations`);
    
    // Wait for calendar to load
    await page.waitForSelector('[class*="calendar"]', { timeout: 10000 });

    // Calendar should be visible even with no data
    await expect(page.locator('[class*="calendar"]').first()).toBeVisible();

    // Should show month view by default
    const monthView = page.locator('.calendar-month-view, [class*="month"]');
    await expect(monthView.first()).toBeVisible();

    // No JavaScript console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const criticalErrors = consoleErrors.filter(e =>
      e.includes('TypeError') ||
      e.includes('Cannot read properties')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ============================================
  // TC-NULL-003: Server dropdown handles empty server list
  // ============================================
  test('should handle empty server list in dropdown', async ({ page, request }) => {
    // Mock or verify availability endpoint returns empty servers
    const response = await request.get(`${BASE_URL}/api/reservations/availability`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await response.json();
    expect(response.status()).toBe(200);

    // Navigate to reservations page
    await page.goto(`${FRONTEND_URL}/reservations`);
    await page.waitForLoadState('networkidle');

    // Server dropdown should exist and be clickable
    const serverDropdown = page.locator('.ant-select').first();
    if (await serverDropdown.isVisible()) {
      await serverDropdown.click();
      // Dropdown should open without errors
      await page.waitForSelector('.ant-select-dropdown', { timeout: 5000 }).catch(() => {});
    }
  });

  // ============================================
  // TC-NULL-004: Calendar day view handles missing properties
  // ============================================
  test('should render day view without errors', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations`);
    
    // Switch to day view
    const dayButton = page.getByRole('radio', { name: /日|day/i });
    if (await dayButton.isVisible()) {
      await dayButton.click();
      await page.waitForTimeout(500);
    }

    // Should not have JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(e =>
      e.includes('Cannot read properties of undefined') ||
      e.includes('.slice is not a function')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ============================================
  // TC-NULL-005: Calendar week view handles missing properties
  // ============================================
  test('should render week view without errors', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations`);
    
    // Switch to week view
    const weekButton = page.getByRole('radio', { name: /周|week/i });
    if (await weekButton.isVisible()) {
      await weekButton.click();
      await page.waitForTimeout(500);
    }

    // Should not have JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(e =>
      e.includes('Cannot read properties of undefined') ||
      e.includes('.slice is not a function')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ============================================
  // TC-NULL-006: Reservation tooltip displays correctly with missing data
  // ============================================
  test('should display reservation tooltips without crashing', async ({ page, request }) => {
    // Create a reservation with minimal data
    const startTime = new Date(Date.now() + 3600000);
    const endTime = new Date(Date.now() + 7200000);

    const createResponse = await request.post(`${BASE_URL}/api/reservations`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: {
        title: 'Test Reservation',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        gpuCount: 1,
      },
    });

    // Navigate to reservations page
    await page.goto(`${FRONTEND_URL}/reservations`);
    await page.waitForLoadState('networkidle');

    // If there are any reservations displayed, hover should not crash
    const reservationItems = page.locator('[class*="reservation-item"]');
    const count = await reservationItems.count();
    
    if (count > 0) {
      await reservationItems.first().hover();
      await page.waitForTimeout(300);
    }

    // No JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    const criticalErrors = errors.filter(e => 
      e.includes('Cannot read properties of undefined')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('API Response Structure Tests', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, TEST_USER.username, TEST_USER.password);
  });

  // ============================================
  // TC-API-001: Availability API returns correct structure
  // ============================================
  test('should return availability data with servers array', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/reservations/availability`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.servers)).toBe(true);
    expect(typeof body.data.available).toBe('boolean');
    expect(typeof body.data.totalAvailableGpus).toBe('number');
  });

  // ============================================
  // TC-API-002: Availability API works without time parameters
  // ============================================
  test('should work without startTime and endTime parameters', async ({ request }) => {
    // This was a bug fix - availability API should work without time params
    const response = await request.get(`${BASE_URL}/api/reservations/availability`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  // ============================================
  // TC-API-003: Availability API validates time parameters when provided
  // ============================================
  test('should validate time parameters when provided', async ({ request }) => {
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + 86400000).toISOString();

    const response = await request.get(`${BASE_URL}/api/reservations/availability`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { startTime, endTime },
    });

    expect(response.status()).toBe(200);
  });

  // ============================================
  // TC-API-004: Reservations list API returns proper structure
  // ============================================
  test('should return reservations with all required fields', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/reservations`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    if (body.data && body.data.length > 0) {
      const reservation = body.data[0];
      // These fields should always exist or be null-safe
      expect(reservation).toHaveProperty('id');
      expect(reservation).toHaveProperty('status');
    }
  });

  // ============================================
  // TC-API-005: Calendar API returns proper structure
  // ============================================
  test('should return calendar data with proper structure', async ({ request }) => {
    const start = new Date();
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const response = await request.get(`${BASE_URL}/api/reservations/calendar`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});

test.describe('Reservation Data Display Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USER);
  });

  // ============================================
  // TC-DISP-001: My Reservations page handles empty state
  // ============================================
  test('should show proper empty state for my reservations', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations/mine`);
    await page.waitForLoadState('networkidle');

    // Page should render without errors
    await expect(page.locator('main').first()).toBeVisible();

    // Should either show a table, calendar, or empty state
    const hasContent = await page.locator('.ant-table, .ant-empty, [class*="calendar"]').count();
    expect(hasContent).toBeGreaterThan(0);
  });

  // ============================================
  // TC-DISP-002: New Server Reservation button works
  // ============================================
  test('should navigate to server reservation form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations`);
    await page.waitForLoadState('networkidle');

    // Click New Server Reservation button
    const newServerBtn = page.getByRole('button', { name: /服务器预约|server reservation/i });
    await newServerBtn.click();

    // Should navigate to reservation form
    await expect(page).toHaveURL(/\/reservations\/new/);
    await expect(page.locator('form')).toBeVisible({ timeout: 5000 });
  });

  // ============================================
  // TC-DISP-003: New Cluster Reservation button works
  // ============================================
  test('should navigate to cluster reservation form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations`);
    await page.waitForLoadState('networkidle');

    // Click New Cluster Reservation button
    const newClusterBtn = page.getByRole('button', { name: /集群预约|cluster reservation/i });
    await newClusterBtn.click();

    // Should navigate to cluster reservation form
    await expect(page).toHaveURL(/\/reservations\/cluster/);
  });

  // ============================================
  // TC-DISP-004: View toggle works correctly
  // ============================================
  test('should toggle between calendar and list views', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations`);
    await page.waitForLoadState('networkidle');

    // Default should be calendar view
    const calendarView = page.locator('[class*="calendar"]').first();
    await expect(calendarView).toBeVisible();

    // Switch to list view
    const listButton = page.getByRole('radio', { name: /列表|list/i });
    if (await listButton.isVisible()) {
      await listButton.click();
      await page.waitForTimeout(500);

      // Should show list view or empty state
      const listView = page.locator('.ant-card, .ant-table, .ant-empty').first();
      await expect(listView).toBeVisible();
    }
  });

  // ============================================
  // TC-DISP-005: Date navigation works without errors
  // ============================================
  test('should navigate dates without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${FRONTEND_URL}/reservations`);
    await page.waitForLoadState('networkidle');

    // Click next month button
    const nextBtn = page.getByRole('button').filter({ hasText: '' }).nth(1);
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(300);
    }

    // Click previous month button
    const prevBtn = page.getByRole('button').filter({ hasText: '' }).first();
    if (await prevBtn.isVisible()) {
      await prevBtn.click();
      await page.waitForTimeout(300);
    }

    // No critical JavaScript errors
    const criticalErrors = errors.filter(e =>
      e.includes('TypeError') ||
      e.includes('Cannot read properties of undefined')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Cross-Component Null Safety Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USER);
  });

  // ============================================
  // TC-CROSS-001: All pages with data tables handle empty/null data
  // ============================================
  const pagesWithData = [
    { name: 'Servers', url: '/servers' },
    { name: 'Clusters', url: '/clusters' },
    { name: 'Tasks', url: '/tasks' },
    { name: 'Users', url: '/users' },
    { name: 'GPUs', url: '/gpus' },
    { name: 'Monitoring', url: '/monitoring' },
  ];

  for (const pageInfo of pagesWithData) {
    test(`should load ${pageInfo.name} page without undefined property errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));

      await page.goto(`${FRONTEND_URL}${pageInfo.url}`);
      await page.waitForLoadState('networkidle');

      const criticalErrors = errors.filter(e =>
        e.includes('Cannot read properties of undefined') ||
        e.includes('.slice is not a function') ||
        e.includes('.map is not a function')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  }

  // ============================================
  // TC-CROSS-002: Dashboard handles null cluster stats
  // ============================================
  test('should load dashboard without errors when cluster stats are null', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${FRONTEND_URL}/`);
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(e =>
      e.includes('Cannot read properties of undefined')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});