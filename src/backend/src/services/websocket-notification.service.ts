import { Server as SocketIOServer } from 'socket.io';
import {
  Notification,
  NotificationType,
  NotificationSeverity,
  NotificationPriority,
  NotificationChannel,
  notificationHistoryService,
} from './notification-history.service';

/**
 * WebSocket notification payload
 */
interface WebSocketNotificationPayload {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
  isRead: boolean;
}

/**
 * Batch operation progress
 */
interface BatchProgress {
  batchId: string;
  operation: string;
  total: number;
  completed: number;
  failed: number;
  progress: number; // percentage 0-100
  status: 'running' | 'completed' | 'failed';
  currentStep?: string;
}

/**
 * Enhanced WebSocket Notification Service
 * 
 * Provides advanced notification features:
 * - Real-time alert push
 * - Batch operation progress tracking
 * - System notifications
 * - Notification history integration
 * - User-specific and broadcast notifications
 */
export class WebSocketNotificationService {
  private io: SocketIOServer | null = null;
  private notificationQueue: Array<{
    userId: string;
    notification: Omit<Notification, 'id' | 'recipientIds'>;
  }> = [];

  /**
   * Initialize with Socket.IO server
   */
  initialize(io: SocketIOServer) {
    this.io = io;
    console.log('[WebSocketNotification] Service initialized');
  }

  /**
   * Send real-time alert notification
   */
  async sendAlert(notification: {
    type: NotificationType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    metadata?: Record<string, any>;
    recipientIds?: string[];
  }): Promise<void> {
    const payload: WebSocketNotificationPayload = {
      id: Date.now().toString(),
      type: notification.type,
      severity: notification.severity,
      priority: this.getPriorityFromSeverity(notification.severity),
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    console.log(
      `[WebSocketNotification] Sending alert: ${payload.title} (${payload.severity})`
    );

    // Broadcast to all clients
    if (notification.recipientIds && notification.recipientIds.length > 0) {
      // Send to specific users
      for (const userId of notification.recipientIds) {
        await this.sendToUser(userId, payload);
      }
    } else {
      // Broadcast to all
      this.io?.emit('notification:alert', payload);
    }

    // Save to history (async, non-blocking)
    this.saveToHistory(notification.recipientIds || [], {
      type: notification.type,
      severity: notification.severity,
      priority: payload.priority,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
    });
  }

  /**
   * Send batch operation progress update
   */
  async sendBatchProgress(
    userId: string,
    progress: BatchProgress
  ): Promise<void> {
    const payload: WebSocketNotificationPayload = {
      id: `batch-${progress.batchId}-${Date.now()}`,
      type: NotificationType.BATCH_PROGRESS,
      severity: NotificationSeverity.INFO,
      priority: NotificationPriority.NORMAL,
      title: `${progress.operation} - ${progress.progress.toFixed(1)}%`,
      message: `Completed: ${progress.completed}/${progress.total}${
        progress.currentStep ? ` - ${progress.currentStep}` : ''
      }`,
      metadata: {
        batchId: progress.batchId,
        operation: progress.operation,
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        progress: progress.progress,
        status: progress.status,
        currentStep: progress.currentStep,
      },
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    console.log(
      `[WebSocketNotification] Batch progress: ${progress.operation} ${progress.progress.toFixed(1)}%`
    );

    // Send to specific user
    this.io?.to(`user:${userId}`).emit('notification:batch', payload);

    // Save to history (async, non-blocking)
    this.saveToHistory([userId], {
      type: NotificationType.BATCH_PROGRESS,
      severity: NotificationSeverity.INFO,
      priority: NotificationPriority.NORMAL,
      title: payload.title,
      message: payload.message,
      metadata: payload.metadata,
    });
  }

  /**
   * Send batch operation completion notification
   */
  async sendBatchCompletion(
    userId: string,
    batchId: string,
    operation: string,
    success: boolean,
    total: number,
    completed: number,
    failed: number
  ): Promise<void> {
    const payload: WebSocketNotificationPayload = {
      id: `batch-${batchId}-complete`,
      type: success ? NotificationType.BATCH_COMPLETED : NotificationType.BATCH_FAILED,
      severity: success ? NotificationSeverity.SUCCESS : NotificationSeverity.WARNING,
      priority: success ? NotificationPriority.NORMAL : NotificationPriority.HIGH,
      title: success ? `${operation} Completed` : `${operation} Failed`,
      message: success
        ? `Successfully completed ${completed}/${total} items`
        : `Failed: ${failed}/${total} items`,
      metadata: {
        batchId,
        operation,
        total,
        completed,
        failed,
        success,
      },
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    console.log(
      `[WebSocketNotification] Batch ${success ? 'completed' : 'failed'}: ${operation}`
    );

    // Send to specific user
    this.io?.to(`user:${userId}`).emit('notification:batch', payload);

    // Save to history (async, non-blocking)
    this.saveToHistory([userId], {
      type: payload.type,
      severity: payload.severity,
      priority: payload.priority,
      title: payload.title,
      message: payload.message,
      metadata: payload.metadata,
    });
  }

  /**
   * Send system notification
   */
  async sendSystemNotification(notification: {
    type: NotificationType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    metadata?: Record<string, any>;
    broadcast?: boolean;
    recipientIds?: string[];
  }): Promise<void> {
    const payload: WebSocketNotificationPayload = {
      id: `system-${Date.now()}`,
      type: notification.type,
      severity: notification.severity,
      priority: this.getPriorityFromSeverity(notification.severity),
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    console.log(`[WebSocketNotification] System notification: ${payload.title}`);

    if (notification.broadcast) {
      // Broadcast to all
      this.io?.emit('notification:system', payload);
    } else if (notification.recipientIds) {
      // Send to specific users
      for (const userId of notification.recipientIds) {
        await this.sendToUser(userId, payload);
      }
    }

    // Save to history (async, non-blocking)
    this.saveToHistory(notification.recipientIds || [], {
      type: notification.type,
      severity: notification.severity,
      priority: payload.priority,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
    });
  }

  /**
   * Send task status notification
   */
  async sendTaskNotification(
    userId: string,
    taskId: string,
    taskName: string,
    type: NotificationType,
    status: string
  ): Promise<void> {
    const severityMap: Partial<Record<NotificationType, NotificationSeverity>> = {
      [NotificationType.TASK_CREATED]: NotificationSeverity.INFO,
      [NotificationType.TASK_STARTED]: NotificationSeverity.INFO,
      [NotificationType.TASK_COMPLETED]: NotificationSeverity.SUCCESS,
      [NotificationType.TASK_FAILED]: NotificationSeverity.WARNING,
      [NotificationType.TASK_CANCELLED]: NotificationSeverity.WARNING,
    };

    const titleMap: Partial<Record<NotificationType, string>> = {
      [NotificationType.TASK_CREATED]: 'Task Created',
      [NotificationType.TASK_STARTED]: 'Task Started',
      [NotificationType.TASK_COMPLETED]: 'Task Completed',
      [NotificationType.TASK_FAILED]: 'Task Failed',
      [NotificationType.TASK_CANCELLED]: 'Task Cancelled',
    };

    const payload: WebSocketNotificationPayload = {
      id: `task-${taskId}-${type}`,
      type,
      severity: severityMap[type] || NotificationSeverity.INFO,
      priority: NotificationPriority.NORMAL,
      title: titleMap[type],
      message: `Task "${taskName}" ${status.toLowerCase()}`,
      metadata: {
        taskId,
        taskName,
        status,
      },
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    console.log(`[WebSocketNotification] Task notification: ${payload.title}`);

    // Send to specific user
    this.io?.to(`user:${userId}`).emit('notification:task', payload);

    // Save to history (async, non-blocking)
    this.saveToHistory([userId], {
      type,
      severity: payload.severity,
      priority: payload.priority,
      title: payload.title,
      message: payload.message,
      metadata: payload.metadata,
    });
  }

  /**
   * Send notification to specific user
   */
  private async sendToUser(
    userId: string,
    payload: WebSocketNotificationPayload
  ): Promise<void> {
    this.io?.to(`user:${userId}`).emit('notification', payload);
  }

  /**
   * Save notification to history (async, non-blocking)
   */
  private async saveToHistory(
    userIds: string[],
    notification: Omit<Notification, 'id' | 'recipientIds'>
  ): Promise<void> {
    try {
      if (userIds.length === 0) {
        // For broadcast notifications, we might want to save for all users
        // For now, skip
        return;
      }

      // Save for each user
      for (const userId of userIds) {
        await notificationHistoryService.saveNotification(userId, notification);
      }
    } catch (error) {
      console.error('[WebSocketNotification] Save to history failed:', error);
      // Don't throw - notification was already sent
    }
  }

  /**
   * Get priority from severity
   */
  private getPriorityFromSeverity(severity: NotificationSeverity): NotificationPriority {
    switch (severity) {
      case NotificationSeverity.CRITICAL:
        return NotificationPriority.URGENT;
      case NotificationSeverity.WARNING:
        return NotificationPriority.HIGH;
      case NotificationSeverity.SUCCESS:
        return NotificationPriority.NORMAL;
      case NotificationSeverity.INFO:
      default:
        return NotificationPriority.NORMAL;
    }
  }

  /**
   * Queue notification for later sending
   */
  queueNotification(
    userId: string,
    notification: Omit<Notification, 'id' | 'recipientIds'>
  ): void {
    this.notificationQueue.push({ userId, notification });
    console.log(
      `[WebSocketNotification] Queued notification for ${userId}, queue size: ${this.notificationQueue.length}`
    );
  }

  /**
   * Process queued notifications
   */
  async processQueue(): Promise<void> {
    const queue = [...this.notificationQueue];
    this.notificationQueue = [];

    for (const item of queue) {
      try {
        await this.sendAlert({
          type: item.notification.type,
          severity: item.notification.severity,
          title: item.notification.title,
          message: item.notification.message,
          metadata: item.notification.metadata,
          recipientIds: [item.userId],
        });
      } catch (error) {
        console.error('[WebSocketNotification] Process queue failed:', error);
      }
    }

    console.log(`[WebSocketNotification] Processed ${queue.length} queued notifications`);
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.notificationQueue.length;
  }

  /**
   * Clear notification queue
   */
  clearQueue(): void {
    this.notificationQueue = [];
    console.log('[WebSocketNotification] Queue cleared');
  }
}

// Export singleton instance
export const webSocketNotificationService = new WebSocketNotificationService();
export default webSocketNotificationService;
