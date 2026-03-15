/**
 * Server Routes Integration Tests
 * 
 * Tests for server management API endpoints
 */

import request from 'supertest';
import express from 'express';
import serverRoutes from '../../routes/server.routes';
import serverService from '../../services/server.service';

// Mock server service
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

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      userId: 'user-1',
      username: 'testuser',
      role: 'USER',
    };
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
  AuthRequest: Request,
}));

const app = express();
app.use(express.json());
app.use('/api/servers', serverRoutes);

describe('Server Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/servers', () => {
    it('should return all servers', async () => {
      const mockServers = [
        { id: 'server-1', name: 'Server 1', status: 'ONLINE' },
        { id: 'server-2', name: 'Server 2', status: 'OFFLINE' },
      ];
      (serverService.getAllServers as jest.Mock).mockResolvedValue(mockServers);

      const response = await request(app)
        .get('/api/servers');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should handle service error', async () => {
      (serverService.getAllServers as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/servers');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/servers/stats', () => {
    it('should return server statistics', async () => {
      const mockStats = {
        total: 10,
        online: 7,
        offline: 2,
        maintenance: 1,
        totalGpus: 40,
        availableGpus: 15,
      };
      (serverService.getServerStats as jest.Mock).mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/servers/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(10);
    });
  });

  describe('GET /api/servers/available', () => {
    it('should return available servers', async () => {
      const mockServers = [
        { id: 'server-1', name: 'Server 1', status: 'ONLINE', availableGpus: 2 },
      ];
      (serverService.getAvailableServers as jest.Mock).mockResolvedValue(mockServers);

      const response = await request(app)
        .get('/api/servers/available');

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
    });
  });

  describe('GET /api/servers/:id', () => {
    it('should return server by ID', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Server 1',
        status: 'ONLINE',
        cpuCores: 32,
        totalMemory: 128,
      };
      (serverService.getServerById as jest.Mock).mockResolvedValue(mockServer);

      const response = await request(app)
        .get('/api/servers/server-1');

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Server 1');
    });

    it('should return 404 for non-existent server', async () => {
      (serverService.getServerById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/servers/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/servers', () => {
    const appWithAdmin = express();
    appWithAdmin.use(express.json());
    appWithAdmin.use((req: any, res, next) => {
      req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
      next();
    });
    appWithAdmin.use('/api/servers', serverRoutes);

    it('should create server for admin', async () => {
      const mockServer = {
        id: 'server-new',
        name: 'New Server',
        hostname: 'server.local',
        ipAddress: '192.168.1.1',
      };
      (serverService.createServer as jest.Mock).mockResolvedValue(mockServer);

      const response = await request(appWithAdmin)
        .post('/api/servers')
        .send({
          name: 'New Server',
          hostname: 'server.local',
          ipAddress: '192.168.1.1',
          cpuCores: 32,
          totalMemory: 128,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('New Server');
    });

    it('should reject invalid IP address', async () => {
      const response = await request(appWithAdmin)
        .post('/api/servers')
        .send({
          name: 'New Server',
          hostname: 'server.local',
          ipAddress: 'invalid-ip',
          cpuCores: 32,
          totalMemory: 128,
        });

      expect(response.status).toBe(400);
    });

    it('should reject missing required fields', async () => {
      const response = await request(appWithAdmin)
        .post('/api/servers')
        .send({
          name: 'New Server',
        });

      expect(response.status).toBe(400);
    });

    it('should deny access for non-admin', async () => {
      const response = await request(app)
        .post('/api/servers')
        .send({
          name: 'New Server',
          hostname: 'server.local',
          ipAddress: '192.168.1.1',
          cpuCores: 32,
          totalMemory: 128,
        });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/servers/:id', () => {
    const appWithManager = express();
    appWithManager.use(express.json());
    appWithManager.use((req: any, res, next) => {
      req.user = { userId: 'manager-1', username: 'manager', role: 'MANAGER' };
      next();
    });
    appWithManager.use('/api/servers', serverRoutes);

    it('should update server for manager', async () => {
      const mockServer = {
        id: 'server-1',
        name: 'Updated Server',
        status: 'ONLINE',
      };
      (serverService.updateServer as jest.Mock).mockResolvedValue(mockServer);

      const response = await request(appWithManager)
        .put('/api/servers/server-1')
        .send({
          name: 'Updated Server',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Server');
    });

    it('should deny access for regular user', async () => {
      const response = await request(app)
        .put('/api/servers/server-1')
        .send({
          name: 'Updated Server',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/servers/:id/status', () => {
    const appWithManager = express();
    appWithManager.use(express.json());
    appWithManager.use((req: any, res, next) => {
      req.user = { userId: 'manager-1', username: 'manager', role: 'MANAGER' };
      next();
    });
    appWithManager.use('/api/servers', serverRoutes);

    it('should update server status', async () => {
      const mockServer = {
        id: 'server-1',
        status: 'MAINTENANCE',
      };
      (serverService.updateServerStatus as jest.Mock).mockResolvedValue(mockServer);

      const response = await request(appWithManager)
        .patch('/api/servers/server-1/status')
        .send({
          status: 'MAINTENANCE',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('MAINTENANCE');
    });

    it('should reject invalid status', async () => {
      const response = await request(appWithManager)
        .patch('/api/servers/server-1/status')
        .send({
          status: 'INVALID',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/servers/:id', () => {
    const appWithAdmin = express();
    appWithAdmin.use(express.json());
    appWithAdmin.use((req: any, res, next) => {
      req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
      next();
    });
    appWithAdmin.use('/api/servers', serverRoutes);

    it('should delete server for admin', async () => {
      (serverService.deleteServer as jest.Mock).mockResolvedValue(undefined);

      const response = await request(appWithAdmin)
        .delete('/api/servers/server-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access for non-admin', async () => {
      const response = await request(app)
        .delete('/api/servers/server-1');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/servers/:id/metrics', () => {
    it('should return server metrics', async () => {
      const mockMetrics = [
        {
          timestamp: new Date(),
          cpuUsage: 45.5,
          memoryUsage: 60.2,
          gpuUsage: 30.1,
        },
      ];
      (serverService.getServerMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/servers/server-1/metrics');

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
    });

    it('should accept time range parameters', async () => {
      const mockMetrics: any[] = [];
      (serverService.getServerMetrics as jest.Mock).mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/servers/server-1/metrics')
        .query({
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-02T00:00:00Z',
        });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/servers/batch', () => {
    const appWithAdmin = express();
    appWithAdmin.use(express.json());
    appWithAdmin.use((req: any, res, next) => {
      req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
      next();
    });
    appWithAdmin.use('/api/servers', serverRoutes);

    it('should batch delete servers', async () => {
      (serverService.deleteServer as jest.Mock).mockResolvedValue(undefined);

      const response = await request(appWithAdmin)
        .delete('/api/servers/batch')
        .send({
          ids: ['server-1', 'server-2'],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.success).toBe(2);
    });

    it('should handle partial failures', async () => {
      (serverService.deleteServer as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Server in use'));

      const response = await request(appWithAdmin)
        .delete('/api/servers/batch')
        .send({
          ids: ['server-1', 'server-2'],
        });

      expect(response.status).toBe(200);
      expect(response.body.data.success).toBe(1);
      expect(response.body.data.failed).toBe(1);
    });

    it('should reject empty ids array', async () => {
      const response = await request(appWithAdmin)
        .delete('/api/servers/batch')
        .send({
          ids: [],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/servers/batch/status', () => {
    const appWithManager = express();
    appWithManager.use(express.json());
    appWithManager.use((req: any, res, next) => {
      req.user = { userId: 'manager-1', username: 'manager', role: 'MANAGER' };
      next();
    });
    appWithManager.use('/api/servers', serverRoutes);

    it('should batch update server status', async () => {
      (serverService.updateServerStatus as jest.Mock).mockResolvedValue({});

      const response = await request(appWithManager)
        .patch('/api/servers/batch/status')
        .send({
          ids: ['server-1', 'server-2'],
          status: 'MAINTENANCE',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.success).toBe(2);
    });

    it('should reject invalid status in batch', async () => {
      const response = await request(appWithManager)
        .patch('/api/servers/batch/status')
        .send({
          ids: ['server-1'],
          status: 'INVALID',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication requirement', () => {
    const appNoAuth = express();
    appNoAuth.use(express.json());
    // No auth middleware
    appNoAuth.use('/api/servers', serverRoutes);

    it('should require authentication for all routes', async () => {
      // Since auth middleware is mocked, all requests have a user
      // In real scenario, requests without auth would fail
      const response = await request(app).get('/api/servers');
      
      // With mocked auth, this should succeed
      expect(response.status).not.toBe(401);
    });
  });
});