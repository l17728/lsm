/**
 * Alert Deduplication Service
 * v3.1.0 - 智能告警降噪服务
 * 
 * 功能：
 * - 告警去重（基于指纹）
 * - 告警聚合（合并相似告警）
 * - 告警抑制（静默策略）
 * - 智能分组（相关性分析）
 * - 告警分级（优先级计算）
 * - 告警静默（维护窗口）
 */

import { PrismaClient } from '@prisma/client';
import { notificationService, AlertSeverity, AlertType } from '../notification.service';

const prisma = new PrismaClient();

// 告警指纹
export interface AlertFingerprint {
  hash: string;
  type: AlertType;
  serverId?: string;
  metric?: string;
  threshold?: number;
}

// 原始告警
export interface RawAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  serverId?: string;
  metric?: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
}

// 聚合告警
export interface AggregatedAlert {
  id: string;
  fingerprint: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  serverIds: string[];
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SILENCED';
  silenceId?: string;
  relatedAlerts: string[];
  priority: number;  // 0-100, 越高越优先
}

// 静默规则
export interface SilenceRule {
  id: string;
  name: string;
  enabled: boolean;
  
  // 匹配条件
  matchers: Array<{
    field: 'type' | 'serverId' | 'severity' | 'title' | 'message';
    operator: 'equals' | 'contains' | 'regex' | 'startsWith';
    value: string;
  }>;
  
  // 静默时长
  duration: number;  // 秒
  startTime?: Date;
  endTime?: Date;
  
  // 创建信息
  createdBy: string;
  createdAt: Date;
  reason: string;
}

// 抑制规则
export interface InhibitRule {
  id: string;
  name: string;
  enabled: boolean;
  
  // 源告警匹配
  sourceMatchers: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'regex';
    value: string;
  }>;
  
  // 目标告警匹配
  targetMatchers: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'regex';
    value: string;
  }>;
  
  // 当源告警存在时，抑制目标告警
  createdAt: Date;
}

// 告警分组
export interface AlertGroup {
  id: string;
  name: string;
  alerts: AggregatedAlert[];
  commonFields: Record<string, any>;
  rootCause?: string;
  suggestedActions: string[];
}

// 降噪配置
export interface DeduplicationConfig {
  // 去重窗口（秒）- 在此时间内的相同告警会被合并
  deduplicationWindow: number;
  
  // 聚合窗口（秒）- 在此时间内的相似告警会被聚合
  aggregationWindow: number;
  
  // 分组窗口（秒）
  groupingWindow: number;
  
  // 最大聚合数量
  maxAggregationCount: number;
  
  // 自动解决阈值（秒）- 超过此时间未再出现的告警自动标记为解决
  autoResolveThreshold: number;
  
  // 优先级权重
  priorityWeights: {
    severity: number;     // 严重性权重
    frequency: number;    // 频率权重
    recency: number;      // 新鲜度权重
    impact: number;       // 影响范围权重
  };
}

// 默认配置
const DEFAULT_CONFIG: DeduplicationConfig = {
  deduplicationWindow: 300,      // 5 分钟
  aggregationWindow: 600,        // 10 分钟
  groupingWindow: 300,           // 5 分钟
  maxAggregationCount: 100,
  autoResolveThreshold: 3600,    // 1 小时
  priorityWeights: {
    severity: 40,
    frequency: 20,
    recency: 20,
    impact: 20,
  },
};

// 默认抑制规则
const DEFAULT_INHIBIT_RULES: InhibitRule[] = [
  {
    id: 'inhibit_child_on_parent_offline',
    name: '服务器离线时抑制相关告警',
    enabled: true,
    sourceMatchers: [
      { field: 'type', operator: 'equals', value: 'SYSTEM' },
      { field: 'title', operator: 'contains', value: '离线' },
    ],
    targetMatchers: [
      { field: 'serverId', operator: 'equals', value: '${source.serverId}' },
    ],
    createdAt: new Date(),
  },
  {
    id: 'inhibit_child_on_critical',
    name: '关键告警时抑制低级别告警',
    enabled: true,
    sourceMatchers: [
      { field: 'severity', operator: 'equals', value: 'CRITICAL' },
    ],
    targetMatchers: [
      { field: 'severity', operator: 'equals', value: 'WARNING' },
      { field: 'serverId', operator: 'equals', value: '${source.serverId}' },
    ],
    createdAt: new Date(),
  },
];

/**
 * 智能告警降噪服务
 */
export class AlertDeduplicationService {
  private config: DeduplicationConfig;
  private rawAlerts: Map<string, RawAlert> = new Map();
  private aggregatedAlerts: Map<string, AggregatedAlert> = new Map();
  private fingerprints: Map<string, string[]> = new Map();  // fingerprint -> alert IDs
  private silenceRules: Map<string, SilenceRule> = new Map();
  private inhibitRules: Map<string, InhibitRule> = new Map();
  private alertGroups: Map<string, AlertGroup> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultRules();
  }

  /**
   * 初始化默认规则
   */
  private initializeDefaultRules(): void {
    DEFAULT_INHIBIT_RULES.forEach(rule => {
      this.inhibitRules.set(rule.id, rule);
    });

    console.log(`[AlertDedup] Initialized ${DEFAULT_INHIBIT_RULES.length} inhibit rules`);
  }

  /**
   * 启动服务
   */
  start(): void {
    // 启动定时清理
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);  // 每分钟清理一次

    console.log('[AlertDedup] Service started');
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log('[AlertDedup] Service stopped');
  }

  /**
   * 处理告警入口
   */
  async processAlert(alert: RawAlert): Promise<AggregatedAlert | null> {
    // 1. 生成指纹
    const fingerprint = this.generateFingerprint(alert);

    // 2. 检查静默规则
    const silenceMatch = this.checkSilenceRules(alert);
    if (silenceMatch) {
      console.log(`[AlertDedup] Alert ${alert.id} silenced by rule ${silenceMatch.id}`);
      return null;
    }

    // 3. 检查抑制规则
    const inhibitMatch = this.checkInhibitRules(alert);
    if (inhibitMatch) {
      console.log(`[AlertDedup] Alert ${alert.id} inhibited by rule ${inhibitMatch.id}`);
      return null;
    }

    // 4. 去重处理
    const existingAlert = this.findDuplicate(fingerprint, alert);
    if (existingAlert) {
      // 更新现有告警
      return this.updateAggregatedAlert(existingAlert, alert);
    }

    // 5. 创建新的聚合告警
    const aggregated = this.createAggregatedAlert(alert, fingerprint);

    // 6. 分组分析
    this.analyzeGrouping(aggregated);

    // 7. 发送通知
    await this.sendNotification(aggregated);

    return aggregated;
  }

  /**
   * 生成告警指纹
   */
  private generateFingerprint(alert: RawAlert): string {
    const parts: string[] = [
      alert.type,
      alert.serverId || 'global',
      alert.metric || 'none',
    ];

    // 将阈值纳入指纹（同类型不同阈值视为不同告警）
    if (alert.threshold !== undefined) {
      parts.push(String(alert.threshold));
    }

    // 标准化标题（移除动态部分）
    const normalizedTitle = this.normalizeTitle(alert.title);
    parts.push(normalizedTitle);

    const hash = this.simpleHash(parts.join('|'));
    return hash;
  }

  /**
   * 标准化标题（移除动态部分）
   */
  private normalizeTitle(title: string): string {
    // 移除数字、百分比、IP 地址等动态内容
    return title
      .replace(/\d+(\.\d+)?%?/g, 'N')
      .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, 'IP')
      .replace(/server-[a-f0-9]+/gi, 'SERVER')
      .toLowerCase();
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * 检查静默规则
   */
  private checkSilenceRules(alert: RawAlert): SilenceRule | null {
    for (const rule of this.silenceRules.values()) {
      if (!rule.enabled) continue;

      // 检查时间范围
      if (rule.startTime && rule.endTime) {
        const now = new Date();
        if (now < rule.startTime || now > rule.endTime) {
          continue;
        }
      }

      // 检查匹配条件
      if (this.matchAlert(alert, rule.matchers)) {
        return rule;
      }
    }
    return null;
  }

  /**
   * 检查抑制规则
   */
  private checkInhibitRules(alert: RawAlert): InhibitRule | null {
    for (const rule of this.inhibitRules.values()) {
      if (!rule.enabled) continue;

      // 检查是否有匹配源告警的活跃告警
      const sourceAlerts = this.findMatchingAlerts(rule.sourceMatchers);
      if (sourceAlerts.length === 0) continue;

      // 检查当前告警是否匹配目标匹配器
      const targetMatchers = this.resolveMatchers(rule.targetMatchers, sourceAlerts[0]);
      if (this.matchAlert(alert, targetMatchers)) {
        return rule;
      }
    }
    return null;
  }

  /**
   * 解析匹配器中的变量引用
   */
  private resolveMatchers(
    matchers: Array<{ field: string; operator: string; value: string }>,
    sourceAlert: AggregatedAlert
  ): Array<{ field: string; operator: string; value: string }> {
    return matchers.map(m => {
      let value = m.value;
      
      // 替换变量引用，如 ${source.serverId}
      const varMatch = m.value.match(/\$\{source\.(\w+)\}/);
      if (varMatch) {
        const field = varMatch[1];
        const sourceValue = (sourceAlert as any)[field];
        if (sourceValue) {
          value = sourceValue;
        }
      }

      return { ...m, value };
    });
  }

  /**
   * 匹配告警
   */
  private matchAlert(
    alert: RawAlert | AggregatedAlert,
    matchers: Array<{ field: string; operator: string; value: string }>
  ): boolean {
    return matchers.every(matcher => {
      const fieldValue = String((alert as any)[matcher.field] || '');
      const targetValue = matcher.value;

      switch (matcher.operator) {
        case 'equals':
          return fieldValue === targetValue;
        case 'contains':
          return fieldValue.includes(targetValue);
        case 'startsWith':
          return fieldValue.startsWith(targetValue);
        case 'regex':
          try {
            return new RegExp(targetValue).test(fieldValue);
          } catch {
            return false;
          }
        default:
          return false;
      }
    });
  }

  /**
   * 查找匹配的告警
   */
  private findMatchingAlerts(
    matchers: Array<{ field: string; operator: string; value: string }>
  ): AggregatedAlert[] {
    const results: AggregatedAlert[] = [];
    
    for (const alert of this.aggregatedAlerts.values()) {
      if (alert.status !== 'ACTIVE') continue;
      
      if (this.matchAlert(alert, matchers)) {
        results.push(alert);
      }
    }

    return results;
  }

  /**
   * 查找重复告警
   */
  private findDuplicate(fingerprint: string, alert: RawAlert): AggregatedAlert | null {
    const alertIds = this.fingerprints.get(fingerprint);
    if (!alertIds || alertIds.length === 0) return null;

    // 在去重窗口内查找
    const windowStart = new Date(Date.now() - this.config.deduplicationWindow * 1000);

    for (const alertId of alertIds) {
      const aggregated = this.aggregatedAlerts.get(alertId);
      if (aggregated && aggregated.lastOccurrence >= windowStart && aggregated.status === 'ACTIVE') {
        return aggregated;
      }
    }

    return null;
  }

  /**
   * 创建聚合告警
   */
  private createAggregatedAlert(alert: RawAlert, fingerprint: string): AggregatedAlert {
    const aggregated: AggregatedAlert = {
      id: `agg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fingerprint,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      count: 1,
      firstOccurrence: alert.timestamp,
      lastOccurrence: alert.timestamp,
      serverIds: alert.serverId ? [alert.serverId] : [],
      status: 'ACTIVE',
      relatedAlerts: [],
      priority: 0,
    };

    // 计算优先级
    aggregated.priority = this.calculatePriority(aggregated);

    // 存储
    this.aggregatedAlerts.set(aggregated.id, aggregated);
    this.rawAlerts.set(alert.id, alert);

    // 更新指纹映射
    const existingIds = this.fingerprints.get(fingerprint) || [];
    existingIds.push(aggregated.id);
    this.fingerprints.set(fingerprint, existingIds);

    console.log(`[AlertDedup] Created aggregated alert ${aggregated.id} (priority: ${aggregated.priority})`);
    return aggregated;
  }

  /**
   * 更新聚合告警
   */
  private updateAggregatedAlert(aggregated: AggregatedAlert, alert: RawAlert): AggregatedAlert {
    // 增加计数
    aggregated.count++;

    // 更新时间
    aggregated.lastOccurrence = alert.timestamp;

    // 更新服务器列表
    if (alert.serverId && !aggregated.serverIds.includes(alert.serverId)) {
      aggregated.serverIds.push(alert.serverId);
    }

    // 更新严重性（取最高的）
    if (this.compareSeverity(alert.severity, aggregated.severity) > 0) {
      aggregated.severity = alert.severity;
    }

    // 追加消息
    aggregated.message += `\n[${alert.timestamp.toISOString()}] ${alert.message}`;

    // 重新计算优先级
    aggregated.priority = this.calculatePriority(aggregated);

    // 存储原始告警
    this.rawAlerts.set(alert.id, alert);

    console.log(`[AlertDedup] Updated aggregated alert ${aggregated.id} (count: ${aggregated.count})`);
    return aggregated;
  }

  /**
   * 比较严重性
   */
  private compareSeverity(a: AlertSeverity, b: AlertSeverity): number {
    const order = { INFO: 0, WARNING: 1, ERROR: 2, CRITICAL: 3 };
    return order[a] - order[b];
  }

  /**
   * 计算优先级
   */
  private calculatePriority(alert: AggregatedAlert): number {
    const weights = this.config.priorityWeights;
    let score = 0;

    // 严重性得分 (0-40)
    const severityScores: Record<AlertSeverity, number> = {
      INFO: 0,
      WARNING: 10,
      ERROR: 25,
      CRITICAL: 40,
    };
    score += severityScores[alert.severity] * (weights.severity / 40);

    // 频率得分 (0-20)
    const frequencyScore = Math.min(alert.count / 10, 1) * 20;
    score += frequencyScore * (weights.frequency / 20);

    // 新鲜度得分 (0-20) - 越新分数越高
    const ageMinutes = (Date.now() - alert.lastOccurrence.getTime()) / 60000;
    const recencyScore = Math.max(0, 20 - ageMinutes);
    score += recencyScore * (weights.recency / 20);

    // 影响范围得分 (0-20)
    const impactScore = Math.min(alert.serverIds.length * 5, 20);
    score += impactScore * (weights.impact / 20);

    return Math.round(score);
  }

  /**
   * 分组分析
   */
  private analyzeGrouping(alert: AggregatedAlert): void {
    // 查找相关的其他告警
    const relatedAlerts: AggregatedAlert[] = [];

    for (const other of this.aggregatedAlerts.values()) {
      if (other.id === alert.id || other.status !== 'ACTIVE') continue;

      // 检查相关性
      if (this.areRelated(alert, other)) {
        relatedAlerts.push(other);
      }
    }

    // 如果有相关告警，创建或更新分组
    if (relatedAlerts.length > 0) {
      this.createOrUpdateGroup(alert, relatedAlerts);
    }
  }

  /**
   * 判断两个告警是否相关
   */
  private areRelated(a: AggregatedAlert, b: AggregatedAlert): boolean {
    // 相同服务器
    if (a.serverIds.some(id => b.serverIds.includes(id))) {
      return true;
    }

    // 相同类型
    if (a.type === b.type && a.fingerprint !== b.fingerprint) {
      return true;
    }

    // 时间接近（5分钟内）
    const timeDiff = Math.abs(a.lastOccurrence.getTime() - b.lastOccurrence.getTime());
    if (timeDiff < 5 * 60 * 1000) {
      // 检查是否可能是因果相关
      if (this.areCausallyRelated(a, b)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 判断是否因果相关
   */
  private areCausallyRelated(a: AggregatedAlert, b: AggregatedAlert): boolean {
    // 简化的因果关系判断
    const causalPatterns = [
      { cause: AlertType.SYSTEM, effect: AlertType.PERFORMANCE },
      { cause: AlertType.RESOURCE, effect: AlertType.PERFORMANCE },
      { cause: AlertType.SYSTEM, effect: AlertType.TASK },
    ];

    for (const pattern of causalPatterns) {
      if ((a.type === pattern.cause && b.type === pattern.effect) ||
          (b.type === pattern.cause && a.type === pattern.effect)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 创建或更新告警分组
   */
  private createOrUpdateGroup(alert: AggregatedAlert, relatedAlerts: AggregatedAlert[]): void {
    const allAlerts = [alert, ...relatedAlerts];
    
    // 提取共同字段
    const commonFields: Record<string, any> = {};
    
    // 分析根本原因
    const rootCause = this.analyzeRootCause(allAlerts);
    
    const group: AlertGroup = {
      id: `group_${Date.now()}`,
      name: this.generateGroupName(allAlerts),
      alerts: allAlerts,
      commonFields,
      rootCause,
      suggestedActions: this.generateSuggestedActions(allAlerts),
    };

    this.alertGroups.set(group.id, group);

    // 更新告警的关联信息
    allAlerts.forEach(a => {
      a.relatedAlerts = allAlerts.filter(x => x.id !== a.id).map(x => x.id);
    });

    console.log(`[AlertDedup] Created alert group ${group.id} with ${allAlerts.length} alerts`);
  }

  /**
   * 生成分组名称
   */
  private generateGroupName(alerts: AggregatedAlert[]): string {
    const types = [...new Set(alerts.map(a => a.type))];
    const servers = [...new Set(alerts.flatMap(a => a.serverIds))];

    if (servers.length === 1) {
      return `服务器 ${servers[0]} 告警组 (${alerts.length} 条)`;
    } else if (types.length === 1) {
      return `${types[0]} 类型告警组 (${alerts.length} 条)`;
    } else {
      return `综合告警组 (${alerts.length} 条)`;
    }
  }

  /**
   * 生成建议操作
   */
  private generateSuggestedActions(alerts: AggregatedAlert[]): string[] {
    const actions: string[] = [];
    const types = new Set(alerts.map(a => a.type));
    const servers = new Set(alerts.flatMap(a => a.serverIds));

    if (types.has(AlertType.SYSTEM)) {
      actions.push('检查服务器状态和日志');
    }
    if (types.has(AlertType.PERFORMANCE)) {
      actions.push('分析性能瓶颈，考虑扩容');
    }
    if (types.has(AlertType.RESOURCE)) {
      actions.push('检查资源使用情况，清理或扩容');
    }
    if (servers.size === 1) {
      actions.push('聚焦单一服务器排查');
    } else if (servers.size > 3) {
      actions.push('可能存在集群级别问题，检查基础设施');
    }

    return actions;
  }

  /**
   * 分析根本原因
   */
  private analyzeRootCause(alerts: AggregatedAlert[]): string {
    // 简化的根本原因分析
    const severityCounts: Record<AlertSeverity, number> = {
      INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0,
    };

    alerts.forEach(a => severityCounts[a.severity]++);

    if (severityCounts.CRITICAL > 0) {
      const critical = alerts.find(a => a.severity === AlertSeverity.CRITICAL);
      if (critical) {
        return `可能是 ${critical.title} 导致的连锁问题`;
      }
    }

    if (severityCounts.ERROR > 2) {
      return '多个错误可能源于共同的底层问题';
    }

    return '需要进一步分析确定根本原因';
  }

  /**
   * 发送通知
   */
  private async sendNotification(alert: AggregatedAlert): Promise<void> {
    // 如果是聚合告警，发送汇总通知
    if (alert.count > 1) {
      await notificationService.sendAlert({
        type: alert.type,
        severity: alert.severity,
        title: `[聚合] ${alert.title} (${alert.count} 次)`,
        message: `首次发生: ${alert.firstOccurrence.toLocaleString()}\n最近发生: ${alert.lastOccurrence.toLocaleString()}\n影响服务器: ${alert.serverIds.length} 台\n优先级: ${alert.priority}/100\n\n${alert.message}`,
        metadata: { aggregatedId: alert.id, fingerprint: alert.fingerprint },
      });
    } else {
      await notificationService.sendAlert({
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        metadata: { aggregatedId: alert.id },
      });
    }
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    const now = Date.now();
    const threshold = this.config.autoResolveThreshold * 1000;

    // 自动解决长时间未更新的告警
    for (const [id, alert] of this.aggregatedAlerts) {
      if (alert.status === 'ACTIVE' && now - alert.lastOccurrence.getTime() > threshold) {
        alert.status = 'RESOLVED';
        console.log(`[AlertDedup] Auto-resolved alert ${id}`);
      }
    }

    // 清理过期的原始告警
    for (const [id, alert] of this.rawAlerts) {
      if (now - alert.timestamp.getTime() > 24 * 60 * 60 * 1000) {  // 24 小时
        this.rawAlerts.delete(id);
      }
    }

    // 清理过期的静默规则
    for (const [id, rule] of this.silenceRules) {
      if (rule.endTime && now > rule.endTime.getTime()) {
        this.silenceRules.delete(id);
        console.log(`[AlertDedup] Expired silence rule ${id} removed`);
      }
    }
  }

  // ============================================
  // 公共 API
  // ============================================

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): AggregatedAlert[] {
    return Array.from(this.aggregatedAlerts.values())
      .filter(a => a.status === 'ACTIVE')
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取所有告警
   */
  getAllAlerts(): AggregatedAlert[] {
    return Array.from(this.aggregatedAlerts.values());
  }

  /**
   * 获取告警分组
   */
  getAlertGroups(): AlertGroup[] {
    return Array.from(this.alertGroups.values());
  }

  /**
   * 确认告警
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.aggregatedAlerts.get(alertId);
    if (alert) {
      alert.status = 'ACKNOWLEDGED';
      console.log(`[AlertDedup] Alert ${alertId} acknowledged`);
      return true;
    }
    return false;
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.aggregatedAlerts.get(alertId);
    if (alert) {
      alert.status = 'RESOLVED';
      console.log(`[AlertDedup] Alert ${alertId} resolved`);
      return true;
    }
    return false;
  }

  /**
   * 创建静默规则
   */
  createSilenceRule(rule: Partial<SilenceRule>): SilenceRule {
    const newRule: SilenceRule = {
      id: `silence_${Date.now()}`,
      name: rule.name || 'Unnamed Silence',
      enabled: rule.enabled ?? true,
      matchers: rule.matchers || [],
      duration: rule.duration || 3600,
      startTime: rule.startTime,
      endTime: rule.endTime || new Date(Date.now() + (rule.duration || 3600) * 1000),
      createdBy: rule.createdBy || 'system',
      createdAt: new Date(),
      reason: rule.reason || '',
    };

    this.silenceRules.set(newRule.id, newRule);
    console.log(`[AlertDedup] Created silence rule ${newRule.id}`);
    return newRule;
  }

  /**
   * 删除静默规则
   */
  deleteSilenceRule(id: string): boolean {
    const deleted = this.silenceRules.delete(id);
    if (deleted) {
      console.log(`[AlertDedup] Deleted silence rule ${id}`);
    }
    return deleted;
  }

  /**
   * 获取静默规则
   */
  getSilenceRules(): SilenceRule[] {
    return Array.from(this.silenceRules.values());
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalAlerts: number;
    activeAlerts: number;
    acknowledgedAlerts: number;
    resolvedAlerts: number;
    silencedAlerts: number;
    alertGroups: number;
    activeSilences: number;
    deduplicationRate: number;
  } {
    const alerts = Array.from(this.aggregatedAlerts.values());
    const totalRaw = this.rawAlerts.size;
    
    return {
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => a.status === 'ACTIVE').length,
      acknowledgedAlerts: alerts.filter(a => a.status === 'ACKNOWLEDGED').length,
      resolvedAlerts: alerts.filter(a => a.status === 'RESOLVED').length,
      silencedAlerts: alerts.filter(a => a.status === 'SILENCED').length,
      alertGroups: this.alertGroups.size,
      activeSilences: Array.from(this.silenceRules.values()).filter(r => r.enabled).length,
      deduplicationRate: totalRaw > 0 ? (totalRaw - alerts.length) / totalRaw : 0,
    };
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    isRunning: boolean;
    config: DeduplicationConfig;
    statistics: ReturnType<AlertDeduplicationService['getStatistics']>;
  } {
    return {
      isRunning: this.cleanupInterval !== null,
      config: this.config,
      statistics: this.getStatistics(),
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[AlertDedup] Config updated');
  }
}

// 导出单例
export const alertDeduplicationService = new AlertDeduplicationService();
export default alertDeduplicationService;