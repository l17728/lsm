import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Audit log action types
 */
export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REGISTER = 'REGISTER',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  SERVER_CREATE = 'SERVER_CREATE',
  SERVER_UPDATE = 'SERVER_UPDATE',
  SERVER_DELETE = 'SERVER_DELETE',
  GPU_ALLOCATE = 'GPU_ALLOCATE',
  GPU_RELEASE = 'GPU_RELEASE',
  TASK_CREATE = 'TASK_CREATE',
  TASK_UPDATE = 'TASK_UPDATE',
  TASK_DELETE = 'TASK_DELETE',
  SETTINGS_CHANGE = 'SETTINGS_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  DATA_EXPORT = 'DATA_EXPORT',
  API_ACCESS = 'API_ACCESS',
}

/**
 * Audit log severity levels
 */
export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Audit log interface
 */
export interface AuditLogData {
  userId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity?: AuditSeverity;
}

/**
 * Audit Logging Service
 */
export class AuditLogService {
  /**
   * Create audit log entry
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          details: data.details || {},
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      console.log(`[Audit] ${data.action} logged${data.userId ? ` for user ${data.userId}` : ''}`);
    } catch (error) {
      console.error('[Audit] Log error:', error);
    }
  }

  /**
   * Log user login
   */
  async logLogin(userId: string, ipAddress: string, userAgent: string, success: boolean): Promise<void> {
    await this.log({
      userId,
      action: success ? AuditAction.LOGIN : AuditAction.LOGIN,
      resourceType: 'User',
      resourceId: userId,
      details: { success, method: 'password' },
      ipAddress,
      userAgent,
      severity: success ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
    });
  }

  /**
   * Log user logout
   */
  async logLogout(userId: string, ipAddress: string): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.LOGOUT,
      resourceType: 'User',
      resourceId: userId,
      ipAddress,
      severity: AuditSeverity.LOW,
    });
  }

  /**
   * Log password change
   */
  async logPasswordChange(userId: string, ipAddress: string): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.PASSWORD_CHANGE,
      resourceType: 'User',
      resourceId: userId,
      ipAddress,
      severity: AuditSeverity.HIGH,
    });
  }

  /**
   * Log GPU allocation
   */
  async logGpuAllocation(
    userId: string,
    gpuId: string,
    serverId: string,
    ipAddress: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.GPU_ALLOCATE,
      resourceType: 'GPU',
      resourceId: gpuId,
      details: { serverId },
      ipAddress,
      severity: AuditSeverity.MEDIUM,
    });
  }

  /**
   * Log GPU release
   */
  async logGpuRelease(userId: string, gpuId: string, ipAddress: string): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.GPU_RELEASE,
      resourceType: 'GPU',
      resourceId: gpuId,
      ipAddress,
      severity: AuditSeverity.LOW,
    });
  }

  /**
   * Log task creation
   */
  async logTaskCreation(
    userId: string,
    taskId: string,
    taskName: string,
    priority: string,
    ipAddress: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.TASK_CREATE,
      resourceType: 'Task',
      resourceId: taskId,
      details: { taskName, priority },
      ipAddress,
      severity: AuditSeverity.MEDIUM,
    });
  }

  /**
   * Log data export
   */
  async logDataExport(
    userId: string,
    exportType: string,
    recordCount: number,
    ipAddress: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.DATA_EXPORT,
      resourceType: 'Data',
      details: { exportType, recordCount },
      ipAddress,
      severity: AuditSeverity.HIGH,
    });
  }

  /**
   * Log failed authentication attempt
   */
  async logFailedAuth(email: string, ipAddress: string, userAgent: string): Promise<void> {
    await this.log({
      action: AuditAction.LOGIN,
      resourceType: 'User',
      details: { email, success: false, reason: 'invalid_credentials' },
      ipAddress,
      userAgent,
      severity: AuditSeverity.MEDIUM,
    });
  }

  /**
   * Log permission change
   */
  async logPermissionChange(
    userId: string,
    targetUserId: string,
    oldRole: string,
    newRole: string,
    ipAddress: string
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.PERMISSION_CHANGE,
      resourceType: 'User',
      resourceId: targetUserId,
      details: { oldRole, newRole },
      ipAddress,
      severity: AuditSeverity.CRITICAL,
    });
  }

  /**
   * Get audit logs for user
   */
  async getUserLogs(userId: string, limit: number = 100): Promise<any[]> {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get audit logs for resource
   */
  async getResourceLogs(resourceType: string, resourceId: string, limit: number = 100): Promise<any[]> {
    return prisma.auditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get audit logs by action
   */
  async getLogsByAction(action: AuditAction, limit: number = 100): Promise<any[]> {
    return prisma.auditLog.findMany({
      where: { action },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent audit logs
   */
  async getRecentLogs(limit: number = 100): Promise<any[]> {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Clean old audit logs
   */
  async cleanOldLogs(daysToKeep: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[Audit] Cleaned ${result.count} old audit logs`);
  }
}

// Export singleton instance
export const auditLogService = new AuditLogService();
