/**
 * API Error Types Tests
 * 
 * Tests for:
 * - ApiErrorType enum values
 * - ApiError interface
 * - createApiError helper function
 */

import { describe, it, expect } from 'vitest';
import { ApiErrorType, createApiError, type ApiError } from '../apiErrors';

describe('API Error Types', () => {
  describe('ApiErrorType enum', () => {
    it('should have all required error types', () => {
      expect(ApiErrorType.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ApiErrorType.AUTHENTICATION_ERROR).toBe('AUTHENTICATION_ERROR');
      expect(ApiErrorType.AUTHORIZATION_ERROR).toBe('AUTHORIZATION_ERROR');
      expect(ApiErrorType.NOT_FOUND_ERROR).toBe('NOT_FOUND_ERROR');
      expect(ApiErrorType.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(ApiErrorType.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });

    it('should have exactly 6 error types', () => {
      const types = Object.values(ApiErrorType);
      expect(types).toHaveLength(6);
    });
  });

  describe('createApiError function', () => {
    it('should create a basic error object', () => {
      const error = createApiError(
        ApiErrorType.VALIDATION_ERROR,
        'Invalid input'
      );

      expect(error.type).toBe(ApiErrorType.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid input');
    });

    it('should include optional code', () => {
      const error = createApiError(
        ApiErrorType.AUTHENTICATION_ERROR,
        'Token expired',
        { code: 'TOKEN_EXPIRED' }
      );

      expect(error.code).toBe('TOKEN_EXPIRED');
    });

    it('should include optional details', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = createApiError(
        ApiErrorType.VALIDATION_ERROR,
        'Validation failed',
        { details }
      );

      expect(error.details).toEqual(details);
    });

    it('should include optional status', () => {
      const error = createApiError(
        ApiErrorType.NOT_FOUND_ERROR,
        'Resource not found',
        { status: 404 }
      );

      expect(error.status).toBe(404);
    });

    it('should include all optional fields together', () => {
      const error = createApiError(
        ApiErrorType.AUTHORIZATION_ERROR,
        'Access denied',
        {
          code: 'FORBIDDEN',
          details: { resource: 'admin-panel' },
          status: 403,
        }
      );

      expect(error.type).toBe(ApiErrorType.AUTHORIZATION_ERROR);
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.details).toEqual({ resource: 'admin-panel' });
      expect(error.status).toBe(403);
    });

    it('should create network error', () => {
      const error = createApiError(
        ApiErrorType.NETWORK_ERROR,
        'Connection refused',
        { status: 0 }
      );

      expect(error.type).toBe(ApiErrorType.NETWORK_ERROR);
      expect(error.status).toBe(0);
    });

    it('should create unknown error for unexpected cases', () => {
      const error = createApiError(
        ApiErrorType.UNKNOWN_ERROR,
        'An unexpected error occurred'
      );

      expect(error.type).toBe(ApiErrorType.UNKNOWN_ERROR);
    });
  });

  describe('ApiError interface', () => {
    it('should be compatible with error objects', () => {
      const error: ApiError = {
        type: ApiErrorType.VALIDATION_ERROR,
        message: 'Test error',
      };

      expect(error.type).toBeDefined();
      expect(error.message).toBeDefined();
    });

    it('should allow optional fields to be undefined', () => {
      const error: ApiError = {
        type: ApiErrorType.UNKNOWN_ERROR,
        message: 'Test',
      };

      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
      expect(error.status).toBeUndefined();
    });
  });
});