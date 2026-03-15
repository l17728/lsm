/**
 * LSM v3.2.0 Decision Service
 * 决策分类与风险评估服务
 */

import { user_role as UserRole } from '@prisma/client';
import prisma from '../../utils/prisma';
import {
  DecisionCategory,
  DecisionResult,
  Operation,
  RiskFactors,
  ROLE_DECISION_MATRIX,
} from '../../models/approval';

/**
 * 风险权重配置
 */
const RISK_WEIGHTS: Record<string, number> = {
  dataImpact: 0.25,
  resourceImpact: 0.20,
  reversibility: 0.20,
  costImpact: 0.20,
  securityImpact: 0.15,
};

/**
 * 决策阈值配置
 */
const DECISION_THRESHOLDS = {
  AUTO: 1.0,      // 风险分 ≤ 1.0 自动执行
  NOTIFY: 2.5,    // 风险分 ≤ 2.5 通知确认
  APPROVAL: 5.0,  // 风险分 > 2.5 人工审批
};

/**
 * 操作类型风险预设
 */
const OPERATION_RISK_PRESETS: Record<string, Partial<RiskFactors>> = {
  // 查询类 - 低风险
  'query:status': { dataImpact: 1, resourceImpact: 1, reversibility: 5, costImpact: 1, securityImpact: 1 },
  'query:logs': { dataImpact: 1, resourceImpact: 1, reversibility: 5, costImpact: 1, securityImpact: 2 },
  'query:metrics': { dataImpact: 1, resourceImpact: 1, reversibility: 5, costImpact: 1, securityImpact: 1 },
  
  // 信息展示 - 低风险
  'info:list': { dataImpact: 1, resourceImpact: 1, reversibility: 5, costImpact: 1, securityImpact: 1 },
  'info:detail': { dataImpact: 1, resourceImpact: 1, reversibility: 5, costImpact: 1, securityImpact: 1 },
  
  // 个人设置 - 低风险
  'preference:update': { dataImpact: 1, resourceImpact: 1, reversibility: 5, costImpact: 1, securityImpact: 1 },
  'preference:notification': { dataImpact: 1, resourceImpact: 1, reversibility: 5, costImpact: 1, securityImpact: 1 },
  
  // 任务操作 - 中等风险
  'task:create': { dataImpact: 2, resourceImpact: 2, reversibility: 4, costImpact: 2, securityImpact: 1 },
  'task:update': { dataImpact: 2, resourceImpact: 1, reversibility: 4, costImpact: 1, securityImpact: 1 },
  'task:delete': { dataImpact: 3, resourceImpact: 2, reversibility: 3, costImpact: 2, securityImpact: 1 },
  'task:submit': { dataImpact: 2, resourceImpact: 3, reversibility: 3, costImpact: 2, securityImpact: 1 },
  
  // 预约操作 - 中等风险
  'reservation:create': { dataImpact: 2, resourceImpact: 3, reversibility: 4, costImpact: 2, securityImpact: 1 },
  'reservation:cancel': { dataImpact: 2, resourceImpact: 2, reversibility: 4, costImpact: 1, securityImpact: 1 },
  'reservation:update': { dataImpact: 2, resourceImpact: 2, reversibility: 4, costImpact: 1, securityImpact: 1 },
  
  // 资源操作 - 高风险
  'resource:allocate': { dataImpact: 2, resourceImpact: 3, reversibility: 3, costImpact: 3, securityImpact: 2 },
  'resource:release': { dataImpact: 2, resourceImpact: 3, reversibility: 2, costImpact: 2, securityImpact: 1 },
  'resource:force-release': { dataImpact: 4, resourceImpact: 4, reversibility: 1, costImpact: 3, securityImpact: 3 },
  
  // 权限操作 - 高风险
  'permission:grant': { dataImpact: 3, resourceImpact: 3, reversibility: 3, costImpact: 1, securityImpact: 5 },
  'permission:revoke': { dataImpact: 3, resourceImpact: 2, reversibility: 3, costImpact: 1, securityImpact: 5 },
  'permission:role-change': { dataImpact: 4, resourceImpact: 4, reversibility: 2, costImpact: 1, securityImpact: 5 },
  
  // 系统配置 - 高风险
  'system:config': { dataImpact: 4, resourceImpact: 5, reversibility: 2, costImpact: 3, securityImpact: 4 },
  'system:maintenance': { dataImpact: 3, resourceImpact: 5, reversibility: 3, costImpact: 2, securityImpact: 3 },
  
  // 数据操作 - 高风险
  'data:delete': { dataImpact: 5, resourceImpact: 2, reversibility: 1, costImpact: 1, securityImpact: 3 },
  'data:backup': { dataImpact: 2, resourceImpact: 2, reversibility: 5, costImpact: 2, securityImpact: 2 },
  'data:restore': { dataImpact: 4, resourceImpact: 3, reversibility: 2, costImpact: 2, securityImpact: 3 },
  
  // 费用相关 - 高风险
  'billing:upgrade': { dataImpact: 2, resourceImpact: 3, reversibility: 3, costImpact: 5, securityImpact: 2 },
  'billing:cancel': { dataImpact: 3, resourceImpact: 3, reversibility: 2, costImpact: 4, securityImpact: 2 },
};

/**
 * 决策服务
 * 负责操作的风险评估和决策分类
 */
export class DecisionService {
  /**
   * 评估操作并返回决策结果
   */
  evaluate(operation: Operation): DecisionResult {
    // 计算风险评分
    const riskFactors = this.calculateRiskFactors(operation);
    const riskScore = this.calculateRiskScore(riskFactors);
    
    // 获取基于角色的基础决策
    const roleBasedCategory = this.getRoleBasedCategory(operation);
    
    // 获取基于操作类型的决策
    const operationCategory = this.getOperationCategory(operation.type);
    
    // 综合决策：取更严格的级别
    const categories = [roleBasedCategory, operationCategory];
    const category = this.getStricterCategory(categories);
    
    // 根据风险评分调整决策
    const finalCategory = this.adjustByRiskScore(category, riskScore);
    
    return {
      category: finalCategory,
      riskScore,
      riskFactors,
      autoApproved: finalCategory === DecisionCategory.AUTO,
      requiresNotification: finalCategory !== DecisionCategory.AUTO,
      notificationChannels: this.getNotificationChannels(finalCategory, operation),
      estimatedProcessingTime: this.estimateProcessingTime(finalCategory),
    };
  }

  /**
   * 计算风险因素
   */
  calculateRiskFactors(operation: Operation): RiskFactors {
    const preset = OPERATION_RISK_PRESETS[operation.type] || {};
    
    const defaultFactors: RiskFactors = {
      dataImpact: preset.dataImpact ?? 3,
      resourceImpact: preset.resourceImpact ?? 3,
      reversibility: preset.reversibility ?? 3,
      costImpact: preset.costImpact ?? 2,
      securityImpact: preset.securityImpact ?? 2,
    };
    
    // 根据操作上下文调整风险因素
    if (operation.context?.force) {
      defaultFactors.reversibility = Math.max(1, defaultFactors.reversibility - 2);
    }
    
    if (operation.context?.batch) {
      defaultFactors.resourceImpact = Math.min(5, defaultFactors.resourceImpact + 1);
    }
    
    if (operation.context?.targetOthers && operation.userId !== operation.context.targetOthers) {
      defaultFactors.securityImpact = Math.min(5, defaultFactors.securityImpact + 1);
    }
    
    return defaultFactors;
  }

  /**
   * 计算综合风险评分
   */
  calculateRiskScore(factors: RiskFactors): number {
    let score = 0;
    let totalWeight = 0;
    
    for (const [factor, weight] of Object.entries(RISK_WEIGHTS)) {
      const value = factors[factor] ?? 3;
      score += value * weight;
      totalWeight += weight;
    }
    
    return score / totalWeight;
  }

  /**
   * 获取基于角色的决策分类
   */
  private getRoleBasedCategory(operation: Operation): DecisionCategory {
    const roleMatrix = ROLE_DECISION_MATRIX[operation.userRole];
    if (!roleMatrix) {
      return DecisionCategory.APPROVAL; // 未知角色默认需要审批
    }
    
    const operationPrefix = operation.type.split(':')[0];
    return roleMatrix[operationPrefix] ?? DecisionCategory.APPROVAL;
  }

  /**
   * 获取操作类型对应的决策分类
   */
  getOperationCategory(operationType: string): DecisionCategory {
    // 查询类 - 自动执行
    if (operationType.startsWith('query:') || operationType.startsWith('info:')) {
      return DecisionCategory.AUTO;
    }
    
    // 个人设置类 - 自动执行
    if (operationType.startsWith('preference:')) {
      return DecisionCategory.AUTO;
    }
    
    // 高风险操作 - 人工审批
    const approvalOperations = [
      'resource:force-release',
      'permission:',
      'system:',
      'data:delete',
      'billing:',
    ];
    
    if (approvalOperations.some(op => operationType.startsWith(op))) {
      return DecisionCategory.APPROVAL;
    }
    
    // 中等风险操作 - 通知确认
    const notifyOperations = [
      'task:',
      'reservation:',
      'config:',
      'batch:',
    ];
    
    if (notifyOperations.some(op => operationType.startsWith(op))) {
      return DecisionCategory.NOTIFY;
    }
    
    // 默认需要审批
    return DecisionCategory.APPROVAL;
  }

  /**
   * 获取更严格的决策分类
   */
  private getStricterCategory(categories: DecisionCategory[]): DecisionCategory {
    const severity = {
      [DecisionCategory.AUTO]: 1,
      [DecisionCategory.NOTIFY]: 2,
      [DecisionCategory.APPROVAL]: 3,
    };
    
    let maxSeverity = 0;
    let result = DecisionCategory.AUTO;
    
    for (const category of categories) {
      const s = severity[category] ?? 3;
      if (s > maxSeverity) {
        maxSeverity = s;
        result = category;
      }
    }
    
    return result;
  }

  /**
   * 根据风险评分调整决策
   */
  private adjustByRiskScore(category: DecisionCategory, riskScore: number): DecisionCategory {
    // 如果风险评分很低，可以考虑降级
    if (riskScore <= DECISION_THRESHOLDS.AUTO && category !== DecisionCategory.AUTO) {
      // 只有通知级别可以降级为自动
      if (category === DecisionCategory.NOTIFY) {
        return DecisionCategory.AUTO;
      }
    }
    
    // 如果风险评分很高，必须升级
    if (riskScore > DECISION_THRESHOLDS.NOTIFY && category !== DecisionCategory.APPROVAL) {
      return DecisionCategory.APPROVAL;
    }
    
    return category;
  }

  /**
   * 获取通知渠道
   */
  private getNotificationChannels(category: DecisionCategory, operation: Operation): string[] {
    const baseChannels: string[] = [];
    
    switch (category) {
      case DecisionCategory.AUTO:
        // 自动执行不通知
        return [];
      case DecisionCategory.NOTIFY:
        // 通知确认：WebSocket + 邮件
        baseChannels.push('websocket', 'email');
        break;
      case DecisionCategory.APPROVAL:
        // 人工审批：WebSocket + 邮件 + 钉钉
        baseChannels.push('websocket', 'email', 'dingtalk');
        break;
    }
    
    // 紧急操作添加短信
    if (operation.context?.urgent) {
      baseChannels.push('sms');
    }
    
    return baseChannels;
  }

  /**
   * 估算处理时间
   */
  private estimateProcessingTime(category: DecisionCategory): number {
    switch (category) {
      case DecisionCategory.AUTO:
        return 100; // 100ms - 即时
      case DecisionCategory.NOTIFY:
        return 5000; // 5s - 含通知发送
      case DecisionCategory.APPROVAL:
        return 3600000; // 1h - 需等待审批
      default:
        return 0;
    }
  }

  /**
   * 检查操作是否可以自动执行
   */
  canAutoExecute(operation: Operation): boolean {
    const result = this.evaluate(operation);
    return result.autoApproved;
  }

  /**
   * 获取操作的详细风险评估报告
   */
  getRiskAssessment(operation: Operation): {
    riskScore: number;
    riskFactors: RiskFactors;
    breakdown: Record<string, { value: number; weight: number; contribution: number }>;
    recommendation: string;
  } {
    const factors = this.calculateRiskFactors(operation);
    const riskScore = this.calculateRiskScore(factors);
    
    const breakdown: Record<string, { value: number; weight: number; contribution: number }> = {};
    let totalWeight = 0;
    
    for (const [factor, weight] of Object.entries(RISK_WEIGHTS)) {
      const value = factors[factor] ?? 3;
      const contribution = value * weight;
      breakdown[factor] = { value, weight, contribution };
      totalWeight += weight;
    }
    
    let recommendation: string;
    if (riskScore <= DECISION_THRESHOLDS.AUTO) {
      recommendation = '低风险操作，建议自动执行';
    } else if (riskScore <= DECISION_THRESHOLDS.NOTIFY) {
      recommendation = '中等风险操作，建议执行后通知确认';
    } else {
      recommendation = '高风险操作，需要人工审批';
    }
    
    return {
      riskScore,
      riskFactors: factors,
      breakdown,
      recommendation,
    };
  }
}

// 导出单例
export const decisionService = new DecisionService();