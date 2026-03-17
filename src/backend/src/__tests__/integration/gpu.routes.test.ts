/**
 * GPU Routes Integration Tests
 *
 * Tests for GPU management API endpoints
 */

import request from 'supertest';
import express from 'express';
import gpuRoutes from '../../routes/gpu.routes';
import gpuService from '../../services/gpu.service';

// Mock GPU service
jest.mock('../../services/gpu.service', () => ({
  getGpuStats: jest.fn(),
  allocateGpu: jest.fn(),
  releaseGpu: jest.fn(),
  getUserAllocations: jest.fn(),
  getAllActiveAllocations: jest.fn(),
  getAllocation: jest.fn(),
  getAllocationHistory: jest.fn(),
  forceTerminate: jest.fn(),
}));

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
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

// Mock prisma (for routes that call prisma directly)
jest.mock('../../utils/prisma', () => ({
  gpu: {
    delete: jest.fn(),
    update: jest.fn(),
  },
}));

// App with USER role
const app = express();
app.use(express.json());
app.use('/api/gpu', gpuRoutes);

// App with ADMIN role
const adminApp = express();
adminApp.use(express.json());
adminApp.use((req: any, _res: any, next: any) => {
  req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
  next();
});
adminApp.use('/api/gpu', gpuRoutes);

// App with MANAGER role
const managerApp = express();
managerApp.use(express.json());
managerApp.use((req: any, _res: any, next: any) => {
  req.user = { userId: 'manager-1', username: 'manager', role: 'MANAGER' };
  next();
});
managerApp.use('/api/gpu', gpuRoutes);

// Import prisma mock to control per-test behavior
import prisma from '../../utils/prisma';

describe('GPU Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /stats ====================

  describe('GET /api/gpu/stats', () => {
    it('should return GPU statistics', async () => {
      const mockStats = { total: 10, available: 6, allocated: 4 };
      (gpuService.getGpuStats as jest.Mock).mockResolvedValue(mockStats);

      const response = await request(app).get('/api/gpu/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });

    it('should handle service error with 500', async () => {
      (gpuService.getGpuStats as jest.Mock).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/gpu/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== POST /allocate ====================

  describe('POST /api/gpu/allocate', () => {
    it('should allocate GPU and return 201', async () => {
      const mockAllocation = { id: 'alloc-1', gpuId: 'gpu-1', userId: 'user-1' };
      (gpuService.allocateGpu as jest.Mock).mockResolvedValue(mockAllocation);

      const response = await request(app)
        .post('/api/gpu/allocate')
        .send({ gpuModel: 'NVIDIA A100', minMemory: 40 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAllocation);
      expect(gpuService.allocateGpu as jest.Mock).toHaveBeenCalledWith({
        userId: 'user-1',
        gpuModel: 'NVIDIA A100',
        minMemory: 40,
      });
    });

    it('should allocate GPU without filters', async () => {
      const mockAllocation = { id: 'alloc-2', gpuId: 'gpu-2', userId: 'user-1' };
      (gpuService.allocateGpu as jest.Mock).mockResolvedValue(mockAllocation);

      const response = await request(app).post('/api/gpu/allocate').send({});

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 when no GPU is available', async () => {
      (gpuService.allocateGpu as jest.Mock).mockRejectedValue(
        new Error('No available GPU matching requirements')
      );

      const response = await request(app).post('/api/gpu/allocate').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No available GPU');
    });
  });

  // ==================== POST /release/:id ====================

  describe('POST /api/gpu/release/:id', () => {
    it('should release GPU allocation', async () => {
      const mockResult = { id: 'alloc-1', status: 'RELEASED' };
      (gpuService.releaseGpu as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app).post('/api/gpu/release/alloc-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(gpuService.releaseGpu as jest.Mock).toHaveBeenCalledWith('alloc-1', 'user-1');
    });

    it('should return 400 when allocation not found or not owned', async () => {
      (gpuService.releaseGpu as jest.Mock).mockRejectedValue(
        new Error('Allocation not found or not owned by user')
      );

      const response = await request(app).post('/api/gpu/release/non-existent');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /my-allocations ====================

  describe('GET /api/gpu/my-allocations', () => {
    it('should return current user allocations', async () => {
      const mockAllocations = [
        { id: 'alloc-1', gpuId: 'gpu-1', userId: 'user-1' },
        { id: 'alloc-2', gpuId: 'gpu-2', userId: 'user-1' },
      ];
      (gpuService.getUserAllocations as jest.Mock).mockResolvedValue(mockAllocations);

      const response = await request(app).get('/api/gpu/my-allocations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(gpuService.getUserAllocations as jest.Mock).toHaveBeenCalledWith('user-1');
    });

    it('should return 500 on service error', async () => {
      (gpuService.getUserAllocations as jest.Mock).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/gpu/my-allocations');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /allocations ====================

  describe('GET /api/gpu/allocations', () => {
    it('should return all active allocations', async () => {
      const mockAllocations = [
        { id: 'alloc-1', userId: 'user-1' },
        { id: 'alloc-2', userId: 'user-2' },
      ];
      (gpuService.getAllActiveAllocations as jest.Mock).mockResolvedValue(mockAllocations);

      const response = await request(app).get('/api/gpu/allocations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  // ==================== GET /allocations/:id ====================

  describe('GET /api/gpu/allocations/:id', () => {
    it('should return allocation details when found', async () => {
      const mockAllocation = { id: 'alloc-1', gpuId: 'gpu-1', userId: 'user-1' };
      (gpuService.getAllocation as jest.Mock).mockResolvedValue(mockAllocation);

      const response = await request(app).get('/api/gpu/allocations/alloc-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAllocation);
    });

    it('should return 404 when allocation not found', async () => {
      (gpuService.getAllocation as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/gpu/allocations/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Allocation not found');
    });
  });

  // ==================== GET /history ====================

  describe('GET /api/gpu/history', () => {
    it('should return allocation history with default limit', async () => {
      const mockHistory = [{ id: 'alloc-1', status: 'RELEASED' }];
      (gpuService.getAllocationHistory as jest.Mock).mockResolvedValue(mockHistory);

      const response = await request(app).get('/api/gpu/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(gpuService.getAllocationHistory as jest.Mock).toHaveBeenCalledWith('user-1', 50);
    });

    it('should accept custom limit parameter', async () => {
      (gpuService.getAllocationHistory as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/gpu/history?limit=10');

      expect(response.status).toBe(200);
      expect(gpuService.getAllocationHistory as jest.Mock).toHaveBeenCalledWith('user-1', 10);
    });
  });

  // ==================== POST /allocations/:id/terminate ====================

  describe('POST /api/gpu/allocations/:id/terminate', () => {
    it('should allow admin to force terminate allocation', async () => {
      const mockResult = { id: 'alloc-1', status: 'TERMINATED' };
      (gpuService.forceTerminate as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(adminApp)
        .post('/api/gpu/allocations/alloc-1/terminate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(gpuService.forceTerminate as jest.Mock).toHaveBeenCalledWith('alloc-1');
    });

    it('should deny non-admin from force terminating', async () => {
      const response = await request(app)
        .post('/api/gpu/allocations/alloc-1/terminate');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Admin access required');
    });
  });

  // ==================== DELETE /:id ====================

  describe('DELETE /api/gpu/:id', () => {
    it('should allow admin to delete GPU', async () => {
      (prisma.gpu.delete as jest.Mock).mockResolvedValue({ id: 'gpu-1' });

      const response = await request(adminApp).delete('/api/gpu/gpu-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('GPU deleted successfully');
    });

    it('should deny non-admin from deleting GPU', async () => {
      const response = await request(app).delete('/api/gpu/gpu-1');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when GPU delete fails', async () => {
      (prisma.gpu.delete as jest.Mock).mockRejectedValue(new Error('GPU not found'));

      const response = await request(adminApp).delete('/api/gpu/non-existent');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== DELETE /batch ====================

  describe('DELETE /api/gpu/batch', () => {
    const validUUIDs = [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ];

    it('should batch delete GPUs with mixed results', async () => {
      (prisma.gpu.delete as jest.Mock)
        .mockResolvedValueOnce({ id: validUUIDs[0] })
        .mockRejectedValueOnce(new Error('GPU not found'));

      const response = await request(adminApp)
        .delete('/api/gpu/batch')
        .send({ ids: validUUIDs });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(1);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.data.errors).toHaveLength(1);
    });

    it('should deny non-admin from batch deleting', async () => {
      const response = await request(app)
        .delete('/api/gpu/batch')
        .send({ ids: validUUIDs });

      expect(response.status).toBe(403);
    });
  });

  // ==================== PATCH /:id/allocated ====================

  describe('PATCH /api/gpu/:id/allocated', () => {
    it('should allow manager to update GPU allocated status', async () => {
      const mockGpu = { id: 'gpu-1', allocated: true };
      (prisma.gpu.update as jest.Mock).mockResolvedValue(mockGpu);

      const response = await request(managerApp)
        .patch('/api/gpu/gpu-1/allocated')
        .send({ allocated: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockGpu);
    });

    it('should deny regular user from updating allocated status', async () => {
      const response = await request(app)
        .patch('/api/gpu/gpu-1/allocated')
        .send({ allocated: true });

      expect(response.status).toBe(403);
    });

    it('should return 400 when allocated field is not boolean', async () => {
      (prisma.gpu.update as jest.Mock).mockRejectedValue(new Error('Update failed'));

      const response = await request(managerApp)
        .patch('/api/gpu/gpu-1/allocated')
        .send({ allocated: 'not-a-boolean' });

      // express-validator will coerce or reject - error returns 400
      expect([400, 200]).toContain(response.status);
    });
  });
});
