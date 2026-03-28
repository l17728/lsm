/**
 * Error Middleware Tests
 * 
 * Tests for error handling, AppError class, and error creators
 */

import { Request, Response, NextFunction } from 'express';
import { 
  errorHandler, 
  AppError, 
  ErrorTypes, 
  asyncHandler,
  createError 
} from '../../middleware/error.middleware';

describe('Error Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockReq = {
      path: '/api/test',
      method: 'GET',
    };
    mockRes = {
      status: statusMock,
      json: jsonMock,
      locals: {},
    };
    mockNext = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 400, { detail: 'info' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.status).toBe(400);
      expect(error.details).toEqual({ detail: 'info' });
      expect(error.name).toBe('AppError');
    });

    it('should have default values', () => {
      const error = new AppError('Test error');

      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.status).toBe(500);
      expect(error.details).toBeUndefined();
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError correctly', () => {
      const error = new AppError('Not found', 'NOT_FOUND', 404);

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Not found',
          timestamp: expect.any(String),
        },
      });
    });

    it('should include details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new AppError('Test error', 'TEST', 400, { info: 'detail' });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TEST',
          message: 'Test error',
          details: { info: 'detail' },
          timestamp: expect.any(String),
        },
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle generic Error', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Generic error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: expect.any(String),
        },
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should show error message in development for generic Error', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Dev error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Dev error',
          details: {
            stack: expect.any(String),
            name: 'Error',
          },
          timestamp: expect.any(String),
        },
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle ZodError', () => {
      const zodError = {
        name: 'ZodError',
        errors: [{ path: ['field'], message: 'Invalid' }],
      };

      errorHandler(zodError as any, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [{ path: ['field'], message: 'Invalid' }],
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle Prisma error', () => {
      const prismaError = {
        name: 'PrismaClientKnownRequestError',
        message: 'Unique constraint violation',
      };

      errorHandler(prismaError as any, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Database operation failed',
          timestamp: expect.any(String),
        },
      });
    });

    it('should log error to console', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('asyncHandler', () => {
    it('should pass successful async result through', async () => {
      const handler = jest.fn().mockResolvedValue('result');
      const wrapped = asyncHandler(handler);

      await wrapped(mockReq as Request, mockRes as Response, mockNext);

      expect(handler).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch async errors and pass to next', async () => {
      const error = new Error('Async error');
      const handler = jest.fn().mockRejectedValue(error);
      const wrapped = asyncHandler(handler);

      await wrapped(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should work with synchronous handlers', async () => {
      const handler = jest.fn();
      const wrapped = asyncHandler(handler);

      await wrapped(mockReq as Request, mockRes as Response, mockNext);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('createError factories', () => {
    describe('validation', () => {
      it('should create validation error', () => {
        const error = createError.validation('Invalid input', { field: 'name' });

        expect(error.message).toBe('Invalid input');
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.status).toBe(400);
        expect(error.details).toEqual({ field: 'name' });
      });
    });

    describe('authentication', () => {
      it('should create authentication error with default message', () => {
        const error = createError.authentication();

        expect(error.message).toBe('Authentication required');
        expect(error.code).toBe('AUTHENTICATION_ERROR');
        expect(error.status).toBe(401);
      });

      it('should create authentication error with custom message', () => {
        const error = createError.authentication('Token expired');

        expect(error.message).toBe('Token expired');
      });
    });

    describe('authorization', () => {
      it('should create authorization error with default message', () => {
        const error = createError.authorization();

        expect(error.message).toBe('Not authorized');
        expect(error.code).toBe('AUTHORIZATION_ERROR');
        expect(error.status).toBe(403);
      });
    });

    describe('notFound', () => {
      it('should create not found error', () => {
        const error = createError.notFound('User');

        expect(error.message).toBe('User not found');
        expect(error.code).toBe('NOT_FOUND_ERROR');
        expect(error.status).toBe(404);
      });
    });

    describe('conflict', () => {
      it('should create conflict error', () => {
        const error = createError.conflict('Email already exists');

        expect(error.message).toBe('Email already exists');
        expect(error.code).toBe('CONFLICT_ERROR');
        expect(error.status).toBe(409);
      });
    });

    describe('internal', () => {
      it('should create internal error', () => {
        const error = createError.internal('Database connection failed', { retry: true });

        expect(error.message).toBe('Database connection failed');
        expect(error.code).toBe('INTERNAL_ERROR');
        expect(error.status).toBe(500);
        expect(error.details).toEqual({ retry: true });
      });
    });

    describe('service', () => {
      it('should create service error', () => {
        const error = createError.service('Email service unavailable');

        expect(error.message).toBe('Email service unavailable');
        expect(error.code).toBe('SERVICE_ERROR');
        expect(error.status).toBe(503);
      });
    });
  });

  describe('ErrorTypes enum', () => {
    it('should have all error types', () => {
      expect(ErrorTypes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorTypes.AUTHENTICATION_ERROR).toBe('AUTHENTICATION_ERROR');
      expect(ErrorTypes.AUTHORIZATION_ERROR).toBe('AUTHORIZATION_ERROR');
      expect(ErrorTypes.NOT_FOUND_ERROR).toBe('NOT_FOUND_ERROR');
      expect(ErrorTypes.CONFLICT_ERROR).toBe('CONFLICT_ERROR');
      expect(ErrorTypes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorTypes.SERVICE_ERROR).toBe('SERVICE_ERROR');
    });
  });
});