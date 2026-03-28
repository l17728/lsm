/**
 * LSM v3.2.0 Approval Service
 * 审批流程服务
 */

import { v4 as uuidv4 } from 'uuid';
import prisma from '../../utils/prisma';
import {
  Approval,
  ApprovalType,
  ApprovalStatus,
  ApprovalPriority,
  ApprovalRequest,
  ApprovalResult,
  ApprovalQueryOptions,
  ApprovalStatistics,
  RiskFactors,
  TimeoutConfig,
  DEFAULT_TIMEOUT_CONFIG,
  EscalationRecord,
} from '../../models/approval';

/**
 * 审批服务
 * 负责审批流程的创建、处理、超时管理
 */
export class ApprovalService {
  /**
   * 创建审批请求
   */
  async createApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    try {
      // 计算超时时间
      const priority = request.priority ?? ApprovalPriority.NORMAL;
      const timeoutConfig = DEFAULT_TIMEOUT_CONFIG[priority];
      const customTimeout = request.customTimeout ?? timeoutConfig.hours;
      const expiresAt = new Date(Date.now() + customTimeout * 60 * 60 * 1000);

      // 创建审批记录（使用 AuditLog 表存储，扩展字段）
      const approvalId = uuidv4();
      
      // 创建审批记录到数据库
      // 注意：这里使用 AuditLog 作为临时存储，后续可迁移到专用表
      await prisma.auditLog.create({
        data: {
          id: approvalId,
          userId: request.requesterId,
          action: 'APPROVAL_REQUEST',
          resourceType: request.type,
          resourceId: undefined,
          details: {
            approvalType: request.type,
            operationType: request.operationType,
            operationPayload: request.operationPayload,
            status: ApprovalStatus.PENDING,
            priority,
            riskScore: request.riskScore,
            riskFactors: request.riskFactors,
            escalationLevel: 0,
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as any,
        },
      });

      const approval: Approval = {
        id: approvalId,
        type: request.type,
        requesterId: request.requesterId,
        operationType: request.operationType,
        operationPayload: request.operationPayload,
        status: ApprovalStatus.PENDING,
        priority,
        riskScore: request.riskScore,
        riskFactors: request.riskFactors,
        escalationLevel: 0,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 发送审批通知
      await this.sendApprovalNotification(approval, 'created');

      return {
        success: true,
        approval,
        message: '审批请求已创建',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建审批请求失败',
      };
    }
  }

  /**
   * 批准审批
   */
  async approve(
    approvalId: string,
    approverId: string,
    comment?: string
  ): Promise<ApprovalResult> {
    try {
      // 获取审批记录
      const record = await this.getApprovalById(approvalId);
      if (!record) {
        return { success: false, error: '审批记录不存在' };
      }

      if (record.status !== ApprovalStatus.PENDING) {
        return { success: false, error: '该审批已处理' };
      }

      // 检查审批人权限
      const canApprove = await this.checkApproverPermission(approverId, record.type);
      if (!canApprove) {
        return { success: false, error: '无权限审批此请求' };
      }

      const now = new Date();

      // 更新审批记录
      await prisma.auditLog.update({
        where: { id: approvalId },
        data: {
          action: 'APPROVAL_APPROVED',
          details: {
            ...(record as any).details,
            status: ApprovalStatus.APPROVED,
            approverId,
            approvedAt: now.toISOString(),
            comment,
            updatedAt: now.toISOString(),
          } as any,
        },
      });

      const approval: Approval = {
        ...record,
        status: ApprovalStatus.APPROVED,
        approverId,
        approvedAt: now,
        comment,
        updatedAt: now,
      };

      // 发送审批通过通知
      await this.sendApprovalNotification(approval, 'approved');

      // 执行操作（这里应该调用相应的操作执行器）
      await this.executeOperation(approval);

      return {
        success: true,
        approval,
        message: '审批已通过',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '审批操作失败',
      };
    }
  }

  /**
   * 拒绝审批
   */
  async reject(
    approvalId: string,
    approverId: string,
    reason: string
  ): Promise<ApprovalResult> {
    try {
      const record = await this.getApprovalById(approvalId);
      if (!record) {
        return { success: false, error: '审批记录不存在' };
      }

      if (record.status !== ApprovalStatus.PENDING) {
        return { success: false, error: '该审批已处理' };
      }

      const canApprove = await this.checkApproverPermission(approverId, record.type);
      if (!canApprove) {
        return { success: false, error: '无权限审批此请求' };
      }

      const now = new Date();

      await prisma.auditLog.update({
        where: { id: approvalId },
        data: {
          action: 'APPROVAL_REJECTED',
          details: {
            ...(record as any).details,
            status: ApprovalStatus.REJECTED,
            approverId,
            rejectedAt: now.toISOString(),
            rejectionReason: reason,
            updatedAt: now.toISOString(),
          } as any,
        },
      });

      const approval: Approval = {
        ...record,
        status: ApprovalStatus.REJECTED,
        approverId,
        rejectedAt: now,
        rejectionReason: reason,
        updatedAt: now,
      };

      await this.sendApprovalNotification(approval, 'rejected');

      return {
        success: true,
        approval,
        message: '审批已拒绝',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '拒绝操作失败',
      };
    }
  }

  /**
   * 取消审批
   */
  async cancel(approvalId: string, requesterId: string): Promise<ApprovalResult> {
    try {
      const record = await this.getApprovalById(approvalId);
      if (!record) {
        return { success: false, error: '审批记录不存在' };
      }

      if (record.status !== ApprovalStatus.PENDING) {
        return { success: false, error: '该审批已处理，无法取消' };
      }

      // 只有申请人可以取消
      if (record.requesterId !== requesterId) {
        return { success: false, error: '只有申请人可以取消审批' };
      }

      const now = new Date();

      await prisma.auditLog.update({
        where: { id: approvalId },
        data: {
          action: 'APPROVAL_CANCELLED',
          details: {
            ...(record as any).details,
            status: ApprovalStatus.CANCELLED,
            cancelledAt: now.toISOString(),
            updatedAt: now.toISOString(),
          } as any,
        },
      });

      const approval: Approval = {
        ...record,
        status: ApprovalStatus.CANCELLED,
        updatedAt: now,
      };

      return {
        success: true,
        approval,
        message: '审批已取消',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '取消操作失败',
      };
    }
  }

  /**
   * 升级审批
   */
  async escalate(approvalId: string): Promise<ApprovalResult> {
    try {
      const record = await this.getApprovalById(approvalId);
      if (!record) {
        return { success: false, error: '审批记录不存在' };
      }

      const newLevel = record.escalationLevel + 1;
      const now = new Date();

      // 延长超时时间
      const additionalHours = 24; // 升级后额外 24 小时
      const newExpiresAt = new Date(now.getTime() + additionalHours * 60 * 60 * 1000);

      await prisma.auditLog.update({
        where: { id: approvalId },
        data: {
          action: 'APPROVAL_ESCALATED',
          details: {
            ...(record as any).details,
            status: ApprovalStatus.ESCALATED,
            escalationLevel: newLevel,
            previousExpiresAt: (record as any).details?.expiresAt,
            expiresAt: newExpiresAt.toISOString(),
            escalatedAt: now.toISOString(),
            updatedAt: now.toISOString(),
          } as any,
        },
      });

      const approval: Approval = {
        ...record,
        status: ApprovalStatus.ESCALATED,
        escalationLevel: newLevel,
        expiresAt: newExpiresAt,
        updatedAt: now,
      };

      // 通知上级管理员
      await this.notifyEscalation(approval);

      return {
        success: true,
        approval,
        message: `审批已升级至第 ${newLevel} 级`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '升级操作失败',
      };
    }
  }

  /**
   * 检查超时审批（定时任务调用）
   */
  async checkTimeout(): Promise<{ processed: number; escalated: number }> {
    const now = new Date();
    let processed = 0;
    let escalated = 0;

    // 查询超时的审批记录
    const pendingApprovals = await prisma.auditLog.findMany({
      where: {
        action: { in: ['APPROVAL_REQUEST', 'APPROVAL_ESCALATED'] },
      },
    });

    for (const log of pendingApprovals) {
      const details = log.details as any;
      if (!details?.expiresAt) continue;

      const expiresAt = new Date(details.expiresAt);
      if (expiresAt > now) continue;

      const status = details.status as ApprovalStatus;
      if (status !== ApprovalStatus.PENDING && status !== ApprovalStatus.ESCALATED) {
        continue;
      }

      processed++;

      // 根据优先级决定超时动作
      const priority = (details.priority as ApprovalPriority) ?? ApprovalPriority.NORMAL;
      const timeoutConfig = DEFAULT_TIMEOUT_CONFIG[priority];

      if (timeoutConfig.action === 'escalate') {
        await this.escalate(log.id);
        escalated++;
      } else if (timeoutConfig.action === 'remind_daily') {
        // 发送每日提醒
        await this.sendReminder(log.id, 'timeout');
      }
    }

    return { processed, escalated };
  }

  /**
   * 查询审批列表
   */
  async queryApprovals(options: ApprovalQueryOptions): Promise<Approval[]> {
    const where: any = {
      action: { in: ['APPROVAL_REQUEST', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED', 'APPROVAL_ESCALATED'] },
    };

    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      // 需要在 details 中过滤
    }

    if (options.requesterId) {
      where.userId = options.requesterId;
    }

    if (options.fromDate || options.toDate) {
      where.createdAt = {};
      if (options.fromDate) where.createdAt.gte = options.fromDate;
      if (options.toDate) where.createdAt.lte = options.toDate;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });

    return logs.map(log => this.mapLogToApproval(log));
  }

  /**
   * 获取审批统计
   */
  async getStatistics(fromDate?: Date, toDate?: Date): Promise<ApprovalStatistics> {
    const where: any = {
      action: { in: ['APPROVAL_REQUEST', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED', 'APPROVAL_ESCALATED'] },
    };

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    const logs = await prisma.auditLog.findMany({ where });

    const stats: ApprovalStatistics = {
      total: logs.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      escalated: 0,
      avgProcessingTime: 0,
      timeoutRate: 0,
    };

    let totalProcessingTime = 0;
    let processedCount = 0;
    let timeoutCount = 0;

    for (const log of logs) {
      const details = log.details as any;
      const status = details?.status as ApprovalStatus;

      switch (status) {
        case ApprovalStatus.PENDING:
          stats.pending++;
          break;
        case ApprovalStatus.APPROVED:
          stats.approved++;
          if (details?.approvedAt && details?.createdAt) {
            totalProcessingTime += new Date(details.approvedAt).getTime() - new Date(details.createdAt).getTime();
            processedCount++;
          }
          break;
        case ApprovalStatus.REJECTED:
          stats.rejected++;
          if (details?.rejectedAt && details?.createdAt) {
            totalProcessingTime += new Date(details.rejectedAt).getTime() - new Date(details.createdAt).getTime();
            processedCount++;
          }
          break;
        case ApprovalStatus.ESCALATED:
          stats.escalated++;
          timeoutCount++;
          break;
      }
    }

    stats.avgProcessingTime = processedCount > 0 ? totalProcessingTime / processedCount : 0;
    stats.timeoutRate = logs.length > 0 ? timeoutCount / logs.length : 0;

    return stats;
  }

  /**
   * 获取审批详情
   */
  async getApprovalById(approvalId: string): Promise<Approval | null> {
    const log = await prisma.auditLog.findUnique({
      where: { id: approvalId },
    });

    if (!log) return null;
    return this.mapLogToApproval(log);
  }

  /**
   * 映射数据库记录到审批对象
   */
  private mapLogToApproval(log: any): Approval {
    const details = log.details as any;
    return {
      id: log.id,
      type: details.approvalType as ApprovalType,
      requesterId: log.userId,
      operationType: details.operationType,
      operationPayload: details.operationPayload,
      status: details.status as ApprovalStatus,
      priority: details.priority as ApprovalPriority,
      riskScore: details.riskScore,
      riskFactors: details.riskFactors,
      approverId: details.approverId,
      approvedAt: details.approvedAt ? new Date(details.approvedAt) : undefined,
      rejectedAt: details.rejectedAt ? new Date(details.rejectedAt) : undefined,
      rejectionReason: details.rejectionReason,
      comment: details.comment,
      escalationLevel: details.escalationLevel ?? 0,
      expiresAt: new Date(details.expiresAt),
      executedAt: details.executedAt ? new Date(details.executedAt) : undefined,
      executionResult: details.executionResult,
      createdAt: log.createdAt ?? new Date(details.createdAt),
      updatedAt: new Date(details.updatedAt),
    };
  }

  /**
   * 检查审批人权限
   */
  private async checkApproverPermission(approverId: string, approvalType: ApprovalType): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: approverId },
    });

    if (!user) return false;

    // 管理员和超级管理员可以审批所有类型
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      return true;
    }

    // 普通用户不能审批
    return false;
  }

  /**
   * 执行审批对应的操作
   */
  private async executeOperation(approval: Approval): Promise<void> {
    // 更新状态为已执行
    await prisma.auditLog.update({
      where: { id: approval.id },
      data: {
        action: 'APPROVAL_EXECUTED',
        details: {
          ...(approval as any),
          status: ApprovalStatus.EXECUTED,
          executedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any,
      },
    });

    // 根据操作类型调用相应的服务
    // 这里需要根据实际业务逻辑实现
    console.log(`[ApprovalService] Executing operation: ${approval.operationType}`);
  }

  /**
   * 发送审批通知
   */
  private async sendApprovalNotification(approval: Approval, event: string): Promise<void> {
    // 使用 WebSocket 通知服务发送通知
    // 实际实现需要注入通知服务
    console.log(`[ApprovalService] Sending ${event} notification for approval: ${approval.id}`);
  }

  /**
   * 发送升级通知
   */
  private async notifyEscalation(approval: Approval): Promise<void> {
    console.log(`[ApprovalService] Notifying escalation for approval: ${approval.id}, level: ${approval.escalationLevel}`);
  }

  /**
   * 发送提醒
   */
  private async sendReminder(approvalId: string, type: 'timeout' | 'reminder'): Promise<void> {
    console.log(`[ApprovalService] Sending ${type} reminder for approval: ${approvalId}`);
  }
}

// 导出单例
export const approvalService = new ApprovalService();