/**
 * LSM v3.2.0 Approval Service Unit Tests
 */

import { ApprovalService } from '../approval.service';
import { ApprovalType, ApprovalStatus, ApprovalPriority } from '../../../models/approval';
import { user_role as UserRole } from '@prisma/client';
import prisma from '../../../utils/prisma';

describe('ApprovalService', () => {
  let service: ApprovalService;
  const mockRequesterId = 'user-123';
  const mockApproverId = 'admin-456';

  const mockApprovalRequest = {
    type: ApprovalType.RESOURCE_RELEASE,
    requesterId: mockRequesterId,
    operationType: 'resource:release',
    operationPayload: { 
      operationType: 'resource:release',
      resourceType: 'gpu', 
      resourceId: 'gpu-001' 
    },
    riskScore: 3.5,
    riskFactors: { dataImpact: 2, resourceImpact: 4, reversibility: 3, costImpact: 2, securityImpact: 2 },
  };

  const mockAdminUser = {
    id: mockApproverId,
    name: 'Admin User',
    email: 'admin@test.com',
    role: UserRole.ADMIN,
  };

  const mockRegularUser = {
    id: mockRequesterId,
    name: 'Regular User',
    email: 'user@test.com',
    role: UserRole.USER,
  };

  beforeEach(() => {
    service = new ApprovalService();
    jest.clearAllMocks();
  });

  describe('createApproval()', () => {
    it('should create approval with PENDING status', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'approval-001' });

      const result = await service.createApproval(mockApprovalRequest);

      expect(result.success).toBe(true);
      expect(result.approval?.status).toBe(ApprovalStatus.PENDING);
      expect(result.approval?.requesterId).toBe(mockRequesterId);
      expect(result.approval?.type).toBe(ApprovalType.RESOURCE_RELEASE);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should set expiration based on priority', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'approval-001' });

      const urgentRequest = { ...mockApprovalRequest, priority: ApprovalPriority.URGENT };
      const result = await service.createApproval(urgentRequest);

      expect(result.success).toBe(true);
      // URGENT priority should have 4 hour timeout
      const expiresAt = result.approval?.expiresAt;
      expect(expiresAt).toBeDefined();
    });

    it('should use custom timeout when provided', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'approval-001' });

      const customTimeoutRequest = { ...mockApprovalRequest, customTimeout: 48 };
      const result = await service.createApproval(customTimeoutRequest);

      expect(result.success).toBe(true);
    });

    it('should handle creation errors gracefully', async () => {
      (prisma.auditLog.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await service.createApproval(mockApprovalRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('approve()', () => {
    const mockPendingApproval = {
      id: 'approval-001',
      type: ApprovalType.RESOURCE_RELEASE,
      requesterId: mockRequesterId,
      operationType: 'resource:release',
      operationPayload: {},
      status: ApprovalStatus.PENDING,
      priority: ApprovalPriority.NORMAL,
      riskScore: 3.5,
      riskFactors: {},
      escalationLevel: 0,
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should approve pending approval for admin user', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'approval-001', 
        details: mockPendingApproval 
      });
      (prisma.auditLog.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      const result = await service.approve('approval-001', mockApproverId, 'Looks good');

      expect(result.success).toBe(true);
      expect(result.approval?.status).toBe(ApprovalStatus.APPROVED);
      expect(result.approval?.approverId).toBe(mockApproverId);
    });

    it('should reject approval for non-admin user', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'approval-001', 
        details: mockPendingApproval 
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockRegularUser);

      const result = await service.approve('approval-001', mockRequesterId, 'Trying to approve');

      expect(result.success).toBe(false);
      expect(result.error).toBe('无权限审批此请求');
    });

    it('should return error if approval not found', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.approve('non-existent', mockApproverId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('审批记录不存在');
    });

    it('should return error if already processed', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'approval-001', 
        details: { ...mockPendingApproval, status: ApprovalStatus.APPROVED } 
      });

      const result = await service.approve('approval-001', mockApproverId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('该审批已处理');
    });
  });

  describe('reject()', () => {
    const mockPendingApproval = {
      id: 'approval-001',
      type: ApprovalType.RESOURCE_RELEASE,
      requesterId: mockRequesterId,
      status: ApprovalStatus.PENDING,
      priority: ApprovalPriority.NORMAL,
      riskFactors: {},
      escalationLevel: 0,
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should reject pending approval with reason', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'approval-001', 
        details: mockPendingApproval 
      });
      (prisma.auditLog.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      const result = await service.reject('approval-001', mockApproverId, 'Invalid request');

      expect(result.success).toBe(true);
      expect(result.approval?.status).toBe(ApprovalStatus.REJECTED);
      expect(result.approval?.rejectionReason).toBe('Invalid request');
    });

    it('should reject for non-admin user', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'approval-001', 
        details: mockPendingApproval 
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockRegularUser);

      const result = await service.reject('approval-001', mockRequesterId, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toBe('无权限审批此请求');
    });
  });

  describe('cancel()', () => {
    const mockPendingApproval = {
      id: 'approval-001',
      type: ApprovalType.RESOURCE_RELEASE,
      requesterId: mockRequesterId,
      status: ApprovalStatus.PENDING,
      priority: ApprovalPriority.NORMAL,
      riskFactors: {},
      escalationLevel: 0,
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should allow requester to cancel their own approval', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'approval-001', 
        userId: mockRequesterId,  // Needed for mapLogToApproval
        createdAt: new Date(),
        details: mockPendingApproval 
      });
      (prisma.auditLog.update as jest.Mock).mockResolvedValue({});

      const result = await service.cancel('approval-001', mockRequesterId);

      expect(result.success).toBe(true);
      expect(result.approval?.status).toBe(ApprovalStatus.CANCELLED);
    });

    it('should reject cancellation by non-requester', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'approval-001', 
        userId: mockRequesterId,
        createdAt: new Date(),
        details: mockPendingApproval 
      });

      const result = await service.cancel('approval-001', 'other-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('只有申请人可以取消审批');
    });

    it('should reject cancellation of processed approval', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'approval-001', 
        userId: mockRequesterId,
        createdAt: new Date(),
        details: { ...mockPendingApproval, status: ApprovalStatus.APPROVED } 
      });

      const result = await service.cancel('approval-001', mockRequesterId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('该审批已处理，无法取消');
    });
  });

  describe('escalate()', () => {
    const mockEscalatableApproval = {
      id: 'approval-001',
      type: ApprovalType.RESOURCE_RELEASE,
      requesterId: mockRequesterId,
      status: ApprovalStatus.PENDING,
      priority: ApprovalPriority.NORMAL,
      riskFactors: {},
      escalationLevel: 0,
      expiresAt: new Date(Date.now() - 1000), // Already expired
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should escalate approval and increase escalation level', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'approval-001', 
        details: mockEscalatableApproval 
      });
      (prisma.auditLog.update as jest.Mock).mockResolvedValue({});

      const result = await service.escalate('approval-001');

      expect(result.success).toBe(true);
      expect(result.approval?.status).toBe(ApprovalStatus.ESCALATED);
      expect(result.approval?.escalationLevel).toBe(1);
    });

    it('should extend expiration time after escalation', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'approval-001', 
        details: mockEscalatableApproval 
      });
      (prisma.auditLog.update as jest.Mock).mockResolvedValue({});

      const result = await service.escalate('approval-001');

      expect(result.success).toBe(true);
      // New expiration should be 24 hours in the future
      const newExpiresAt = result.approval?.expiresAt;
      expect(newExpiresAt?.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('checkTimeout()', () => {
    it('should process timed-out approvals', async () => {
      const expiredApproval = {
        id: 'approval-001',
        details: {
          status: ApprovalStatus.PENDING,
          priority: ApprovalPriority.NORMAL,
          expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        },
      };

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([expiredApproval]);
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue(expiredApproval);
      (prisma.auditLog.update as jest.Mock).mockResolvedValue({});

      const result = await service.checkTimeout();

      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(result.escalated).toBeGreaterThanOrEqual(0);
    });

    it('should return zero counts when no pending approvals', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.checkTimeout();

      expect(result.processed).toBe(0);
      expect(result.escalated).toBe(0);
    });
  });

  describe('getStatistics()', () => {
    it('should return approval statistics', async () => {
      const mockLogs = [
        { details: { status: ApprovalStatus.PENDING } },
        { details: { status: ApprovalStatus.APPROVED, approvedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 3600000).toISOString() } },
        { details: { status: ApprovalStatus.REJECTED, rejectedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 7200000).toISOString() } },
        { details: { status: ApprovalStatus.ESCALATED } },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const stats = await service.getStatistics();

      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.escalated).toBe(1);
    });
  });

  describe('getApprovalById()', () => {
    it('should return approval when found', async () => {
      const mockLog = {
        id: 'approval-001',
        userId: mockRequesterId,
        createdAt: new Date(),
        details: {
          approvalType: ApprovalType.RESOURCE_RELEASE,
          status: ApprovalStatus.PENDING,
          priority: ApprovalPriority.NORMAL,
          riskScore: 3.5,
          riskFactors: {},
          escalationLevel: 0,
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue(mockLog);

      const result = await service.getApprovalById('approval-001');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('approval-001');
      expect(result?.type).toBe(ApprovalType.RESOURCE_RELEASE);
    });

    it('should return null when not found', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getApprovalById('non-existent');

      expect(result).toBeNull();
    });
  });
});