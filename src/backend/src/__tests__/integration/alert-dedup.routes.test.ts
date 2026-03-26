/**
 * Alert Deduplication Routes Integration Tests
 */

import request from 'supertest';
import express from 'express';
import alertDedupRoutes from '../../routes/alert-dedup.routes';
import { alertDeduplicationService } from '../../services/alert-dedup';

jest.mock('../../services/alert-dedup', () => ({
  alertDeduplicationService: {
    getStatus: jest.fn(),
    getStatistics: jest.fn(),
    getActiveAlerts: jest.fn(),
    getAllAlerts: jest.fn(),
    processAlert: jest.fn(),
    acknowledgeAlert: jest.fn(),
    resolveAlert: jest.fn(),
    getAlertGroups: jest.fn(),
    getSilenceRules: jest.fn(),
    createSilenceRule: jest.fn(),
    deleteSilenceRule: jest.fn(),
    updateConfig: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  },
}));

jest.mock('../../services/notification.service', () => ({
  AlertType: {
    CPU_HIGH: 'CPU_HIGH',
    MEMORY_HIGH: 'MEMORY_HIGH',
    GPU_OVERLOAD: 'GPU_OVERLOAD',
    SERVER_DOWN: 'SERVER_DOWN',
  },
  AlertSeverity: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
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
app.use('/api/alert-dedup', alertDedupRoutes);

describe('Alert Deduplication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /status ====================

  describe('GET /api/alert-dedup/status', () => {
    it('should return deduplication service status', async () => {
      const mockStatus = {
        running: true,
        dedupWindow: 300,
        config: { enabled: true, windowMs: 300000 },
      };
      (alertDeduplicationService.getStatus as jest.Mock).mockReturnValue(mockStatus);

      const response = await request(app).get('/api/alert-dedup/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
    });
  });

  // ==================== GET /statistics ====================

  describe('GET /api/alert-dedup/statistics', () => {
    it('should return alert statistics', async () => {
      const mockStats = {
        totalAlerts: 50,
        dedupedAlerts: 30,
        activeAlerts: 5,
        resolvedAlerts: 45,
      };
      (alertDeduplicationService.getStatistics as jest.Mock).mockReturnValue(mockStats);

      const response = await request(app).get('/api/alert-dedup/statistics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  // ==================== GET /alerts ====================

  describe('GET /api/alert-dedup/alerts', () => {
    it('should return all alerts', async () => {
      const mockAlerts = [
        { id: 'alert-1', type: 'CPU_HIGH', status: 'ACTIVE', count: 3 },
        { id: 'alert-2', type: 'MEMORY_HIGH', status: 'RESOLVED', count: 1 },
      ];
      (alertDeduplicationService.getAllAlerts as jest.Mock).mockReturnValue(mockAlerts);

      const response = await request(app).get('/api/alert-dedup/alerts');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.alerts).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    it('should return only active alerts when active=true', async () => {
      const mockActiveAlerts = [{ id: 'alert-1', type: 'CPU_HIGH', status: 'ACTIVE', count: 3 }];
      (alertDeduplicationService.getActiveAlerts as jest.Mock).mockReturnValue(mockActiveAlerts);

      const response = await request(app).get('/api/alert-dedup/alerts?active=true');

      expect(response.status).toBe(200);
      expect(response.body.data.alerts).toHaveLength(1);
      expect(alertDeduplicationService.getActiveAlerts as jest.Mock).toHaveBeenCalled();
    });
  });

  // ==================== GET /alerts/:id ====================

  describe('GET /api/alert-dedup/alerts/:id', () => {
    it('should return alert details when found', async () => {
      const mockAlert = { id: 'alert-1', type: 'CPU_HIGH', status: 'ACTIVE', count: 3 };
      (alertDeduplicationService.getAllAlerts as jest.Mock).mockReturnValue([mockAlert]);

      const response = await request(app).get('/api/alert-dedup/alerts/alert-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('alert-1');
    });

    it('should return 404 when alert not found', async () => {
      (alertDeduplicationService.getAllAlerts as jest.Mock).mockReturnValue([]);

      const response = await request(app).get('/api/alert-dedup/alerts/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Alert not found');
    });
  });

  // ==================== POST /alerts ====================

  describe('POST /api/alert-dedup/alerts', () => {
    it('should create and process a new alert', async () => {
      const mockAggregated = { id: 'alert-new', type: 'CPU_HIGH', count: 1, status: 'ACTIVE' };
      (alertDeduplicationService.processAlert as jest.Mock).mockResolvedValue(mockAggregated);

      const response = await request(app)
        .post('/api/alert-dedup/alerts')
        .send({ type: 'CPU_HIGH', severity: 'HIGH', serverId: 'server-1', value: 95 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAggregated);
    });

    it('should return 400 on processing error', async () => {
      (alertDeduplicationService.processAlert as jest.Mock).mockRejectedValue(
        new Error('Invalid alert data')
      );

      const response = await request(app)
        .post('/api/alert-dedup/alerts')
        .send({ type: 'UNKNOWN' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== POST /alerts/:id/acknowledge ====================

  describe('POST /api/alert-dedup/alerts/:id/acknowledge', () => {
    it('should acknowledge an alert', async () => {
      (alertDeduplicationService.acknowledgeAlert as jest.Mock).mockReturnValue(true);

      const response = await request(app).post('/api/alert-dedup/alerts/alert-1/acknowledge');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Alert acknowledged');
    });

    it('should return 404 when alert not found for acknowledge', async () => {
      (alertDeduplicationService.acknowledgeAlert as jest.Mock).mockReturnValue(false);

      const response = await request(app).post('/api/alert-dedup/alerts/non-existent/acknowledge');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== POST /alerts/:id/resolve ====================

  describe('POST /api/alert-dedup/alerts/:id/resolve', () => {
    it('should resolve an alert', async () => {
      (alertDeduplicationService.resolveAlert as jest.Mock).mockReturnValue(true);

      const response = await request(app).post('/api/alert-dedup/alerts/alert-1/resolve');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Alert resolved');
    });

    it('should return 404 when alert not found for resolve', async () => {
      (alertDeduplicationService.resolveAlert as jest.Mock).mockReturnValue(false);

      const response = await request(app).post('/api/alert-dedup/alerts/non-existent/resolve');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /groups ====================

  describe('GET /api/alert-dedup/groups', () => {
    it('should return alert groups', async () => {
      const mockGroups = [
        { id: 'group-1', type: 'CPU_HIGH', alertIds: ['alert-1', 'alert-2'], count: 2 },
      ];
      (alertDeduplicationService.getAlertGroups as jest.Mock).mockReturnValue(mockGroups);

      const response = await request(app).get('/api/alert-dedup/groups');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.groups).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });
  });

  // ==================== GET /silences ====================

  describe('GET /api/alert-dedup/silences', () => {
    it('should return silence rules', async () => {
      const mockSilences = [
        { id: 'silence-1', pattern: 'CPU_HIGH', expiresAt: new Date().toISOString() },
      ];
      (alertDeduplicationService.getSilenceRules as jest.Mock).mockReturnValue(mockSilences);

      const response = await request(app).get('/api/alert-dedup/silences');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.silences).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });
  });

  // ==================== POST /silences ====================

  describe('POST /api/alert-dedup/silences', () => {
    it('should create a silence rule', async () => {
      const mockSilence = { id: 'silence-new', pattern: 'MEMORY_HIGH', durationMs: 3600000 };
      (alertDeduplicationService.createSilenceRule as jest.Mock).mockReturnValue(mockSilence);

      const response = await request(app)
        .post('/api/alert-dedup/silences')
        .send({ pattern: 'MEMORY_HIGH', durationMs: 3600000, reason: 'Maintenance' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSilence);
    });

    it('should return 400 on invalid silence rule', async () => {
      (alertDeduplicationService.createSilenceRule as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid silence rule');
      });

      const response = await request(app)
        .post('/api/alert-dedup/silences')
        .send({ pattern: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== DELETE /silences/:id ====================

  describe('DELETE /api/alert-dedup/silences/:id', () => {
    it('should delete a silence rule', async () => {
      (alertDeduplicationService.deleteSilenceRule as jest.Mock).mockReturnValue(true);

      const response = await request(app).delete('/api/alert-dedup/silences/silence-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Silence rule deleted');
    });

    it('should return 404 when silence rule not found', async () => {
      (alertDeduplicationService.deleteSilenceRule as jest.Mock).mockReturnValue(false);

      const response = await request(app).delete('/api/alert-dedup/silences/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== PUT /config ====================

  describe('PUT /api/alert-dedup/config', () => {
    it('should update deduplication config', async () => {
      const mockStatus = { config: { enabled: true, windowMs: 600000 } };
      (alertDeduplicationService.updateConfig as jest.Mock).mockReturnValue(undefined);
      (alertDeduplicationService.getStatus as jest.Mock).mockReturnValue(mockStatus);

      const response = await request(app)
        .put('/api/alert-dedup/config')
        .send({ windowMs: 600000 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Config updated');
    });
  });
});
