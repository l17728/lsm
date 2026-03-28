/**
 * Monitoring Routes Integration Tests
 *
 * Tests for monitoring API endpoints
 */

import request from 'supertest';
import express from 'express';
import monitoringRoutes from '../../routes/monitoring.routes';
import monitoringService from '../../services/monitoring.service';

// Mock monitoring service
jest.mock('../../services/monitoring.service', () => ({
  getServerHealth: jest.fn(),
  getClusterStats: jest.fn(),
  getAlerts: jest.fn(),
  getMetricsRange: jest.fn(),
  collectMetrics: jest.fn(),
}));

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) {
      req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    }
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!req.user) {
      req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    }
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.user?.role === 'ADMIN') next();
    else res.status(403).json({ success: false, error: 'Admin access required' });
  },
  requireManager: (req: any, res: any, next: any) => {
    if (['ADMIN', 'MANAGER'].includes(req.user?.role)) next();
    else res.status(403).json({ success: false, error: 'Manager access required' });
  },
  AuthRequest: {},
}));

// Mock logging middleware
jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

// App with USER role (default)
const app = express();
app.use(express.json());
app.use('/api/monitoring', monitoringRoutes);

describe('Monitoring Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /health ====================

  describe('GET /api/monitoring/health', () => {
    it('should return server health status', async () => {
      const mockHealth = [
        { serverId: 'srv-1', serverName: 'GPU Server 1', status: 'healthy', cpuUsage: 45, memoryUsage: 60 },
        { serverId: 'srv-2', serverName: 'GPU Server 2', status: 'warning', cpuUsage: 85, memoryUsage: 90 },
      ];
      (monitoringService.getServerHealth as jest.Mock).mockResolvedValue(mockHealth);

      const response = await request(app).get('/api/monitoring/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHealth);
    });

    it('should return 500 on service error', async () => {
      (monitoringService.getServerHealth as jest.Mock).mockRejectedValue(new Error('DB connection failed'));

      const response = await request(app).get('/api/monitoring/health');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('DB connection failed');
    });
  });

  // ==================== GET /cluster-stats ====================

  describe('GET /api/monitoring/cluster-stats', () => {
    it('should return aggregated cluster statistics', async () => {
      const mockStats = {
        totalServers: 5,
        healthyServers: 4,
        totalGPUs: 20,
        activeGPUs: 15,
        avgCpuUsage: 55,
        avgMemoryUsage: 70,
      };
      (monitoringService.getClusterStats as jest.Mock).mockResolvedValue(mockStats);

      const response = await request(app).get('/api/monitoring/cluster-stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  // ==================== GET /alerts ====================

  describe('GET /api/monitoring/alerts', () => {
    it('should return current alerts', async () => {
      const mockAlerts = [
        { id: 'alert-1', serverId: 'srv-1', type: 'HIGH_CPU', severity: 'WARNING', message: 'CPU usage at 85%' },
        { id: 'alert-2', serverId: 'srv-2', type: 'HIGH_MEMORY', severity: 'CRITICAL', message: 'Memory at 95%' },
      ];
      (monitoringService.getAlerts as jest.Mock).mockResolvedValue(mockAlerts);

      const response = await request(app).get('/api/monitoring/alerts');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAlerts);
      expect(response.body.data).toHaveLength(2);
    });
  });

  // ==================== GET /servers/:id/metrics ====================

  describe('GET /api/monitoring/servers/:id/metrics', () => {
    it('should return metrics for a specific server', async () => {
      const mockMetrics = [
        { timestamp: new Date().toISOString(), cpuUsage: 50, memoryUsage: 65, gpuUsage: 80 },
        { timestamp: new Date().toISOString(), cpuUsage: 55, memoryUsage: 68, gpuUsage: 75 },
      ];
      (monitoringService.getMetricsRange as jest.Mock).mockResolvedValue(mockMetrics);

      const response = await request(app).get(`/api/monitoring/servers/${validUUID}/metrics`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMetrics);
      expect(monitoringService.getMetricsRange as jest.Mock).toHaveBeenCalledWith(
        validUUID,
        expect.any(Date),
        expect.any(Date)
      );
    });
  });

  // ==================== POST /collect ====================

  describe('POST /api/monitoring/collect', () => {
    it('should trigger metrics collection and return collected count', async () => {
      const mockResults = [
        { serverId: 'srv-1', collected: true },
        { serverId: 'srv-2', collected: true },
        { serverId: 'srv-3', collected: true },
      ];
      (monitoringService.collectMetrics as jest.Mock).mockResolvedValue(mockResults);

      const response = await request(app).post('/api/monitoring/collect');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.collected).toBe(3);
      expect(response.body.data.servers).toEqual(mockResults);
    });
  });
});
