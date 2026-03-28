/**
 * Authentication Middleware Tests
 * 
 * Tests for JWT authentication and role-based authorization
 */

import { Request, Response, NextFunction } from 'express';

// Mock @prisma/client for UserRole - must be before any imports that use it
jest.mock('@prisma/client', () => ({
  user_role: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    USER: 'USER',
  },
}));

// Mock the auth service
jest.mock('../../services/auth.service', () => ({
  verifyToken: jest.fn(),
  __esModule: true,
  default: {
    verifyToken: jest.fn(),
  },
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    USER: 'USER',
  },
}));

import { authenticate, authorize, requireAdmin, requireManager } from '../../middleware/auth.middleware';
import authService from '../../services/auth.service';

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should return 401 when no authorization header', async () => {
      await authenticate(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
      mockReq.headers = { authorization: 'Basic token123' };

      await authenticate(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      (authService.verifyToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticate(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next and attach user to request when token is valid', async () => {
      const mockPayload = {
        userId: 'user-123',
        username: 'testuser',
        role: 'USER',
      };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      (authService.verifyToken as jest.Mock).mockReturnValue(mockPayload);

      await authenticate(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toEqual(mockPayload);
    });
  });

  describe('authorize', () => {
    it('should return 401 when no user on request', () => {
      const middleware = authorize('ADMIN');
      
      middleware(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return 403 when user role is not allowed', () => {
      (mockReq as any).user = { userId: '1', username: 'test', role: 'USER' };
      const middleware = authorize('ADMIN');

      middleware(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should call next when user has required role', () => {
      (mockReq as any).user = { userId: '1', username: 'admin', role: 'ADMIN' };
      const middleware = authorize('ADMIN');

      middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next when user has one of the allowed roles', () => {
      (mockReq as any).user = { userId: '1', username: 'manager', role: 'MANAGER' };
      const middleware = authorize('ADMIN', 'MANAGER');

      middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should allow ADMIN role', () => {
      (mockReq as any).user = { userId: '1', username: 'admin', role: 'ADMIN' };

      requireAdmin(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny USER role', () => {
      (mockReq as any).user = { userId: '1', username: 'user', role: 'USER' };

      requireAdmin(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should deny MANAGER role', () => {
      (mockReq as any).user = { userId: '1', username: 'manager', role: 'MANAGER' };

      requireAdmin(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });

  describe('requireManager', () => {
    it('should allow ADMIN role', () => {
      (mockReq as any).user = { userId: '1', username: 'admin', role: 'ADMIN' };

      requireManager(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow MANAGER role', () => {
      (mockReq as any).user = { userId: '1', username: 'manager', role: 'MANAGER' };

      requireManager(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny USER role', () => {
      (mockReq as any).user = { userId: '1', username: 'user', role: 'USER' };

      requireManager(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });
});