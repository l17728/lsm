/**
 * AI 智能调度系统 - ML 模型架构
 * 用于任务调度优化的机器学习模型服务
 * 
 * @version 3.1.0
 * @author AI Backend Developer
 */

import prisma from '../../utils/prisma';
import { task_priority as TaskPriority, task_status as TaskStatus, server_status as ServerStatus } from '@prisma/client';

// ============================================
// 类型定义
// ============================================

export interface TaskFeatures {
  taskId: string;
  priority: number;
  estimatedDuration: number;
  gpuMemoryRequired: number;
  cpuCoresRequired: number;
  userId: string;
  userPriority: number;
  submissionTime: Date;
  waitingTime: number;
  historicalSuccessRate: number;
  resourceUtilization: number;
}

export interface ServerFeatures {
  serverId: string;
  cpuUtilization: number;
  memoryUtilization: number;
  gpuUtilization: number;
  networkBandwidth: number;
  diskIO: number;
  loadAvg: number;
  temperature: number;
  reliabilityScore: number;
}

export interface SchedulingDecision {
  taskId: string;
  serverId: string;
  gpuId?: string;
  priority: number;
  confidence: number;
  estimatedStartTime: Date;
  estimatedCompletionTime: Date;
  reasoning: string[];
}

export interface MLPrediction {
  score: number;
  confidence: number;
  factors: Record<string, number>;
}

export interface ModelWeights {
  priority: number;
  resourceFit: number;
  loadBalance: number;
  userFairness: number;
  energyEfficiency: number;
  reliability: number;
}

// ============================================
// ML 模型配置
// ============================================

const DEFAULT_MODEL_WEIGHTS: ModelWeights = {
  priority: 0.25,
  resourceFit: 0.20,
  loadBalance: 0.20,
  userFairness: 0.15,
  energyEfficiency: 0.10,
  reliability: 0.10,
};

// 学习率
const LEARNING_RATE = 0.01;
// 历史数据窗口大小
const HISTORY_WINDOW = 100;
// 特征归一化参数
const FEATURE_BOUNDS = {
  priority: { min: 0, max: 3 },
  waitingTime: { min: 0, max: 86400 }, // 24 hours in seconds
  utilization: { min: 0, max: 100 },
  reliability: { min: 0, max: 1 },
};

// ============================================
// AI 调度器服务类
// ============================================

export class AISchedulerService {
  private weights: ModelWeights;
  private performanceHistory: Array<{
    decision: SchedulingDecision;
    actualCompletionTime: number;
    success: boolean;
  }>;
  private initialized: boolean = false;

  constructor() {
    this.weights = { ...DEFAULT_MODEL_WEIGHTS };
    this.performanceHistory = [];
  }

  /**
   * 初始化模型 - 加载历史数据进行模型预热
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 加载历史任务数据进行模型预热
      const historicalTasks = await prisma.task.findMany({
        where: {
          status: { in: [TaskStatus.COMPLETED, TaskStatus.FAILED] },
          completedAt: { not: null },
        },
        take: HISTORY_WINDOW,
        orderBy: { completedAt: 'desc' },
      });

      // 使用历史数据调整权重
      if (historicalTasks.length > 10) {
        await this.trainFromHistory(historicalTasks);
      }

      this.initialized = true;
      console.log('[AIScheduler] Model initialized with', historicalTasks.length, 'historical records');
    } catch (error) {
      console.error('[AIScheduler] Initialization error:', error);
      this.initialized = true; // 使用默认权重继续
    }
  }

  /**
   * 从历史数据训练模型
   */
  private async trainFromHistory(tasks: any[]): Promise<void> {
    let successCount = 0;

    for (const task of tasks) {
      const success = task.status === TaskStatus.COMPLETED;
      if (success) successCount++;
    }

    const n = tasks.length;
    const successRate = successCount / n;

    // 基于历史表现调整权重
    if (successRate > 0.8) {
      // 当前策略有效，略微增加资源适配权重
      this.weights.resourceFit = Math.min(0.3, this.weights.resourceFit * 1.1);
    } else if (successRate < 0.6) {
      // 需要调整策略，增加优先级权重
      this.weights.priority = Math.min(0.35, this.weights.priority * 1.2);
    }

    // 归一化权重
    this.normalizeWeights();
  }

  /**
   * 归一化权重使其总和为 1
   */
  private normalizeWeights(): void {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(this.weights) as (keyof ModelWeights)[]) {
      this.weights[key] /= sum;
    }
  }

  /**
   * 提取任务特征
   */
  async extractTaskFeatures(taskId: string): Promise<TaskFeatures | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        user: true,
      },
    });

    if (!task) return null;

    const now = new Date();
    const waitingTime = (now.getTime() - task.createdAt!.getTime()) / 1000;

    // 获取用户历史成功率
    const userTasks = await prisma.task.count({
      where: {
        userId: task.userId,
        status: TaskStatus.COMPLETED,
      },
    });
    const totalUserTasks = await prisma.task.count({
      where: { userId: task.userId },
    });
    const historicalSuccessRate = totalUserTasks > 0 ? userTasks / totalUserTasks : 0.5;

    // 估算资源需求（基于任务名称和描述的模式匹配）
    const estimatedResources = this.estimateResourceRequirements(task.name, task.description);

    return {
      taskId: task.id,
      priority: this.priorityToNumber(task.priority),
      estimatedDuration: estimatedResources.duration,
      gpuMemoryRequired: estimatedResources.gpuMemory,
      cpuCoresRequired: estimatedResources.cpuCores,
      userId: task.userId,
      userPriority: task.user?.role === 'ADMIN' ? 1 : 0.5,
      submissionTime: task.createdAt!,
      waitingTime,
      historicalSuccessRate,
      resourceUtilization: 0.5, // 默认值
    };
  }

  /**
   * 提取服务器特征
   */
  async extractServerFeatures(serverId: string): Promise<ServerFeatures | null> {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        gpus: true,
      },
    });

    if (!server) return null;

    // 获取最新的监控数据
    const latestMetric = await prisma.serverMetric.findFirst({
      where: { serverId },
      orderBy: { recordedAt: 'desc' },
    });

    // 计算可靠性得分（基于服务器状态和GPU情况）
    const reliabilityScore = server.status === ServerStatus.ONLINE ? 0.9 : 0.5;

    return {
      serverId: server.id,
      cpuUtilization: latestMetric?.cpuUsage ? Number(latestMetric.cpuUsage) : 0,
      memoryUtilization: latestMetric?.memoryUsage ? Number(latestMetric.memoryUsage) : 0,
      gpuUtilization: this.calculateGpuUtilization(server.gpus),
      networkBandwidth: Number(latestMetric?.networkIn || 0),
      diskIO: 0,
      loadAvg: 0,
      temperature: latestMetric?.temperature ? Number(latestMetric.temperature) : 50,
      reliabilityScore,
    };
  }

  /**
   * ML 预测 - 预测任务在特定服务器上的执行效果
   */
  async predictExecutionScore(
    taskFeatures: TaskFeatures,
    serverFeatures: ServerFeatures
  ): Promise<MLPrediction> {
    const factors: Record<string, number> = {};

    // 1. 优先级得分 - 高优先级任务应优先调度
    factors.priority = this.normalize(
      taskFeatures.priority,
      FEATURE_BOUNDS.priority.min,
      FEATURE_BOUNDS.priority.max
    );

    // 2. 资源适配得分 - 任务需求与服务器资源的匹配度
    factors.resourceFit = this.calculateResourceFitScore(taskFeatures, serverFeatures);

    // 3. 负载均衡得分 - 低负载服务器得分更高
    factors.loadBalance = 1 - (
      serverFeatures.cpuUtilization * 0.4 +
      serverFeatures.memoryUtilization * 0.3 +
      serverFeatures.gpuUtilization * 0.3
    ) / 100;

    // 4. 用户公平性得分 - 等待时间越长、历史成功率越低的用户应优先
    factors.userFairness = (
      this.normalize(taskFeatures.waitingTime, FEATURE_BOUNDS.waitingTime.min, FEATURE_BOUNDS.waitingTime.max) * 0.5 +
      (1 - taskFeatures.historicalSuccessRate) * 0.5
    );

    // 5. 能效得分 - 低负载和低温度的服务器更节能
    factors.energyEfficiency = (
      factors.loadBalance * 0.6 +
      (1 - serverFeatures.temperature / 100) * 0.4
    );

    // 6. 可靠性得分
    factors.reliability = serverFeatures.reliabilityScore;

    // 计算加权总分
    let score = 0;
    for (const [key, value] of Object.entries(factors)) {
      score += value * this.weights[key as keyof ModelWeights];
    }

    // 计算置信度 - 基于因素的一致性
    const variance = this.calculateVariance(Object.values(factors));
    const confidence = Math.max(0.5, 1 - variance);

    return { score, confidence, factors };
  }

  /**
   * 智能调度决策 - 为任务选择最优服务器
   */
  async makeSchedulingDecision(taskId: string): Promise<SchedulingDecision | null> {
    await this.initialize();

    // 提取任务特征
    const taskFeatures = await this.extractTaskFeatures(taskId);
    if (!taskFeatures) {
      throw new Error(`Task ${taskId} not found`);
    }

    // 获取所有在线服务器
    const servers = await prisma.server.findMany({
      where: { status: ServerStatus.ONLINE },
      include: {
        gpus: true,
      },
    });

    if (servers.length === 0) {
      return null;
    }

    // 评估每个服务器的适合度
    const evaluations = await Promise.all(
      servers.map(async (server) => {
        const serverFeatures = await this.extractServerFeatures(server.id);
        if (!serverFeatures) return null;

        const prediction = await this.predictExecutionScore(taskFeatures, serverFeatures);
        
        // 检查 GPU 需求
        let gpuId: string | undefined;
        if (taskFeatures.gpuMemoryRequired > 0 && server.gpus.length > 0) {
          const availableGpus = server.gpus.filter(g => !g.allocated && g.memory >= taskFeatures.gpuMemoryRequired);
          if (availableGpus.length > 0) {
            gpuId = availableGpus[0].id;
          }
        }

        return {
          server,
          prediction,
          gpuId,
        };
      })
    );

    // 过滤有效结果并排序
    const validEvaluations = evaluations
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => {
        // 综合得分和置信度排序
        const scoreA = a.prediction.score * a.prediction.confidence;
        const scoreB = b.prediction.score * b.prediction.confidence;
        return scoreB - scoreA;
      });

    if (validEvaluations.length === 0) {
      return null;
    }

    const best = validEvaluations[0];
    const estimatedDuration = taskFeatures.estimatedDuration * 60000; // 转换为毫秒
    const now = new Date();

    const decision: SchedulingDecision = {
      taskId,
      serverId: best.server.id,
      gpuId: best.gpuId,
      priority: taskFeatures.priority,
      confidence: best.prediction.confidence,
      estimatedStartTime: now,
      estimatedCompletionTime: new Date(now.getTime() + estimatedDuration),
      reasoning: this.generateReasoning(best.prediction.factors),
    };

    return decision;
  }

  /**
   * 批量调度优化 - 为多个待处理任务生成最优调度方案
   */
  async batchSchedule(taskIds: string[]): Promise<SchedulingDecision[]> {
    await this.initialize();

    const decisions: SchedulingDecision[] = [];
    const assignedServers = new Set<string>();
    const assignedGpus = new Set<string>();

    // 按优先级排序任务
    const tasks = await Promise.all(
      taskIds.map(async (id) => ({
        id,
        features: await this.extractTaskFeatures(id),
      }))
    );

    const sortedTasks = tasks
      .filter((t) => t.features !== null)
      .sort((a, b) => {
        if (!a.features || !b.features) return 0;
        // 高优先级 + 长等待时间优先
        const scoreA = a.features.priority * 2 + a.features.waitingTime / 3600;
        const scoreB = b.features.priority * 2 + b.features.waitingTime / 3600;
        return scoreB - scoreA;
      });

    for (const task of sortedTasks) {
      if (!task.features) continue;

      // 获取可用服务器（排除已分配的）
      const servers = await prisma.server.findMany({
        where: {
          status: ServerStatus.ONLINE,
          id: { notIn: Array.from(assignedServers) },
        },
        include: {
          gpus: {
            where: {
              allocated: false,
              id: { notIn: Array.from(assignedGpus) },
            },
          },
        },
      });

      if (servers.length === 0) continue;

      let bestDecision: SchedulingDecision | null = null;
      let bestScore = -Infinity;

      for (const server of servers) {
        const serverFeatures = await this.extractServerFeatures(server.id);
        if (!serverFeatures) continue;

        const prediction = await this.predictExecutionScore(task.features, serverFeatures);
        const compositeScore = prediction.score * prediction.confidence;

        if (compositeScore > bestScore) {
          bestScore = compositeScore;
          
          let gpuId: string | undefined;
          if (task.features.gpuMemoryRequired > 0 && server.gpus.length > 0) {
            const availableGpus = server.gpus.filter(g => !g.allocated && g.memory >= task.features.gpuMemoryRequired);
            if (availableGpus.length > 0) {
              gpuId = availableGpus[0].id;
            }
          }

          const estimatedDuration = task.features.estimatedDuration * 60000;
          const now = new Date();

          bestDecision = {
            taskId: task.id,
            serverId: server.id,
            gpuId,
            priority: task.features.priority,
            confidence: prediction.confidence,
            estimatedStartTime: now,
            estimatedCompletionTime: new Date(now.getTime() + estimatedDuration),
            reasoning: this.generateReasoning(prediction.factors),
          };
        }
      }

      if (bestDecision) {
        decisions.push(bestDecision);
        assignedServers.add(bestDecision.serverId);
        if (bestDecision.gpuId) {
          assignedGpus.add(bestDecision.gpuId);
        }
      }
    }

    return decisions;
  }

  /**
   * 在线学习 - 根据任务执行结果更新模型
   */
  async learnFromResult(
    decision: SchedulingDecision,
    actualCompletionTime: number,
    success: boolean
  ): Promise<void> {
    // 记录历史
    this.performanceHistory.push({
      decision,
      actualCompletionTime,
      success,
    });

    // 保持历史窗口大小
    if (this.performanceHistory.length > HISTORY_WINDOW) {
      this.performanceHistory.shift();
    }

    // 计算预测误差
    const predictedDuration = decision.estimatedCompletionTime.getTime() - decision.estimatedStartTime.getTime();
    const error = Math.abs(actualCompletionTime - predictedDuration) / predictedDuration;

    // 根据误差调整权重（简化版梯度下降）
    if (error > 0.3 || !success) {
      // 预测误差大或任务失败，需要调整
      const adjustment = LEARNING_RATE * error;
      
      // 增加可靠性权重，减少能效权重
      this.weights.reliability = Math.min(0.25, this.weights.reliability + adjustment);
      this.weights.energyEfficiency = Math.max(0.05, this.weights.energyEfficiency - adjustment * 0.5);
      
      this.normalizeWeights();
    }
  }

  /**
   * 获取模型状态
   */
  getModelStatus(): {
    initialized: boolean;
    weights: ModelWeights;
    historySize: number;
  } {
    return {
      initialized: this.initialized,
      weights: { ...this.weights },
      historySize: this.performanceHistory.length,
    };
  }

  // ============================================
  // 辅助方法
  // ============================================

  private priorityToNumber(priority: TaskPriority): number {
    switch (priority) {
      case TaskPriority.LOW:
        return 0;
      case TaskPriority.MEDIUM:
        return 1;
      case TaskPriority.HIGH:
        return 2;
      case TaskPriority.CRITICAL:
        return 3;
      default:
        return 1;
    }
  }

  private normalize(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  private calculateGpuUtilization(gpus: any[]): number {
    if (gpus.length === 0) return 0;
    const allocatedCount = gpus.filter(g => g.allocated).length;
    return (allocatedCount / gpus.length) * 100;
  }

  private estimateResourceRequirements(name: string, description: string | null): {
    duration: number;
    gpuMemory: number;
    cpuCores: number;
  } {
    const text = `${name} ${description || ''}`.toLowerCase();
    
    // 基于关键词估算
    let duration = 60; // 默认 60 分钟
    let gpuMemory = 0;
    let cpuCores = 2;

    if (text.includes('train') || text.includes('训练')) {
      duration = 240;
      gpuMemory = 24;
      cpuCores = 8;
    } else if (text.includes('inference') || text.includes('推理')) {
      duration = 30;
      gpuMemory = 8;
      cpuCores = 4;
    } else if (text.includes('fine-tune') || text.includes('微调')) {
      duration = 120;
      gpuMemory = 16;
      cpuCores = 8;
    } else if (text.includes('batch') || text.includes('批量')) {
      duration = 180;
      gpuMemory = 12;
      cpuCores = 4;
    }

    return { duration, gpuMemory, cpuCores };
  }

  private calculateResourceFitScore(
    task: TaskFeatures,
    server: ServerFeatures
  ): number {
    // 服务器可用资源
    const availableCpu = 100 - server.cpuUtilization;
    const availableMemory = 100 - server.memoryUtilization;
    const availableGpu = 100 - server.gpuUtilization;

    // 资源适配得分
    const cpuFit = availableCpu >= task.cpuCoresRequired * 10 ? 1 : availableCpu / (task.cpuCoresRequired * 10);
    const memoryFit = availableMemory >= 50 ? 1 : availableMemory / 50;
    const gpuFit = task.gpuMemoryRequired > 0 ? availableGpu / 100 : 1;

    return (cpuFit * 0.3 + memoryFit * 0.3 + gpuFit * 0.4);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private generateReasoning(factors: Record<string, number>): string[] {
    const reasoning: string[] = [];
    
    if (factors.priority > 0.7) {
      reasoning.push('高优先级任务，优先调度');
    }
    if (factors.resourceFit > 0.8) {
      reasoning.push('服务器资源与任务需求高度匹配');
    }
    if (factors.loadBalance > 0.7) {
      reasoning.push('服务器负载较低，适合接收新任务');
    }
    if (factors.userFairness > 0.6) {
      reasoning.push('用户等待时间较长或历史成功率较低，给予优先');
    }
    if (factors.reliability > 0.9) {
      reasoning.push('服务器可靠性高，任务成功率有保障');
    }
    
    return reasoning.length > 0 ? reasoning : ['综合评估最优选择'];
  }
}

// 导出单例
export const aiSchedulerService = new AISchedulerService();