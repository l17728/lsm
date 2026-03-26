/**
 * LSM v3.2.0 Approval Model
 * 审批模型定义
 */

import { user_role as UserRole } from '@prisma/client';

/**
 * 审批类型枚举
 */
export enum ApprovalType {
  RESOURCE_RELEASE = 'RESOURCE_RELEASE',       // 资源释放
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',      // 权限变更
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',             // 系统配置
  DATA_DELETE = 'DATA_DELETE',                 // 数据删除
  BILLING = 'BILLING',                         // 费用相关
  RESERVATION = 'RESERVATION',                 // 预约审批
  EMERGENCY = 'EMERGENCY',                     // 紧急操作
}

/**
 * 审批状态枚举
 */
export enum ApprovalStatus {
  PENDING = 'PENDING',           // 待审批
  APPROVED = 'APPROVED',         // 已批准
  REJECTED = 'REJECTED',         // 已拒绝
  EXECUTED = 'EXECUTED',         // 已执行
  CANCELLED = 'CANCELLED',       // 已取消
  ESCALATED = 'ESCALATED',       // 已升级
}

/**
 * 审批优先级
 */
export enum ApprovalPriority {
  LOW = 'LOW',           // 普通审批
  NORMAL = 'NORMAL',     // 正常审批
  HIGH = 'HIGH',         // 高优先级
  URGENT = 'URGENT',     // 紧急审批
  CRITICAL = 'CRITICAL', // 关键审批
}

/**
 * 风险因素接口
 */
export interface RiskFactors {
  dataImpact: number;       // 数据影响 (1-5)
  resourceImpact: number;   // 资源影响 (1-5)
  reversibility: number;    // 可逆性 (1-5)
  costImpact: number;       // 成本影响 (1-5)
  securityImpact: number;   // 安全影响 (1-5)
  [key: string]: number;    // 扩展因素
}

/**
 * 操作详情接口
 */
export interface OperationPayload {
  operationType: string;           // 操作类型
  resourceType?: string;          // 资源类型
  resourceId?: string;            // 资源ID
  targetUserId?: string;          // 目标用户ID
  changes?: Record<string, any>;  // 变更内容
  metadata?: Record<string, any>;  // 元数据
}

/**
 * 审批接口
 */
export interface Approval {
  id: string;
  type: ApprovalType;
  requesterId: string;
  operationType: string;
  operationPayload: OperationPayload;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  riskScore: number;
  riskFactors: RiskFactors;
  approverId?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  comment?: string;
  escalationLevel: number;
  expiresAt: Date;
  executedAt?: Date;
  executionResult?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 审批请求接口
 */
export interface ApprovalRequest {
  type: ApprovalType;
  requesterId: string;
  operationType: string;
  operationPayload: OperationPayload;
  riskScore: number;
  riskFactors: RiskFactors;
  priority?: ApprovalPriority;
  customTimeout?: number;  // 自定义超时（小时）
}

/**
 * 审批结果接口
 */
export interface ApprovalResult {
  success: boolean;
  approval?: Approval;
  message?: string;
  error?: string;
}

/**
 * 审批查询选项
 */
export interface ApprovalQueryOptions {
  status?: ApprovalStatus | ApprovalStatus[];
  type?: ApprovalType | ApprovalType[];
  requesterId?: string;
  approverId?: string;
  priority?: ApprovalPriority | ApprovalPriority[];
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * 超时配置接口
 */
export interface TimeoutConfig {
  hours: number;
  action: 'escalate' | 'remind_daily' | 'auto_reject';
}

/**
 * 决策类型
 */
export enum DecisionCategory {
  AUTO = 'AUTO',           // 自动执行
  NOTIFY = 'NOTIFY',       // 通知确认
  APPROVAL = 'APPROVAL',   // 人工审批
}

/**
 * 决策结果接口
 */
export interface DecisionResult {
  category: DecisionCategory;
  riskScore: number;
  riskFactors: RiskFactors;
  autoApproved: boolean;
  requiresNotification: boolean;
  notificationChannels?: string[];
  estimatedProcessingTime?: number;  // 预估处理时间（毫秒）
}

/**
 * 操作接口
 */
export interface Operation {
  type: string;
  userId: string;
  userRole: UserRole;
  resourceType?: string;
  resourceId?: string;
  payload: Record<string, any>;
  context?: Record<string, any>;
}

/**
 * 升级记录接口
 */
export interface EscalationRecord {
  approvalId: string;
  fromLevel: number;
  toLevel: number;
  escalatedAt: Date;
  escalatedTo?: string;  // 升级目标用户ID
  reason: string;
}

/**
 * 审批统计接口
 */
export interface ApprovalStatistics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  escalated: number;
  avgProcessingTime: number;  // 平均处理时间（毫秒）
  timeoutRate: number;         // 超时率
}

/**
 * 角色权限映射（决策权限）
 */
export const ROLE_DECISION_MATRIX: Record<UserRole, Record<string, DecisionCategory>> = {
  USER: {
    query: DecisionCategory.AUTO,
    info: DecisionCategory.AUTO,
    preference: DecisionCategory.AUTO,
    task: DecisionCategory.NOTIFY,
    reservation: DecisionCategory.NOTIFY,
    resource: DecisionCategory.APPROVAL,
    permission: DecisionCategory.APPROVAL,
    system: DecisionCategory.APPROVAL,
  },
  MANAGER: {
    query: DecisionCategory.AUTO,
    info: DecisionCategory.AUTO,
    preference: DecisionCategory.AUTO,
    task: DecisionCategory.AUTO,
    reservation: DecisionCategory.NOTIFY,
    resource: DecisionCategory.NOTIFY,
    permission: DecisionCategory.APPROVAL,
    system: DecisionCategory.APPROVAL,
  },
  ADMIN: {
    query: DecisionCategory.AUTO,
    info: DecisionCategory.AUTO,
    preference: DecisionCategory.AUTO,
    task: DecisionCategory.AUTO,
    reservation: DecisionCategory.AUTO,
    resource: DecisionCategory.NOTIFY,
    permission: DecisionCategory.NOTIFY,
    system: DecisionCategory.APPROVAL,
  },
  SUPER_ADMIN: {
    query: DecisionCategory.AUTO,
    info: DecisionCategory.AUTO,
    preference: DecisionCategory.AUTO,
    task: DecisionCategory.AUTO,
    reservation: DecisionCategory.AUTO,
    resource: DecisionCategory.AUTO,
    permission: DecisionCategory.AUTO,
    system: DecisionCategory.AUTO,
  },
};

/**
 * 默认超时配置
 */
export const DEFAULT_TIMEOUT_CONFIG: Record<ApprovalPriority, TimeoutConfig> = {
  [ApprovalPriority.LOW]: { hours: 48, action: 'remind_daily' },
  [ApprovalPriority.NORMAL]: { hours: 24, action: 'escalate' },
  [ApprovalPriority.HIGH]: { hours: 12, action: 'escalate' },
  [ApprovalPriority.URGENT]: { hours: 4, action: 'escalate' },
  [ApprovalPriority.CRITICAL]: { hours: 48, action: 'remind_daily' },
};