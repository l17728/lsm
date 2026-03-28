import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Notification severity levels
 */
export enum NotificationSeverity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
}

/**
 * Notification types
 */
export enum NotificationType {
  // Alert notifications
  ALERT_CPU = 'ALERT_CPU',
  ALERT_MEMORY = 'ALERT_MEMORY',
  ALERT_GPU = 'ALERT_GPU',
  ALERT_TEMP = 'ALERT_TEMP',
  ALERT_SERVER_OFFLINE = 'ALERT_SERVER_OFFLINE',
  
  // Task notifications
  TASK_CREATED = 'TASK_CREATED',
  TASK_STARTED = 'TASK_STARTED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_FAILED = 'TASK_FAILED',
  TASK_CANCELLED = 'TASK_CANCELLED',
  
  // System notifications
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  SYSTEM_UPDATE = 'SYSTEM_UPDATE',
  SYSTEM_RESTART = 'SYSTEM_RESTART',
  
  // Batch operation notifications
  BATCH_STARTED = 'BATCH_STARTED',
  BATCH_PROGRESS = 'BATCH_PROGRESS',
  BATCH_COMPLETED = 'BATCH_COMPLETED',
  BATCH_FAILED = 'BATCH_FAILED',
  
  // User notifications
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_KICKED = 'USER_KICKED',
}

/**
 * Notification channel types
 */
export enum NotificationChannel {
  EMAIL = 'EMAIL',
  DINGTALK = 'DINGTALK',
  WEBSOCKET = 'WEBSOCKET',
  SMS = 'SMS',
}

/**
 * Notification priority
 */
export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Notification interface
 */
export interface Notification {
  id?: string;
  type: NotificationType;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  recipientIds?: string[];
  channel?: NotificationChannel[];
  createdAt?: Date;
}

/**
 * Notification history record
 */
export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata: any;
  isRead: boolean;
  readAt?: Date;
  channel: NotificationChannel[];
  createdAt: Date;
}

/**
 * Notification statistics
 */
export interface NotificationStats {
  totalCount: number;
  unreadCount: number;
  countByType: Record<string, number>;
  countBySeverity: Record<string, number>;
  countByPriority: Record<string, number>;
}

/**
 * Notification History Service
 * 
 * Handles notification persistence, retrieval, and management
 */
export class NotificationHistoryService {
  /**
   * Save notification to database
   */
  async saveNotification(
    userId: string,
    notification: Omit<Notification, 'id' | 'recipientIds'>
  ): Promise<NotificationRecord> {
    try {
      const record = await prisma.notificationHistory.create({
        data: {
          userId,
          type: notification.type,
          severity: notification.severity,
          priority: notification.priority,
          title: notification.title,
          message: notification.message,
          metadata: notification.metadata || {},
          channel: notification.channel || [NotificationChannel.WEBSOCKET],
          isRead: false,
        },
      });

      console.log(`[NotificationHistory] Saved notification ${record.id} for user ${userId}`);
      return record as NotificationRecord;
    } catch (error) {
      console.error('[NotificationHistory] Save failed:', error);
      throw error;
    }
  }

  /**
   * Save notifications for multiple users (batch)
   */
  async saveNotificationsBatch(
    userIds: string[],
    notification: Omit<Notification, 'id' | 'recipientIds'>
  ): Promise<NotificationRecord[]> {
    try {
      const records = await Promise.all(
        userIds.map(userId => this.saveNotification(userId, notification))
      );
      console.log(`[NotificationHistory] Saved ${records.length} notifications in batch`);
      return records;
    } catch (error) {
      console.error('[NotificationHistory] Batch save failed:', error);
      throw error;
    }
  }

  /**
   * Get user's notification history
   */
  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      type?: NotificationType;
      severity?: NotificationSeverity;
      isRead?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ notifications: NotificationRecord[]; total: number }> {
    try {
      const where: any = { userId };

      // Apply filters
      if (filters?.type) {
        where.type = filters.type;
      }
      if (filters?.severity) {
        where.severity = filters.severity;
      }
      if (filters?.isRead !== undefined) {
        where.isRead = filters.isRead;
      }
      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters?.startDate) {
          where.createdAt.gte = filters.startDate;
        }
        if (filters?.endDate) {
          where.createdAt.lte = filters.endDate;
        }
      }

      const [notifications, total] = await Promise.all([
        prisma.notificationHistory.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.notificationHistory.count({ where }),
      ]);

      return {
        notifications: notifications as NotificationRecord[],
        total,
      };
    } catch (error) {
      console.error('[NotificationHistory] Get user notifications failed:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationRecord> {
    try {
      const record = await prisma.notificationHistory.update({
        where: {
          id_userId: {
            id: notificationId,
            userId,
          },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      console.log(`[NotificationHistory] Marked notification ${notificationId} as read`);
      return record as NotificationRecord;
    } catch (error) {
      console.error('[NotificationHistory] Mark as read failed:', error);
      throw error;
    }
  }

  /**
   * Mark all user notifications as read
   */
  async markAllAsRead(userId: string, filters?: { type?: NotificationType }): Promise<number> {
    try {
      const where: any = { userId, isRead: false };
      if (filters?.type) {
        where.type = filters.type;
      }

      const result = await prisma.notificationHistory.updateMany({
        where,
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      console.log(`[NotificationHistory] Marked ${result.count} notifications as read for user ${userId}`);
      return result.count;
    } catch (error) {
      console.error('[NotificationHistory] Mark all as read failed:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      await prisma.notificationHistory.delete({
        where: {
          id_userId: {
            id: notificationId,
            userId,
          },
        },
      });

      console.log(`[NotificationHistory] Deleted notification ${notificationId}`);
    } catch (error) {
      console.error('[NotificationHistory] Delete failed:', error);
      throw error;
    }
  }

  /**
   * Delete old notifications (cleanup)
   */
  async cleanupOldNotifications(maxAgeDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

      const result = await prisma.notificationHistory.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          isRead: true, // Only delete read notifications
        },
      });

      console.log(`[NotificationHistory] Cleaned up ${result.count} old notifications`);
      return result.count;
    } catch (error) {
      console.error('[NotificationHistory] Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics for user
   */
  async getUserStats(userId: string): Promise<NotificationStats> {
    try {
      const [totalCount, unreadCount, typeCounts, severityCounts, priorityCounts] = await Promise.all([
        prisma.notificationHistory.count({ where: { userId } }),
        prisma.notificationHistory.count({ where: { userId, isRead: false } }),
        
        // Count by type
        prisma.notificationHistory.groupBy({
          by: ['type'],
          where: { userId },
          _count: true,
        }),
        
        // Count by severity
        prisma.notificationHistory.groupBy({
          by: ['severity'],
          where: { userId },
          _count: true,
        }),
        
        // Count by priority
        prisma.notificationHistory.groupBy({
          by: ['priority'],
          where: { userId },
          _count: true,
        }),
      ]);

      const countByType: Record<string, number> = {};
      typeCounts.forEach(item => {
        countByType[item.type] = item._count;
      });

      const countBySeverity: Record<string, number> = {};
      severityCounts.forEach(item => {
        countBySeverity[item.severity] = item._count;
      });

      const countByPriority: Record<string, number> = {};
      priorityCounts.forEach(item => {
        countByPriority[item.priority] = item._count;
      });

      return {
        totalCount,
        unreadCount,
        countByType,
        countBySeverity,
        countByPriority,
      };
    } catch (error) {
      console.error('[NotificationHistory] Get stats failed:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await prisma.notificationHistory.count({
        where: { userId, isRead: false },
      });
    } catch (error) {
      console.error('[NotificationHistory] Get unread count failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationHistoryService = new NotificationHistoryService();
export default notificationHistoryService;
