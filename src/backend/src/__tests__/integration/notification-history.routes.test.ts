/**
 * Notification History Routes Integration Tests
 */

import request from 'supertest';
import express from 'express';
import notificationHistoryRoutes from '../../routes/notification-history.routes';
import { notificationHistoryService } from '../../services/notification-history.service';

jest.mock('../../services/notification-history.service', () => ({
  notificationHistoryService: {
    getUserNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    getUserStats: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  },
  NotificationType: { ALERT: 'ALERT', TASK: 'TASK', SYSTEM: 'SYSTEM' },
  NotificationSeverity: { INFO: 'INFO', WARNING: 'WARNING', CRITICAL: 'CRITICAL' },
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { id: 'user-1', userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { id: 'user-1', userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  AuthRequest: {},
}));

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use((req: any, _res: any, next: any) => {
  if (!req.user) req.user = { id: 'user-1', userId: 'user-1', username: 'testuser', role: 'USER' };
  next();
});
app.use('/api/notification-history', notificationHistoryRoutes);

describe('Notification History Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /history ====================

  describe('GET /api/notification-history/history', () => {
    it('should return notification history', async () => {
      (notificationHistoryService.getUserNotifications as jest.Mock).mockResolvedValue({
        notifications: [{ id: 'n-1', title: 'Test', isRead: false }],
        total: 1,
      });

      const response = await request(app).get('/api/notification-history/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.total).toBe(1);
    });

    it('should return empty list when no notifications', async () => {
      (notificationHistoryService.getUserNotifications as jest.Mock).mockResolvedValue({
        notifications: [],
        total: 0,
      });

      const response = await request(app).get('/api/notification-history/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toHaveLength(0);
    });

    it('should return 500 on service error', async () => {
      (notificationHistoryService.getUserNotifications as jest.Mock).mockRejectedValue(
        new Error('DB error')
      );

      const response = await request(app).get('/api/notification-history/history');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /unread-count ====================

  describe('GET /api/notification-history/unread-count', () => {
    it('should return unread count', async () => {
      (notificationHistoryService.getUnreadCount as jest.Mock).mockResolvedValue(5);

      const response = await request(app).get('/api/notification-history/unread-count');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(5);
    });

    it('should return 500 on service error', async () => {
      (notificationHistoryService.getUnreadCount as jest.Mock).mockRejectedValue(
        new Error('Cache error')
      );

      const response = await request(app).get('/api/notification-history/unread-count');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /stats ====================

  describe('GET /api/notification-history/stats', () => {
    it('should return notification statistics', async () => {
      const mockStats = { total: 10, unread: 3, byType: { ALERT: 5, TASK: 3, SYSTEM: 2 } };
      (notificationHistoryService.getUserStats as jest.Mock).mockResolvedValue(mockStats);

      const response = await request(app).get('/api/notification-history/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });

    it('should return 500 on service error', async () => {
      (notificationHistoryService.getUserStats as jest.Mock).mockRejectedValue(
        new Error('Stats error')
      );

      const response = await request(app).get('/api/notification-history/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== PUT /read-all (must be before /:id/read) ====================

  describe('PUT /api/notification-history/read-all', () => {
    it('should mark all notifications as read', async () => {
      (notificationHistoryService.markAllAsRead as jest.Mock).mockResolvedValue(3);

      const response = await request(app).put('/api/notification-history/read-all');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(3);
    });

    it('should return 500 on service error', async () => {
      (notificationHistoryService.markAllAsRead as jest.Mock).mockRejectedValue(
        new Error('Mark all error')
      );

      const response = await request(app).put('/api/notification-history/read-all');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== PUT /:id/read ====================

  describe('PUT /api/notification-history/:id/read', () => {
    it('should mark a notification as read', async () => {
      (notificationHistoryService.markAsRead as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).put('/api/notification-history/notif-123/read');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(notificationHistoryService.markAsRead as jest.Mock).toHaveBeenCalledWith(
        'notif-123',
        'user-1'
      );
    });

    it('should return 500 on service error', async () => {
      (notificationHistoryService.markAsRead as jest.Mock).mockRejectedValue(
        new Error('Not found')
      );

      const response = await request(app).put('/api/notification-history/notif-999/read');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== DELETE /:id ====================

  describe('DELETE /api/notification-history/:id', () => {
    it('should delete a notification', async () => {
      (notificationHistoryService.deleteNotification as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app).delete('/api/notification-history/notif-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(notificationHistoryService.deleteNotification as jest.Mock).toHaveBeenCalledWith(
        'notif-123',
        'user-1'
      );
    });

    it('should return 500 on service error', async () => {
      (notificationHistoryService.deleteNotification as jest.Mock).mockRejectedValue(
        new Error('Delete error')
      );

      const response = await request(app).delete('/api/notification-history/notif-999');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
