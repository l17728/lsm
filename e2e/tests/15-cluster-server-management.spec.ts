/**
 * E2E — Cluster Server Management (SUPER_ADMIN)
 *
 * Tests:
 * - SUPER_ADMIN can add servers to cluster
 * - SUPER_ADMIN can remove servers from cluster
 * - Non-SUPER_ADMIN cannot see manage servers button
 * - UI verification of server management modal
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8081';

// Test users - MUST use SUPER_ADMIN for cluster management
const SUPER_ADMIN_USER = {
  username: process.env.TEST_SUPER_ADMIN_USERNAME || 'superadmin',
  password: process.env.TEST_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
};

const MANAGER_USER = {
  username: process.env.TEST_MANAGER_USERNAME || 'manager',
  password: process.env.TEST_MANAGER_PASSWORD || 'Manager@123',
};

// Helper to login via UI
async function loginAs(page: Page, user: { username: string; password: string }) {
  await page.goto(`${FRONTEND_URL}/login`);
  await page.getByPlaceholder(/username|用户名/i).fill(user.username);
  await page.getByPlaceholder(/password|密码/i).fill(user.password);
  await page.getByRole('button', { name: /login|登录/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
}

// Helper to get auth token from API
async function getAuthToken(username: string, password: string): Promise<{ token: string }> {
  // Add small delay to prevent race condition with token generation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json();
  if (!body.success || !body.data?.token) {
    throw new Error(`Login failed for ${username}: ${JSON.stringify(body)}`);
  }
  return { token: body.data.token };
}

// Helper to create test server via API
async function createTestServer(token: string, name: string) {
  const response = await fetch(`${BASE_URL}/api/servers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      hostname: `${name.toLowerCase().replace(/\s+/g, '-')}.local`,
      ipAddress: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      cpuCores: 8,
      totalMemory: 64,
      gpuCount: 2,
      status: 'ONLINE',
    }),
  });
  return response.json();
}

// Helper to create test cluster via API
async function createTestCluster(token: string, code: string) {
  const response = await fetch(`${BASE_URL}/api/clusters`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: `Test Cluster ${code}`,
      code,
      type: 'COMPUTE',
      description: 'E2E test cluster for server management',
    }),
  });
  return response.json();
}

// Helper to delete test cluster
async function deleteTestCluster(token: string, clusterId: string) {
  await fetch(`${BASE_URL}/api/clusters/${clusterId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Helper to delete test server
async function deleteTestServer(token: string, serverId: string) {
  await fetch(`${BASE_URL}/api/servers/${serverId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

test.describe('Cluster Server Management - SUPER_ADMIN', () => {
  test.describe.configure({ mode: 'serial' });

  let superAdminToken: string;
  let managerToken: string;
  let testClusterId: string;
  let testClusterName: string;
  let testServerId: string;

  test.beforeAll(async () => {
    // Get tokens
    superAdminToken = (await getAuthToken(SUPER_ADMIN_USER.username, SUPER_ADMIN_USER.password)).token;
    managerToken = (await getAuthToken(MANAGER_USER.username, MANAGER_USER.password)).token;

    // Create test cluster
    const cluster = await createTestCluster(superAdminToken, `SRV_MGT_${Date.now()}`);
    testClusterId = cluster.data?.id;
    testClusterName = cluster.data?.name;
    console.log(`Created test cluster: ${testClusterId}, name: ${testClusterName}`);

    // Create test server
    const server = await createTestServer(superAdminToken, `Test Server ${Date.now()}`);
    testServerId = server.data?.id;
    console.log(`Created test server: ${testServerId}`);
  });

  test.afterAll(async () => {
    // Cleanup
    if (testClusterId) {
      await deleteTestCluster(superAdminToken, testClusterId);
    }
    if (testServerId) {
      await deleteTestServer(superAdminToken, testServerId);
    }
  });

  // ============================================
  // Test 1: SUPER_ADMIN sees manage servers button
  // ============================================
  test('SUPER_ADMIN should see manage servers button on cluster card', async ({ page }) => {
    test.skip(!testClusterId, 'Test cluster not created');

    await loginAs(page, SUPER_ADMIN_USER);
    await page.goto(`${FRONTEND_URL}/clusters`);

    // Wait for cluster cards
    await page.waitForSelector('.cluster-card', { timeout: 10000 });

    // Find the test cluster card by name (ID is not displayed on card)
    const clusterCard = page.locator('.cluster-card').filter({ hasText: testClusterName }).first();
    await clusterCard.waitFor({ timeout: 10000 });

    // Verify the card has action icons
    const actionIcons = clusterCard.locator('.ant-card-actions li');
    const count = await actionIcons.count();
    
    // SUPER_ADMIN should have: view detail, view servers, manage servers (3 actions)
    expect(count).toBeGreaterThanOrEqual(3);
  });

  // ============================================
  // Test 2: MANAGER does NOT see manage servers button
  // ============================================
  test('MANAGER should NOT see manage servers button', async ({ page }) => {
    test.skip(!testClusterId, 'Test cluster not created');

    await loginAs(page, MANAGER_USER);
    await page.goto(`${FRONTEND_URL}/clusters`);

    // Wait for cluster cards
    await page.waitForSelector('.cluster-card', { timeout: 10000 });

    // Find the test cluster card by name
    const clusterCard = page.locator('.cluster-card').filter({ hasText: testClusterName }).first();
    await clusterCard.waitFor({ timeout: 10000 });
    
    // Look for edit/manage icon - should not be present
    const editIcon = clusterCard.locator('[data-icon="edit"], .anticon-edit');
    const editCount = await editIcon.count();
    
    // MANAGER should not have manage servers button
    expect(editCount).toBe(0);
  });

  // ============================================
  // Test 3: Open manage servers modal
  // ============================================
  test('SUPER_ADMIN can open manage servers modal', async ({ page }) => {
    test.skip(!testClusterId, 'Test cluster not created');

    await loginAs(page, SUPER_ADMIN_USER);
    await page.goto(`${FRONTEND_URL}/clusters`);

    // Wait for cluster cards
    await page.waitForSelector('.cluster-card', { timeout: 10000 });

    // Find and click manage servers icon (edit icon)
    const clusterCard = page.locator('.cluster-card').filter({ hasText: testClusterName }).first();
    await clusterCard.waitFor({ timeout: 10000 });
    
    // Click the edit/manage icon (third action)
    const editIcon = clusterCard.locator('.anticon-edit').first();
    await editIcon.click();

    // Verify modal opens with title "管理服务器"
    const modal = page.locator('.ant-modal-content');
    await modal.waitFor({ timeout: 10000 });
    
    await expect(modal.getByText(/管理服务器|服务器列表/)).toBeVisible();
    
    // Verify current servers section
    await expect(modal.getByText(/当前服务器|暂无服务器/)).toBeVisible();
    
    // Verify add server form
    await expect(modal.getByPlaceholder(/选择服务器/)).toBeVisible();
  });

  // ============================================
  // Test 4: Add server to cluster via API
  // ============================================
  test('SUPER_ADMIN can add server to cluster', async ({ request }) => {
    test.skip(!testClusterId || !testServerId, 'Test resources not created');

    const response = await request.post(
      `${BASE_URL}/api/clusters/${testClusterId}/servers`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        data: {
          serverId: testServerId,
          priority: 1,
          role: 'WORKER',
        },
      }
    );

    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  // ============================================
  // Test 5: Verify server appears in cluster
  // ============================================
  test('Added server should appear in cluster detail', async ({ request }) => {
    test.skip(!testClusterId || !testServerId, 'Test resources not created');

    const response = await request.get(
      `${BASE_URL}/api/clusters/${testClusterId}`,
      {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    
    // Verify server is in cluster
    const servers = body.data?.servers || [];
    const foundServer = servers.find((s: any) => s.server?.id === testServerId);
    expect(foundServer).toBeDefined();
  });

  // ============================================
  // Test 6: Remove server from cluster
  // ============================================
  test('SUPER_ADMIN can remove server from cluster', async ({ request }) => {
    test.skip(!testClusterId || !testServerId, 'Test resources not created');

    const response = await request.delete(
      `${BASE_URL}/api/clusters/${testClusterId}/servers/${testServerId}`,
      {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  // ============================================
  // Test 7: Verify server removed from cluster
  // ============================================
  test('Removed server should not appear in cluster', async ({ request }) => {
    test.skip(!testClusterId, 'Test cluster not created');

    const response = await request.get(
      `${BASE_URL}/api/clusters/${testClusterId}`,
      {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    
    // Verify server is NOT in cluster
    const servers = body.data?.servers || [];
    expect(servers).toHaveLength(0);
  });
});

test.describe('Cluster Server Management - Permission Checks', () => {
  let managerToken: string;
  let testClusterId: string;
  let testServerId: string;

  test.beforeAll(async () => {
    const superAdminToken = (await getAuthToken(SUPER_ADMIN_USER.username, SUPER_ADMIN_USER.password)).token;
    managerToken = (await getAuthToken(MANAGER_USER.username, MANAGER_USER.password)).token;

    // Create test resources as SUPER_ADMIN
    const cluster = await createTestCluster(superAdminToken, `PERM_${Date.now()}`);
    testClusterId = cluster.data?.id;

    const server = await createTestServer(superAdminToken, `Perm Server ${Date.now()}`);
    testServerId = server.data?.id;
  });

  test.afterAll(async () => {
    const superAdminToken = (await getAuthToken(SUPER_ADMIN_USER.username, SUPER_ADMIN_USER.password)).token;
    if (testClusterId) await deleteTestCluster(superAdminToken, testClusterId);
    if (testServerId) await deleteTestServer(superAdminToken, testServerId);
  });

  test('MANAGER cannot add server to cluster', async ({ request }) => {
    test.skip(!testClusterId || !testServerId, 'Test resources not created');

    const response = await request.post(
      `${BASE_URL}/api/clusters/${testClusterId}/servers`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${managerToken}`,
        },
        data: {
          serverId: testServerId,
          priority: 1,
        },
      }
    );

    // Should be forbidden
    expect(response.status()).toBe(403);
  });

  test('MANAGER cannot remove server from cluster', async ({ request }) => {
    test.skip(!testClusterId || !testServerId, 'Test resources not created');

    const response = await request.delete(
      `${BASE_URL}/api/clusters/${testClusterId}/servers/${testServerId}`,
      {
        headers: { Authorization: `Bearer ${managerToken}` },
      }
    );

    // Should be forbidden
    expect(response.status()).toBe(403);
  });
});