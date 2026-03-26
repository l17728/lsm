/**
 * Analytics Routes Integration Tests
 *
 * Tests for analytics API endpoints
 */

import request from 'supertest';
import express from 'express';
import analyticsRoutes from '../../routes/analytics.routes';
import analyticsService from '../../services/analytics.service';

// Mock analytics service
jest.mock('../../services/analytics.service', () => ({
  getSummary: jest.fn(),
  getResourceTrends: jest.fn(),
  getCostBreakdown: jest.fn(),
  getServerUtilization: jest.fn(),
  getEfficiencyReport: jest.fn(),
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

// App with USER role (default)
const app = express();
app.use(express.json());
app.use('/api/analytics', analyticsRoutes);

describe('Analytics Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /summary ====================

  describe('GET /api/analytics/summary', () => {
    it('should return analytics summary', async () => {
      const mockSummary = { totalCost: 100, avgUtilization: 75, efficiency: 80 };
      (analyticsService.getSummary as jest.Mock).mockResolvedValue(mockSummary);

      const response = await request(app).get('/api/analytics/summary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSummary);
    });

    it('should return 500 on service error', async () => {
      (analyticsService.getSummary as jest.Mock).mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app).get('/api/analytics/summary');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service unavailable');
    });
  });

  // ==================== GET /resource-trends ====================

  describe('GET /api/analytics/resource-trends', () => {
    it('should return resource usage trends', async () => {
      const mockTrends = [
        { date: '2026-03-01', cpuUsage: 55, memoryUsage: 70, gpuUsage: 80 },
        { date: '2026-03-02', cpuUsage: 60, memoryUsage: 72, gpuUsage: 85 },
      ];
      (analyticsService.getResourceTrends as jest.Mock).mockResolvedValue(mockTrends);

      const response = await request(app).get('/api/analytics/resource-trends');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTrends);
    });
  });

  // ==================== GET /cost-breakdown ====================

  describe('GET /api/analytics/cost-breakdown', () => {
    it('should return cost breakdown by category', async () => {
      const mockBreakdown = [{ category: 'GPU', amount: 50, percentage: 50, trend: 5 }];
      (analyticsService.getCostBreakdown as jest.Mock).mockResolvedValue(mockBreakdown);

      const response = await request(app).get('/api/analytics/cost-breakdown');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBreakdown);
    });
  });

  // ==================== GET /server-utilization ====================

  describe('GET /api/analytics/server-utilization', () => {
    it('should return server utilization details', async () => {
      const mockUtilization: any[] = [];
      (analyticsService.getServerUtilization as jest.Mock).mockResolvedValue(mockUtilization);

      const response = await request(app).get('/api/analytics/server-utilization');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUtilization);
    });
  });

  // ==================== GET /efficiency-report ====================

  describe('GET /api/analytics/efficiency-report', () => {
    it('should return efficiency report with recommendations', async () => {
      const mockReport = {
        overallEfficiency: 78,
        recommendations: ['Consolidate idle servers', 'Upgrade GPU drivers'],
        idleResources: [],
      };
      (analyticsService.getEfficiencyReport as jest.Mock).mockResolvedValue(mockReport);

      const response = await request(app).get('/api/analytics/efficiency-report');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockReport);
    });
  });

  // ==================== GET /export ====================

  describe('GET /api/analytics/export', () => {
    it('should return JSON analytics report when format=json', async () => {
      const mockSummary = { totalCost: 100, avgUtilization: 75, efficiency: 80 };
      const mockTrends = [{ date: '2026-03-01', cpuUsage: 55 }];
      const mockBreakdown = [{ category: 'GPU', amount: 50, percentage: 50, trend: 5 }];
      const mockUtilization: any[] = [];
      const mockEfficiency = { overallEfficiency: 78, recommendations: [] };

      (analyticsService.getSummary as jest.Mock).mockResolvedValue(mockSummary);
      (analyticsService.getResourceTrends as jest.Mock).mockResolvedValue(mockTrends);
      (analyticsService.getCostBreakdown as jest.Mock).mockResolvedValue(mockBreakdown);
      (analyticsService.getServerUtilization as jest.Mock).mockResolvedValue(mockUtilization);
      (analyticsService.getEfficiencyReport as jest.Mock).mockResolvedValue(mockEfficiency);

      const response = await request(app).get('/api/analytics/export?format=json');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('generatedAt');
      expect(response.body.data.summary).toEqual(mockSummary);
    });
  });
});
