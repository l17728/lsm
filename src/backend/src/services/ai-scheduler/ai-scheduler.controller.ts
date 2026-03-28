/**
 * AI 智能调度系统 - 控制器
 * @version 3.1.0
 */

import { Request, Response } from 'express';
import { aiSchedulerService } from './ai-scheduler.service';
import { gpuPredictorService } from './gpu-predictor.service';
import { loadBalancerService } from './load-balancer.service';

export class AISchedulerController {
  // ============================================
  // ML 调度器相关接口
  // ============================================

  /**
   * 获取模型状态
   * GET /api/ai-scheduler/model/status
   */
  async getModelStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = aiSchedulerService.getModelStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取任务调度建议
   * GET /api/ai-scheduler/schedule/:taskId
   */
  async getSchedulingDecision(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const decision = await aiSchedulerService.makeSchedulingDecision(taskId);

      if (!decision) {
        res.status(404).json({
          success: false,
          message: 'Unable to make scheduling decision for this task',
        });
        return;
      }

      res.json({
        success: true,
        data: decision,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 批量调度优化
   * POST /api/ai-scheduler/schedule/batch
   */
  async batchSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { taskIds } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'taskIds must be a non-empty array',
        });
        return;
      }

      const decisions = await aiSchedulerService.batchSchedule(taskIds);

      res.json({
        success: true,
        data: {
          totalTasks: taskIds.length,
          scheduledTasks: decisions.length,
          decisions,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 提交学习反馈
   * POST /api/ai-scheduler/learn
   */
  async submitLearningFeedback(req: Request, res: Response): Promise<void> {
    try {
      const { decision, actualCompletionTime, success } = req.body;

      await aiSchedulerService.learnFromResult(
        decision,
        actualCompletionTime,
        success
      );

      res.json({
        success: true,
        message: 'Learning feedback submitted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ============================================
  // GPU 预测器相关接口
  // ============================================

  /**
   * 预测性 GPU 分配
   * POST /api/ai-scheduler/gpu/predict
   */
  async predictGpuAllocation(req: Request, res: Response): Promise<void> {
    try {
      const { taskId, userId, minMemory, preferredModel, maxWaitTime, priority, taskType } = req.body;

      const result = await gpuPredictorService.predictAndAllocate({
        taskId,
        userId,
        minMemory,
        preferredModel,
        maxWaitTime,
        priority: priority || 1,
        taskType,
      });

      res.json({
        success: result.success,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取即将释放的 GPU
   * GET /api/ai-scheduler/gpu/releasing
   */
  async getReleasingGpus(req: Request, res: Response): Promise<void> {
    try {
      const { withinMinutes = 30 } = req.query;
      const predictions = await gpuPredictorService.predictReleasingGpus(Number(withinMinutes));

      res.json({
        success: true,
        data: predictions,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取 GPU 使用模式
   * GET /api/ai-scheduler/gpu/patterns
   */
  async getGpuPatterns(req: Request, res: Response): Promise<void> {
    try {
      const patterns = gpuPredictorService.getGpuPatterns();

      res.json({
        success: true,
        data: patterns,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 批量 GPU 需求预测
   * POST /api/ai-scheduler/gpu/predict-batch
   */
  async predictBatchGpuRequirements(req: Request, res: Response): Promise<void> {
    try {
      const { taskIds } = req.body;

      if (!Array.isArray(taskIds)) {
        res.status(400).json({
          success: false,
          message: 'taskIds must be an array',
        });
        return;
      }

      const predictions = await gpuPredictorService.predictBatchRequirements(taskIds);

      // 转换 Map 为对象以便 JSON 序列化
      const result: Record<string, any> = {};
      predictions.forEach((value, key) => {
        result[key] = value;
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ============================================
  // 负载均衡相关接口
  // ============================================

  /**
   * 获取集群负载状态
   * GET /api/ai-scheduler/load-balancing/cluster-load
   */
  async getClusterLoad(req: Request, res: Response): Promise<void> {
    try {
      const loads = await loadBalancerService.getClusterLoad();

      res.json({
        success: true,
        data: loads,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 执行负载均衡分析
   * POST /api/ai-scheduler/load-balancing/analyze
   */
  async analyzeLoadBalancing(req: Request, res: Response): Promise<void> {
    try {
      const decisions = await loadBalancerService.analyzeAndBalance();

      res.json({
        success: true,
        data: decisions,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 执行负载均衡决策
   * POST /api/ai-scheduler/load-balancing/execute
   */
  async executeLoadBalancing(req: Request, res: Response): Promise<void> {
    try {
      const decision = req.body;

      const result = await loadBalancerService.executeDecision(decision);

      res.json({
        success: result.success,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取负载均衡报告
   * GET /api/ai-scheduler/load-balancing/report
   */
  async getLoadBalancingReport(req: Request, res: Response): Promise<void> {
    try {
      const report = await loadBalancerService.getLoadBalancingReport();

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 更新负载均衡配置
   * PUT /api/ai-scheduler/load-balancing/config
   */
  async updateLoadBalancingConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = req.body;
      loadBalancerService.updateConfig(config);

      res.json({
        success: true,
        message: 'Configuration updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ============================================
  // 综合调度接口
  // ============================================

  /**
   * 智能任务调度 - 综合所有 AI 能力
   * POST /api/ai-scheduler/smart-schedule
   */
  async smartSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { taskIds, strategy = 'balanced' } = req.body;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'taskIds must be a non-empty array',
        });
        return;
      }

      // 1. 获取 ML 调度决策
      const schedulingDecisions = await aiSchedulerService.batchSchedule(taskIds);

      // 2. 获取 GPU 预测
      const gpuPredictions = await gpuPredictorService.predictBatchRequirements(taskIds);

      // 3. 获取当前负载状态
      const clusterLoad = await loadBalancerService.getClusterLoad();

      // 4. 综合决策
      const smartDecisions = schedulingDecisions.map(decision => {
        const gpuOptions = gpuPredictions.get(decision.taskId) || [];
        const targetServerLoad = clusterLoad.find(l => l.serverId === decision.serverId);

        return {
          ...decision,
          gpuOptions: gpuOptions.slice(0, 3),
          targetServerLoad: targetServerLoad?.loadScore || 0,
          riskLevel: this.assessRisk(decision.confidence, targetServerLoad?.loadScore || 0),
          strategy,
        };
      });

      res.json({
        success: true,
        data: {
          totalTasks: taskIds.length,
          scheduledTasks: smartDecisions.length,
          clusterHealth: this.calculateClusterHealth(clusterLoad),
          decisions: smartDecisions,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取 AI 调度系统状态
   * GET /api/ai-scheduler/status
   */
  async getSystemStatus(req: Request, res: Response): Promise<void> {
    try {
      const modelStatus = aiSchedulerService.getModelStatus();
      const gpuPatterns = gpuPredictorService.getGpuPatterns();
      const clusterLoad = await loadBalancerService.getClusterLoad();

      res.json({
        success: true,
        data: {
          mlScheduler: {
            initialized: modelStatus.initialized,
            historySize: modelStatus.historySize,
            weights: modelStatus.weights,
          },
          gpuPredictor: {
            patternsCount: gpuPatterns.length,
            topModels: this.getTopGpuModels(gpuPatterns),
          },
          loadBalancer: {
            serverCount: clusterLoad.length,
            avgLoad: this.calculateAverageLoad(clusterLoad),
            healthyServers: clusterLoad.filter(l => l.healthScore > 80).length,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ============================================
  // 辅助方法
  // ============================================

  private assessRisk(confidence: number, loadScore: number): 'low' | 'medium' | 'high' {
    if (confidence > 0.8 && loadScore < 60) return 'low';
    if (confidence > 0.6 && loadScore < 80) return 'medium';
    return 'high';
  }

  private calculateClusterHealth(loads: any[]): 'healthy' | 'warning' | 'critical' {
    const avgLoad = this.calculateAverageLoad(loads);
    const overloadedCount = loads.filter(l => l.loadScore > 80).length;

    if (overloadedCount === 0 && avgLoad < 60) return 'healthy';
    if (overloadedCount < loads.length / 2 && avgLoad < 75) return 'warning';
    return 'critical';
  }

  private calculateAverageLoad(loads: any[]): number {
    if (loads.length === 0) return 0;
    return loads.reduce((sum, l) => sum + l.loadScore, 0) / loads.length;
  }

  private getTopGpuModels(patterns: any[]): string[] {
    const modelCounts: Record<string, number> = {};
    for (const pattern of patterns) {
      modelCounts[pattern.model] = (modelCounts[pattern.model] || 0) + 1;
    }
    return Object.entries(modelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([model]) => model);
  }
}

// 导出控制器实例
export const aiSchedulerController = new AISchedulerController();