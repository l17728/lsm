/**
 * Auto-Scaling Service
 * v3.1.0 - 自动扩缩容策略服务
 * 
 * 功能：
 * - 基于资源使用率自动扩缩容
 * - 支持预测性扩容（基于历史趋势）
 * - 多维度扩缩容策略（CPU/内存/GPU/任务队列）
 * - 安全边界保护（最小/最大实例数）
 */

import { PrismaClient } from '@prisma/client';
import { monitoringService } from '../monitoring.service';
import { notificationService, AlertSeverity, AlertType } from '../notification.service';

const prisma = new PrismaClient();

// 扩缩容策略类型
export enum ScalingStrategyType {
  REACTIVE = 'REACTIVE',       // 响应式扩缩容
  PREDICTIVE = 'PREDICTIVE',   // 预测性扩缩容
  SCHEDULED = 'SCHEDULED',     // 定时扩缩容
  HYBRID = 'HYBRID',           // 混合策略
}

// 扩缩容指标类型
export enum ScalingMetricType {
  CPU_USAGE = 'CPU_USAGE',
  MEMORY_USAGE = 'MEMORY_USAGE',
  GPU_USAGE = 'GPU_USAGE',
  TASK_QUEUE_LENGTH = 'TASK_QUEUE_LENGTH',
  REQUEST_RATE = 'REQUEST_RATE',
  CUSTOM = 'CUSTOM',
}

// 扩缩容动作
export enum ScalingAction {
  SCALE_UP = 'SCALE_UP',
  SCALE_DOWN = 'SCALE_DOWN',
  NO_ACTION = 'NO_ACTION',
}

// 扩缩容策略配置
export interface ScalingPolicy {
  id: string;
  name: string;
  enabled: boolean;
  strategyType: ScalingStrategyType;
  metricType: ScalingMetricType;
  
  // 阈值配置
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  
  // 扩缩容步长
  scaleUpStep: number;
  scaleDownStep: number;
  
  // 安全边界
  minInstances: number;
  maxInstances: number;
  
  // 冷却时间（秒）
  cooldownPeriod: number;
  
  // 预测性扩缩容参数
  predictiveConfig?: {
    lookbackMinutes: number;
    forecastMinutes: number;
    confidenceThreshold: number;
  };
  
  // 定时扩缩容参数
  scheduleConfig?: {
    timezone: string;
    schedules: Array<{
      cron: string;
      targetInstances: number;
    }>;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

// 扩缩容事件记录
export interface ScalingEvent {
  id: string;
  policyId: string;
  action: ScalingAction;
  metricValue: number;
  threshold: number;
  fromInstances: number;
  toInstances: number;
  reason: string;
  success: boolean;
  executedAt: Date;
}

// 扩缩容状态
export interface ScalingState {
  currentInstances: number;
  pendingScaling: boolean;
  lastScalingAction: Date | null;
  lastMetricValue: number;
  consecutiveHighMetrics: number;
  consecutiveLowMetrics: number;
}

// 默认扩缩容策略
const DEFAULT_POLICIES: ScalingPolicy[] = [
  {
    id: 'policy_cpu_reactive',
    name: 'CPU 响应式扩缩容',
    enabled: true,
    strategyType: ScalingStrategyType.REACTIVE,
    metricType: ScalingMetricType.CPU_USAGE,
    scaleUpThreshold: 80,
    scaleDownThreshold: 30,
    scaleUpStep: 1,
    scaleDownStep: 1,
    minInstances: 1,
    maxInstances: 10,
    cooldownPeriod: 300, // 5 分钟
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'policy_memory_reactive',
    name: '内存响应式扩缩容',
    enabled: true,
    strategyType: ScalingStrategyType.REACTIVE,
    metricType: ScalingMetricType.MEMORY_USAGE,
    scaleUpThreshold: 85,
    scaleDownThreshold: 40,
    scaleUpStep: 1,
    scaleDownStep: 1,
    minInstances: 1,
    maxInstances: 10,
    cooldownPeriod: 300,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'policy_task_queue',
    name: '任务队列扩缩容',
    enabled: true,
    strategyType: ScalingStrategyType.REACTIVE,
    metricType: ScalingMetricType.TASK_QUEUE_LENGTH,
    scaleUpThreshold: 50,  // 队列深度 > 50
    scaleDownThreshold: 10,
    scaleUpStep: 2,
    scaleDownStep: 1,
    minInstances: 2,
    maxInstances: 20,
    cooldownPeriod: 180, // 3 分钟
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'policy_predictive_cpu',
    name: 'CPU 预测性扩缩容',
    enabled: true,
    strategyType: ScalingStrategyType.PREDICTIVE,
    metricType: ScalingMetricType.CPU_USAGE,
    scaleUpThreshold: 75,
    scaleDownThreshold: 25,
    scaleUpStep: 1,
    scaleDownStep: 1,
    minInstances: 2,
    maxInstances: 15,
    cooldownPeriod: 240,
    predictiveConfig: {
      lookbackMinutes: 60,
      forecastMinutes: 15,
      confidenceThreshold: 0.8,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'policy_scheduled',
    name: '工作时间定时扩缩容',
    enabled: true,
    strategyType: ScalingStrategyType.SCHEDULED,
    metricType: ScalingMetricType.CPU_USAGE,
    scaleUpThreshold: 0,
    scaleDownThreshold: 0,
    scaleUpStep: 0,
    scaleDownStep: 0,
    minInstances: 1,
    maxInstances: 10,
    cooldownPeriod: 60,
    scheduleConfig: {
      timezone: 'Asia/Shanghai',
      schedules: [
        { cron: '0 9 * * 1-5', targetInstances: 5 },   // 工作日 9:00 扩容到 5 个
        { cron: '0 18 * * 1-5', targetInstances: 2 },  // 工作日 18:00 缩容到 2 个
      ],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * 自动扩缩容服务
 */
export class AutoScalingService {
  private policies: Map<string, ScalingPolicy> = new Map();
  private states: Map<string, ScalingState> = new Map();
  private events: ScalingEvent[] = [];
  private lastEvaluation: Date | null = null;
  private evaluationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializePolicies();
  }

  /**
   * 初始化策略
   */
  private initializePolicies(): void {
    DEFAULT_POLICIES.forEach(policy => {
      this.policies.set(policy.id, policy);
      this.states.set(policy.id, {
        currentInstances: policy.minInstances,
        pendingScaling: false,
        lastScalingAction: null,
        lastMetricValue: 0,
        consecutiveHighMetrics: 0,
        consecutiveLowMetrics: 0,
      });
    });

    console.log(`[AutoScaling] Initialized ${DEFAULT_POLICIES.length} scaling policies`);
  }

  /**
   * 启动自动评估循环
   */
  startAutoEvaluation(intervalSeconds: number = 60): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    this.evaluationInterval = setInterval(() => {
      this.evaluateAllPolicies().catch(err => {
        console.error('[AutoScaling] Evaluation error:', err);
      });
    }, intervalSeconds * 1000);

    console.log(`[AutoScaling] Started auto-evaluation with ${intervalSeconds}s interval`);
  }

  /**
   * 停止自动评估
   */
  stopAutoEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      console.log('[AutoScaling] Stopped auto-evaluation');
    }
  }

  /**
   * 评估所有策略
   */
  async evaluateAllPolicies(): Promise<void> {
    this.lastEvaluation = new Date();

    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      try {
        await this.evaluatePolicy(policy);
      } catch (error) {
        console.error(`[AutoScaling] Failed to evaluate policy ${policy.id}:`, error);
      }
    }
  }

  /**
   * 评估单个策略
   */
  async evaluatePolicy(policy: ScalingPolicy): Promise<ScalingAction> {
    const state = this.states.get(policy.id);
    if (!state) return ScalingAction.NO_ACTION;

    // 检查冷却时间
    if (state.lastScalingAction) {
      const cooldownMs = policy.cooldownPeriod * 1000;
      const elapsed = Date.now() - state.lastScalingAction.getTime();
      if (elapsed < cooldownMs) {
        console.log(`[AutoScaling] Policy ${policy.id} in cooldown (${Math.round((cooldownMs - elapsed) / 1000)}s remaining)`);
        return ScalingAction.NO_ACTION;
      }
    }

    // 获取当前指标值
    const metricValue = await this.getMetricValue(policy.metricType);
    state.lastMetricValue = metricValue;

    // 根据策略类型决定动作
    let action: ScalingAction;
    switch (policy.strategyType) {
      case ScalingStrategyType.REACTIVE:
        action = this.evaluateReactive(policy, state, metricValue);
        break;
      case ScalingStrategyType.PREDICTIVE:
        action = await this.evaluatePredictive(policy, state, metricValue);
        break;
      case ScalingStrategyType.SCHEDULED:
        action = this.evaluateScheduled(policy, state);
        break;
      case ScalingStrategyType.HYBRID:
        action = await this.evaluateHybrid(policy, state, metricValue);
        break;
      default:
        action = ScalingAction.NO_ACTION;
    }

    // 执行扩缩容
    if (action !== ScalingAction.NO_ACTION) {
      await this.executeScaling(policy, state, action);
    }

    return action;
  }

  /**
   * 响应式扩缩容评估
   */
  private evaluateReactive(
    policy: ScalingPolicy,
    state: ScalingState,
    metricValue: number
  ): ScalingAction {
    // 更新连续计数
    if (metricValue > policy.scaleUpThreshold) {
      state.consecutiveHighMetrics++;
      state.consecutiveLowMetrics = 0;
    } else if (metricValue < policy.scaleDownThreshold) {
      state.consecutiveLowMetrics++;
      state.consecutiveHighMetrics = 0;
    } else {
      state.consecutiveHighMetrics = 0;
      state.consecutiveLowMetrics = 0;
    }

    // 需要连续 3 次确认才触发动作（防止抖动）
    if (state.consecutiveHighMetrics >= 3) {
      if (state.currentInstances < policy.maxInstances) {
        return ScalingAction.SCALE_UP;
      }
    }

    if (state.consecutiveLowMetrics >= 5) {  // 缩容更保守
      if (state.currentInstances > policy.minInstances) {
        return ScalingAction.SCALE_DOWN;
      }
    }

    return ScalingAction.NO_ACTION;
  }

  /**
   * 预测性扩缩容评估
   */
  private async evaluatePredictive(
    policy: ScalingPolicy,
    state: ScalingState,
    currentValue: number
  ): Promise<ScalingAction> {
    if (!policy.predictiveConfig) {
      return this.evaluateReactive(policy, state, currentValue);
    }

    // 获取历史数据
    const historicalData = await this.getHistoricalMetrics(
      policy.metricType,
      policy.predictiveConfig.lookbackMinutes
    );

    // 简化的预测算法：线性趋势预测
    const prediction = this.predictFutureValue(
      historicalData,
      policy.predictiveConfig.forecastMinutes
    );

    console.log(`[AutoScaling] Predictive analysis: current=${currentValue.toFixed(2)}, predicted=${prediction.toFixed(2)}`);

    // 基于预测值决策
    if (prediction > policy.scaleUpThreshold) {
      if (state.currentInstances < policy.maxInstances) {
        return ScalingAction.SCALE_UP;
      }
    }

    if (prediction < policy.scaleDownThreshold) {
      if (state.currentInstances > policy.minInstances) {
        return ScalingAction.SCALE_DOWN;
      }
    }

    return ScalingAction.NO_ACTION;
  }

  /**
   * 定时扩缩容评估
   */
  private evaluateScheduled(
    policy: ScalingPolicy,
    state: ScalingState
  ): ScalingAction {
    if (!policy.scheduleConfig) {
      return ScalingAction.NO_ACTION;
    }

    // 检查当前是否匹配任何定时规则
    const now = new Date();
    const currentTime = now.getTime();

    for (const schedule of policy.scheduleConfig.schedules) {
      if (this.matchesCron(schedule.cron, now)) {
        const target = schedule.targetInstances;
        if (target > state.currentInstances) {
          return ScalingAction.SCALE_UP;
        } else if (target < state.currentInstances) {
          return ScalingAction.SCALE_DOWN;
        }
      }
    }

    return ScalingAction.NO_ACTION;
  }

  /**
   * 混合策略评估
   */
  private async evaluateHybrid(
    policy: ScalingPolicy,
    state: ScalingState,
    metricValue: number
  ): Promise<ScalingAction> {
    // 先尝试预测性
    const predictiveAction = await this.evaluatePredictive(policy, state, metricValue);
    
    // 如果预测性建议扩容，直接采纳
    if (predictiveAction === ScalingAction.SCALE_UP) {
      return predictiveAction;
    }

    // 否则使用响应式
    return this.evaluateReactive(policy, state, metricValue);
  }

  /**
   * 获取当前指标值
   */
  private async getMetricValue(metricType: ScalingMetricType): Promise<number> {
    try {
      const stats = await monitoringService.getClusterStats();

      switch (metricType) {
        case ScalingMetricType.CPU_USAGE:
          return stats.usage.avgCpuUsage;
        case ScalingMetricType.MEMORY_USAGE:
          return stats.usage.avgMemoryUsage;
        case ScalingMetricType.GPU_USAGE:
          return stats.usage.avgGpuUsage;
        case ScalingMetricType.TASK_QUEUE_LENGTH:
          // 获取待处理任务数
          const pendingTasks = await prisma.task.count({
            where: { status: 'PENDING' },
          });
          return pendingTasks;
        case ScalingMetricType.REQUEST_RATE:
          // 从缓存或监控获取请求速率
          return 0; // 需要从监控服务获取
        default:
          return 0;
      }
    } catch (error) {
      console.error(`[AutoScaling] Failed to get metric ${metricType}:`, error);
      return 0;
    }
  }

  /**
   * 获取历史指标数据
   */
  private async getHistoricalMetrics(
    metricType: ScalingMetricType,
    lookbackMinutes: number
  ): Promise<number[]> {
    const startTime = new Date(Date.now() - lookbackMinutes * 60 * 1000);
    const endTime = new Date();

    try {
      const servers = await prisma.server.findMany({
        where: { status: 'ONLINE' },
        include: {
          metrics: {
            where: {
              recordedAt: {
                gte: startTime,
                lte: endTime,
              },
            },
            orderBy: { recordedAt: 'asc' },
          },
        },
      });

      const values: number[] = [];
      servers.forEach(server => {
        server.metrics.forEach(metric => {
          switch (metricType) {
            case ScalingMetricType.CPU_USAGE:
              values.push(Number(metric.cpuUsage));
              break;
            case ScalingMetricType.MEMORY_USAGE:
              values.push(Number(metric.memoryUsage));
              break;
            case ScalingMetricType.GPU_USAGE:
              if (metric.gpuUsage) values.push(Number(metric.gpuUsage));
              break;
          }
        });
      });

      return values;
    } catch (error) {
      console.error('[AutoScaling] Failed to get historical metrics:', error);
      return [];
    }
  }

  /**
   * 预测未来值（简化版线性回归）
   */
  private predictFutureValue(data: number[], forecastMinutes: number): number {
    if (data.length < 2) {
      return data[0] || 0;
    }

    // 简单线性趋势
    const n = data.length;
    const xMean = (n - 1) / 2;
    const yMean = data.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (data[i] - yMean);
      denominator += (i - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // 预测未来值
    const forecastIndex = n + (forecastMinutes / 5);  // 假设 5 分钟一个采样点
    const prediction = intercept + slope * forecastIndex;

    // 限制在合理范围内
    return Math.max(0, Math.min(100, prediction));
  }

  /**
   * 检查是否匹配 cron 表达式（简化版）
   */
  private matchesCron(cron: string, date: Date): boolean {
    const parts = cron.split(' ');
    if (parts.length !== 5) return false;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = {
      minute: date.getMinutes(),
      hour: date.getHours(),
      dayOfMonth: date.getDate(),
      month: date.getMonth() + 1,
      dayOfWeek: date.getDay(),
    };

    const match = (pattern: string, value: number): boolean => {
      if (pattern === '*') return true;
      return parseInt(pattern) === value;
    };

    return (
      match(minute, now.minute) &&
      match(hour, now.hour) &&
      match(dayOfMonth, now.dayOfMonth) &&
      match(month, now.month) &&
      match(dayOfWeek, now.dayOfWeek)
    );
  }

  /**
   * 执行扩缩容
   */
  private async executeScaling(
    policy: ScalingPolicy,
    state: ScalingState,
    action: ScalingAction
  ): Promise<void> {
    const fromInstances = state.currentInstances;
    let toInstances: number;

    if (action === ScalingAction.SCALE_UP) {
      toInstances = Math.min(
        state.currentInstances + policy.scaleUpStep,
        policy.maxInstances
      );
    } else {
      toInstances = Math.max(
        state.currentInstances - policy.scaleDownStep,
        policy.minInstances
      );
    }

    if (toInstances === fromInstances) {
      return;
    }

    console.log(`[AutoScaling] Executing ${action}: ${fromInstances} -> ${toInstances} instances for policy ${policy.id}`);

    // 记录事件
    const event: ScalingEvent = {
      id: `event_${Date.now()}`,
      policyId: policy.id,
      action,
      metricValue: state.lastMetricValue,
      threshold: action === ScalingAction.SCALE_UP 
        ? policy.scaleUpThreshold 
        : policy.scaleDownThreshold,
      fromInstances,
      toInstances,
      reason: `${policy.metricType} ${action === ScalingAction.SCALE_UP ? 'exceeded' : 'below'} threshold`,
      success: false,
      executedAt: new Date(),
    };

    try {
      // 模拟扩缩容操作
      // 在实际环境中，这里会调用 Kubernetes HPA 或云服务商 API
      await this.performScalingAction(policy, fromInstances, toInstances);

      // 更新状态
      state.currentInstances = toInstances;
      state.lastScalingAction = new Date();
      state.consecutiveHighMetrics = 0;
      state.consecutiveLowMetrics = 0;
      event.success = true;

      // 发送通知
      await notificationService.sendAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.INFO,
        title: `自动扩缩容: ${policy.name}`,
        message: `${action === ScalingAction.SCALE_UP ? '扩容' : '缩容'}: ${fromInstances} -> ${toInstances} 实例\n原因: ${event.reason}`,
        metadata: { policyId: policy.id, action, fromInstances, toInstances },
      });

    } catch (error) {
      console.error(`[AutoScaling] Failed to execute scaling:`, error);
      event.success = false;
    }

    this.events.push(event);
  }

  /**
   * 执行实际的扩缩容动作（模拟）
   */
  private async performScalingAction(
    policy: ScalingPolicy,
    fromInstances: number,
    toInstances: number
  ): Promise<void> {
    // 在实际环境中，这里会：
    // 1. 调用 Kubernetes API 更新 Deployment replicas
    // 2. 或调用云服务商 API（AWS ASG, GCP MIG, Azure VMSS）
    // 3. 或通过 SSH 远程控制服务器启停

    console.log(`[AutoScaling] Simulating scaling: ${fromInstances} -> ${toInstances}`);
    await new Promise(resolve => setTimeout(resolve, 100)); // 模拟延迟
  }

  // ============================================
  // 公共 API
  // ============================================

  /**
   * 获取所有策略
   */
  getPolicies(): ScalingPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * 获取策略状态
   */
  getPolicyState(policyId: string): ScalingState | undefined {
    return this.states.get(policyId);
  }

  /**
   * 添加/更新策略
   */
  upsertPolicy(policy: Partial<ScalingPolicy>): ScalingPolicy {
    const id = policy.id || `policy_${Date.now()}`;
    const existing = this.policies.get(id);

    const newPolicy: ScalingPolicy = {
      id,
      name: policy.name || 'Unnamed Policy',
      enabled: policy.enabled ?? true,
      strategyType: policy.strategyType || ScalingStrategyType.REACTIVE,
      metricType: policy.metricType || ScalingMetricType.CPU_USAGE,
      scaleUpThreshold: policy.scaleUpThreshold || 80,
      scaleDownThreshold: policy.scaleDownThreshold || 30,
      scaleUpStep: policy.scaleUpStep || 1,
      scaleDownStep: policy.scaleDownStep || 1,
      minInstances: policy.minInstances || 1,
      maxInstances: policy.maxInstances || 10,
      cooldownPeriod: policy.cooldownPeriod || 300,
      predictiveConfig: policy.predictiveConfig,
      scheduleConfig: policy.scheduleConfig,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.policies.set(id, newPolicy);

    if (!existing) {
      this.states.set(id, {
        currentInstances: newPolicy.minInstances,
        pendingScaling: false,
        lastScalingAction: null,
        lastMetricValue: 0,
        consecutiveHighMetrics: 0,
        consecutiveLowMetrics: 0,
      });
    }

    console.log(`[AutoScaling] Policy ${id} ${existing ? 'updated' : 'created'}`);
    return newPolicy;
  }

  /**
   * 删除策略
   */
  deletePolicy(id: string): boolean {
    const deleted = this.policies.delete(id);
    if (deleted) {
      this.states.delete(id);
      console.log(`[AutoScaling] Policy ${id} deleted`);
    }
    return deleted;
  }

  /**
   * 启用/禁用策略
   */
  togglePolicy(id: string, enabled: boolean): ScalingPolicy | undefined {
    const policy = this.policies.get(id);
    if (policy) {
      policy.enabled = enabled;
      policy.updatedAt = new Date();
      console.log(`[AutoScaling] Policy ${id} ${enabled ? 'enabled' : 'disabled'}`);
    }
    return policy;
  }

  /**
   * 手动触发扩缩容
   */
  async manualScale(policyId: string, targetInstances: number): Promise<ScalingEvent | null> {
    const policy = this.policies.get(policyId);
    const state = this.states.get(policyId);

    if (!policy || !state) {
      console.error(`[AutoScaling] Policy ${policyId} not found`);
      return null;
    }

    // 边界检查
    targetInstances = Math.max(policy.minInstances, Math.min(policy.maxInstances, targetInstances));

    const action = targetInstances > state.currentInstances 
      ? ScalingAction.SCALE_UP 
      : ScalingAction.SCALE_DOWN;

    const fromInstances = state.currentInstances;

    await this.executeScaling(policy, state, action);

    return this.events[this.events.length - 1] || null;
  }

  /**
   * 获取扩缩容历史
   */
  getEvents(limit: number = 100): ScalingEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    isRunning: boolean;
    lastEvaluation: Date | null;
    totalPolicies: number;
    enabledPolicies: number;
    totalEvents: number;
  } {
    return {
      isRunning: this.evaluationInterval !== null,
      lastEvaluation: this.lastEvaluation,
      totalPolicies: this.policies.size,
      enabledPolicies: Array.from(this.policies.values()).filter(p => p.enabled).length,
      totalEvents: this.events.length,
    };
  }
}

// 导出单例
export const autoScalingService = new AutoScalingService();
export default autoScalingService;