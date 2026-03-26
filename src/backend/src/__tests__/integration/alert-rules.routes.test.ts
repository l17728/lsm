/**
 * Alert Rules Routes Integration Tests
 *
 * Tests for alert rules management API endpoints
 */

import request from 'supertest';
import express from 'express';
import alertRulesRoutes from '../../routes/alert-rules.routes';
import { alertRulesService } from '../../services/alert-rules.service';

// Mock alert rules service
jest.mock('../../services/alert-rules.service', () => ({
  alertRulesService: {
    getRules: jest.fn(),
    getRule: jest.fn(),
    upsertRule: jest.fn(),
    deleteRule: jest.fn(),
    toggleRule: jest.fn(),
    getMetrics: jest.fn(),
    acknowledgeAlert: jest.fn(),
    resolveAlert: jest.fn(),
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

// App with USER role (default)
const app = express();
app.use(express.json());
app.use('/api/alert-rules', alertRulesRoutes);

describe('Alert Rules Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET / ====================

  describe('GET /api/alert-rules', () => {
    it('should return 200 with rules array', async () => {
      (alertRulesService.getRules as jest.Mock).mockReturnValue([]);

      const response = await request(app).get('/api/alert-rules');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(alertRulesService.getRules).toHaveBeenCalled();
    });
  });

  // ==================== GET /:id ====================

  describe('GET /api/alert-rules/:id', () => {
    it('should return 404 when rule not found', async () => {
      (alertRulesService.getRule as jest.Mock).mockReturnValue(null);

      const response = await request(app).get('/api/alert-rules/non-existent-rule');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Rule not found');
    });

    it('should return 200 with rule when found', async () => {
      const mockRule = {
        id: 'rule-1',
        name: 'CPU High Usage',
        type: 'cpu',
        severity: 'warning',
        enabled: true,
      };
      (alertRulesService.getRule as jest.Mock).mockReturnValue(mockRule);

      const response = await request(app).get('/api/alert-rules/rule-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRule);
    });
  });

  // ==================== POST / ====================

  describe('POST /api/alert-rules', () => {
    it('should return 201 on successful rule creation', async () => {
      const mockRule = {
        id: 'rule-new',
        name: 'Memory High Usage',
        type: 'memory',
        severity: 'critical',
        enabled: true,
      };
      (alertRulesService.upsertRule as jest.Mock).mockReturnValue(mockRule);

      const response = await request(app)
        .post('/api/alert-rules')
        .send({
          name: 'Memory High Usage',
          type: 'memory',
          severity: 'critical',
          condition: 'gt',
          threshold: 90,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRule);
      expect(alertRulesService.upsertRule).toHaveBeenCalled();
    });
  });

  // ==================== DELETE /:id ====================

  describe('DELETE /api/alert-rules/:id', () => {
    it('should return 200 on successful deletion', async () => {
      (alertRulesService.deleteRule as jest.Mock).mockReturnValue(true);

      const response = await request(app).delete('/api/alert-rules/rule-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(alertRulesService.deleteRule).toHaveBeenCalledWith('rule-1');
    });

    it('should return 404 when rule to delete is not found', async () => {
      (alertRulesService.deleteRule as jest.Mock).mockReturnValue(null);

      const response = await request(app).delete('/api/alert-rules/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== POST /:id/toggle ====================

  describe('POST /api/alert-rules/:id/toggle', () => {
    it('should return 400 when enabled is not a boolean', async () => {
      const response = await request(app)
        .post('/api/alert-rules/rule-1/toggle')
        .send({ enabled: 'yes' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Enabled must be a boolean');
    });

    it('should return 200 on successful toggle', async () => {
      const mockRule = { id: 'rule-1', name: 'CPU High Usage', enabled: false };
      (alertRulesService.toggleRule as jest.Mock).mockReturnValue(mockRule);

      const response = await request(app)
        .post('/api/alert-rules/rule-1/toggle')
        .send({ enabled: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRule);
      expect(alertRulesService.toggleRule).toHaveBeenCalledWith('rule-1', false);
    });
  });
});
