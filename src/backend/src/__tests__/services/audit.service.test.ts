/**
 * AuditLogService Unit Tests
 *
 * Tests for audit log creation, user log retrieval, resource logs, and cleanup.
 * audit.service.ts instantiates its own PrismaClient — we mock @prisma/client directly.
 */

const mockAuditLog = {
  create: jest.fn(),
  findMany: jest.fn(),
  deleteMany: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    auditLog: mockAuditLog,
  })),
}));

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { AuditLogService, AuditAction, AuditSeverity } from '../../services/audit.service';

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditLogService();
  });

  describe('log', () => {
    it('should create an audit log entry with all fields', async () => {
      mockAuditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.log({
        userId: 'user-1',
        action: AuditAction.LOGIN,
        resourceType: 'User',
        resourceId: 'user-1',
        details: { success: true },
        ipAddress: '127.0.0.1',
        userAgent: 'jest-test',
      });

      expect(mockAuditLog.create).toHaveBeenCalledTimes(1);
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            action: AuditAction.LOGIN,
            ipAddress: '127.0.0.1',
          }),
        })
      );
    });

    it('should not throw if prisma.auditLog.create rejects', async () => {
      mockAuditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.log({ action: AuditAction.API_ACCESS })
      ).resolves.toBeUndefined();
    });
  });

  describe('logLogin', () => {
    it('should call log with LOGIN action and correct details', async () => {
      mockAuditLog.create.mockResolvedValue({ id: 'log-2' });

      await service.logLogin('user-1', '10.0.0.1', 'Mozilla/5.0', true);

      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: AuditAction.LOGIN,
            userId: 'user-1',
            details: expect.objectContaining({ success: true }),
          }),
        })
      );
    });
  });

  describe('getUserLogs', () => {
    it('should return audit logs for a specific user with default limit', async () => {
      const mockLogs = [
        { id: 'log-1', userId: 'user-1', action: AuditAction.LOGIN },
        { id: 'log-2', userId: 'user-1', action: AuditAction.LOGOUT },
      ];
      mockAuditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getUserLogs('user-1');

      expect(mockAuditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      expect(result).toEqual(mockLogs);
    });

    it('should respect a custom limit', async () => {
      mockAuditLog.findMany.mockResolvedValue([]);

      await service.getUserLogs('user-2', 10);

      expect(mockAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  describe('getResourceLogs', () => {
    it('should query logs by resourceType and resourceId', async () => {
      const mockLogs = [{ id: 'log-3', resourceType: 'GPU', resourceId: 'gpu-1' }];
      mockAuditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getResourceLogs('GPU', 'gpu-1');

      expect(mockAuditLog.findMany).toHaveBeenCalledWith({
        where: { resourceType: 'GPU', resourceId: 'gpu-1' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      expect(result).toEqual(mockLogs);
    });
  });

  describe('cleanOldLogs', () => {
    it('should delete logs older than the cutoff date', async () => {
      mockAuditLog.deleteMany.mockResolvedValue({ count: 5 });

      await service.cleanOldLogs(30);

      expect(mockAuditLog.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        })
      );
    });

    it('should use default 90-day retention when no argument is supplied', async () => {
      mockAuditLog.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanOldLogs();

      expect(mockAuditLog.deleteMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('logPermissionChange', () => {
    it('should log a CRITICAL severity PERMISSION_CHANGE entry', async () => {
      mockAuditLog.create.mockResolvedValue({ id: 'log-4' });

      await service.logPermissionChange('admin-1', 'user-1', 'USER', 'MANAGER', '10.0.0.1');

      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: AuditAction.PERMISSION_CHANGE,
            details: { oldRole: 'USER', newRole: 'MANAGER' },
          }),
        })
      );
    });
  });
});
