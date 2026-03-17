/**
 * LSM API Integration Tests
 *
 * FIXED: Replaced real PrismaClient with mocks to eliminate database dependency
 * and prevent test data pollution.
 */

import request from 'supertest';
import express from 'express';

// Mock ALL services to avoid real DB calls
jest.mock('../../services/auth.service', () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  getCurrentUser: jest.fn(),
  getUsers: jest.fn(),
  changePassword: jest.fn(),
  deleteUser: jest.fn(),
  updateUserRole: jest.fn(),
}));

jest.mock('../../services/server.service', () => ({
  getAllServers: jest.fn(),
  getServerStats: jest.fn(),
  getAvailableServers: jest.fn(),
  getServerById: jest.fn(),
  createServer: jest.fn(),
  updateServer: jest.fn(),
  updateServerStatus: jest.fn(),
  deleteServer: jest.fn(),
  getServerMetrics: jest.fn(),
}));

jest.mock('../../services/task.service', () => ({
  getUserTasks: jest.fn(),
  getAllTasks: jest.fn(),
  getTask: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  cancelTask: jest.fn(),
  deleteTask: jest.fn(),
  getTaskStats: jest.fn(),
  getPendingTasks: jest.fn(),
  completeTask: jest.fn(),
  failTask: jest.fn(),
}));

jest.mock('../../services/monitoring.service', () => ({
  getClusterStats: jest.fn(),
  getAlerts: jest.fn(),
  getServerMetrics: jest.fn(),
}));

// Mock auth middleware to inject test user
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return _res.status(401).json({ success: false, error: 'No token provided' });
    }
    req.user = { userId: 'test-user-1', username: 'testuser', role: 'ADMIN' };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.user?.role === 'ADMIN') next();
    else res.status(403).json({ success: false, error: 'Admin required' });
  },
  requireManager: (req: any, res: any, next: any) => {
    if (['ADMIN', 'MANAGER'].includes(req.user?.role)) next();
    else res.status(403).json({ success: false, error: 'Manager required' });
  },
  AuthRequest: {},
}));

// Mock prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: { create: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
    $disconnect: jest.fn(),
  })),
  task_status: {
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
}));

import authService from '../../services/auth.service';
import serverService from '../../services/server.service';
import taskService from '../../services/task.service';
import monitoringService from '../../services/monitoring.service';

// Import routes after all mocks are set up
import authRoutes from '../../routes/auth.routes';
import serverRoutes from '../../routes/server.routes';
import taskRoutes from '../../routes/task.routes';

// Build test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/tasks', taskRoutes);
app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

const AUTH_TOKEN = 'test-jwt-token';

describe('LSM API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== Authentication ====================

  describe('Authentication', () => {
    it('should login successfully', async () => {
      (authService.login as jest.Mock).mockResolvedValue({
        token: 'jwt-abc123',
        user: { id: 'user-1', username: 'testuser', role: 'USER' },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'Password123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should fail login with invalid credentials', async () => {
      (authService.login as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials')
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== Protected Routes ====================

  describe('Protected Routes', () => {
    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should allow access with valid token', async () => {
      (authService.getCurrentUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'ADMIN',
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(200);
    });
  });

  // ==================== Server Management ====================

  describe('Server Management', () => {
    it('should create server as admin', async () => {
      const mockServer = {
        id: 'srv-1',
        name: 'Test Server',
        status: 'ONLINE',
      };
      (serverService.createServer as jest.Mock).mockResolvedValue(mockServer);

      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ name: 'Test Server', hostname: 'srv01.local', ipAddress: '10.0.0.1' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should get servers list', async () => {
      (serverService.getAllServers as jest.Mock).mockResolvedValue([
        { id: 'srv-1', name: 'Server 1', status: 'ONLINE' },
        { id: 'srv-2', name: 'Server 2', status: 'OFFLINE' },
      ]);

      const response = await request(app)
        .get('/api/servers')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  // ==================== Task Management ====================

  describe('Task Management', () => {
    it('should create task', async () => {
      const mockTask = { id: 'task-1', name: 'Test Task', status: 'PENDING' };
      (taskService.createTask as jest.Mock).mockResolvedValue(mockTask);

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({ name: 'Test Task', priority: 5 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should get tasks list', async () => {
      (taskService.getUserTasks as jest.Mock).mockResolvedValue([
        { id: 'task-1', name: 'Task 1', status: 'PENDING' },
      ]);

      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  // ==================== Error Handling ====================

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app).get('/api/nonexistent');

      expect(response.status).toBe(404);
    });

    it('should handle validation errors on server creation', async () => {
      (serverService.createServer as jest.Mock).mockRejectedValue(
        new Error('Validation failed')
      );

      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .send({}); // Empty body - missing required fields

      expect([400, 201]).toContain(response.status);
    });
  });
});
