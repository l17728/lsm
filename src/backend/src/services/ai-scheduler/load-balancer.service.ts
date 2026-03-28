/**
 * AI 智能调度系统 - 智能负载均衡核心代码
 * 基于多维指标的动态负载均衡算法
 * 
 * @version 3.1.0
 * @author AI Backend Developer
 */

import prisma from '../../utils/prisma';
import { task_status as TaskStatus, server_status as ServerStatus } from '@prisma/client';

// ============================================
// 类型定义
// ============================================

export interface ServerLoad {
  serverId: string;
  serverName: string;
  cpuLoad: number;
  memoryLoad: number;
  gpuLoad: number;
  networkLoad: number;
  diskLoad: number;
  taskCount: number;
  runningTasks: number;
  pendingTasks: number;
  loadScore: number;
  healthScore: number;
  capacity: number;
  temperature: number;
  powerConsumption: number;
}

export interface LoadBalancingDecision {
  sourceServerId?: string;
  targetServerId: string;
  taskIds: string[];
  action: 'migrate' | 'distribute' | 'consolidate' | 'none';
  reason: string;
  expectedImprovement: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface LoadBalancingConfig {
  cpuThreshold: number;
  memoryThreshold: number;
  gpuThreshold: number;
  imbalanceThreshold: number;
  minTasksForMigration: number;
  maxMigrationTasks: number;
  enableAutoMigration: boolean;
  enablePredictive: boolean;
  coolingPeriod: number; // 冷却时间（秒）
}

export interface MigrationTask {
  taskId: string;
  taskName: string;
  fromServerId: string;
  toServerId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  error?: string;
}

export interface LoadHistory {
  timestamp: Date;
  load: ServerLoad;
}

export interface PredictionResult {
  serverId: string;
  predictedLoad: number;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  timeToThreshold?: number;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: LoadBalancingConfig = {
  cpuThreshold: 80,
  memoryThreshold: 85,
  gpuThreshold: 90,
  imbalanceThreshold: 30, // 最大允许的负载差异百分比
  minTasksForMigration: 1,
  maxMigrationTasks: 5,
  enableAutoMigration: true,
  enablePredictive: true,
  coolingPeriod: 300, // 5 分钟冷却
};

// 负载计算权重
const LOAD_WEIGHTS = {
  cpu: 0.35,
  memory: 0.25,
  gpu: 0.25,
  network: 0.10,
  disk: 0.05,
};

// ============================================
// 智能负载均衡服务类
// ============================================

export class LoadBalancerService {
  private config: LoadBalancingConfig;
  private loadHistory: Map<string, LoadHistory[]> = new Map();
  private migrationHistory: MigrationTask[] = [];
  private lastBalancingTime: Date = new Date(0);
  private initialized: boolean = false;

  constructor(config?: Partial<LoadBalancingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 加载历史负载数据
      await this.loadLoadHistory();
      
      this.initialized = true;
      console.log('[LoadBalancer] Initialized with config:', this.config);
    } catch (error) {
      console.error('[LoadBalancer] Initialization error:', error);
      this.initialized = true;
    }
  }

  /**
   * 加载历史负载数据
   */
  private async loadLoadHistory(): Promise<void> {
    const servers = await prisma.server.findMany({
      where: { status: ServerStatus.ONLINE },
    });

    for (const server of servers) {
      // 获取最近的监控指标
      const metrics = await prisma.serverMetric.findMany({
        where: { serverId: server.id },
        orderBy: { recordedAt: 'desc' },
        take: 60, // 最近 60 个数据点
      });

      const history: LoadHistory[] = metrics.map(m => ({
        timestamp: m.recordedAt!,
        load: this.metricToLoad(m, server),
      }));

      this.loadHistory.set(server.id, history.reverse());
    }
  }

  /**
   * 转换监控指标到负载对象
   */
  private metricToLoad(metric: any, server: any): ServerLoad {
    return {
      serverId: server.id,
      serverName: server.name,
      cpuLoad: metric.cpuUsage ? Number(metric.cpuUsage) : 0,
      memoryLoad: metric.memoryUsage ? Number(metric.memoryUsage) : 0,
      gpuLoad: metric.gpuUsage ? Number(metric.gpuUsage) : 0,
      networkLoad: Number(metric.networkIn || 0),
      diskLoad: 0,
      taskCount: 0,
      runningTasks: 0,
      pendingTasks: 0,
      loadScore: 0,
      healthScore: 100,
      capacity: 0,
      temperature: metric.temperature ? Number(metric.temperature) : 50,
      powerConsumption: 0,
    };
  }

  /**
   * 获取当前集群负载状态
   */
  async getClusterLoad(): Promise<ServerLoad[]> {
    const servers = await prisma.server.findMany({
      where: { status: ServerStatus.ONLINE },
      include: {
        gpus: true,
      },
    });

    const loads: ServerLoad[] = [];

    for (const server of servers) {
      // 获取最新监控数据
      const latestMetric = await prisma.serverMetric.findFirst({
        where: { serverId: server.id },
        orderBy: { recordedAt: 'desc' },
      });

      // 计算 GPU 负载
      const totalGpus = server.gpus.length;
      const busyGpus = server.gpus.filter(g => g.allocated).length;
      const gpuLoad = totalGpus > 0 ? (busyGpus / totalGpus) * 100 : 0;

      // 计算综合负载得分
      const loadScore = this.calculateLoadScore({
        cpuLoad: latestMetric?.cpuUsage ? Number(latestMetric.cpuUsage) : 0,
        memoryLoad: latestMetric?.memoryUsage ? Number(latestMetric.memoryUsage) : 0,
        gpuLoad,
        networkLoad: 0,
        diskLoad: 0,
      });

      // 计算健康得分
      const healthScore = this.calculateHealthScore(server, latestMetric);

      const load: ServerLoad = {
        serverId: server.id,
        serverName: server.name,
        cpuLoad: latestMetric?.cpuUsage ? Number(latestMetric.cpuUsage) : 0,
        memoryLoad: latestMetric?.memoryUsage ? Number(latestMetric.memoryUsage) : 0,
        gpuLoad,
        networkLoad: 0,
        diskLoad: 0,
        taskCount: 0,
        runningTasks: 0,
        pendingTasks: 0,
        loadScore,
        healthScore,
        capacity: 0,
        temperature: latestMetric?.temperature ? Number(latestMetric.temperature) : 50,
        powerConsumption: this.estimatePowerConsumption(server, latestMetric),
      };

      loads.push(load);

      // 更新历史
      this.updateLoadHistory(server.id, load);
    }

    return loads;
  }

  /**
   * 执行负载均衡分析
   */
  async analyzeAndBalance(): Promise<LoadBalancingDecision[]> {
    await this.initialize();

    // 检查冷却时间
    if (this.isInCoolingPeriod()) {
      return [];
    }

    const loads = await this.getClusterLoad();
    const decisions: LoadBalancingDecision[] = [];

    // 1. 检测负载不均衡
    const imbalance = this.detectImbalance(loads);
    if (imbalance.isImbalanced) {
      const decision = await this.createBalancingDecision(loads, imbalance);
      if (decision) {
        decisions.push(decision);
      }
    }

    // 2. 检测过载服务器
    const overloadedServers = loads.filter(l => 
      l.cpuLoad > this.config.cpuThreshold ||
      l.memoryLoad > this.config.memoryThreshold ||
      l.gpuLoad > this.config.gpuThreshold
    );

    for (const server of overloadedServers) {
      const decision = await this.createOverloadReliefDecision(server, loads);
      if (decision) {
        decisions.push(decision);
      }
    }

    // 3. 预测性负载均衡
    if (this.config.enablePredictive) {
      const predictions = await this.predictFutureLoad(loads);
      const predictiveDecision = this.createPredictiveDecision(predictions, loads);
      if (predictiveDecision) {
        decisions.push(predictiveDecision);
      }
    }

    // 4. 资源整合优化（低负载时合并）
    const underutilizedServers = loads.filter(l => l.loadScore < 20);
    if (underutilizedServers.length > 0 && loads.some(l => l.loadScore < 60)) {
      const consolidationDecision = await this.createConsolidationDecision(underutilizedServers, loads);
      if (consolidationDecision) {
        decisions.push(consolidationDecision);
      }
    }

    return decisions;
  }

  /**
   * 执行负载均衡决策
   */
  async executeDecision(decision: LoadBalancingDecision): Promise<{
    success: boolean;
    migratedTasks: string[];
    failedTasks: string[];
    errors: string[];
  }> {
    const result = {
      success: true,
      migratedTasks: [] as string[],
      failedTasks: [] as string[],
      errors: [] as string[],
    };

    if (decision.action === 'none') {
      return result;
    }

    // 记录迁移开始
    const migrations: MigrationTask[] = decision.taskIds.map(taskId => ({
      taskId,
      taskName: '',
      fromServerId: decision.sourceServerId || '',
      toServerId: decision.targetServerId,
      status: 'pending',
      startTime: new Date(),
    }));

    for (const migration of migrations) {
      try {
        // 更新迁移状态
        migration.status = 'executing';
        
        // 获取任务详情
        const task = await prisma.task.findUnique({
          where: { id: migration.taskId },
        });

        if (!task) {
          throw new Error(`Task ${migration.taskId} not found`);
        }

        migration.taskName = task.name;

        // 检查任务是否可以迁移（简化处理，只迁移 PENDING 任务）
        if (task.status !== TaskStatus.PENDING) {
          throw new Error(`Task ${migration.taskId} is not in migratable state`);
        }

        // 更新 GPU 分配
        const gpuAllocations = await prisma.gpuAllocation.findMany({
          where: {
            taskId: migration.taskId,
            releasedAt: null,
          },
        });

        // 如果有 GPU 分配，需要释放并重新分配
        for (const alloc of gpuAllocations) {
          await prisma.gpuAllocation.update({
            where: { id: alloc.id },
            data: { releasedAt: new Date() },
          });

          await prisma.gpu.update({
            where: { id: alloc.gpuId },
            data: { allocated: false },
          });
        }

        // 在目标服务器分配新 GPU
        if (gpuAllocations.length > 0) {
          const targetGpus = await prisma.gpu.findMany({
            where: {
              serverId: decision.targetServerId,
              allocated: false,
            },
          });

          for (const alloc of gpuAllocations) {
            const newGpu = targetGpus.shift();
            if (newGpu) {
              await prisma.gpuAllocation.create({
                data: {
                  userId: alloc.userId,
                  gpuId: newGpu.id,
                  taskId: migration.taskId,
                  allocatedAt: new Date(),
                },
              });

              await prisma.gpu.update({
                where: { id: newGpu.id },
                data: { allocated: true },
              });
            }
          }
        }

        migration.status = 'completed';
        migration.endTime = new Date();
        result.migratedTasks.push(migration.taskId);

      } catch (error: any) {
        migration.status = 'failed';
        migration.error = error.message;
        result.failedTasks.push(migration.taskId);
        result.errors.push(error.message);
        result.success = false;
      }
    }

    // 记录迁移历史
    this.migrationHistory.push(...migrations);
    this.lastBalancingTime = new Date();

    return result;
  }

  /**
   * 预测未来负载
   */
  async predictFutureLoad(loads: ServerLoad[]): Promise<PredictionResult[]> {
    const predictions: PredictionResult[] = [];

    for (const load of loads) {
      const history = this.loadHistory.get(load.serverId) || [];
      
      if (history.length < 5) {
        predictions.push({
          serverId: load.serverId,
          predictedLoad: load.loadScore,
          confidence: 0.5,
          trend: 'stable',
        });
        continue;
      }

      // 使用简单移动平均预测
      const recentLoads = history.slice(-10).map(h => h.load.loadScore);
      const avgLoad = recentLoads.reduce((a, b) => a + b, 0) / recentLoads.length;
      
      // 计算趋势
      const firstHalf = recentLoads.slice(0, 5);
      const secondHalf = recentLoads.slice(-5);
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      const diff = secondAvg - firstAvg;
      const trend = diff > 5 ? 'increasing' : diff < -5 ? 'decreasing' : 'stable';

      // 预测到达阈值的时间
      let timeToThreshold: number | undefined;
      if (trend === 'increasing' && load.loadScore < this.config.cpuThreshold) {
        const rate = diff / 5; // 每个时间单位的变化
        if (rate > 0) {
          timeToThreshold = (this.config.cpuThreshold - load.loadScore) / rate;
        }
      }

      predictions.push({
        serverId: load.serverId,
        predictedLoad: avgLoad,
        confidence: this.calculatePredictionConfidence(history),
        trend,
        timeToThreshold,
      });
    }

    return predictions;
  }

  /**
   * 获取负载均衡报告
   */
  async getLoadBalancingReport(): Promise<{
    clusterLoad: ServerLoad[];
    imbalanceScore: number;
    recommendations: LoadBalancingDecision[];
    recentMigrations: MigrationTask[];
    predictions: PredictionResult[];
  }> {
    const loads = await this.getClusterLoad();
    const predictions = await this.predictFutureLoad(loads);
    const imbalance = this.detectImbalance(loads);
    const recommendations = await this.analyzeAndBalance();

    return {
      clusterLoad: loads,
      imbalanceScore: imbalance.score,
      recommendations,
      recentMigrations: this.migrationHistory.slice(-10),
      predictions,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<LoadBalancingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // ============================================
  // 私有辅助方法
  // ============================================

  private calculateLoadScore(loads: {
    cpuLoad: number;
    memoryLoad: number;
    gpuLoad: number;
    networkLoad: number;
    diskLoad: number;
  }): number {
    return (
      loads.cpuLoad * LOAD_WEIGHTS.cpu +
      loads.memoryLoad * LOAD_WEIGHTS.memory +
      loads.gpuLoad * LOAD_WEIGHTS.gpu +
      loads.networkLoad * LOAD_WEIGHTS.network +
      loads.diskLoad * LOAD_WEIGHTS.disk
    );
  }

  private calculateHealthScore(server: any, metric: any): number {
    let score = 100;

    // CPU 温度惩罚
    if (metric?.temperature && Number(metric.temperature) > 80) {
      score -= (Number(metric.temperature) - 80) * 2;
    }

    return Math.max(0, Math.min(100, score));
  }

  private estimatePowerConsumption(server: any, metric: any): number {
    // 基础功耗 + CPU 功耗 + GPU 功耗估算
    const basePower = 100;
    const cpuPower = (metric?.cpuUsage ? Number(metric.cpuUsage) : 0) * 2;
    const gpuCount = server?.gpus?.length || 0;
    const gpuPower = gpuCount * 150 * (metric?.gpuUsage ? Number(metric.gpuUsage) : 50) / 100;
    
    return basePower + cpuPower + gpuPower;
  }

  private updateLoadHistory(serverId: string, load: ServerLoad): void {
    const history = this.loadHistory.get(serverId) || [];
    history.push({ timestamp: new Date(), load });
    
    // 保持最近 60 个数据点
    if (history.length > 60) {
      history.shift();
    }
    
    this.loadHistory.set(serverId, history);
  }

  private isInCoolingPeriod(): boolean {
    const elapsed = (Date.now() - this.lastBalancingTime.getTime()) / 1000;
    return elapsed < this.config.coolingPeriod;
  }

  private detectImbalance(loads: ServerLoad[]): {
    isImbalanced: boolean;
    score: number;
    maxLoad: number;
    minLoad: number;
  } {
    if (loads.length < 2) {
      return { isImbalanced: false, score: 0, maxLoad: 0, minLoad: 0 };
    }

    const loadScores = loads.map(l => l.loadScore);
    const maxLoad = Math.max(...loadScores);
    const minLoad = Math.min(...loadScores);
    const avgLoad = loadScores.reduce((a, b) => a + b, 0) / loadScores.length;
    
    // 计算不均衡得分（标准差 / 平均值）
    const variance = loadScores.reduce((sum, score) => 
      sum + Math.pow(score - avgLoad, 2), 0) / loadScores.length;
    const stdDev = Math.sqrt(variance);
    const imbalanceScore = avgLoad > 0 ? (stdDev / avgLoad) * 100 : 0;

    return {
      isImbalanced: maxLoad - minLoad > this.config.imbalanceThreshold,
      score: imbalanceScore,
      maxLoad,
      minLoad,
    };
  }

  private async createBalancingDecision(
    loads: ServerLoad[],
    imbalance: { maxLoad: number; minLoad: number }
  ): Promise<LoadBalancingDecision | null> {
    // 找出最高负载和最低负载的服务器
    const highLoadServer = loads.find(l => l.loadScore === imbalance.maxLoad);
    const lowLoadServer = loads.find(l => l.loadScore === imbalance.minLoad);

    if (!highLoadServer || !lowLoadServer) {
      return null;
    }

    // 简化处理：返回一个示例决策
    const expectedImprovement = (imbalance.maxLoad - imbalance.minLoad) / 2;

    return {
      sourceServerId: highLoadServer.serverId,
      targetServerId: lowLoadServer.serverId,
      taskIds: [],
      action: 'migrate',
      reason: `负载不均衡: ${highLoadServer.serverName}(${imbalance.maxLoad.toFixed(1)}%) -> ${lowLoadServer.serverName}(${imbalance.minLoad.toFixed(1)}%)`,
      expectedImprovement,
      riskLevel: expectedImprovement > 30 ? 'medium' : 'low',
    };
  }

  private async createOverloadReliefDecision(
    overloadedServer: ServerLoad,
    loads: ServerLoad[]
  ): Promise<LoadBalancingDecision | null> {
    // 找到负载最低的服务器
    const targetServer = loads
      .filter(l => l.serverId !== overloadedServer.serverId)
      .sort((a, b) => a.loadScore - b.loadScore)[0];

    if (!targetServer || targetServer.loadScore > 70) {
      return null; // 没有合适的目标服务器
    }

    return {
      sourceServerId: overloadedServer.serverId,
      targetServerId: targetServer.serverId,
      taskIds: [],
      action: 'migrate',
      reason: `服务器 ${overloadedServer.serverName} 过载 (CPU: ${overloadedServer.cpuLoad.toFixed(1)}%, MEM: ${overloadedServer.memoryLoad.toFixed(1)}%)`,
      expectedImprovement: overloadedServer.loadScore - targetServer.loadScore,
      riskLevel: 'high',
    };
  }

  private createPredictiveDecision(
    predictions: PredictionResult[],
    loads: ServerLoad[]
  ): LoadBalancingDecision | null {
    // 找出预测即将过载的服务器
    const willOverload = predictions.filter(p => 
      p.trend === 'increasing' && 
      p.timeToThreshold && 
      p.timeToThreshold < 10 // 10 个时间单位内将过载
    );

    if (willOverload.length === 0) {
      return null;
    }

    // 选择一个预测过载的服务器
    const sourcePrediction = willOverload[0];
    const sourceServer = loads.find(l => l.serverId === sourcePrediction.serverId);

    if (!sourceServer) {
      return null;
    }

    // 找到一个稳定或下降趋势的服务器作为目标
    const stableServer = predictions.find(p => 
      p.trend !== 'increasing' && 
      p.serverId !== sourcePrediction.serverId &&
      (loads.find(l => l.serverId === p.serverId)?.loadScore || 0) < 60
    );

    if (!stableServer) {
      return null;
    }

    return {
      sourceServerId: sourcePrediction.serverId,
      targetServerId: stableServer.serverId,
      taskIds: [],
      action: 'migrate',
      reason: `预测性迁移: ${sourceServer.serverName} 负载持续上升，预计 ${Math.round(sourcePrediction.timeToThreshold!)} 时间单位内过载`,
      expectedImprovement: 15,
      riskLevel: 'low',
    };
  }

  private async createConsolidationDecision(
    underutilizedServers: ServerLoad[],
    loads: ServerLoad[]
  ): Promise<LoadBalancingDecision | null> {
    if (underutilizedServers.length === 0) {
      return null;
    }

    // 选择一个低负载服务器作为目标
    const targetServer = loads
      .filter(l => l.loadScore < 60 && !underutilizedServers.includes(l))
      .sort((a, b) => b.loadScore - a.loadScore)[0];

    if (!targetServer) {
      return null;
    }

    // 获取利用率最低服务器
    const lowestUtilized = underutilizedServers[0];

    return {
      sourceServerId: lowestUtilized.serverId,
      targetServerId: targetServer.serverId,
      taskIds: [],
      action: 'consolidate',
      reason: `资源整合: ${lowestUtilized.serverName} 利用率过低 (${lowestUtilized.loadScore.toFixed(1)}%)，建议合并到 ${targetServer.serverName}`,
      expectedImprovement: 10,
      riskLevel: 'low',
    };
  }

  private calculatePredictionConfidence(history: LoadHistory[]): number {
    // 基于历史数据量和波动性计算置信度
    const sampleSize = Math.min(history.length / 30, 1); // 30 个数据点为满分
    const loadValues = history.map(h => h.load.loadScore);
    
    // 计算波动性
    const avg = loadValues.reduce((a, b) => a + b, 0) / loadValues.length;
    const variance = loadValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / loadValues.length;
    const volatility = Math.sqrt(variance) / (avg || 1);
    
    const stabilityScore = Math.max(0, 1 - volatility / 50);
    
    return sampleSize * 0.5 + stabilityScore * 0.5;
  }
}

// 导出单例
export const loadBalancerService = new LoadBalancerService();