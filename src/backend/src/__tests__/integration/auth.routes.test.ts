/**
 * Auth Routes Integration Tests
 * 
 * Tests for authentication API endpoints
 */

import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/auth.routes';
import authService from '../../services/auth.service';

// Mock auth service
jest.mock('../../services/auth.service', () => ({
  register: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  getCurrentUser: jest.fn(),
  changePassword: jest.fn(),
  getAllUsers: jest.fn(),
  updateUserRole: jest.fn(),
  deleteUser: jest.fn(),
  verifyToken: jest.fn(),
}));

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers.authorization) {
      req.user = {
        userId: 'user-1',
        username: 'testuser',
        role: 'USER',
      };
    }
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.user?.role === 'ADMIN') {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Admin access required' });
    }
  },
  requireManager: (req: any, res: any, next: any) => {
    if (['ADMIN', 'MANAGER'].includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Manager access required' });
    }
  },
  AuthRequest: Request,
}));

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'USER',
        createdAt: new Date(),
      };
      (authService.register as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('testuser');
    });

    it('should reject invalid username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab', // Too short
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'Password123',
        });

      expect(response.status).toBe(400);
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'weak',
        });

      expect(response.status).toBe(400);
    });

    it('should handle registration error', async () => {
      (authService.register as jest.Mock).mockRejectedValue(new Error('User already exists'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully', async () => {
      const mockResult = {
        token: 'jwt-token',
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
          role: 'USER',
        },
      };
      (authService.login as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('jwt-token');
    });

    it('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
        });

      expect(response.status).toBe(400);
    });

    it('should handle invalid credentials', async () => {
      (authService.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'USER',
      };
      (authService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('testuser');
    });

    it('should handle invalid token', async () => {
      (authService.getCurrentUser as jest.Mock).mockRejectedValue(new Error('Invalid session'));

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/auth/password', () => {
    it('should change password successfully', async () => {
      (authService.changePassword as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', 'Bearer token')
        .send({
          oldPassword: 'OldPassword123',
          newPassword: 'NewPassword456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject weak new password', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', 'Bearer token')
        .send({
          oldPassword: 'OldPassword123',
          newPassword: 'weak',
        });

      expect(response.status).toBe(400);
    });

    it('should handle incorrect old password', async () => {
      (authService.changePassword as jest.Mock).mockRejectedValue(new Error('Invalid current password'));

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', 'Bearer token')
        .send({
          oldPassword: 'WrongPassword',
          newPassword: 'NewPassword456',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/users', () => {
    it('should return all users for admin', async () => {
      const mockUsers = [
        { id: 'user-1', username: 'user1', email: 'user1@test.com', role: 'USER' },
        { id: 'user-2', username: 'admin', email: 'admin@test.com', role: 'ADMIN' },
      ];
      (authService.getAllUsers as jest.Mock).mockResolvedValue(mockUsers);

      // Mock admin user
      const appWithAdmin = express();
      appWithAdmin.use(express.json());
      appWithAdmin.use((req: any, res, next) => {
        req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
        next();
      });
      appWithAdmin.use('/api/auth', authRoutes);

      const response = await request(appWithAdmin)
        .get('/api/auth/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    it('should deny access for non-admin', async () => {
      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/auth/users/:id/role', () => {
    it('should update user role for admin', async () => {
      const mockUser = { id: 'user-1', username: 'user1', role: 'MANAGER' };
      (authService.updateUserRole as jest.Mock).mockResolvedValue(mockUser);

      const appWithAdmin = express();
      appWithAdmin.use(express.json());
      appWithAdmin.use((req: any, res, next) => {
        req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
        next();
      });
      appWithAdmin.use('/api/auth', authRoutes);

      const response = await request(appWithAdmin)
        .put('/api/auth/users/user-1/role')
        .send({ role: 'MANAGER' });

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe('MANAGER');
    });

    it('should reject invalid role', async () => {
      const appWithAdmin = express();
      appWithAdmin.use(express.json());
      appWithAdmin.use((req: any, res, next) => {
        req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
        next();
      });
      appWithAdmin.use('/api/auth', authRoutes);

      const response = await request(appWithAdmin)
        .put('/api/auth/users/user-1/role')
        .send({ role: 'INVALID_ROLE' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/auth/users/:id', () => {
    it('should delete user for admin', async () => {
      (authService.deleteUser as jest.Mock).mockResolvedValue(undefined);

      const appWithAdmin = express();
      appWithAdmin.use(express.json());
      appWithAdmin.use((req: any, res, next) => {
        req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
        next();
      });
      appWithAdmin.use('/api/auth', authRoutes);

      const response = await request(appWithAdmin)
        .delete('/api/auth/users/user-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access for non-admin', async () => {
      const response = await request(app)
        .delete('/api/auth/users/user-1')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(403);
    });
  });
});