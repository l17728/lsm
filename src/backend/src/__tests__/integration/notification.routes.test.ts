/**
 * Notification Routes Integration Tests
 *
 * Tests for notification API endpoints
 */

import request from 'supertest';
import express from 'express';
import notificationRoutes from '../../routes/notification.routes';

// Mock notification service with AlertSeverity and AlertType enums
jest.mock('../../services/notification.service', () => ({
  notificationService: {
    sendAlert: jest.fn(),
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    testChannels: jest.fn(),
  },
  AlertSeverity: { CRITICAL: 'CRITICAL', WARNING: 'WARNING', INFO: 'INFO' },
  AlertType: {
    SERVER_DOWN: 'SERVER_DOWN',
    HIGH_CPU: 'HIGH_CPU',
    HIGH_MEMORY: 'HIGH_MEMORY',
    HIGH_GPU_USAGE: 'HIGH_GPU_USAGE',
    TASK_FAILED: 'TASK_FAILED',
    TASK_COMPLETED: 'TASK_COMPLETED',
  },
}));

// Mock @prisma/client used by inline route handlers
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    emailNotification: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn().mockResolvedValue({}),
    },
    $disconnect: jest.fn(),
  })),
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
app.use('/api/notifications', notificationRoutes);

// Import the mocked service for assertions
import { notificationService } from '../../services/notification.service';

describe('Notification Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== POST /alert ====================

  describe('POST /api/notifications/alert', () => {
    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/notifications/alert')
        .send({ type: 'SERVER_DOWN' }); // missing severity, title, message

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 when severity is invalid', async () => {
      const response = await request(app)
        .post('/api/notifications/alert')
        .send({
          type: 'SERVER_DOWN',
          severity: 'INVALID_SEVERITY',
          title: 'Test Alert',
          message: 'Test message',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid severity');
    });

    it('should send alert successfully with valid fields', async () => {
      (notificationService.sendAlert as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/notifications/alert')
        .send({
          type: 'SERVER_DOWN',
          severity: 'CRITICAL',
          title: 'Test',
          message: 'Test',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Alert notification sent successfully');
      expect(notificationService.sendAlert as jest.Mock).toHaveBeenCalledWith({
        type: 'SERVER_DOWN',
        severity: 'CRITICAL',
        title: 'Test',
        message: 'Test',
        metadata: undefined,
        recipients: undefined,
      });
    });
  });

  // ==================== GET /preferences ====================

  describe('GET /api/notifications/preferences', () => {
    it('should return notification preferences', async () => {
      const mockPrefs = {
        emailEnabled: true,
        dingtalkEnabled: false,
        websocketEnabled: true,
        severityFilter: ['CRITICAL', 'WARNING'],
      };
      (notificationService.getPreferences as jest.Mock).mockReturnValue(mockPrefs);

      const response = await request(app).get('/api/notifications/preferences');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPrefs);
    });
  });

  // ==================== PUT /preferences ====================

  describe('PUT /api/notifications/preferences', () => {
    it('should update notification preferences successfully', async () => {
      const mockPrefs = {
        emailEnabled: false,
        dingtalkEnabled: true,
        websocketEnabled: true,
        severityFilter: ['CRITICAL'],
      };
      (notificationService.updatePreferences as jest.Mock).mockReturnValue(undefined);
      (notificationService.getPreferences as jest.Mock).mockReturnValue(mockPrefs);

      const response = await request(app)
        .put('/api/notifications/preferences')
        .send({ emailEnabled: false, dingtalkEnabled: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Preferences updated successfully');
      expect(notificationService.updatePreferences as jest.Mock).toHaveBeenCalled();
    });
  });

  // ==================== POST /test ====================

  describe('POST /api/notifications/test', () => {
    it('should return 400 when recipient is missing', async () => {
      const response = await request(app)
        .post('/api/notifications/test')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Recipient email is required');
    });

    it('should test channels successfully with valid recipient', async () => {
      const mockResults = { email: true, dingtalk: false, websocket: true };
      (notificationService.testChannels as jest.Mock).mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/api/notifications/test')
        .send({ recipient: 'test@test.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Channel tests completed');
      expect(response.body.data).toEqual(mockResults);
      expect(notificationService.testChannels as jest.Mock).toHaveBeenCalledWith('test@test.com');
    });
  });
});
