/**
 * Cluster Routes Integration Tests
 *
 * Tests for cluster management API endpoints.
 */
import request from 'supertest';
import express from 'express';
import clusterRoutes from '../../routes/cluster.routes';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.middleware';

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { userId: 'test-user', username: 'testadmin', role: 'SUPER_ADMIN' };
    next();
  }),
  requireSuperAdmin: jest.fn((req, res, next) => next()),
  requireSuperAdminOrAdmin: jest.fn((req, res, next) => next()),
  requireManager: jest.fn((req, res, next) => next()),
}));

// Mock cluster service
jest.mock('../../services/cluster.service', () => ({
  clusterService: {
    getAllClusters: jest.fn(),
    getClusterById: jest.fn(),
    createCluster: jest.fn(),
    updateCluster: jest.fn(),
    deleteCluster: jest.fn(),
    addServer: jest.fn(),
    removeServer: jest.fn(),
    allocateCluster: jest.fn(),
    releaseCluster: jest.fn(),
    getAvailableServers: jest.fn(),
    getClusterStats: jest.fn(),
  },
}));

import { clusterService } from '../../services/cluster.service';

const app = express();
app.use(express.json());
app.use('/api/clusters', clusterRoutes);

describe('Cluster Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/clusters', () => {
    it('should return all clusters', async () => {
      (clusterService.getAllClusters as jest.Mock).mockResolvedValue([]);

      const res = await request(app).get('/api/clusters');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/clusters/stats', () => {
    it('should return cluster statistics', async () => {
      (clusterService.getClusterStats as jest.Mock).mockResolvedValue({
        total: 5,
        byStatus: { available: 3, allocated: 2 },
      });

      const res = await request(app).get('/api/clusters/stats');

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(5);
    });
  });

  describe('GET /api/clusters/:id', () => {
    it('should return cluster by id', async () => {
      (clusterService.getClusterById as jest.Mock).mockResolvedValue({
        id: 'cluster-1',
        name: 'Test Cluster',
      });

      const res = await request(app).get('/api/clusters/cluster-1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('cluster-1');
    });

    it('should return 404 if not found', async () => {
      (clusterService.getClusterById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/clusters/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/clusters', () => {
    it('should create cluster', async () => {
      (clusterService.createCluster as jest.Mock).mockResolvedValue({
        id: 'cluster-1',
        name: 'New Cluster',
        code: 'NEW-001',
      });

      const res = await request(app)
        .post('/api/clusters')
        .send({ name: 'New Cluster', code: 'NEW-001' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Cluster');
    });
  });

  describe('PUT /api/clusters/:id', () => {
    it('should update cluster', async () => {
      (clusterService.updateCluster as jest.Mock).mockResolvedValue({
        id: 'cluster-1',
        name: 'Updated',
      });

      const res = await request(app)
        .put('/api/clusters/cluster-1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/clusters/:id', () => {
    it('should delete cluster', async () => {
      (clusterService.deleteCluster as jest.Mock).mockResolvedValue({});

      const res = await request(app).delete('/api/clusters/cluster-1');

      expect(res.status).toBe(200);
    });
  });
});