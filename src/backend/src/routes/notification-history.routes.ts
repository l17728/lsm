import { Router, Request, Response } from 'express';
import {
  notificationHistoryService,
  NotificationType,
  NotificationSeverity,
} from '../services/notification-history.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * Get user's notification history
 * GET /api/notifications/history
 */
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Parse filters
    const filters: any = {};
    if (req.query.type) {
      filters.type = req.query.type as NotificationType;
    }
    if (req.query.severity) {
      filters.severity = req.query.severity as NotificationSeverity;
    }
    if (req.query.isRead !== undefined) {
      filters.isRead = req.query.isRead === 'true';
    }
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
    }

    const result = await notificationHistoryService.getUserNotifications(
      userId,
      page,
      limit,
      filters
    );

    res.json({
      success: true,
      data: {
        notifications: result.notifications,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('[NotificationRoutes] Get history failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get notification history',
    });
  }
});

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const count = await notificationHistoryService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    console.error('[NotificationRoutes] Get unread count failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get unread count',
    });
  }
});

/**
 * Get notification statistics
 * GET /api/notifications/stats
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const stats = await notificationHistoryService.getUserStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[NotificationRoutes] Get stats failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get notification statistics',
    });
  }
});

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const notificationId = req.params.id;

    await notificationHistoryService.markAsRead(notificationId, userId);

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    console.error('[NotificationRoutes] Mark as read failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark notification as read',
    });
  }
});

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
router.put('/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const type = req.query.type as NotificationType | undefined;

    const count = await notificationHistoryService.markAllAsRead(userId, {
      type,
    });

    res.json({
      success: true,
      data: { count },
      message: `Marked ${count} notifications as read`,
    });
  } catch (error: any) {
    console.error('[NotificationRoutes] Mark all as read failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark all notifications as read',
    });
  }
});

/**
 * Delete notification
 * DELETE /api/notifications/:id
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const notificationId = req.params.id;

    await notificationHistoryService.deleteNotification(notificationId, userId);

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error: any) {
    console.error('[NotificationRoutes] Delete failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete notification',
    });
  }
});

/**
 * Bulk delete notifications
 * DELETE /api/notifications/bulk
 */
router.delete('/bulk', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const notificationIds = req.body.ids as string[];

    if (!notificationIds || notificationIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No notification IDs provided',
      });
    }

    // Delete each notification
    await Promise.all(
      notificationIds.map(id =>
        notificationHistoryService.deleteNotification(id, userId)
      )
    );

    res.json({
      success: true,
      message: `Deleted ${notificationIds.length} notifications`,
    });
  } catch (error: any) {
    console.error('[NotificationRoutes] Bulk delete failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete notifications',
    });
  }
});

export default router;
