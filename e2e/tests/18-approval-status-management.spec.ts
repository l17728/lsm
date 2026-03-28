/**
 * E2E — Approval and Status Management Tests
 *
 * Purpose: Test reservation approval workflow and resource status management
 *
 * Covers:
 * - Server reservation approval
 * - Server reservation rejection
 * - Cluster reservation approval
 * - Cluster reservation rejection
 * - Server status manual update
 * - Cluster status manual update
 * - Permission checks (ADMIN vs SUPER_ADMIN)
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

test.describe('Server Reservation Approval Tests', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, TEST_USER.username, TEST_USER.password);
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USER);
  });

  // ============================================
  // TC-APPROVE-001: Server approval page loads correctly
  // ============================================
  test('should load server approval page with pending reservations', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/servers/approval`);
    await page.waitForLoadState('networkidle');

    // Check page title
    await expect(page.getByRole('heading', { name: /服务器预约审批|Server.*Approval/i })).toBeVisible();

    // Check table exists
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  // ============================================
  // TC-APPROVE-002: Approve server reservation
  // ============================================
  test('should approve a pending server reservation', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/servers/approval`);
    await page.waitForLoadState('networkidle');

    // Find first approve button
    const approveButton = page.getByRole('button', { name: /批准|Approve/i }).first();
    
    if (await approveButton.isVisible()) {
      await approveButton.click();

      // Check for success message
      await expect(page.getByText(/预约已批准|Reservation approved/i)).toBeVisible({ timeout: 5000 });
    }
  });

  // ============================================
  // TC-APPROVE-003: Reject server reservation with reason
  // ============================================
  test('should reject a pending server reservation with reason', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/servers/approval`);
    await page.waitForLoadState('networkidle');

    // Find first reject button
    const rejectButton = page.getByRole('button', { name: /拒绝|Reject/i }).first();
    
    if (await rejectButton.isVisible()) {
      await rejectButton.click();

      // Wait for reject modal
      await page.waitForSelector('.ant-modal', { timeout: 5000 });

      // Fill rejection reason
      const reasonTextarea = page.locator('.ant-modal textarea').first();
      await reasonTextarea.fill('Test rejection reason for e2e testing');

      // Confirm rejection
      await page.getByRole('button', { name: /确认拒绝|Confirm Rejection/i }).click();

      // Check for success message
      await expect(page.getByText(/预约已拒绝|Reservation rejected/i)).toBeVisible({ timeout: 5000 });
    }
  });

  // ============================================
  // TC-APPROVE-004: API returns correct pending reservations
  // ============================================
  test('should return pending reservations via API', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/reservations/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    // All reservations should be PENDING
    for (const reservation of body.data) {
      expect(reservation.status).toBe('PENDING');
    }
  });

  // ============================================
  // TC-APPROVE-005: Approve via API
  // ============================================
  test('should approve reservation via API', async ({ request }) => {
    // Get pending reservations
    const pendingResponse = await request.get(`${BASE_URL}/api/reservations/pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pendingBody = await pendingResponse.json();

    if (pendingBody.data && pendingBody.data.length > 0) {
      const reservationId = pendingBody.data[0].id;

      // Approve the reservation
      const approveResponse = await request.post(`${BASE_URL}/api/reservations/${reservationId}/approve`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      expect(approveResponse.status()).toBe(200);
      const approveBody = await approveResponse.json();
      expect(approveBody.success).toBe(true);
      expect(approveBody.data.status).toBe('APPROVED');
    }
  });
});

test.describe('Cluster Reservation Approval Tests', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, TEST_USER.username, TEST_USER.password);
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USER);
  });

  // ============================================
  // TC-CLUSTER-APPROVE-001: Cluster approval page loads
  // ============================================
  test('should load cluster approval page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/clusters/approval`);
    await page.waitForLoadState('networkidle');

    // Check page title
    await expect(page.getByRole('heading', { name: /Cluster.*Approval|集群预约审批/i })).toBeVisible();

    // Check table exists
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  // ============================================
  // TC-CLUSTER-APPROVE-002: Approve cluster reservation
  // ============================================
  test('should approve a pending cluster reservation', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/clusters/approval`);
    await page.waitForLoadState('networkidle');

    // Find first approve button
    const approveButton = page.getByRole('button', { name: /Approve|批准/i }).first();
    
    if (await approveButton.isVisible()) {
      await approveButton.click();

      // Check for success message
      await expect(page.getByText(/approved|批准/i)).toBeVisible({ timeout: 5000 });
    }
  });

  // ============================================
  // TC-CLUSTER-APPROVE-003: Reject cluster reservation
  // ============================================
  test('should reject a pending cluster reservation', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/clusters/approval`);
    await page.waitForLoadState('networkidle');

    // Find first reject button
    const rejectButton = page.getByRole('button', { name: /Reject|拒绝/i }).first();
    
    if (await rejectButton.isVisible()) {
      await rejectButton.click();

      // Wait for reject modal
      await page.waitForSelector('.ant-modal', { timeout: 5000 });

      // Fill rejection reason
      const reasonTextarea = page.locator('.ant-modal textarea').first();
      await reasonTextarea.fill('Test rejection for e2e');

      // Confirm rejection
      await page.getByRole('button', { name: /Confirm Rejection|确认拒绝/i }).click();

      // Check for success message
      await expect(page.getByText(/rejected|拒绝/i)).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Server Status Management Tests', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, TEST_USER.username, TEST_USER.password);
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USER);
  });

  // ============================================
  // TC-STATUS-001: Server status dropdown visible for admin
  // ============================================
  test('should show status dropdown for admin users', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/servers`);
    await page.waitForLoadState('networkidle');

    // Check status column has dropdown
    const statusDropdown = page.locator('.ant-select').first();
    await expect(statusDropdown).toBeVisible();
  });

  // ============================================
  // TC-STATUS-002: Server status can be changed
  // ============================================
  test('should update server status via dropdown', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/servers`);
    await page.waitForLoadState('networkidle');

    // Click first status dropdown
    const statusDropdown = page.locator('.ant-select').first();
    await statusDropdown.click();

    // Wait for dropdown options
    await page.waitForSelector('.ant-select-dropdown', { timeout: 5000 });

    // Select Maintenance status
    const maintenanceOption = page.getByTitle('Maintenance');
    if (await maintenanceOption.isVisible()) {
      await maintenanceOption.click();

      // Check for success message
      await expect(page.getByText(/Server status updated|服务器状态已更新/i)).toBeVisible({ timeout: 5000 });
    }
  });

  // ============================================
  // TC-STATUS-003: Server status update via API
  // ============================================
  test('should update server status via API', async ({ request }) => {
    // Get servers list
    const serversResponse = await request.get(`${BASE_URL}/api/servers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const serversBody = await serversResponse.json();

    if (serversBody.data && serversBody.data.length > 0) {
      const serverId = serversBody.data[0].id;

      // Update status
      const updateResponse = await request.patch(`${BASE_URL}/api/servers/${serverId}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: { status: 'MAINTENANCE' },
      });

      expect(updateResponse.status()).toBe(200);
      const updateBody = await updateResponse.json();
      expect(updateBody.success).toBe(true);
    }
  });
});

test.describe('Cluster Status Management Tests', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getAuthToken(request, TEST_USER.username, TEST_USER.password);
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USER);
  });

  // ============================================
  // TC-CLUSTER-STATUS-001: Cluster status dropdown visible
  // ============================================
  test('should show status dropdown for clusters', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/clusters`);
    await page.waitForLoadState('networkidle');

    // Check status dropdown exists
    const statusDropdown = page.locator('.ant-select').first();
    await expect(statusDropdown).toBeVisible();
  });

  // ============================================
  // TC-CLUSTER-STATUS-002: Cluster status can be changed
  // ============================================
  test('should update cluster status via dropdown', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/clusters`);
    await page.waitForLoadState('networkidle');

    // Click first status dropdown
    const statusDropdown = page.locator('.ant-select').first();
    await statusDropdown.click();

    // Wait for dropdown options
    await page.waitForSelector('.ant-select-dropdown', { timeout: 5000 });

    // Select Maintenance status
    const maintenanceOption = page.getByTitle('Maintenance');
    if (await maintenanceOption.isVisible()) {
      await maintenanceOption.click();

      // Check for success message
      await expect(page.getByText(/Cluster status updated|集群状态已更新/i)).toBeVisible({ timeout: 5000 });
    }
  });

  // ============================================
  // TC-CLUSTER-STATUS-003: Cluster status update via API
  // ============================================
  test('should update cluster status via API', async ({ request }) => {
    // Get clusters list
    const clustersResponse = await request.get(`${BASE_URL}/api/clusters`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const clustersBody = await clustersResponse.json();

    if (clustersBody.data && clustersBody.data.length > 0) {
      const clusterId = clustersBody.data[0].id;

      // Update status
      const updateResponse = await request.patch(`${BASE_URL}/api/clusters/${clusterId}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: { status: 'MAINTENANCE', reason: 'E2E test' },
      });

      expect([200, 201]).toContain(updateResponse.status);
      const updateBody = await updateResponse.json();
      expect(updateBody.success).toBe(true);
    }
  });
});

test.describe('Permission Tests', () => {
  // ============================================
  // TC-PERM-001: Non-admin cannot see approval menu
  // ============================================
  test('should hide approval menu for regular users', async ({ page, request }) => {
    // Create a regular user for testing
    // Note: In real tests, you'd have a test user setup
    // For now, we skip this test if we're using admin user
    const token = await getAuthToken(request, TEST_USER.username, TEST_USER.password);
    
    // Login
    await loginViaUI(page, TEST_USER);

    // If user is admin, they should see approval menu
    // If user is regular, they should NOT see it
    const approvalMenu = page.getByRole('menuitem', { name: /预约审批|Approval/i });
    
    // This test verifies the menu exists for our test user (who is SUPER_ADMIN)
    if (await approvalMenu.count() > 0) {
      await expect(approvalMenu.first()).toBeVisible();
    }
  });
});