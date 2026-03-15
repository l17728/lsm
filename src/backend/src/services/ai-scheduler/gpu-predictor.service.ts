/**
 * AI 智能调度系统 - GPU 预测性分配算法
 * 基于机器学习的 GPU 资源预测和智能分配服务
 * 
 * @version 3.1.0
 * @author AI Backend Developer
 */

import prisma from '../../utils/prisma';
import { server_status as ServerStatus, task_status as TaskStatus, task_priority as TaskPriority } from '@prisma/client';

// ============================================
// 类型定义
// ============================================

export interface GpuUsagePattern {
  gpuId: string;
  model: string;
  memory: number;
  avgUtilization: number;
  peakUtilization: number;
  avgTaskDuration: number;
  preferredTaskTypes: string[];
  reliabilityScore: number;
  energyEfficiency: number;
}

export interface GpuPrediction {
  gpuId: string;
  serverId: string;
  serverName: string;
  model: string;
  memory: number;
  predictedAvailability: Date;
  predictedDuration: number;
  suitabilityScore: number;
  confidence: number;
  reasons: string[];
}

export interface GpuAllocationRequest {
  taskId: string;
  userId: string;
  minMemory?: number;
  preferredModel?: string;
  maxWaitTime?: number; // 最大可等待时间（分钟）
  priority: number;
  taskType?: string;
}

export interface GpuAllocationResult {
  success: boolean;
  allocation?: {
    gpuId: string;
    serverId: string;
    serverName: string;
    gpuModel: string;
    gpuMemory: number;
    deviceId?: string;
    predictedStartTime: Date;
    predictedEndTime: Date;
  };
  alternatives?: GpuPrediction[];
  queuePosition?: number;
  estimatedWaitTime?: number;
  reasoning: string[];
}

export interface HistoricalUsage {
  timestamp: Date;
  utilization: number;
  memoryUsed: number;
  temperature: number;
  powerDraw: number;
}

// ============================================
// 配置参数
// ============================================

const PREDICTION_CONFIG = {
  // 时间窗口（分钟）
  shortTermWindow: 30,
  mediumTermWindow: 120,
  longTermWindow: 480,
  // 预测阈值
  utilizationThreshold: 0.8,
  memoryThreshold: 0.9,
  // 最小样本数
  minSamplesForPrediction: 10,
  // 权重配置
  weights: {
    memoryFit: 0.30,
    modelMatch: 0.20,
    availability: 0.25,
    performance: 0.15,
    energy: 0.10,
  },
};

// GPU 模型性能数据库（可从配置文件加载）
const GPU_MODEL_SPECS: Record<string, {
  tflops: number;
  memoryBandwidth: number;
  powerTdp: number;
  reliability: number;
  efficiency: number;
}> = {
  'A100': { tflops: 312, memoryBandwidth: 2039, powerTdp: 400, reliability: 0.99, efficiency: 0.95 },
  'A100-80GB': { tflops: 312, memoryBandwidth: 2039, powerTdp: 400, reliability: 0.99, efficiency: 0.95 },
  'H100': { tflops: 989, memoryBandwidth: 3352, powerTdp: 700, reliability: 0.995, efficiency: 0.97 },
  'V100': { tflops: 125, memoryBandwidth: 900, powerTdp: 300, reliability: 0.97, efficiency: 0.88 },
  'RTX4090': { tflops: 165, memoryBandwidth: 1008, powerTdp: 450, reliability: 0.95, efficiency: 0.85 },
  'RTX3090': { tflops: 71, memoryBandwidth: 936, powerTdp: 350, reliability: 0.94, efficiency: 0.80 },
  'A6000': { tflops: 38, memoryBandwidth: 768, powerTdp: 300, reliability: 0.96, efficiency: 0.82 },
};

// ============================================
// GPU 预测器服务类
// ============================================

export class GpuPredictorService {
  private usageHistory: Map<string, HistoricalUsage[]> = new Map();
  private patternCache: Map<string, GpuUsagePattern> = new Map();
  private initialized: boolean = false;

  constructor() {}

  /**
   * 初始化服务 - 加载历史数据
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 加载 GPU 使用历史
      await this.loadUsageHistory();
      
      // 分析使用模式
      await this.analyzePatterns();
      
      this.initialized = true;
      console.log('[GpuPredictor] Initialized with', this.patternCache.size, 'GPU patterns');
    } catch (error) {
      console.error('[GpuPredictor] Initialization error:', error);
      this.initialized = true;
    }
  }

  /**
   * 加载 GPU 使用历史数据
   */
  private async loadUsageHistory(): Promise<void> {
    const gpus = await prisma.gpu.findMany({
      include: {
        allocations: {
          where: {
            releasedAt: { not: null },
          },
          orderBy: { allocatedAt: 'desc' },
          take: 50,
        },
      },
    });

    for (const gpu of gpus) {
      const history: HistoricalUsage[] = gpu.allocations.map((alloc: any) => ({
        timestamp: alloc.allocatedAt!,
        utilization: 0.8, // 假设值
        memoryUsed: gpu.memory * 0.7,
        temperature: 70,
        powerDraw: 250,
      }));

      this.usageHistory.set(gpu.id, history);
    }
  }

  /**
   * 分析 GPU 使用模式
   */
  private async analyzePatterns(): Promise<void> {
    const gpus = await prisma.gpu.findMany({
      include: {
        server: true,
        allocations: true,
      },
    });

    for (const gpu of gpus) {
      const pattern = await this.calculateGpuPattern(gpu);
      this.patternCache.set(gpu.id, pattern);
    }
  }

  /**
   * 计算单个 GPU 的使用模式
   */
  private async calculateGpuPattern(gpu: any): Promise<GpuUsagePattern> {
    const allocations = gpu.allocations || [];
    
    // 计算平均利用率
    const utilizations = allocations.map(() => 0.75); // 模拟值
    const avgUtilization = utilizations.length > 0
      ? utilizations.reduce((a: number, b: number) => a + b, 0) / utilizations.length
      : 0.5;

    // 计算峰值利用率
    const peakUtilization = utilizations.length > 0
      ? Math.max(...utilizations)
      : 0.8;

    // 计算平均任务时长
    const durations = allocations
      .filter((a: any) => a.releasedAt && a.allocatedAt)
      .map((a: any) => (a.releasedAt.getTime() - a.allocatedAt.getTime()) / 60000);
    const avgTaskDuration = durations.length > 0
      ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length
      : 60;

    // 分析任务类型偏好
    const taskTypes: string[] = [];
    for (const alloc of allocations) {
      if (alloc.taskId) {
        const task = await prisma.task.findUnique({ where: { id: alloc.taskId } });
        if (task) {
          const type = this.categorizeTask(task.name);
          if (type) taskTypes.push(type);
        }
      }
    }
    
    const taskTypeCounts: Record<string, number> = {};
    for (const type of taskTypes) {
      taskTypeCounts[type] = (taskTypeCounts[type] || 0) + 1;
    }
    
    const preferredTaskTypes = Object.entries(taskTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    // 获取模型规格
    const modelSpecs = GPU_MODEL_SPECS[gpu.model] || {
      tflops: 100,
      memoryBandwidth: 500,
      powerTdp: 250,
      reliability: 0.9,
      efficiency: 0.8,
    };

    // 计算可靠性得分
    const completedAllocations = allocations.filter((a: any) => a.releasedAt).length;
    const reliabilityScore = allocations.length > 0
      ? completedAllocations / allocations.length
      : modelSpecs.reliability;

    return {
      gpuId: gpu.id,
      model: gpu.model,
      memory: gpu.memory,
      avgUtilization,
      peakUtilization,
      avgTaskDuration,
      preferredTaskTypes,
      reliabilityScore: Math.max(0.5, reliabilityScore),
      energyEfficiency: modelSpecs.efficiency,
    };
  }

  /**
   * 预测性 GPU 分配 - 核心算法
   */
  async predictAndAllocate(request: GpuAllocationRequest): Promise<GpuAllocationResult> {
    await this.initialize();

    const { taskId, userId, minMemory, preferredModel, maxWaitTime = 120, priority } = request;

    // 获取任务详情
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { user: true },
    });

    if (!task) {
      return { success: false, reasoning: ['任务不存在'] };
    }

    // 构建查询条件
    const gpuWhere: {
      memory?: { gte: number };
      model?: string;
    } = {};
    if (minMemory !== undefined) {
      gpuWhere.memory = { gte: minMemory };
    }
    if (preferredModel) {
      gpuWhere.model = preferredModel;
    }

    // 获取所有 GPU 状态
    const gpus = await prisma.gpu.findMany({
      where: gpuWhere,
      include: {
        server: true,
      },
    });

    // 过滤出在线服务器上的 GPU
    const availableGpus = gpus.filter(gpu => gpu.server && gpu.server.status === ServerStatus.ONLINE);

    if (availableGpus.length === 0) {
      return { success: false, reasoning: ['没有找到符合要求的 GPU'] };
    }

    // 分析每个 GPU 的预测情况
    const predictions: GpuPrediction[] = [];

    for (const gpu of availableGpus) {
      if (!gpu.server) continue;
      
      const prediction = await this.predictGpuAvailability(gpu);
      predictions.push(prediction);
    }

    // 按可用性排序
    predictions.sort((a, b) => {
      // 先按可用时间排序
      const timeDiff = a.predictedAvailability.getTime() - b.predictedAvailability.getTime();
      if (timeDiff !== 0) return timeDiff;
      
      // 再按适合度排序
      return b.suitabilityScore - a.suitabilityScore;
    });

    // 尝试立即分配 - 找未分配的 GPU
    const immediateAvailable = predictions.filter(
      p => {
        const gpu = availableGpus.find(g => g.id === p.gpuId);
        return gpu && !gpu.allocated && p.suitabilityScore > 0.6;
      }
    );

    if (immediateAvailable.length > 0) {
      // 选择最适合的 GPU
      const best = immediateAvailable.reduce((best, current) =>
        current.suitabilityScore > best.suitabilityScore ? current : best
      );

      const gpu = availableGpus.find(g => g.id === best.gpuId);

      if (gpu && gpu.server) {
        // 执行分配
        const allocation = await this.executeAllocation(gpu, task, userId);
        
        if (allocation) {
          return {
            success: true,
            allocation: {
              gpuId: gpu.id,
              serverId: gpu.serverId,
              serverName: gpu.server.name,
              gpuModel: gpu.model,
              gpuMemory: gpu.memory,
              predictedStartTime: new Date(),
              predictedEndTime: new Date(Date.now() + best.predictedDuration * 60000),
            },
            alternatives: predictions.filter(p => p.gpuId !== gpu.id).slice(0, 3),
            reasoning: [...best.reasons, '已成功分配 GPU 资源'],
          };
        }
      }
    }

    // 无法立即分配，返回预测信息
    const nearestAvailable = predictions[0];
    const estimatedWaitTime = Math.max(
      0,
      (nearestAvailable.predictedAvailability.getTime() - Date.now()) / 60000
    );

    if (estimatedWaitTime <= maxWaitTime) {
      return {
        success: false,
        alternatives: predictions.slice(0, 5),
        queuePosition: await this.getQueuePosition(priority),
        estimatedWaitTime,
        reasoning: [
          `当前无立即可用的 GPU`,
          `最近可用时间: ${nearestAvailable.predictedAvailability.toLocaleTimeString()}`,
          `预计等待: ${Math.round(estimatedWaitTime)} 分钟`,
        ],
      };
    }

    return {
      success: false,
      alternatives: predictions.slice(0, 5),
      queuePosition: await this.getQueuePosition(priority),
      estimatedWaitTime,
      reasoning: [
        `等待时间超过最大可接受时间 (${maxWaitTime} 分钟)`,
        `建议调整任务需求或等待时间`,
      ],
    };
  }

  /**
   * 预测单个 GPU 的可用时间
   */
  private async predictGpuAvailability(gpu: any): Promise<GpuPrediction> {
    const now = new Date();
    const pattern = this.patternCache.get(gpu.id) || await this.calculateGpuPattern(gpu);

    let predictedAvailability = now;
    let predictedDuration = pattern.avgTaskDuration;

    if (gpu.allocated) {
      // GPU 正在被使用，预测释放时间
      const activeAllocation = await prisma.gpuAllocation.findFirst({
        where: {
          gpuId: gpu.id,
          releasedAt: null,
        },
        orderBy: { allocatedAt: 'desc' },
      });

      if (activeAllocation && activeAllocation.allocatedAt) {
        const elapsed = (now.getTime() - activeAllocation.allocatedAt.getTime()) / 60000;

        // 基于历史数据预测剩余时间
        const estimatedTotal = pattern.avgTaskDuration;
        const remaining = Math.max(5, estimatedTotal - elapsed);
        
        predictedAvailability = new Date(now.getTime() + remaining * 60000);
      }
    }

    // 计算适合度得分
    const suitabilityScore = this.calculateSuitabilityScore(gpu, pattern);

    // 计算置信度
    const confidence = this.calculatePredictionConfidence(gpu.id, pattern);

    // 生成原因说明
    const reasons = this.generateReasons(gpu, pattern, predictedAvailability);

    return {
      gpuId: gpu.id,
      serverId: gpu.serverId,
      serverName: gpu.server?.name || 'Unknown',
      model: gpu.model,
      memory: gpu.memory,
      predictedAvailability,
      predictedDuration,
      suitabilityScore,
      confidence,
      reasons,
    };
  }

  /**
   * 计算 GPU 适合度得分
   */
  private calculateSuitabilityScore(
    gpu: any,
    pattern: GpuUsagePattern,
    taskType?: string
  ): number {
    const weights = PREDICTION_CONFIG.weights;
    const modelSpecs = GPU_MODEL_SPECS[gpu.model] || {
      tflops: 100,
      reliability: 0.9,
      efficiency: 0.8,
    };

    // 内存适配得分
    const memoryScore = gpu.memory >= 24 ? 1 : gpu.memory >= 16 ? 0.8 : gpu.memory >= 8 ? 0.6 : 0.4;

    // 模型匹配得分
    const modelScore = modelSpecs.tflops / 1000;

    // 可用性得分
    const availabilityScore = !gpu.allocated ? 1 : 0.5;

    // 性能得分
    const performanceScore = pattern.reliabilityScore;

    // 能效得分
    const energyScore = pattern.energyEfficiency;

    // 任务类型匹配加分
    let taskTypeBonus = 0;
    if (taskType && pattern.preferredTaskTypes.includes(taskType)) {
      taskTypeBonus = 0.1;
    }

    const score = (
      memoryScore * weights.memoryFit +
      modelScore * weights.modelMatch +
      availabilityScore * weights.availability +
      performanceScore * weights.performance +
      energyScore * weights.energy +
      taskTypeBonus
    );

    return Math.min(1, score);
  }

  /**
   * 计算预测置信度
   */
  private calculatePredictionConfidence(gpuId: string, pattern: GpuUsagePattern): number {
    const history = this.usageHistory.get(gpuId) || [];
    
    // 样本数量影响
    const sampleScore = Math.min(1, history.length / PREDICTION_CONFIG.minSamplesForPrediction);
    
    // 历史可靠性影响
    const reliabilityScore = pattern.reliabilityScore;
    
    // 模式一致性影响
    const consistencyScore = pattern.avgUtilization > 0.3 && pattern.avgUtilization < 0.9 ? 1 : 0.8;

    return (sampleScore * 0.4 + reliabilityScore * 0.4 + consistencyScore * 0.2);
  }

  /**
   * 执行 GPU 分配
   */
  private async executeAllocation(
    gpu: any,
    task: any,
    userId: string
  ): Promise<boolean> {
    try {
      // 创建分配记录
      await prisma.gpuAllocation.create({
        data: {
          userId,
          gpuId: gpu.id,
          taskId: task.id,
          allocatedAt: new Date(),
        },
      });

      // 更新 GPU 状态
      await prisma.gpu.update({
        where: { id: gpu.id },
        data: { allocated: true },
      });

      // 更新任务状态
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      return true;
    } catch (error) {
      console.error('[GpuPredictor] Allocation error:', error);
      return false;
    }
  }

  /**
   * 将数字优先级转换为枚举值
   * 映射规则: 1-2 -> LOW, 3-4 -> MEDIUM, 5-6 -> HIGH, 7+ -> CRITICAL
   */
  private priorityNumberToEnum(priority: number): TaskPriority {
    if (priority >= 7) return TaskPriority.CRITICAL;
    if (priority >= 5) return TaskPriority.HIGH;
    if (priority >= 3) return TaskPriority.MEDIUM;
    return TaskPriority.LOW;
  }

  /**
   * 获取队列位置
   */
  private async getQueuePosition(priority: number): Promise<number> {
    const priorityEnum = this.priorityNumberToEnum(priority);
    
    // 定义优先级排序映射（用于比较）
    const priorityOrder: Record<TaskPriority, number> = {
      [TaskPriority.CRITICAL]: 4,
      [TaskPriority.HIGH]: 3,
      [TaskPriority.MEDIUM]: 2,
      [TaskPriority.LOW]: 1,
    };
    
    const currentPriorityOrder = priorityOrder[priorityEnum];
    
    // 获取所有待处理任务
    const pendingTasks = await prisma.task.findMany({
      where: {
        status: TaskStatus.PENDING,
      },
      select: {
        priority: true,
      },
    });
    
    // 计算优先级 >= 当前的任务数量
    const higherPriorityCount = pendingTasks.filter(
      task => priorityOrder[task.priority] >= currentPriorityOrder
    ).length;
    
    return higherPriorityCount + 1;
  }

  /**
   * 批量预测 GPU 需求
   */
  async predictBatchRequirements(
    taskIds: string[]
  ): Promise<Map<string, GpuPrediction[]>> {
    await this.initialize();

    const results = new Map<string, GpuPrediction[]>();

    for (const taskId of taskIds) {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) continue;

      const taskType = this.categorizeTask(task.name);
      
      const gpus = await prisma.gpu.findMany({
        include: { server: true },
      });

      const predictions: GpuPrediction[] = [];
      for (const gpu of gpus) {
        if (!gpu.server || gpu.server.status !== ServerStatus.ONLINE) continue;
        const prediction = await this.predictGpuAvailability(gpu);
        predictions.push(prediction);
      }

      predictions.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
      results.set(taskId, predictions.slice(0, 5));
    }

    return results;
  }

  /**
   * 智能释放预测 - 预测哪些 GPU 即将释放
   */
  async predictReleasingGpus(withinMinutes: number = 30): Promise<GpuPrediction[]> {
    await this.initialize();

    const busyGpus = await prisma.gpu.findMany({
      where: { allocated: true },
      include: {
        server: true,
      },
    });

    const predictions: GpuPrediction[] = [];
    const threshold = new Date(Date.now() + withinMinutes * 60000);

    for (const gpu of busyGpus) {
      if (!gpu.server) continue;

      const pattern = this.patternCache.get(gpu.id) || await this.calculateGpuPattern(gpu);
      
      // 获取当前活跃分配
      const activeAllocation = await prisma.gpuAllocation.findFirst({
        where: {
          gpuId: gpu.id,
          releasedAt: null,
        },
        orderBy: { allocatedAt: 'desc' },
      });

      if (!activeAllocation || !activeAllocation.allocatedAt) continue;

      const elapsed = (Date.now() - activeAllocation.allocatedAt.getTime()) / 60000;
      const remaining = Math.max(0, pattern.avgTaskDuration - elapsed);

      if (remaining <= withinMinutes) {
        predictions.push({
          gpuId: gpu.id,
          serverId: gpu.serverId,
          serverName: gpu.server.name,
          model: gpu.model,
          memory: gpu.memory,
          predictedAvailability: new Date(Date.now() + remaining * 60000),
          predictedDuration: remaining,
          suitabilityScore: pattern.reliabilityScore,
          confidence: 0.7,
          reasons: [`当前任务预计 ${Math.round(remaining)} 分钟后完成`],
        });
      }
    }

    return predictions.sort(
      (a, b) => a.predictedAvailability.getTime() - b.predictedAvailability.getTime()
    );
  }

  /**
   * 更新学习模型 - 根据实际使用情况调整
   */
  async updateFromUsage(
    gpuId: string,
    actualDuration: number,
    success: boolean
  ): Promise<void> {
    const pattern = this.patternCache.get(gpuId);
    if (!pattern) return;

    // 使用指数移动平均更新平均时长
    const alpha = 0.2;
    pattern.avgTaskDuration = alpha * actualDuration + (1 - alpha) * pattern.avgTaskDuration;

    // 更新可靠性得分
    if (success) {
      pattern.reliabilityScore = Math.min(1, pattern.reliabilityScore + 0.01);
    } else {
      pattern.reliabilityScore = Math.max(0.5, pattern.reliabilityScore - 0.05);
    }

    this.patternCache.set(gpuId, pattern);
  }

  /**
   * 获取 GPU 使用模式统计
   */
  getGpuPatterns(): GpuUsagePattern[] {
    return Array.from(this.patternCache.values());
  }

  // ============================================
  // 辅助方法
  // ============================================

  private categorizeTask(name: string): string | null {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('train') || lowerName.includes('训练')) {
      return 'training';
    }
    if (lowerName.includes('inference') || lowerName.includes('推理')) {
      return 'inference';
    }
    if (lowerName.includes('fine-tune') || lowerName.includes('微调')) {
      return 'fine-tuning';
    }
    if (lowerName.includes('batch') || lowerName.includes('批量')) {
      return 'batch';
    }
    if (lowerName.includes('test') || lowerName.includes('测试')) {
      return 'testing';
    }
    
    return null;
  }

  private generateReasons(
    gpu: any,
    pattern: GpuUsagePattern,
    predictedAvailability: Date
  ): string[] {
    const reasons: string[] = [];

    // GPU 模型优势
    if (gpu.model.includes('H100') || gpu.model.includes('A100')) {
      reasons.push(`高性能 ${gpu.model}，适合大规模计算`);
    }

    // 内存优势
    if (gpu.memory >= 40) {
      reasons.push(`大显存 ${gpu.memory}GB，适合大模型任务`);
    }

    // 可靠性
    if (pattern.reliabilityScore > 0.95) {
      reasons.push(`高可靠性 (${(pattern.reliabilityScore * 100).toFixed(0)}%)`);
    }

    // 可用性
    if (!gpu.allocated) {
      reasons.push('当前可用');
    } else {
      const waitMinutes = Math.round(
        (predictedAvailability.getTime() - Date.now()) / 60000
      );
      reasons.push(`预计 ${waitMinutes} 分钟后可用`);
    }

    // 任务匹配
    if (pattern.preferredTaskTypes.length > 0) {
      reasons.push(`擅长任务类型: ${pattern.preferredTaskTypes.join(', ')}`);
    }

    return reasons.length > 0 ? reasons : ['综合评估'];
  }
}

// 导出单例
export const gpuPredictorService = new GpuPredictorService();