/**
 * Agent Routes Integration Tests
 *
 * Tests for AI Agent API endpoints
 */

import request from 'supertest';
import express from 'express';
import agentRoutes from '../../routes/agent.routes';
import agentController from '../../controllers/agent.controller';

// Mock agent controller
jest.mock('../../controllers/agent.controller', () => ({
  __esModule: true,
  default: {
    getStatus: jest.fn((req: any, res: any) => res.json({ success: true, data: { status: 'ok' } })),
    chat: jest.fn((req: any, res: any) => res.json({ success: true, data: { response: 'Hello' } })),
    getConversations: jest.fn((req: any, res: any) => res.json({ success: true, data: [] })),
    getConversationById: jest.fn((req: any, res: any) => res.json({ success: true, data: {} })),
    approve: jest.fn((req: any, res: any) => res.json({ success: true })),
    getPendingApprovals: jest.fn((req: any, res: any) => res.json({ success: true, data: [] })),
  },
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

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

// App with USER role (default)
const app = express();
app.use(express.json());
app.use('/api/agent', agentRoutes);

// App with ADMIN role
const adminApp = express();
adminApp.use(express.json());
adminApp.use((req: any, _res: any, next: any) => {
  req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
  next();
});
adminApp.use('/api/agent', agentRoutes);

// App with MANAGER role
const managerApp = express();
managerApp.use(express.json());
managerApp.use((req: any, _res: any, next: any) => {
  req.user = { userId: 'manager-1', username: 'manager', role: 'MANAGER' };
  next();
});
managerApp.use('/api/agent', agentRoutes);

describe('Agent Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations to defaults
    (agentController.getStatus as jest.Mock).mockImplementation((req: any, res: any) =>
      res.json({ success: true, data: { status: 'ok' } })
    );
    (agentController.chat as jest.Mock).mockImplementation((req: any, res: any) =>
      res.json({ success: true, data: { response: 'Hello' } })
    );
    (agentController.getConversations as jest.Mock).mockImplementation((req: any, res: any) =>
      res.json({ success: true, data: [] })
    );
    (agentController.getConversationById as jest.Mock).mockImplementation((req: any, res: any) =>
      res.json({ success: true, data: {} })
    );
    (agentController.approve as jest.Mock).mockImplementation((req: any, res: any) =>
      res.json({ success: true })
    );
    (agentController.getPendingApprovals as jest.Mock).mockImplementation((req: any, res: any) =>
      res.json({ success: true, data: [] })
    );
  });

  // ==================== GET /status ====================

  describe('GET /api/agent/status', () => {
    it('should return 200 with agent status', async () => {
      const response = await request(app).get('/api/agent/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(agentController.getStatus).toHaveBeenCalled();
    });
  });

  // ==================== POST /chat ====================

  describe('POST /api/agent/chat', () => {
    it('should return 400 when message is empty', async () => {
      const response = await request(app)
        .post('/api/agent/chat')
        .send({ message: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 200 with valid message', async () => {
      const response = await request(app)
        .post('/api/agent/chat')
        .send({ message: 'Hello, Agent!' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(agentController.chat).toHaveBeenCalled();
    });
  });

  // ==================== GET /conversations ====================

  describe('GET /api/agent/conversations', () => {
    it('should return 200 with conversations list', async () => {
      const response = await request(app).get('/api/agent/conversations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(agentController.getConversations).toHaveBeenCalled();
    });
  });

  // ==================== GET /stats ====================

  describe('GET /api/agent/stats', () => {
    it('should return 403 for non-admin user', async () => {
      const response = await request(app).get('/api/agent/stats');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 200 for admin user', async () => {
      const response = await request(adminApp).get('/api/agent/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ==================== POST /approve ====================

  describe('POST /api/agent/approve', () => {
    it('should return 403 for USER role', async () => {
      const response = await request(app)
        .post('/api/agent/approve')
        .send({
          type: 'reservation',
          resourceId: validUUID,
          action: 'approve',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 200 for MANAGER role', async () => {
      const response = await request(managerApp)
        .post('/api/agent/approve')
        .send({
          type: 'reservation',
          resourceId: validUUID,
          action: 'approve',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(agentController.approve).toHaveBeenCalled();
    });
  });
});
