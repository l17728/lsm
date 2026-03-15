/**
 * Validation Middleware Tests
 * 
 * Tests for Zod validation schemas and validate function
 */

import { validate, userSchemas, serverSchemas, gpuSchemas, taskSchemas, monitoringSchemas, paginationSchema } from '../../middleware/validation.middleware';

describe('Validation Middleware', () => {
  describe('userSchemas.register', () => {
    it('should validate valid registration data', () => {
      const result = userSchemas.register.safeParse({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.success).toBe(true);
    });

    it('should reject username less than 3 characters', () => {
      const result = userSchemas.register.safeParse({
        username: 'ab',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes('3 characters'))).toBe(true);
      }
    });

    it('should reject username more than 50 characters', () => {
      const result = userSchemas.register.safeParse({
        username: 'a'.repeat(51),
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject username with special characters', () => {
      const result = userSchemas.register.safeParse({
        username: 'test@user',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.message.includes('letters, numbers, and underscores'))).toBe(true);
      }
    });

    it('should accept username with underscores', () => {
      const result = userSchemas.register.safeParse({
        username: 'test_user_123',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = userSchemas.register.safeParse({
        username: 'testuser',
        email: 'invalid-email',
        password: 'Password123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject password less than 8 characters', () => {
      const result = userSchemas.register.safeParse({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Pass1',
      });

      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase letter', () => {
      const result = userSchemas.register.safeParse({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase letter', () => {
      const result = userSchemas.register.safeParse({
        username: 'testuser',
        email: 'test@example.com',
        password: 'PASSWORD123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = userSchemas.register.safeParse({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Passwords',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('userSchemas.login', () => {
    it('should validate valid login data', () => {
      const result = userSchemas.login.safeParse({
        email: 'test@example.com',
        password: 'anypassword',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = userSchemas.login.safeParse({
        email: 'invalid',
        password: 'password',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = userSchemas.login.safeParse({
        email: 'test@example.com',
        password: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('userSchemas.changePassword', () => {
    it('should validate valid change password data', () => {
      const result = userSchemas.changePassword.safeParse({
        currentPassword: 'oldPassword123',
        newPassword: 'NewPassword456',
      });

      expect(result.success).toBe(true);
    });

    it('should reject weak new password', () => {
      const result = userSchemas.changePassword.safeParse({
        currentPassword: 'oldPassword123',
        newPassword: 'weak',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('serverSchemas.create', () => {
    it('should validate valid server creation data', () => {
      const result = serverSchemas.create.safeParse({
        name: 'Test Server',
        description: 'A test server',
        gpuCount: 4,
        location: 'Data Center 1',
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty server name', () => {
      const result = serverSchemas.create.safeParse({
        name: '',
        gpuCount: 0,
      });

      expect(result.success).toBe(false);
    });

    it('should reject server name over 100 characters', () => {
      const result = serverSchemas.create.safeParse({
        name: 'a'.repeat(101),
      });

      expect(result.success).toBe(false);
    });

    it('should reject negative gpuCount', () => {
      const result = serverSchemas.create.safeParse({
        name: 'Server',
        gpuCount: -1,
      });

      expect(result.success).toBe(false);
    });

    it('should reject gpuCount over 100', () => {
      const result = serverSchemas.create.safeParse({
        name: 'Server',
        gpuCount: 101,
      });

      expect(result.success).toBe(false);
    });

    it('should use default gpuCount of 0', () => {
      const result = serverSchemas.create.safeParse({
        name: 'Server',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gpuCount).toBe(0);
      }
    });
  });

  describe('serverSchemas.update', () => {
    it('should validate valid update data', () => {
      const result = serverSchemas.update.safeParse({
        name: 'Updated Server',
        status: 'ONLINE',
      });

      expect(result.success).toBe(true);
    });

    it('should accept partial updates', () => {
      const result = serverSchemas.update.safeParse({
        name: 'New Name',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = serverSchemas.update.safeParse({
        status: 'INVALID',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('gpuSchemas.allocate', () => {
    it('should validate valid allocation data', () => {
      const result = gpuSchemas.allocate.safeParse({
        gpuId: 'gpu-123',
        taskId: 'task-456',
        userId: 'user-789',
      });

      expect(result.success).toBe(true);
    });

    it('should reject missing gpuId', () => {
      const result = gpuSchemas.allocate.safeParse({
        taskId: 'task-456',
        userId: 'user-789',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('gpuSchemas.filter', () => {
    it('should validate valid filter params', () => {
      const result = gpuSchemas.filter.safeParse({
        model: 'RTX 3090',
        minMemory: 16,
        maxMemory: 32,
      });

      expect(result.success).toBe(true);
    });

    it('should allow empty filter', () => {
      const result = gpuSchemas.filter.safeParse({});

      expect(result.success).toBe(true);
    });
  });

  describe('taskSchemas.create', () => {
    it('should validate valid task data', () => {
      const result = taskSchemas.create.safeParse({
        name: 'Training Task',
        description: 'Model training',
        priority: 'HIGH',
        gpuRequirements: {
          model: 'A100',
          minMemory: 40,
          count: 2,
        },
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty task name', () => {
      const result = taskSchemas.create.safeParse({
        name: '',
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid priority', () => {
      const result = taskSchemas.create.safeParse({
        name: 'Task',
        priority: 'INVALID',
      });

      expect(result.success).toBe(false);
    });

    it('should use default priority', () => {
      const result = taskSchemas.create.safeParse({
        name: 'Task',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('MEDIUM');
      }
    });
  });

  describe('monitoringSchemas.recordMetrics', () => {
    it('should validate valid metrics', () => {
      const result = monitoringSchemas.recordMetrics.safeParse({
        serverId: 'server-123',
        cpuUsage: 45.5,
        memoryUsage: 60.2,
        gpuUsage: 30.0,
        temperature: 65,
      });

      expect(result.success).toBe(true);
    });

    it('should reject cpuUsage over 100', () => {
      const result = monitoringSchemas.recordMetrics.safeParse({
        serverId: 'server-123',
        cpuUsage: 150,
        memoryUsage: 50,
      });

      expect(result.success).toBe(false);
    });

    it('should reject negative cpuUsage', () => {
      const result = monitoringSchemas.recordMetrics.safeParse({
        serverId: 'server-123',
        cpuUsage: -10,
        memoryUsage: 50,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('monitoringSchemas.queryMetrics', () => {
    it('should validate valid query params', () => {
      const result = monitoringSchemas.queryMetrics.safeParse({
        serverId: 'server-123',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-02T00:00:00Z',
        limit: 50,
      });

      expect(result.success).toBe(true);
    });

    it('should reject limit over 1000', () => {
      const result = monitoringSchemas.queryMetrics.safeParse({
        limit: 1500,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should validate valid pagination params', () => {
      const result = paginationSchema.safeParse({
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const result = paginationSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sortOrder).toBe('asc');
      }
    });

    it('should reject page less than 1', () => {
      const result = paginationSchema.safeParse({
        page: 0,
      });

      expect(result.success).toBe(false);
    });

    it('should reject limit over 100', () => {
      const result = paginationSchema.safeParse({
        limit: 200,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('validate function', () => {
    it('should return parsed data for valid input', () => {
      const data = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
      };

      const result = validate(userSchemas.register, data);

      expect(result).toEqual(data);
    });

    it('should throw error for invalid input', () => {
      const data = {
        username: 'ab',
        email: 'invalid',
        password: 'weak',
      };

      expect(() => validate(userSchemas.register, data)).toThrow();
    });

    it('should include field information in error', () => {
      const data = {
        username: '',
        email: 'test@example.com',
        password: 'Password123',
      };

      try {
        validate(userSchemas.register, data);
        fail('Should have thrown');
      } catch (error: any) {
        const parsed = JSON.parse(error.message);
        expect(parsed.code).toBe('VALIDATION_ERROR');
        expect(parsed.details).toBeDefined();
        expect(parsed.details.length).toBeGreaterThan(0);
      }
    });
  });
});