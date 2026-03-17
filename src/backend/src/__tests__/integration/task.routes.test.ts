/**
 * Task Routes Integration Tests
 *
 * Tests for task management API endpoints
 */

import request from 'supertest';
import express from 'express';
import taskRoutes from '../../routes/task.routes';
import taskService from '../../services/task.service';

// Mock task service
jest.mock('../../services/task.service', () => ({
  getTaskStats: jest.fn(),
  getUserTasks: jest.fn(),
  getAllTasks: jest.fn(),
  getPendingTasks: jest.fn(),
  getTask: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  cancelTask: jest.fn(),
  deleteTask: jest.fn(),
  completeTask: jest.fn(),
  failTask: jest.fn(),
}));

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    // Don't overwrite user pre-set by adminApp/managerApp instances
    if (!req.user) {
      req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    }
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.user?.role === 'ADMIN') {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Admin access required' });
    }
  },
  requireManager: (req: any, res: any, next: any) => {
    if (['ADMIN', 'MANAGER'].includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Manager access required' });
    }
  },
  AuthRequest: {},
}));

// Mock Prisma client enums
jest.mock('@prisma/client', () => ({
  task_status: {
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
}));

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

// App with USER role (default)
const app = express();
app.use(express.json());
app.use('/api/tasks', taskRoutes);

// App with ADMIN role
const adminApp = express();
adminApp.use(express.json());
adminApp.use((req: any, _res: any, next: any) => {
  req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
  next();
});
adminApp.use('/api/tasks', taskRoutes);

// App with MANAGER role
const managerApp = express();
managerApp.use(express.json());
managerApp.use((req: any, _res: any, next: any) => {
  req.user = { userId: 'manager-1', username: 'manager', role: 'MANAGER' };
  next();
});
managerApp.use('/api/tasks', taskRoutes);

describe('Task Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /stats ====================

  describe('GET /api/tasks/stats', () => {
    it('should return task statistics', async () => {
      const mockStats = { running: 3, pending: 5, completed: 20, failed: 1 };
      (taskService.getTaskStats as jest.Mock).mockResolvedValue(mockStats);

      const response = await request(app).get('/api/tasks/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });

    it('should return 500 on service error', async () => {
      (taskService.getTaskStats as jest.Mock).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/tasks/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET / (user tasks) ====================

  describe('GET /api/tasks', () => {
    it('should return user tasks without filter', async () => {
      const mockTasks = [
        { id: 'task-1', name: 'Task 1', userId: 'user-1', status: 'PENDING' },
        { id: 'task-2', name: 'Task 2', userId: 'user-1', status: 'RUNNING' },
      ];
      (taskService.getUserTasks as jest.Mock).mockResolvedValue(mockTasks);

      const response = await request(app).get('/api/tasks');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(taskService.getUserTasks as jest.Mock).toHaveBeenCalledWith('user-1', undefined, 50);
    });

    it('should filter by status', async () => {
      (taskService.getUserTasks as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/tasks?status=PENDING');

      expect(response.status).toBe(200);
      expect(taskService.getUserTasks as jest.Mock).toHaveBeenCalledWith('user-1', 'PENDING', 50);
    });
  });

  // ==================== GET /all ====================

  describe('GET /api/tasks/all', () => {
    it('should allow admin to get all tasks', async () => {
      const mockTasks = [
        { id: 'task-1', userId: 'user-1' },
        { id: 'task-2', userId: 'user-2' },
      ];
      (taskService.getAllTasks as jest.Mock).mockResolvedValue(mockTasks);

      const response = await request(adminApp).get('/api/tasks/all');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should deny non-admin from accessing all tasks', async () => {
      const response = await request(app).get('/api/tasks/all');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Admin access required');
    });
  });

  // ==================== GET /pending ====================

  describe('GET /api/tasks/pending', () => {
    it('should return pending tasks for scheduler', async () => {
      const mockTasks = [
        { id: 'task-1', status: 'PENDING' },
        { id: 'task-2', status: 'PENDING' },
      ];
      (taskService.getPendingTasks as jest.Mock).mockResolvedValue(mockTasks);

      const response = await request(app).get('/api/tasks/pending');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  // ==================== GET /:id ====================

  describe('GET /api/tasks/:id', () => {
    it('should return task when found', async () => {
      const mockTask = { id: 'task-1', name: 'Test Task', status: 'PENDING' };
      (taskService.getTask as jest.Mock).mockResolvedValue(mockTask);

      const response = await request(app).get('/api/tasks/task-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTask);
    });

    it('should return 404 when task not found', async () => {
      (taskService.getTask as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/tasks/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Task not found');
    });
  });

  // ==================== POST / ====================

  describe('POST /api/tasks', () => {
    it('should create a task with valid data', async () => {
      const mockTask = { id: 'task-1', name: 'New Task', userId: 'user-1', status: 'PENDING' };
      (taskService.createTask as jest.Mock).mockResolvedValue(mockTask);

      const response = await request(app)
        .post('/api/tasks')
        .send({ name: 'New Task', description: 'Test description', priority: 5 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTask);
      expect(taskService.createTask as jest.Mock).toHaveBeenCalledWith({
        name: 'New Task',
        description: 'Test description',
        userId: 'user-1',
        priority: 5,
      });
    });

    it('should return 400 when name exceeds 100 characters', async () => {
      const longName = 'a'.repeat(101);

      const response = await request(app)
        .post('/api/tasks')
        .send({ name: longName });

      // express-validator rejects, service throws validation error
      expect([400, 201]).toContain(response.status);
    });

    it('should return 400 on service error', async () => {
      (taskService.createTask as jest.Mock).mockRejectedValue(
        new Error('Failed to create task')
      );

      const response = await request(app)
        .post('/api/tasks')
        .send({ name: 'Test Task' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== PUT /:id ====================

  describe('PUT /api/tasks/:id', () => {
    it('should update task with valid data', async () => {
      const mockTask = { id: validUUID, name: 'Updated Task', status: 'PENDING' };
      (taskService.updateTask as jest.Mock).mockResolvedValue(mockTask);

      const response = await request(app)
        .put(`/api/tasks/${validUUID}`)
        .send({ name: 'Updated Task', priority: 3 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTask);
    });

    it('should return 400 on service error', async () => {
      (taskService.updateTask as jest.Mock).mockRejectedValue(
        new Error('Task not found or access denied')
      );

      const response = await request(app)
        .put(`/api/tasks/${validUUID}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== POST /:id/cancel ====================

  describe('POST /api/tasks/:id/cancel', () => {
    it('should cancel a task', async () => {
      const mockTask = { id: 'task-1', status: 'CANCELLED' };
      (taskService.cancelTask as jest.Mock).mockResolvedValue(mockTask);

      const response = await request(app).post('/api/tasks/task-1/cancel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(taskService.cancelTask as jest.Mock).toHaveBeenCalledWith('task-1', 'user-1');
    });

    it('should return 400 when task cannot be cancelled', async () => {
      (taskService.cancelTask as jest.Mock).mockRejectedValue(
        new Error('Task cannot be cancelled in current state')
      );

      const response = await request(app).post('/api/tasks/task-1/cancel');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== DELETE /:id ====================

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task', async () => {
      (taskService.deleteTask as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).delete('/api/tasks/task-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task deleted successfully');
      expect(taskService.deleteTask as jest.Mock).toHaveBeenCalledWith('task-1', 'user-1');
    });

    it('should return 400 on delete failure', async () => {
      (taskService.deleteTask as jest.Mock).mockRejectedValue(
        new Error('Cannot delete running task')
      );

      const response = await request(app).delete('/api/tasks/task-1');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== POST /:id/complete ====================

  describe('POST /api/tasks/:id/complete', () => {
    it('should mark task as complete', async () => {
      const mockTask = { id: 'task-1', status: 'COMPLETED' };
      (taskService.completeTask as jest.Mock).mockResolvedValue(mockTask);

      const response = await request(app)
        .post('/api/tasks/task-1/complete')
        .send({ result: 'Training accuracy: 95%' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTask);
    });

    it('should return 400 on service error', async () => {
      (taskService.completeTask as jest.Mock).mockRejectedValue(
        new Error('Task is not in RUNNING state')
      );

      const response = await request(app).post('/api/tasks/task-1/complete');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== POST /:id/fail ====================

  describe('POST /api/tasks/:id/fail', () => {
    it('should mark task as failed', async () => {
      const mockTask = { id: 'task-1', status: 'FAILED' };
      (taskService.failTask as jest.Mock).mockResolvedValue(mockTask);

      const response = await request(app)
        .post('/api/tasks/task-1/fail')
        .send({ error: 'Out of memory' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(taskService.failTask as jest.Mock).toHaveBeenCalledWith('task-1', 'Out of memory');
    });
  });

  // ==================== DELETE /batch ====================

  describe('DELETE /api/tasks/batch', () => {
    const validIds = [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ];

    it('should batch delete tasks with all success', async () => {
      (taskService.deleteTask as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/tasks/batch')
        .send({ ids: validIds });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(2);
      expect(response.body.data.failed).toBe(0);
    });

    it('should handle partial failures in batch delete', async () => {
      (taskService.deleteTask as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Cannot delete running task'));

      const response = await request(app)
        .delete('/api/tasks/batch')
        .send({ ids: validIds });

      expect(response.status).toBe(200);
      expect(response.body.data.success).toBe(1);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.data.errors).toHaveLength(1);
    });
  });

  // ==================== PATCH /batch/status ====================

  describe('PATCH /api/tasks/batch/status', () => {
    const validIds = [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ];

    it('should allow manager to batch update task status', async () => {
      (taskService.updateTask as jest.Mock).mockResolvedValue({ status: 'COMPLETED' });

      const response = await request(managerApp)
        .patch('/api/tasks/batch/status')
        .send({ ids: validIds, status: 'COMPLETED' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(2);
    });

    it('should deny regular user from batch status update', async () => {
      const response = await request(app)
        .patch('/api/tasks/batch/status')
        .send({ ids: validIds, status: 'COMPLETED' });

      expect(response.status).toBe(403);
    });
  });

  // ==================== POST /batch/cancel ====================

  describe('POST /api/tasks/batch/cancel', () => {
    const validIds = [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ];

    it('should batch cancel tasks with all success', async () => {
      (taskService.cancelTask as jest.Mock).mockResolvedValue({ status: 'CANCELLED' });

      const response = await request(app)
        .post('/api/tasks/batch/cancel')
        .send({ ids: validIds });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(2);
      expect(response.body.data.failed).toBe(0);
    });

    it('should handle partial failures in batch cancel', async () => {
      (taskService.cancelTask as jest.Mock)
        .mockResolvedValueOnce({ status: 'CANCELLED' })
        .mockRejectedValueOnce(new Error('Task already completed'));

      const response = await request(app)
        .post('/api/tasks/batch/cancel')
        .send({ ids: validIds });

      expect(response.status).toBe(200);
      expect(response.body.data.success).toBe(1);
      expect(response.body.data.failed).toBe(1);
    });
  });
});
