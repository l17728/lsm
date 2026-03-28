/**
 * WebSocket Routes Integration Tests
 *
 * Tests for WebSocket session management API endpoints
 */

import request from 'supertest';
import express from 'express';
import websocketRoutes from '../../routes/websocket.routes';
import { websocketSessionService } from '../../services/websocket-session.service';

// Mock websocket session service
jest.mock('../../services/websocket-session.service', () => ({
  websocketSessionService: {
    getOnlineUsers: jest.fn(),
    getOnlineCount: jest.fn(),
    getAllSessions: jest.fn(),
  },
}));

// Mock Prisma client enums
jest.mock('@prisma/client', () => ({
  user_role: { ADMIN: 'ADMIN', MANAGER: 'MANAGER', USER: 'USER' },
}));

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
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
app.use('/api/websocket', websocketRoutes);

// App with ADMIN role
const adminApp = express();
adminApp.use(express.json());
adminApp.use((req: any, _res: any, next: any) => {
  req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
  next();
});
adminApp.use('/api/websocket', websocketRoutes);

describe('WebSocket Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /online-users ====================

  describe('GET /api/websocket/online-users', () => {
    it('should return online users with count and timestamp', async () => {
      (websocketSessionService.getOnlineUsers as jest.Mock).mockReturnValue([]);
      (websocketSessionService.getOnlineCount as jest.Mock).mockReturnValue(0);

      const response = await request(app).get('/api/websocket/online-users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data.users).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });

    it('should return 500 on service error', async () => {
      (websocketSessionService.getOnlineUsers as jest.Mock).mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      const response = await request(app).get('/api/websocket/online-users');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /sessions ====================

  describe('GET /api/websocket/sessions', () => {
    it('should return 403 for non-admin user', async () => {
      const response = await request(app).get('/api/websocket/sessions');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return sessions for admin user', async () => {
      (websocketSessionService.getAllSessions as jest.Mock).mockReturnValue([]);

      const response = await request(adminApp).get('/api/websocket/sessions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessions');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data.sessions).toEqual([]);
    });
  });
});
