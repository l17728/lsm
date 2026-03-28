/**
 * E2E — Reservation Pages Regression Tests
 *
 * Purpose: Prevent regression of critical bugs in reservation-related pages
 *
 * Bugs Fixed:
 * 1. ReservationForm: server.gpus undefined causing TypeError
 * 2. ReservationForm: server.availableGpus not in type
 * 3. Backend: Missing /api/reservations/quota endpoint
 * 4. Backend: Missing /api/reservations/my endpoint (route conflict with /:id)
 * 5. reservationStore: response.data should be response.data.data for quota
 * 6. CalendarView: r.purpose.slice() when purpose is undefined
 *
 * Test Categories:
 * - Page Load Tests: All reservation pages load without errors
 * - API Endpoint Tests: All required APIs return correct structure
 * - Data Handling Tests: Pages handle missing/null data gracefully
 * - Navigation Tests: Buttons and links navigate correctly
 */
import { test, expect, Page, APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8081';

const TEST_USER = {
  username: process.env.TEST_USERNAME || 'testadmin',
  password: process.env.TEST_PASSWORD || 'TestAdmin123!',
};

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

async function loginViaUI(page: Page, user: { username: string; password: string }) {
  await page.goto(`${FRONTEND_URL}/login`);
  await page.getByPlaceholder(/username|用户名/i).fill(user.username);
  await page.getByPlaceholder(/password|密码/i).fill(user.password);
  await page.getByRole('button', { name: /login|登录/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
}

test.describe('Reservation Pages — Page Load Tests', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, TEST_USER.username, TEST_USER.password);
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USER);
  });

  // ============================================
  // TC-PAGE-001: Reservations calendar page loads
  // ============================================
  test('should load /reservations without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${FRONTEND_URL}/reservations`);
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(e =>
      e.includes('TypeError') ||
      e.includes('Cannot read properties of undefined') ||
      e.includes('.slice is not a function')
    );
    expect(criticalErrors).toHaveLength(0);

    // Verify page content
    await expect(page.getByRole('heading', { name: /预约|reservation/i })).toBeVisible();
  });

  // ============================================
  // TC-PAGE-002: New Server Reservation page loads
  // ============================================
  test('should load /reservations/new without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${FRONTEND_URL}/reservations/new`);
    await page.waitForLoadState('networkidle');

    // Critical: Must not have TypeError from undefined server.gpus
    const criticalErrors = errors.filter(e =>
      e.includes('TypeError') ||
      e.includes('Cannot read properties of undefined') ||
      e.includes('.map is not a function') ||
      e.includes('.length')
    );
    expect(criticalErrors).toHaveLength(0);

    // Verify page content
    await expect(page.getByRole('heading', { name: /new reservation|新建预约/i })).toBeVisible();
    
    // Verify server cards are displayed
    const serverCards = page.locator('[class*="server-card"]');
    const count = await serverCards.count();
    expect(count).toBeGreaterThan(0);
  });

  // ============================================
  // TC-PAGE-003: My Reservations page loads
  // ============================================
  test('should load /reservations/mine without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${FRONTEND_URL}/reservations/mine`);
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(e =>
      e.includes('TypeError') ||
      e.includes('Cannot read properties of undefined')
    );
    expect(criticalErrors).toHaveLength(0);

    // Verify page content
    await expect(page.getByRole('heading', { name: /我的预约|my reservation/i })).toBeVisible();
  });

  // ============================================
  // TC-PAGE-004: New Cluster Reservation page loads
  // ============================================
  test('should load /reservations/cluster without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${FRONTEND_URL}/reservations/cluster`);
    await page.waitForLoadState('networkidle');

    const criticalErrors = errors.filter(e =>
      e.includes('TypeError') ||
      e.includes('Cannot read properties of undefined')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Reservation API — Endpoint Tests', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, TEST_USER.username, TEST_USER.password);
  });

  // ============================================
  // TC-API-001: GET /api/reservations/quota
  // ============================================
  test('should return user quota with correct structure', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/reservations/quota`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data.maxHoursPerWeek).toBe('number');
    expect(typeof body.data.usedHoursThisWeek).toBe('number');
    expect(typeof body.data.maxConcurrentReservations).toBe('number');
    expect(typeof body.data.currentReservations).toBe('number');
  });

  // ============================================
  // TC-API-002: GET /api/reservations/my
  // ============================================
  test('should return user reservations with correct structure', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/reservations/my`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, limit: 10 },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.page).toBe('number');
    expect(typeof body.limit).toBe('number');
  });

  // ============================================
  // TC-API-003: GET /api/reservations/availability
  // ============================================
  test('should return available servers with correct structure', async ({ request }) => {
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

    // Verify server structure
    if (body.data.servers.length > 0) {
      const server = body.data.servers[0];
      expect(server).toHaveProperty('id');
      expect(server).toHaveProperty('name');
      expect(Array.isArray(server.availableGpus)).toBe(true);
    }
  });

  // ============================================
  // TC-API-004: GET /api/reservations (list)
  // ============================================
  test('should return reservations list with correct structure', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/reservations`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body.success).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  // ============================================
  // TC-API-005: GET /api/reservations/calendar
  // ============================================
  test('should return calendar data with correct structure', async ({ request }) => {
    const today = new Date();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const response = await request.get(`${BASE_URL}/api/reservations/calendar`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        start: today.toISOString().split('T')[0],
        end: nextWeek.toISOString().split('T')[0],
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });
});

test.describe('Reservation Form — Data Handling Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USER);
  });

  // ============================================
  // TC-DATA-001: Server cards display correctly
  // ============================================
  test('should display server cards with GPU counts', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations/new`);
    await page.waitForLoadState('networkidle');

    // Find server cards
    const serverCards = page.locator('[class*="server-card"]');
    const count = await serverCards.count();
    
    // Should have at least one server card
    expect(count).toBeGreaterThan(0);

    // Each card should show GPU count
    const firstCard = serverCards.first();
    await expect(firstCard.getByText(/GPU/i)).toBeVisible();
  });

  // ============================================
  // TC-DATA-002: Quota info displays correctly
  // ============================================
  test('should display quota information without NaN', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations/new`);
    await page.waitForLoadState('networkidle');

    // Find quota alert
    const quotaAlert = page.locator('.ant-alert').filter({ hasText: /hours|小时/i });
    
    if (await quotaAlert.count() > 0) {
      const text = await quotaAlert.textContent();
      // Should not contain NaN
      expect(text).not.toContain('NaN');
    }
  });

  // ============================================
  // TC-DATA-003: Form fields are interactive
  // ============================================
  test('should allow form field interactions', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations/new`);
    await page.waitForLoadState('networkidle');

    // Click on first server card
    const serverCard = page.locator('[class*="server-card"]').first();
    await serverCard.click();

    // Fill purpose field
    const purposeField = page.getByPlaceholder(/purpose|目的/i);
    await purposeField.fill('Test reservation for e2e testing');
    await expect(purposeField).toHaveValue('Test reservation for e2e testing');
  });
});

test.describe('My Reservations — Data Display Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USER);
  });

  // ============================================
  // TC-MY-001: Tabs display correctly
  // ============================================
  test('should display server and cluster reservation tabs', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations/mine`);
    await page.waitForLoadState('networkidle');

    // Check tabs exist
    await expect(page.getByRole('tab', { name: /服务器预约|server/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /集群预约|cluster/i })).toBeVisible();
  });

  // ============================================
  // TC-MY-002: Navigation buttons work
  // ============================================
  test('should have working navigation buttons', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations/mine`);
    await page.waitForLoadState('networkidle');

    // New Server Reservation button
    const newServerBtn = page.getByRole('button', { name: /服务器预约|server reservation/i });
    await expect(newServerBtn).toBeVisible();

    // New Cluster Reservation button
    const newClusterBtn = page.getByRole('button', { name: /集群预约|cluster reservation/i });
    await expect(newClusterBtn).toBeVisible();

    // Calendar button
    const calendarBtn = page.getByRole('button', { name: /日历|calendar/i });
    await expect(calendarBtn).toBeVisible();
  });

  // ============================================
  // TC-MY-003: Click calendar button navigates correctly
  // ============================================
  test('should navigate to calendar on button click', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations/mine`);
    await page.waitForLoadState('networkidle');

    // Click calendar button
    await page.getByRole('button', { name: /日历|calendar/i }).click();

    // Should navigate to /reservations
    await expect(page).toHaveURL(/\/reservations$/);
  });
});

test.describe('Navigation — Button Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USER);
  });

  // ============================================
  // TC-NAV-001: New Server Reservation button from calendar
  // ============================================
  test('should navigate to new reservation form from calendar page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations`);
    await page.waitForLoadState('networkidle');

    // Click New Server Reservation button
    await page.getByRole('button', { name: /服务器预约|server reservation/i }).click();

    // Should navigate to /reservations/new
    await expect(page).toHaveURL(/\/reservations\/new/);
  });

  // ============================================
  // TC-NAV-002: New Cluster Reservation button from calendar
  // ============================================
  test('should navigate to cluster reservation form from calendar page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations`);
    await page.waitForLoadState('networkidle');

    // Click New Cluster Reservation button
    await page.getByRole('button', { name: /集群预约|cluster reservation/i }).click();

    // Should navigate to /reservations/cluster
    await expect(page).toHaveURL(/\/reservations\/cluster/);
  });

  // ============================================
  // TC-NAV-003: My Reservations button from calendar
  // ============================================
  test('should navigate to my reservations from calendar page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/reservations`);
    await page.waitForLoadState('networkidle');

    // Click My Reservations button
    await page.getByRole('button', { name: /我的预约|my reservation/i }).click();

    // Should navigate to /reservations/mine
    await expect(page).toHaveURL(/\/reservations\/mine/);
  });
});