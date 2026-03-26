/**
 * Self-Healing Routes Integration Tests
 */

import request from 'supertest';
import express from 'express';
import selfHealingRoutes from '../../routes/self-healing.routes';
import { selfHealingService, FaultType, FaultLevel, RepairActionType } from '../../services/self-healing';

jest.mock('../../services/self-healing', () => ({
  selfHealingService: {
    getStatus: jest.fn(),
    getRules: jest.fn(),
    upsertRule: jest.fn(),
    getActiveEvents: jest.fn(),
    getAllEvents: jest.fn(),
    manualRepair: jest.fn(),
    ignoreEvent: jest.fn(),
    getRepairHistory: jest.fn(),
    startDetection: jest.fn(),
    stopDetection: jest.fn(),
  },
  FaultType: {
    HIGH_CPU: 'HIGH_CPU',
    HIGH_MEMORY: 'HIGH_MEMORY',
    SERVICE_DOWN: 'SERVICE_DOWN',
    DISK_FULL: 'DISK_FULL',
  },
  FaultLevel: {
    WARNING: 'WARNING',
    CRITICAL: 'CRITICAL',
    FATAL: 'FATAL',
  },
  RepairActionType: {
    RESTART_SERVICE: 'RESTART_SERVICE',
    SCALE_UP: 'SCALE_UP',
    CLEAR_CACHE: 'CLEAR_CACHE',
    NOTIFY: 'NOTIFY',
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
app.use('/api/self-healing', selfHealingRoutes);

describe('Self-Healing Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /status ====================

  describe('GET /api/self-healing/status', () => {
    it('should return self-healing service status', async () => {
      const mockStatus = { running: true, rulesCount: 5, activeEvents: 1 };
      (selfHealingService.getStatus as jest.Mock).mockReturnValue(mockStatus);

      const response = await request(app).get('/api/self-healing/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
    });
  });

  // ==================== GET /rules ====================

  describe('GET /api/self-healing/rules', () => {
    it('should return all healing rules', async () => {
      const mockRules = [
        { id: 'rule-1', name: 'High CPU Rule', faultType: 'HIGH_CPU', enabled: true },
        { id: 'rule-2', name: 'Service Down Rule', faultType: 'SERVICE_DOWN', enabled: true },
      ];
      (selfHealingService.getRules as jest.Mock).mockReturnValue(mockRules);

      const response = await request(app).get('/api/self-healing/rules');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rules).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });
  });

  // ==================== POST /rules ====================

  describe('POST /api/self-healing/rules', () => {
    it('should create a new healing rule', async () => {
      const mockRule = { id: 'rule-new', name: 'New Rule', faultType: 'HIGH_CPU' };
      (selfHealingService.upsertRule as jest.Mock).mockReturnValue(mockRule);

      const response = await request(app)
        .post('/api/self-healing/rules')
        .send({
          name: 'New Rule',
          faultType: 'HIGH_CPU',
          threshold: 90,
          repairAction: 'RESTART_SERVICE',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRule);
    });

    it('should return 400 on invalid rule data', async () => {
      (selfHealingService.upsertRule as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid rule configuration');
      });

      const response = await request(app)
        .post('/api/self-healing/rules')
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== PUT /rules/:id ====================

  describe('PUT /api/self-healing/rules/:id', () => {
    it('should update an existing healing rule', async () => {
      const mockRule = { id: 'rule-1', name: 'Updated Rule', faultType: 'HIGH_CPU' };
      (selfHealingService.upsertRule as jest.Mock).mockReturnValue(mockRule);

      const response = await request(app)
        .put('/api/self-healing/rules/rule-1')
        .send({ name: 'Updated Rule', threshold: 85 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRule);
    });

    it('should return 400 on update error', async () => {
      (selfHealingService.upsertRule as jest.Mock).mockImplementation(() => {
        throw new Error('Rule update failed');
      });

      const response = await request(app)
        .put('/api/self-healing/rules/rule-1')
        .send({ threshold: -1 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /events ====================

  describe('GET /api/self-healing/events', () => {
    it('should return all fault events', async () => {
      const mockEvents = [
        { id: 'event-1', faultType: 'HIGH_CPU', status: 'RESOLVED' },
        { id: 'event-2', faultType: 'SERVICE_DOWN', status: 'ACTIVE' },
      ];
      (selfHealingService.getAllEvents as jest.Mock).mockReturnValue(mockEvents);

      const response = await request(app).get('/api/self-healing/events');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    it('should return only active events when active=true', async () => {
      const mockActiveEvents = [{ id: 'event-2', faultType: 'SERVICE_DOWN', status: 'ACTIVE' }];
      (selfHealingService.getActiveEvents as jest.Mock).mockReturnValue(mockActiveEvents);

      const response = await request(app).get('/api/self-healing/events?active=true');

      expect(response.status).toBe(200);
      expect(response.body.data.events).toHaveLength(1);
      expect(selfHealingService.getActiveEvents as jest.Mock).toHaveBeenCalled();
    });
  });

  // ==================== GET /events/:id ====================

  describe('GET /api/self-healing/events/:id', () => {
    it('should return event when found', async () => {
      const mockEvent = { id: 'event-1', faultType: 'HIGH_CPU', status: 'RESOLVED' };
      (selfHealingService.getAllEvents as jest.Mock).mockReturnValue([mockEvent]);

      const response = await request(app).get('/api/self-healing/events/event-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('event-1');
    });

    it('should return 404 when event not found', async () => {
      (selfHealingService.getAllEvents as jest.Mock).mockReturnValue([]);

      const response = await request(app).get('/api/self-healing/events/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Event not found');
    });
  });

  // ==================== POST /events/:id/repair ====================

  describe('POST /api/self-healing/events/:id/repair', () => {
    it('should trigger manual repair', async () => {
      (selfHealingService.manualRepair as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).post('/api/self-healing/events/event-1/repair');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Repair initiated');
    });

    it('should return 500 on repair error', async () => {
      (selfHealingService.manualRepair as jest.Mock).mockRejectedValue(
        new Error('Repair failed: service unreachable')
      );

      const response = await request(app).post('/api/self-healing/events/event-1/repair');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== POST /events/:id/ignore ====================

  describe('POST /api/self-healing/events/:id/ignore', () => {
    it('should ignore an event', async () => {
      (selfHealingService.ignoreEvent as jest.Mock).mockReturnValue(true);

      const response = await request(app).post('/api/self-healing/events/event-1/ignore');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Event ignored');
    });

    it('should return 404 when event not found for ignore', async () => {
      (selfHealingService.ignoreEvent as jest.Mock).mockReturnValue(false);

      const response = await request(app).post('/api/self-healing/events/non-existent/ignore');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /history ====================

  describe('GET /api/self-healing/history', () => {
    it('should return repair history', async () => {
      const mockHistory = [
        { id: 'h-1', eventId: 'event-1', action: 'RESTART_SERVICE', success: true },
      ];
      (selfHealingService.getRepairHistory as jest.Mock).mockReturnValue(mockHistory);

      const response = await request(app).get('/api/self-healing/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });
  });

  // ==================== GET /fault-types ====================

  describe('GET /api/self-healing/fault-types', () => {
    it('should return available fault types', async () => {
      const response = await request(app).get('/api/self-healing/fault-types');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ==================== GET /fault-levels ====================

  describe('GET /api/self-healing/fault-levels', () => {
    it('should return available fault levels', async () => {
      const response = await request(app).get('/api/self-healing/fault-levels');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ==================== GET /repair-actions ====================

  describe('GET /api/self-healing/repair-actions', () => {
    it('should return available repair action types', async () => {
      const response = await request(app).get('/api/self-healing/repair-actions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
