/**
 * OpenClaw Routes Integration Tests
 *
 * Tests for OpenClaw gateway proxy API endpoints
 */

import request from 'supertest';
import express from 'express';
import openclawRoutes from '../../routes/openclaw.routes';
import axios from 'axios';

// Mock axios
jest.mock('axios');

// Mock ws
jest.mock('ws');

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER', id: 'user-1' };
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER', id: 'user-1' };
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

// App with USER role (default — note: authenticate sets id field too)
const app = express();
app.use(express.json());
// Pre-set user with both userId and id fields (openclaw.routes uses (req.user as any)?.id)
app.use((req: any, _res: any, next: any) => {
  req.user = { userId: 'user-1', username: 'testuser', role: 'USER', id: 'user-1' };
  next();
});
app.use('/api/openclaw', openclawRoutes);

describe('OpenClaw Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== POST /connect ====================

  describe('POST /api/openclaw/connect', () => {
    it('should return sessionKey on connect', async () => {
      const response = await request(app).post('/api/openclaw/connect').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('sessionKey');
      expect(typeof response.body.sessionKey).toBe('string');
    });
  });

  // ==================== POST /disconnect ====================

  describe('POST /api/openclaw/disconnect', () => {
    it('should return success on disconnect', async () => {
      const response = await request(app).post('/api/openclaw/disconnect').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ==================== POST /chat ====================

  describe('POST /api/openclaw/chat', () => {
    it('should return 400 when message is missing', async () => {
      const response = await request(app)
        .post('/api/openclaw/chat')
        .send({ sessionKey: 'some-key' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Message is required');
    });

    it('should fall back to local mode when axios throws', async () => {
      (axios.post as jest.Mock).mockRejectedValue(new Error('OpenClaw unavailable'));
      (axios.get as jest.Mock).mockRejectedValue(new Error('LSM API unavailable'));

      const response = await request(app)
        .post('/api/openclaw/chat')
        .send({ message: 'Hello', sessionKey: 'test-key' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('message');
    });
  });

  // ==================== GET /health ====================

  describe('GET /api/openclaw/health', () => {
    it('should return health status with openclaw and lsm booleans', async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error('no'));

      const response = await request(app).get('/api/openclaw/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('openclaw');
      expect(response.body.data).toHaveProperty('lsm');
      expect(typeof response.body.data.openclaw).toBe('boolean');
      expect(typeof response.body.data.lsm).toBe('boolean');
      expect(response.body.data.openclaw).toBe(false);
      expect(response.body.data.lsm).toBe(false);
    });
  });
});
