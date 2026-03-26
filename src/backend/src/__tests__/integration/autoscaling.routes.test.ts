/**
 * Autoscaling Routes Integration Tests
 */

import request from 'supertest';
import express from 'express';
import autoscalingRoutes from '../../routes/autoscaling.routes';
import { autoScalingService, ScalingStrategyType, ScalingMetricType } from '../../services/autoscaling';

jest.mock('../../services/autoscaling', () => ({
  autoScalingService: {
    getStatus: jest.fn(),
    getPolicies: jest.fn(),
    getPolicyState: jest.fn(),
    upsertPolicy: jest.fn(),
    deletePolicy: jest.fn(),
    togglePolicy: jest.fn(),
    manualScale: jest.fn(),
    getEvents: jest.fn(),
    startAutoEvaluation: jest.fn(),
    stopAutoEvaluation: jest.fn(),
  },
  ScalingStrategyType: {
    CPU_BASED: 'CPU_BASED',
    MEMORY_BASED: 'MEMORY_BASED',
    QUEUE_BASED: 'QUEUE_BASED',
    SCHEDULE_BASED: 'SCHEDULE_BASED',
  },
  ScalingMetricType: {
    CPU_USAGE: 'CPU_USAGE',
    MEMORY_USAGE: 'MEMORY_USAGE',
    GPU_USAGE: 'GPU_USAGE',
    QUEUE_LENGTH: 'QUEUE_LENGTH',
  },
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  AuthRequest: {},
}));

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use('/api/autoscaling', autoscalingRoutes);

describe('Autoscaling Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /status ====================

  describe('GET /api/autoscaling/status', () => {
    it('should return autoscaling service status', async () => {
      const mockStatus = { running: true, evaluationCount: 5, lastEvaluationAt: null };
      (autoScalingService.getStatus as jest.Mock).mockReturnValue(mockStatus);

      const response = await request(app).get('/api/autoscaling/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
    });
  });

  // ==================== GET /policies ====================

  describe('GET /api/autoscaling/policies', () => {
    it('should return all scaling policies', async () => {
      const mockPolicies = [
        { id: 'policy-1', name: 'CPU Policy', strategy: 'CPU_BASED' },
        { id: 'policy-2', name: 'Memory Policy', strategy: 'MEMORY_BASED' },
      ];
      (autoScalingService.getPolicies as jest.Mock).mockReturnValue(mockPolicies);
      (autoScalingService.getPolicyState as jest.Mock).mockReturnValue({ currentInstances: 2 });

      const response = await request(app).get('/api/autoscaling/policies');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.policies).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });
  });

  // ==================== GET /policies/:id ====================

  describe('GET /api/autoscaling/policies/:id', () => {
    it('should return policy details when found', async () => {
      const mockPolicy = { id: 'policy-1', name: 'CPU Policy', strategy: 'CPU_BASED' };
      (autoScalingService.getPolicies as jest.Mock).mockReturnValue([mockPolicy]);
      (autoScalingService.getPolicyState as jest.Mock).mockReturnValue({ currentInstances: 2 });

      const response = await request(app).get('/api/autoscaling/policies/policy-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('policy-1');
    });

    it('should return 404 for unknown policy', async () => {
      (autoScalingService.getPolicies as jest.Mock).mockReturnValue([]);

      const response = await request(app).get('/api/autoscaling/policies/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Policy not found');
    });
  });

  // ==================== POST /policies ====================

  describe('POST /api/autoscaling/policies', () => {
    it('should create a new scaling policy', async () => {
      const mockPolicy = { id: 'policy-new', name: 'New Policy', strategy: 'CPU_BASED' };
      (autoScalingService.upsertPolicy as jest.Mock).mockReturnValue(mockPolicy);

      const response = await request(app)
        .post('/api/autoscaling/policies')
        .send({ name: 'New Policy', strategy: 'CPU_BASED', minInstances: 1, maxInstances: 10 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPolicy);
    });

    it('should return 400 on validation error', async () => {
      (autoScalingService.upsertPolicy as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid policy configuration');
      });

      const response = await request(app)
        .post('/api/autoscaling/policies')
        .send({ name: 'Bad Policy' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid policy configuration');
    });
  });

  // ==================== PUT /policies/:id ====================

  describe('PUT /api/autoscaling/policies/:id', () => {
    it('should update an existing policy', async () => {
      const mockPolicy = { id: 'policy-1', name: 'Updated Policy', strategy: 'CPU_BASED' };
      (autoScalingService.upsertPolicy as jest.Mock).mockReturnValue(mockPolicy);

      const response = await request(app)
        .put('/api/autoscaling/policies/policy-1')
        .send({ name: 'Updated Policy' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPolicy);
    });

    it('should return 400 on error', async () => {
      (autoScalingService.upsertPolicy as jest.Mock).mockImplementation(() => {
        throw new Error('Update failed');
      });

      const response = await request(app)
        .put('/api/autoscaling/policies/policy-1')
        .send({ name: 'Bad' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== DELETE /policies/:id ====================

  describe('DELETE /api/autoscaling/policies/:id', () => {
    it('should delete a policy', async () => {
      (autoScalingService.deletePolicy as jest.Mock).mockReturnValue(true);

      const response = await request(app).delete('/api/autoscaling/policies/policy-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Policy deleted');
    });

    it('should return 404 when policy does not exist', async () => {
      (autoScalingService.deletePolicy as jest.Mock).mockReturnValue(false);

      const response = await request(app).delete('/api/autoscaling/policies/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== POST /policies/:id/toggle ====================

  describe('POST /api/autoscaling/policies/:id/toggle', () => {
    it('should toggle a policy on', async () => {
      const mockPolicy = { id: 'policy-1', enabled: true };
      (autoScalingService.togglePolicy as jest.Mock).mockReturnValue(mockPolicy);

      const response = await request(app)
        .post('/api/autoscaling/policies/policy-1/toggle')
        .send({ enabled: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(true);
    });

    it('should return 404 when policy not found for toggle', async () => {
      (autoScalingService.togglePolicy as jest.Mock).mockReturnValue(null);

      const response = await request(app)
        .post('/api/autoscaling/policies/non-existent/toggle')
        .send({ enabled: true });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== POST /manual-scale ====================

  describe('POST /api/autoscaling/manual-scale', () => {
    it('should trigger manual scaling', async () => {
      const mockEvent = { id: 'event-1', policyId: 'policy-1', targetInstances: 5 };
      (autoScalingService.manualScale as jest.Mock).mockResolvedValue(mockEvent);

      const response = await request(app)
        .post('/api/autoscaling/manual-scale')
        .send({ policyId: 'policy-1', targetInstances: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockEvent);
    });

    it('should return 400 when required params are missing', async () => {
      const response = await request(app)
        .post('/api/autoscaling/manual-scale')
        .send({ policyId: 'policy-1' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should return 500 on service error', async () => {
      (autoScalingService.manualScale as jest.Mock).mockRejectedValue(
        new Error('Scaling failed')
      );

      const response = await request(app)
        .post('/api/autoscaling/manual-scale')
        .send({ policyId: 'policy-1', targetInstances: 3 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /events ====================

  describe('GET /api/autoscaling/events', () => {
    it('should return scaling events', async () => {
      const mockEvents = [
        { id: 'e-1', policyId: 'policy-1', action: 'SCALE_UP', timestamp: new Date() },
      ];
      (autoScalingService.getEvents as jest.Mock).mockReturnValue(mockEvents);

      const response = await request(app).get('/api/autoscaling/events');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });
  });

  // ==================== GET /strategy-types ====================

  describe('GET /api/autoscaling/strategy-types', () => {
    it('should return available strategy types', async () => {
      const response = await request(app).get('/api/autoscaling/strategy-types');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ==================== GET /metric-types ====================

  describe('GET /api/autoscaling/metric-types', () => {
    it('should return available metric types', async () => {
      const response = await request(app).get('/api/autoscaling/metric-types');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
