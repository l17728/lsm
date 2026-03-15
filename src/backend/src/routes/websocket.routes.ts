import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { websocketSessionService } from '../services/websocket-session.service';
import { user_role as UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/websocket/online-users
 * @desc    Get list of online users
 * @access  Private
 */
router.get('/online-users', async (req: AuthRequest, res) => {
  try {
    const onlineUsers = websocketSessionService.getOnlineUsers();
    const onlineCount = websocketSessionService.getOnlineCount();

    res.json({
      success: true,
      data: {
        users: onlineUsers,
        count: onlineCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[WebSocket] Get online users failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get online users',
    });
  }
});

/**
 * @route   GET /api/websocket/sessions
 * @desc    Get all active sessions (Admin only)
 * @access  Private/Admin
 */
router.get('/sessions', async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ERR_PERMISSION_DENIED',
          message: '权限不足：仅管理员可查看会话列表',
        },
      });
    }

    const sessions = websocketSessionService.getAllSessions();

    res.json({
      success: true,
      data: {
        sessions,
        count: sessions.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[WebSocket] Get sessions failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get sessions',
    });
  }
});

export default router;
