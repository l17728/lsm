import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Integration Tests for LSM API
 */
describe('LSM API Integration Tests', () => {
  let app: any;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Import app dynamically
    app = require('../../index').app;
  });

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: '$2b$10$test',
        role: 'USER',
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
  });

  describe('Authentication', () => {
    it('should login successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      authToken = response.body.data.token;
    });

    it('should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Protected Routes', () => {
    beforeEach(() => {
      // Mock authenticated user
      authToken = 'mock-token';
    });

    it('should access protected route with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });

  describe('Server Management', () => {
    let serverId: string;

    it('should create server', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Server',
          gpuCount: 4,
          location: 'Test DC',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      serverId = response.body.data.id;
    });

    it('should get servers list', async () => {
      const response = await request(app)
        .get('/api/servers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should update server', async () => {
      const response = await request(app)
        .put(`/api/servers/${serverId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'ONLINE',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('ONLINE');
    });

    it('should delete server', async () => {
      const response = await request(app)
        .delete(`/api/servers/${serverId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GPU Management', () => {
    it('should get available GPUs', async () => {
      const response = await request(app)
        .get('/api/gpus')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Task Management', () => {
    let taskId: string;

    it('should create task', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Task',
          priority: 'HIGH',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      taskId = response.body.data.id;
    });

    it('should get tasks list', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should update task status', async () => {
      const response = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'RUNNING',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('RUNNING');
    });

    it('should cancel task', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('CANCELLED');
    });
  });

  describe('Monitoring', () => {
    it('should get cluster stats', async () => {
      const response = await request(app)
        .get('/api/monitoring/cluster-stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('totalServers');
    });

    it('should get alerts', async () => {
      const response = await request(app)
        .get('/api/monitoring/alerts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Data Export', () => {
    it('should export servers to CSV', async () => {
      const response = await request(app)
        .get('/api/export/servers/csv')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should export users to Excel', async () => {
      const response = await request(app)
        .get('/api/export/users/excel')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle 404', async () => {
      const response = await request(app).get('/api/nonexistent');

      expect(response.status).toBe(404);
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
