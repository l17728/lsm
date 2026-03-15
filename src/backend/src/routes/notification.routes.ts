import { Router, Request, Response } from 'express';
import { notificationService, AlertSeverity, AlertType } from '../services/notification.service';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/notifications/alert
 * Send an alert notification
 */
router.post('/alert', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { type, severity, title, message, metadata, recipients } = req.body;

    // Validate required fields
    if (!type || !severity || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, severity, title, message',
      });
    }

    // Validate severity
    if (!Object.values(AlertSeverity).includes(severity)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid severity. Must be one of: CRITICAL, WARNING, INFO',
      });
    }

    // Validate type
    if (!Object.values(AlertType).includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert type',
      });
    }

    // Send notification
    await notificationService.sendAlert({
      type,
      severity,
      title,
      message,
      metadata,
      recipients,
    });

    res.json({
      success: true,
      message: 'Alert notification sent successfully',
    });
  } catch (error: any) {
    console.error('[Notification API] Send alert error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send alert notification',
    });
  }
});

/**
 * GET /api/notifications/preferences
 * Get notification preferences
 */
router.get('/preferences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const preferences = notificationService.getPreferences();
    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error('[Notification API] Get preferences error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get preferences',
    });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 */
router.put('/preferences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { emailEnabled, dingtalkEnabled, websocketEnabled, severityFilter, quietHours } = req.body;

    notificationService.updatePreferences({
      emailEnabled,
      dingtalkEnabled,
      websocketEnabled,
      severityFilter,
      quietHours,
    });

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: notificationService.getPreferences(),
    });
  } catch (error: any) {
    console.error('[Notification API] Update preferences error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update preferences',
    });
  }
});

/**
 * POST /api/notifications/test
 * Test notification channels
 */
router.post('/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { recipient } = req.body;

    if (!recipient) {
      return res.status(400).json({
        success: false,
        error: 'Recipient email is required',
      });
    }

    const results = await notificationService.testChannels(recipient);

    res.json({
      success: true,
      message: 'Channel tests completed',
      data: results,
    });
  } catch (error: any) {
    console.error('[Notification API] Test channels error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test channels',
    });
  }
});

/**
 * GET /api/notifications/list
 * Get user's notification list
 */
router.get('/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const userId = (req as any).user?.id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const where: any = {
      userId,
      ...(unreadOnly === 'true' ? { status: 'PENDING' } : {}),
    };

    const [notifications, total] = await Promise.all([
      prisma.emailNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.emailNotification.count({ where }),
    ]);

    await prisma.$disconnect();

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    console.error('[Notification API] Get list error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get notifications',
    });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.emailNotification.update({
      where: { id },
      data: { status: 'READ' },
    });

    await prisma.$disconnect();

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    console.error('[Notification API] Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark notification as read',
    });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.emailNotification.updateMany({
      where: {
        userId,
        status: 'PENDING',
      },
      data: { status: 'READ' },
    });

    await prisma.$disconnect();

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error: any) {
    console.error('[Notification API] Mark all as read error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark all notifications as read',
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.emailNotification.delete({
      where: { id },
    });

    await prisma.$disconnect();

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error: any) {
    console.error('[Notification API] Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete notification',
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const count = await prisma.emailNotification.count({
      where: {
        userId,
        status: 'PENDING',
      },
    });

    await prisma.$disconnect();

    res.json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    console.error('[Notification API] Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get unread count',
    });
  }
});

export { router as notificationRoutes };
export default router;
