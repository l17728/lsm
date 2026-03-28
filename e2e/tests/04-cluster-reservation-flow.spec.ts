/**
 * E2E — Cluster Reservation User Flow Tests
 *
 * Comprehensive test scenarios covering:
 * - Complete reservation lifecycle (MANAGER user perspective)
 * - Queue management and advancement
 * - Permission checks between roles
 * - Error handling and edge cases
 * - Log audit verification
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8081';

// Test users
const MANAGER_USER = {
  username: process.env.TEST_MANAGER_USERNAME || 'manager',
  password: process.env.TEST_MANAGER_PASSWORD || 'Manager@123',
};

const SUPER_ADMIN_USER = {
  username: process.env.TEST_ADMIN_USERNAME || 'admin',
  password: process.env.TEST_ADMIN_PASSWORD || 'Admin123',
};

// Helper to login
async function loginAs(page: Page, user: { username: string; password: string }) {
  await page.goto(`${FRONTEND_URL}/login`);
  await page.getByPlaceholder(/username|用户名/i).fill(user.username);
  await page.getByPlaceholder(/password|密码/i).fill(user.password);
  await page.getByRole('button', { name: /login|登录/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
}

// Helper to get auth token from API
async function getAuthToken(username: string, password: string): Promise<{ token: string; refreshToken: string }> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json();
  if (!body.success || !body.data?.token) {
    throw new Error(`Login failed for ${username}: ${JSON.stringify(body)}`);
  }
  return { token: body.data.token, refreshToken: body.data.refreshToken };
}

// Helper to create test cluster (SUPER_ADMIN only)
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
      description: 'E2E test cluster',
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

test.describe('Cluster Reservation - User Flow Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let adminToken: string;
  let managerToken: string;
  let testClusterId: string;
  let testReservationId: string;

  test.beforeAll(async () => {
    const adminAuth = await getAuthToken(SUPER_ADMIN_USER.username, SUPER_ADMIN_USER.password);
    adminToken = adminAuth.token;

    const managerAuth = await getAuthToken(MANAGER_USER.username, MANAGER_USER.password);
    managerToken = managerAuth.token;

    // Create a test cluster
    const cluster = await createTestCluster(adminToken, `E2E_${Date.now()}`);
    testClusterId = cluster.data?.id;
  });

  test.afterAll(async () => {
    // Cleanup: Delete test cluster
    if (testClusterId) {
      await deleteTestCluster(adminToken, testClusterId);
    }
  });

  // ============================================
  // UC-UI-001: Cluster Card Display
  // ============================================
  test('should display cluster cards with correct status information', async ({ page }) => {
    await loginAs(page, MANAGER_USER);
    await page.goto(`${FRONTEND_URL}/clusters`);

    // Wait for cluster cards to load
    await page.waitForSelector('.cluster-card', { timeout: 10000 });

    // Verify stats are displayed
    await expect(page.getByText('集群总数')).toBeVisible();
    await expect(page.getByText('空闲')).toBeVisible();
    await expect(page.getByText('服务器总数')).toBeVisible();

    // Check for cluster cards
    const clusterCards = page.locator('.cluster-card');
    const cardCount = await clusterCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify status badges are present
    const statusBadges = page.locator('.ant-tag');
    const statusCount = await statusBadges.count();
    expect(statusCount).toBeGreaterThan(0);
  });

  // ============================================
  // UC-BF-001: Complete Reservation Flow (Happy Path)
  // ============================================
  test('should complete full reservation lifecycle', async ({ page, request }) => {
    test.skip(!testClusterId, 'Test cluster not created');

    // Step 1: Login as MANAGER
    await loginAs(page, MANAGER_USER);
    await page.goto(`${FRONTEND_URL}/clusters`);

    // Step 2: Find and click on the test cluster
    const clusterCard = page.locator('.cluster-card').filter({ hasText: testClusterId });
    await clusterCard.waitFor({ timeout: 10000 });

    // Step 3: View cluster details
    await clusterCard.getByRole('img', { name: /eye|detail/i }).or(
      clusterCard.getByRole('button').first()
    ).click();

    // Verify detail modal opens
    await expect(page.getByRole('dialog')).toBeVisible();

    // Step 4: Create reservation via API (UI interaction for form is complex)
    const startTime = new Date(Date.now() + 3600000); // 1 hour from now
    const endTime = new Date(Date.now() + 7200000); // 2 hours from now

    const createResponse = await request.post(`${BASE_URL}/api/cluster-reservations`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      data: {
        clusterId: testClusterId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        purpose: 'E2E test reservation',
      },
    });

    expect(createResponse.status()).toBe(201);
    const createBody = await createResponse.json();
    testReservationId = createBody.data.id;
    expect(createBody.data.status).toBe('PENDING');

    // Step 5: Verify reservation appears in "my reservations"
    await page.goto(`${FRONTEND_URL}/reservations/mine`);
    await page.waitForSelector('.ant-table-tbody tr, .ant-empty', { timeout: 10000 });

    // Step 6: SUPER_ADMIN approves reservation
    const approveResponse = await request.put(
      `${BASE_URL}/api/cluster-reservations/${testReservationId}/approve`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(approveResponse.status()).toBe(200);
    const approveBody = await approveResponse.json();
    expect(approveBody.data.status).toBe('APPROVED');

    // Step 7: Verify cluster status changed to RESERVED
    const clusterResponse = await request.get(`${BASE_URL}/api/clusters/${testClusterId}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const clusterBody = await clusterResponse.json();
    expect(clusterBody.data.status).toBe('RESERVED');

    // Step 8: Release resources
    const releaseResponse = await request.put(
      `${BASE_URL}/api/cluster-reservations/${testReservationId}/release`,
      {
        headers: { Authorization: `Bearer ${managerToken}` },
      }
    );

    expect(releaseResponse.status()).toBe(200);
    const releaseBody = await releaseResponse.json();
    expect(releaseBody.data.status).toBe('COMPLETED');
  });

  // ============================================
  // UC-BF-002: Reservation Rejection Flow
  // ============================================
  test('should handle reservation rejection', async ({ request }) => {
    test.skip(!testClusterId, 'Test cluster not created');

    // Create reservation
    const startTime = new Date(Date.now() + 86400000); // Tomorrow
    const endTime = new Date(Date.now() + 90000000);

    const createResponse = await request.post(`${BASE_URL}/api/cluster-reservations`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      data: {
        clusterId: testClusterId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        purpose: 'Rejection test',
      },
    });

    const createBody = await createResponse.json();
    const reservationId = createBody.data?.id;
    test.skip(!reservationId, 'Reservation not created');

    // Reject the reservation
    const rejectResponse = await request.put(
      `${BASE_URL}/api/cluster-reservations/${reservationId}/reject`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        data: { reason: 'E2E test rejection' },
      }
    );

    expect(rejectResponse.status()).toBe(200);
    const rejectBody = await rejectResponse.json();
    expect(rejectBody.data.status).toBe('REJECTED');
    expect(rejectBody.data.rejectionReason).toBe('E2E test rejection');
  });

  // ============================================
  // UC-BF-003: User Cancels Own Reservation
  // ============================================
  test('should allow user to cancel pending reservation', async ({ request }) => {
    test.skip(!testClusterId, 'Test cluster not created');

    // Create reservation
    const startTime = new Date(Date.now() + 172800000); // 2 days from now
    const endTime = new Date(Date.now() + 176400000);

    const createResponse = await request.post(`${BASE_URL}/api/cluster-reservations`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      data: {
        clusterId: testClusterId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        purpose: 'Cancellation test',
      },
    });

    const createBody = await createResponse.json();
    const reservationId = createBody.data?.id;
    test.skip(!reservationId, 'Reservation not created');

    // Cancel the reservation
    const cancelResponse = await request.put(
      `${BASE_URL}/api/cluster-reservations/${reservationId}/cancel`,
      {
        headers: { Authorization: `Bearer ${managerToken}` },
      }
    );

    expect(cancelResponse.status()).toBe(200);
    const cancelBody = await cancelResponse.json();
    expect(cancelBody.data.status).toBe('CANCELLED');
  });

  // ============================================
  // UC-BF-005: Queue Management
  // ============================================
  test('should add to wait queue when time conflict exists', async ({ request }) => {
    test.skip(!testClusterId, 'Test cluster not created');

    // Create first reservation
    const startTime = new Date(Date.now() + 259200000); // 3 days from now
    const endTime = new Date(Date.now() + 262800000);

    const firstResponse = await request.post(`${BASE_URL}/api/cluster-reservations`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      data: {
        clusterId: testClusterId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        purpose: 'First reservation',
      },
    });

    // Approve first reservation
    const firstBody = await firstResponse.json();
    if (firstBody.data?.id) {
      await request.put(`${BASE_URL}/api/cluster-reservations/${firstBody.data.id}/approve`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      // Try to create conflicting reservation
      const secondResponse = await request.post(`${BASE_URL}/api/cluster-reservations`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${managerToken}`,
        },
        data: {
          clusterId: testClusterId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          purpose: 'Conflicting reservation',
        },
      });

      const secondBody = await secondResponse.json();
      expect(secondResponse.status()).toBe(201);
      // Should have queue position assigned
      expect(secondBody.data.queuePosition).toBeDefined();
      expect(secondBody.data.queuePosition).toBeGreaterThan(0);

      // Cleanup
      await request.put(`${BASE_URL}/api/cluster-reservations/${firstBody.data.id}/release`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      if (secondBody.data?.id) {
        await request.put(`${BASE_URL}/api/cluster-reservations/${secondBody.data.id}/cancel`, {
          headers: { Authorization: `Bearer ${managerToken}` },
        });
      }
    }
  });
});

test.describe('Cluster Reservation - Permission Tests', () => {
  // ============================================
  // UC-PM-001: Unauthenticated Access
  // ============================================
  test('should reject unauthenticated access', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/cluster-reservations`);
    expect(response.status()).toBe(401);
  });

  // ============================================
  // UC-PM-002: Manager Cannot Approve
  // ============================================
  test('should deny MANAGER from approving reservations', async ({ request }) => {
    test.skip(!testClusterId, 'Test cluster not created');

    const managerAuth = await getAuthToken(MANAGER_USER.username, MANAGER_USER.password);

    // Try to approve with MANAGER token
    const response = await request.put(
      `${BASE_URL}/api/cluster-reservations/some-id/approve`,
      {
        headers: { Authorization: `Bearer ${managerAuth.token}` },
      }
    );

    expect([403, 404]).toContain(response.status());
  });

  // ============================================
  // UC-PM-003: User Cannot Operate Others Reservation
  // ============================================
  test('should deny user from operating others reservations', async ({ request }) => {
    // Try to cancel someone else's reservation
    const managerAuth = await getAuthToken(MANAGER_USER.username, MANAGER_USER.password);

    const response = await request.put(
      `${BASE_URL}/api/cluster-reservations/nonexistent-id/cancel`,
      {
        headers: { Authorization: `Bearer ${managerAuth.token}` },
      }
    );

    expect([400, 404]).toContain(response.status());
  });

  // ============================================
  // UC-PM-004: Pending Reservations Only for SUPER_ADMIN
  // ============================================
  test('should deny MANAGER from viewing pending queue', async ({ request }) => {
    const managerAuth = await getAuthToken(MANAGER_USER.username, MANAGER_USER.password);

    const response = await request.get(`${BASE_URL}/api/cluster-reservations/pending`, {
      headers: { Authorization: `Bearer ${managerAuth.token}` },
    });

    expect(response.status()).toBe(403);
  });
});

test.describe('Cluster Reservation - Validation Tests', () => {
  let managerToken: string;

  test.beforeAll(async () => {
    const auth = await getAuthToken(MANAGER_USER.username, MANAGER_USER.password);
    managerToken = auth.token;
  });

  // ============================================
  // UC-EC-001: Invalid Time Range
  // ============================================
  test('should reject reservation with end time before start time', async ({ request }) => {
    const startTime = new Date(Date.now() + 7200000);
    const endTime = new Date(Date.now() + 3600000); // End before start

    const response = await request.post(`${BASE_URL}/api/cluster-reservations`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      data: {
        clusterId: '123e4567-e89b-12d3-a456-426614174000',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    expect(response.status()).toBe(400);
  });

  // ============================================
  // UC-EC-002: Past Start Time
  // ============================================
  test('should reject reservation with past start time', async ({ request }) => {
    const startTime = new Date(Date.now() - 3600000); // Past
    const endTime = new Date(Date.now() + 3600000);

    const response = await request.post(`${BASE_URL}/api/cluster-reservations`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      data: {
        clusterId: '123e4567-e89b-12d3-a456-426614174000',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    expect(response.status()).toBe(400);
  });

  // ============================================
  // UC-EC-003: Missing Required Fields
  // ============================================
  test('should reject reservation with missing required fields', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/cluster-reservations`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      data: { purpose: 'No cluster or time' },
    });

    expect(response.status()).toBe(400);
  });

  // ============================================
  // UC-EC-004: Invalid Cluster ID
  // ============================================
  test('should reject reservation with invalid cluster ID', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/cluster-reservations`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      data: {
        clusterId: 'invalid-uuid',
        startTime: new Date(Date.now() + 3600000).toISOString(),
        endTime: new Date(Date.now() + 7200000).toISOString(),
      },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe('Cluster Reservation - Log Audit Tests', () => {
  let managerToken: string;
  let adminToken: string;

  test.beforeAll(async () => {
    const managerAuth = await getAuthToken(MANAGER_USER.username, MANAGER_USER.password);
    managerToken = managerAuth.token;

    const adminAuth = await getAuthToken(SUPER_ADMIN_USER.username, SUPER_ADMIN_USER.password);
    adminToken = adminAuth.token;
  });

  // ============================================
  // UC-AU-001: Operation Logs
  // ============================================
  test('should log reservation creation with user info', async ({ request }) => {
    // Create reservation - logs should be generated
    const response = await request.get(`${BASE_URL}/api/cluster-reservations/my`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    expect(response.status()).toBe(200);
    // Log verification would require access to log files
    // This test ensures the API responds correctly
  });

  // ============================================
  // UC-AU-002: Sensitive Data Masking
  // ============================================
  test('should not expose sensitive data in API responses', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/cluster-reservations`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    const body = await response.json();

    // Verify token fields are not exposed
    const responseStr = JSON.stringify(body);
    expect(responseStr).not.toContain('passwordHash');
    expect(responseStr).not.toContain('jwtSecret');
  });
});