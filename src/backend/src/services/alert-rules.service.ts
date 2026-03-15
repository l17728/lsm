import { PrismaClient, alert_type } from '@prisma/client';
import { notificationService, AlertSeverity, AlertType } from '../services/notification.service';

const prisma = new PrismaClient();

/**
 * Alert rule configuration interface
 */
export interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  severity: AlertSeverity;
  condition: string;
  threshold: number;
  enabled: boolean;
  recipients: string[];
  escalationPolicy?: EscalationPolicy;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Escalation policy interface
 */
export interface EscalationPolicy {
  enabled: boolean;
  levels: EscalationLevel[];
}

/**
 * Escalation level interface
 */
export interface EscalationLevel {
  level: number;
  delayMinutes: number;
  severity: AlertSeverity;
  recipients: string[];
}

/**
 * Alert metrics interface
 */
export interface AlertMetrics {
  totalAlerts: number;
  activeAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  averageResolutionTime: number;
  alertsBySeverity: Record<string, number>;
  alertsByType: Record<string, number>;
}

/**
 * Alert Rules Service
 * 
 * Manages alert rule configuration and execution
 */
export class AlertRulesService {
  private rules: Map<string, AlertRule> = new Map();
  private alertHistory: Map<string, Date> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'rule_cpu_critical',
        name: 'CPU 使用率严重告警',
        type: AlertType.PERFORMANCE,
        severity: AlertSeverity.CRITICAL,
        condition: 'cpu_usage > threshold',
        threshold: 90,
        enabled: true,
        recipients: ['admin@example.com'],
        escalationPolicy: {
          enabled: true,
          levels: [
            { level: 1, delayMinutes: 5, severity: AlertSeverity.CRITICAL, recipients: ['admin@example.com'] },
            { level: 2, delayMinutes: 15, severity: AlertSeverity.CRITICAL, recipients: ['manager@example.com'] },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule_memory_warning',
        name: '内存使用率警告',
        type: AlertType.RESOURCE,
        severity: AlertSeverity.WARNING,
        condition: 'memory_usage > threshold',
        threshold: 80,
        enabled: true,
        recipients: ['admin@example.com'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule_server_offline',
        name: '服务器离线告警',
        type: AlertType.SYSTEM,
        severity: AlertSeverity.CRITICAL,
        condition: 'server_status == OFFLINE',
        threshold: 0,
        enabled: true,
        recipients: ['admin@example.com'],
        escalationPolicy: {
          enabled: true,
          levels: [
            { level: 1, delayMinutes: 1, severity: AlertSeverity.CRITICAL, recipients: ['admin@example.com'] },
            { level: 2, delayMinutes: 5, severity: AlertSeverity.CRITICAL, recipients: ['ops@example.com'] },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule_gpu_high',
        name: 'GPU 高使用率告警',
        type: AlertType.RESOURCE,
        severity: AlertSeverity.WARNING,
        condition: 'gpu_usage > threshold',
        threshold: 85,
        enabled: true,
        recipients: ['admin@example.com'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule_disk_space',
        name: '磁盘空间不足告警',
        type: AlertType.SYSTEM,
        severity: AlertSeverity.WARNING,
        condition: 'disk_usage > threshold',
        threshold: 85,
        enabled: true,
        recipients: ['admin@example.com'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });

    console.log(`[AlertRules] Initialized ${defaultRules.length} default rules`);
  }

  /**
   * Evaluate metrics against rules and trigger alerts
   */
  async evaluateMetrics(metrics: {
    serverId?: string;
    cpuUsage?: number;
    memoryUsage?: number;
    gpuUsage?: number;
    diskUsage?: number;
    serverStatus?: string;
  }): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const shouldAlert = this.evaluateRule(rule, metrics);

      if (shouldAlert) {
        await this.triggerAlert(rule, metrics);
      }
    }
  }

  /**
   * Evaluate a single rule against metrics
   */
  private evaluateRule(rule: AlertRule, metrics: any): boolean {
    const condition = rule.condition.toLowerCase();

    if (condition.includes('cpu_usage')) {
      return (metrics.cpuUsage || 0) > rule.threshold;
    }

    if (condition.includes('memory_usage')) {
      return (metrics.memoryUsage || 0) > rule.threshold;
    }

    if (condition.includes('gpu_usage')) {
      return (metrics.gpuUsage || 0) > rule.threshold;
    }

    if (condition.includes('disk_usage')) {
      return (metrics.diskUsage || 0) > rule.threshold;
    }

    if (condition.includes('server_status') && condition.includes('offline')) {
      return metrics.serverStatus === 'OFFLINE';
    }

    return false;
  }

  /**
   * Trigger alert for a rule
   */
  private async triggerAlert(rule: AlertRule, metrics: any): Promise<void> {
    const ruleKey = `${rule.id}:${metrics.serverId || 'global'}`;
    const lastAlert = this.alertHistory.get(ruleKey);
    const now = new Date();

    // Rate limiting: don't alert more than once every 5 minutes for the same rule
    if (lastAlert && now.getTime() - lastAlert.getTime() < 5 * 60 * 1000) {
      return;
    }

    this.alertHistory.set(ruleKey, now);

    const message = this.formatAlertMessage(rule, metrics);

    await notificationService.sendAlert({
      type: rule.type,
      severity: rule.severity,
      title: rule.name,
      message,
      metadata: {
        ruleId: rule.id,
        threshold: rule.threshold,
        ...metrics,
      },
      recipients: rule.recipients,
    });

    // Save alert to database
    await this.saveAlertToDatabase(rule, metrics);

    console.log(`[AlertRules] Alert triggered: ${rule.name}`);

    // Handle escalation if enabled
    if (rule.escalationPolicy?.enabled) {
      this.scheduleEscalation(rule, metrics);
    }
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(rule: AlertRule, metrics: any): string {
    const parts: string[] = [];

    if (metrics.serverId) {
      parts.push(`服务器 ID: ${metrics.serverId}`);
    }

    if (metrics.cpuUsage !== undefined) {
      parts.push(`CPU 使用率：${metrics.cpuUsage}%`);
    }

    if (metrics.memoryUsage !== undefined) {
      parts.push(`内存使用率：${metrics.memoryUsage}%`);
    }

    if (metrics.gpuUsage !== undefined) {
      parts.push(`GPU 使用率：${metrics.gpuUsage}%`);
    }

    if (metrics.diskUsage !== undefined) {
      parts.push(`磁盘使用率：${metrics.diskUsage}%`);
    }

    if (metrics.serverStatus) {
      parts.push(`服务器状态：${metrics.serverStatus}`);
    }

    parts.push(`\n阈值：${rule.threshold}`);
    parts.push(`规则：${rule.condition}`);

    return parts.join('\n');
  }

  /**
   * Save alert to database
   */
  private async saveAlertToDatabase(rule: AlertRule, metrics: any): Promise<void> {
    try {
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      });

      for (const user of adminUsers) {
        await prisma.alert.create({
          data: {
            type: this.mapAlertType(rule.type),
            severity: rule.severity,
            serverId: metrics.serverId,
            message: this.formatAlertMessage(rule, metrics),
            details: {
              ruleId: rule.id,
              ruleName: rule.name,
              threshold: rule.threshold,
              ...metrics,
            },
            status: 'ACTIVE',
          },
        });
      }
    } catch (error) {
      console.error('[AlertRules] Save alert to database error:', error);
    }
  }

  /**
   * Map alert type to database enum
   */
  private mapAlertType(type: AlertType): alert_type {
    const mapping: Record<AlertType, alert_type> = {
      [AlertType.SYSTEM]: alert_type.SERVER_OFFLINE,
      [AlertType.PERFORMANCE]: alert_type.HIGH_CPU,
      [AlertType.RESOURCE]: alert_type.HIGH_MEMORY,
      [AlertType.SECURITY]: alert_type.SERVER_OFFLINE,
      [AlertType.TASK]: alert_type.SERVER_OFFLINE,
    };
    return mapping[type] ?? alert_type.SERVER_OFFLINE;
  }

  /**
   * Schedule escalation for an alert
   */
  private scheduleEscalation(rule: AlertRule, metrics: any): void {
    if (!rule.escalationPolicy) return;

    rule.escalationPolicy.levels.forEach(level => {
      setTimeout(async () => {
        // Check if alert is still active
        const stillActive = await this.isAlertStillActive(rule, metrics);
        
        if (stillActive) {
          await notificationService.sendAlert({
            type: rule.type,
            severity: level.severity,
            title: `[升级] ${rule.name} - 级别 ${level.level}`,
            message: `告警升级通知：${rule.name} 在 ${level.delayMinutes} 分钟后仍未解决。\n\n${this.formatAlertMessage(rule, metrics)}`,
            recipients: level.recipients,
            metadata: {
              escalationLevel: level.level,
              originalRuleId: rule.id,
              ...metrics,
            },
          });
        }
      }, level.delayMinutes * 60 * 1000);
    });
  }

  /**
   * Check if alert is still active
   */
  private async isAlertStillActive(rule: AlertRule, metrics: any): Promise<boolean> {
    // Re-evaluate the rule
    return this.evaluateRule(rule, metrics);
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule by ID
   */
  getRule(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }

  /**
   * Add or update a rule
   */
  upsertRule(rule: Partial<AlertRule>): AlertRule {
    const id = rule.id || `rule_${Date.now()}`;
    const existingRule = this.rules.get(id);

    const newRule: AlertRule = {
      id,
      name: rule.name || 'Unnamed Rule',
      type: rule.type || AlertType.SYSTEM,
      severity: rule.severity || AlertSeverity.WARNING,
      condition: rule.condition || '',
      threshold: rule.threshold || 0,
      enabled: rule.enabled ?? true,
      recipients: rule.recipients || [],
      escalationPolicy: rule.escalationPolicy,
      createdAt: existingRule?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(id, newRule);
    console.log(`[AlertRules] Rule ${id} ${existingRule ? 'updated' : 'created'}`);

    return newRule;
  }

  /**
   * Delete a rule
   */
  deleteRule(id: string): boolean {
    const deleted = this.rules.delete(id);
    if (deleted) {
      console.log(`[AlertRules] Rule ${id} deleted`);
    }
    return deleted;
  }

  /**
   * Enable/disable a rule
   */
  toggleRule(id: string, enabled: boolean): AlertRule | undefined {
    const rule = this.rules.get(id);
    if (rule) {
      rule.enabled = enabled;
      rule.updatedAt = new Date();
      console.log(`[AlertRules] Rule ${id} ${enabled ? 'enabled' : 'disabled'}`);
    }
    return rule;
  }

  /**
   * Get alert metrics
   */
  async getMetrics(): Promise<AlertMetrics> {
    try {
      const [totalAlerts, activeAlerts, acknowledgedAlerts, resolvedAlerts] = await Promise.all([
        prisma.alert.count(),
        prisma.alert.count({ where: { status: 'ACTIVE' } }),
        prisma.alert.count({ where: { status: 'ACKNOWLEDGED' } }),
        prisma.alert.count({ where: { status: 'RESOLVED' } }),
      ]);

      // Get alerts by severity
      const severityCounts = await prisma.alert.groupBy({
        by: ['severity'],
        _count: true,
      });

      const alertsBySeverity: Record<string, number> = {};
      severityCounts.forEach(item => {
        alertsBySeverity[item.severity] = (item as any)._count;
      });

      // Calculate average resolution time (simplified)
      const averageResolutionTime = 0; // Would need more complex query

      return {
        totalAlerts,
        activeAlerts,
        acknowledgedAlerts,
        resolvedAlerts,
        averageResolutionTime,
        alertsBySeverity,
        alertsByType: {}, // Would need similar grouping by type
      };
    } catch (error) {
      console.error('[AlertRules] Get metrics error:', error);
      return {
        totalAlerts: 0,
        activeAlerts: 0,
        acknowledgedAlerts: 0,
        resolvedAlerts: 0,
        averageResolutionTime: 0,
        alertsBySeverity: {},
        alertsByType: {},
      };
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedBy: userId,
          acknowledgedAt: new Date(),
        },
      });
      console.log(`[AlertRules] Alert ${alertId} acknowledged by ${userId}`);
    } catch (error) {
      console.error('[AlertRules] Acknowledge alert error:', error);
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    try {
      await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
      });
      console.log(`[AlertRules] Alert ${alertId} resolved`);
    } catch (error) {
      console.error('[AlertRules] Resolve alert error:', error);
    }
  }
}

// Export singleton instance
export const alertRulesService = new AlertRulesService();
