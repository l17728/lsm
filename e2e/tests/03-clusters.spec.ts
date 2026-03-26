/**
 * E2E — Cluster Management
 *
 * Covers:
 * - Cluster list display
 * - Cluster creation
 * - Cluster editing
 * - Cluster deletion
 * - Cluster statistics
 * - Permission checks
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const ADMIN_USER = {
  username: process.env.TEST_ADMIN_USERNAME || 'admin',
  password: process.env.TEST_ADMIN_PASSWORD || 'Admin123',
};

test.describe('Cluster Management API', () => {
  let accessToken: string;
  let refreshToken: string;
  let createdClusterId: string;

  test.beforeAll(async ({ request }) => {
    // Login to get tokens
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        username: ADMIN_USER.username,
        password: ADMIN_USER.password,
      },
    });

    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    accessToken = loginBody.data.token;
    refreshToken = loginBody.data.refreshToken;
  });

  test.describe('Cluster List & Stats', () => {
    test('should get all clusters', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/clusters`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should get cluster statistics', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/clusters/stats`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('total');
      expect(body.data).toHaveProperty('byStatus');
      expect(body.data).toHaveProperty('resources');
    });

    test('should reject request without authentication', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/clusters`);

      expect(response.status()).toBe(401);
    });
  });

  test.describe('Cluster CRUD Operations', () => {
    test('should create a new cluster', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/clusters`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          name: 'E2E Test Cluster',
          code: `E2E_${Date.now()}`,
          description: 'Cluster created by E2E test',
          type: 'COMPUTE',
        },
      });

      expect([200, 201]).toContain(response.status());
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('E2E Test Cluster');
      
      createdClusterId = body.data.id;
    });

    test('should get cluster by ID', async ({ request }) => {
      test.skip(!createdClusterId, 'No cluster created');

      const response = await request.get(
        `${BASE_URL}/api/clusters/${createdClusterId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdClusterId);
    });

    test('should update cluster', async ({ request }) => {
      test.skip(!createdClusterId, 'No cluster created');

      const response = await request.put(
        `${BASE_URL}/api/clusters/${createdClusterId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          data: {
            name: 'E2E Test Cluster Updated',
            description: 'Updated description',
          },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('E2E Test Cluster Updated');
    });

    test('should reject creation with invalid code format', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/clusters`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          name: 'Invalid Code Cluster',
          code: 'invalid-code-!', // Invalid: contains special characters
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should reject creation with missing required fields', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/clusters`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          description: 'Missing name and code',
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should return 404 for non-existent cluster', async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/clusters/00000000-0000-0000-0000-000000000000`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status()).toBe(404);
    });
  });

  test.describe('Cluster Server Management', () => {
    test('should get available servers', async ({ request }) => {
      const response = await request.get(
        `${BASE_URL}/api/clusters/available-servers`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // This endpoint requires SUPER_ADMIN
      expect([200, 403]).toContain(response.status());
    });
  });

  test.describe('Cleanup', () => {
    test('should delete created cluster', async ({ request }) => {
      test.skip(!createdClusterId, 'No cluster to delete');

      const response = await request.delete(
        `${BASE_URL}/api/clusters/${createdClusterId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });
});

test.describe('Cluster Permission Checks', () => {
  test('should require authentication for all cluster endpoints', async ({ request }) => {
    const endpoints = [
      { method: 'GET', path: '/api/clusters' },
      { method: 'GET', path: '/api/clusters/stats' },
      { method: 'GET', path: '/api/clusters/test-id' },
      { method: 'POST', path: '/api/clusters' },
      { method: 'PUT', path: '/api/clusters/test-id' },
      { method: 'DELETE', path: '/api/clusters/test-id' },
    ];

    for (const endpoint of endpoints) {
      const response = await request[endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](
        `${BASE_URL}${endpoint.path}`
      );
      expect(response.status()).toBe(401);
    }
  });
});

test.describe('Cluster Validation', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        username: ADMIN_USER.username,
        password: ADMIN_USER.password,
      },
    });

    const loginBody = await loginResponse.json();
    accessToken = loginBody.data.token;
  });

  test('should reject duplicate cluster code', async ({ request }) => {
    const code = `DUP_${Date.now()}`;

    // Create first cluster
    await request.post(`${BASE_URL}/api/clusters`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: 'First Cluster', code },
    });

    // Try to create duplicate
    const response = await request.post(`${BASE_URL}/api/clusters`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: 'Second Cluster', code },
    });

    expect(response.status()).toBe(400);

    // Cleanup
    const clusters = await request.get(`${BASE_URL}/api/clusters`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await clusters.json();
    const created = body.data.find((c: any) => c.code === code);
    if (created) {
      await request.delete(`${BASE_URL}/api/clusters/${created.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
  });

  test('should validate cluster type values', async ({ request }) => {
    const validTypes = ['COMPUTE', 'TRAINING', 'INFERENCE', 'GENERAL', 'CUSTOM'];

    for (const type of validTypes) {
      const response = await request.post(`${BASE_URL}/api/clusters`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          name: `Type Test ${type}`,
          code: `TYPE_${type}_${Date.now()}`,
          type,
        },
      });

      expect([200, 201]).toContain(response.status());

      // Cleanup
      const body = await response.json();
      if (body.data?.id) {
        await request.delete(`${BASE_URL}/api/clusters/${body.data.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    }
  });
});