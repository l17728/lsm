/**
 * NotificationHistoryService Unit Tests
 *
 * Tests for saveNotification, getUserNotifications, getUnreadCount,
 * markAsRead, markAllAsRead, deleteNotification, and cleanupOldNotifications.
 * Prisma is mocked via moduleNameMapper (src/__mocks__/prisma.ts).
 */

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// notification-history.service.ts creates its own PrismaClient instance.
// We provide a full mock that covers all used operations.
const mockNotificationHistory = {
  create: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  groupBy: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    notificationHistory: mockNotificationHistory,
  })),
}));

import {
  NotificationHistoryService,
  NotificationType,
  NotificationSeverity,
  NotificationPriority,
  NotificationChannel,
} from '../../services/notification-history.service';

const baseNotification = {
  type: NotificationType.TASK_COMPLETED,
  severity: NotificationSeverity.INFO,
  priority: NotificationPriority.NORMAL,
  title: 'Task Done',
  message: 'Your task has finished.',
  channel: [NotificationChannel.WEBSOCKET],
};

describe('NotificationHistoryService', () => {
  let service: NotificationHistoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationHistoryService();
  });

  describe('saveNotification', () => {
    it('should persist a notification and return the created record', async () => {
      const mockRecord = { id: 'notif-1', userId: 'user-1', isRead: false, ...baseNotification };
      mockNotificationHistory.create.mockResolvedValue(mockRecord);

      const result = await service.saveNotification('user-1', baseNotification);

      expect(result).toEqual(mockRecord);
      expect(mockNotificationHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            type: NotificationType.TASK_COMPLETED,
            isRead: false,
          }),
        })
      );
    });

    it('should propagate errors thrown by prisma', async () => {
      mockNotificationHistory.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.saveNotification('user-1', baseNotification)
      ).rejects.toThrow('DB error');
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications and total count', async () => {
      const mockRecords = [
        { id: 'notif-1', userId: 'user-1', isRead: false },
        { id: 'notif-2', userId: 'user-1', isRead: true },
      ];
      mockNotificationHistory.findMany.mockResolvedValue(mockRecords);
      mockNotificationHistory.count.mockResolvedValue(2);

      const result = await service.getUserNotifications('user-1', 1, 10);

      expect(result.total).toBe(2);
      expect(result.notifications).toEqual(mockRecords);
      expect(mockNotificationHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
          skip: 0,
          take: 10,
        })
      );
    });

    it('should apply isRead filter when supplied', async () => {
      mockNotificationHistory.findMany.mockResolvedValue([]);
      mockNotificationHistory.count.mockResolvedValue(0);

      await service.getUserNotifications('user-1', 1, 20, { isRead: false });

      expect(mockNotificationHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isRead: false }),
        })
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return the count of unread notifications for a user', async () => {
      mockNotificationHistory.count.mockResolvedValue(7);

      const count = await service.getUnreadCount('user-1');

      expect(count).toBe(7);
      expect(mockNotificationHistory.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
    });

    it('should propagate errors', async () => {
      mockNotificationHistory.count.mockRejectedValue(new Error('Redis down'));

      await expect(service.getUnreadCount('user-1')).rejects.toThrow('Redis down');
    });
  });

  describe('markAsRead', () => {
    it('should update isRead and readAt for the specified notification', async () => {
      const updated = { id: 'notif-1', userId: 'user-1', isRead: true, readAt: new Date() };
      mockNotificationHistory.update.mockResolvedValue(updated);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(result.isRead).toBe(true);
      expect(mockNotificationHistory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_userId: { id: 'notif-1', userId: 'user-1' } },
          data: expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
        })
      );
    });

    it('should throw when the notification does not belong to the user', async () => {
      mockNotificationHistory.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.markAsRead('notif-99', 'wrong-user')).rejects.toThrow(
        'Record not found'
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read and return the count', async () => {
      mockNotificationHistory.updateMany.mockResolvedValue({ count: 5 });

      const count = await service.markAllAsRead('user-1');

      expect(count).toBe(5);
      expect(mockNotificationHistory.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', isRead: false }),
          data: expect.objectContaining({ isRead: true }),
        })
      );
    });

    it('should apply type filter when provided', async () => {
      mockNotificationHistory.updateMany.mockResolvedValue({ count: 2 });

      await service.markAllAsRead('user-1', { type: NotificationType.ALERT_CPU });

      expect(mockNotificationHistory.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: NotificationType.ALERT_CPU }),
        })
      );
    });
  });

  describe('deleteNotification', () => {
    it('should call prisma delete with the composite key', async () => {
      mockNotificationHistory.delete.mockResolvedValue({});

      await expect(service.deleteNotification('notif-1', 'user-1')).resolves.toBeUndefined();

      expect(mockNotificationHistory.delete).toHaveBeenCalledWith({
        where: { id_userId: { id: 'notif-1', userId: 'user-1' } },
      });
    });

    it('should propagate a not-found error', async () => {
      mockNotificationHistory.delete.mockRejectedValue(new Error('Not found'));

      await expect(service.deleteNotification('missing', 'user-1')).rejects.toThrow('Not found');
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should delete read notifications older than the cutoff and return count', async () => {
      mockNotificationHistory.deleteMany.mockResolvedValue({ count: 12 });

      const count = await service.cleanupOldNotifications(30);

      expect(count).toBe(12);
      expect(mockNotificationHistory.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isRead: true,
            createdAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        })
      );
    });
  });
});
