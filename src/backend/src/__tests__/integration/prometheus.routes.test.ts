/**
 * Prometheus Routes Integration Tests
 *
 * Tests for Prometheus metrics and health check endpoints
 */

import request from 'supertest';
import express from 'express';
import prometheusRoutes from '../../routes/prometheus.routes';

// Mock Prisma
jest.mock('../../utils/prisma', () => ({
  default: {
    user: { count: jest.fn().mockResolvedValue(5) },
    server: { count: jest.fn().mockResolvedValue(3) },
    task: { count: jest.fn().mockResolvedValue(10), findMany: jest.fn().mockResolvedValue([]) },
    gpu: {
      count: jest.fn().mockResolvedValue(8),
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

// Mock cache service
jest.mock('../../services/cache.service', () => ({
  cacheService: {
    getStats: jest.fn().mockReturnValue({ hits: 100, misses: 20, size: 50 }),
  },
}));

// Mock health check service
jest.mock('../../services/health-check.service', () => ({
  healthCheckService: {
    getOverallHealth: jest.fn().mockResolvedValue({
      status: 'healthy',
      checks: {
        database: { status: 'healthy' },
        redis: { status: 'healthy' },
        disk: { usage: 30 },
        memory: { usage: 40 },
      },
    }),
    getDatabaseStats: jest.fn().mockResolvedValue({}),
    getCacheStats: jest.fn().mockResolvedValue({}),
  },
}));

// Mock email queue service
jest.mock('../../services/email-queue.service', () => ({
  emailQueueService: {
    getStats: jest.fn().mockReturnValue({ pending: 0, processing: 0, failed: 0 }),
  },
}));

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
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

// No auth on prometheus routes
const app = express();
app.use(express.json());
app.use('/api/prometheus', prometheusRoutes);

describe('Prometheus Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /metrics ====================

  describe('GET /api/prometheus/metrics', () => {
    it('should return 200 with text/plain content type and prometheus metrics', async () => {
      const response = await request(app).get('/api/prometheus/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(response.text).toContain('lsm_app_uptime_seconds');
    });
  });

  // ==================== GET /health/detailed ====================

  describe('GET /api/prometheus/health/detailed', () => {
    it('should return 200 with health and database/cache data', async () => {
      const response = await request(app).get('/api/prometheus/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('database');
      expect(response.body.data).toHaveProperty('cache');
    });
  });
});
