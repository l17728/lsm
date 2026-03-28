/**
 * Execution Tracker Service - 执行追踪服务
 * 
 * 支持进度追踪和结果验收
 * - 实时进度监控
 * - 执行结果验证
 * - 性能指标统计
 */

import prisma from '../../utils/prisma';
import { task_status as TaskStatus } from '@prisma/client';

// 执行状态
export enum ExecutionState {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
}

// 进度信息
export interface ProgressInfo {
  taskId: string;
  state: ExecutionState;
  percentage: number;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  startedAt: Date | null;
  estimatedEnd: Date | null;
  elapsedTime: number; // milliseconds
  lastUpdate: Date;
}

// 执行结果
export interface ExecutionResult {
  taskId: string;
  success: boolean;
  output?: any;
  error?: string;
  metrics: ExecutionMetrics;
  artifacts: ExecutionArtifact[];
  validatedAt?: Date;
  validatedBy?: string;
}

// 执行指标
export interface ExecutionMetrics {
  duration: number;
  cpuUsage?: number;
  memoryUsage?: number;
  retryCount: number;
  checkpoints: number;
}

// 执行产物
export interface ExecutionArtifact {
  type: 'file' | 'log' | 'report' | 'data';
  name: string;
  path?: string;
  content?: string;
  size?: number;
  createdAt: Date;
}

// 验收结果
export interface ValidationResult {
  passed: boolean;
  score: number; // 0-100
  checks: ValidationCheck[];
  summary: string;
  validatedAt: Date;
}

// 验收检查项
export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  weight: number;
}

// 检查点
interface Checkpoint {
  taskId: string;
  step: number;
  timestamp: Date;
  data?: any;
}

export class ExecutionTrackerService {
  private progressCache: Map<string, ProgressInfo> = new Map();
  private checkpoints: Map<string, Checkpoint[]> = new Map();
  private metricsHistory: Map<string, ExecutionMetrics[]> = new Map();

  /**
   * 开始追踪任务执行
   */
  startTracking(
    taskId: string,
    options?: { totalSteps?: number; estimatedDuration?: number }
  ): ProgressInfo {
    const now = new Date();
    const estimatedEnd = options?.estimatedDuration
      ? new Date(now.getTime() + options.estimatedDuration)
      : null;

    const progress: ProgressInfo = {
      taskId,
      state: ExecutionState.RUNNING,
      percentage: 0,
      currentStep: 'Initializing',
      totalSteps: options?.totalSteps || 1,
      completedSteps: 0,
      startedAt: now,
      estimatedEnd,
      elapsedTime: 0,
      lastUpdate: now,
    };

    this.progressCache.set(taskId, progress);
    return progress;
  }

  /**
   * 更新进度
   */
  updateProgress(
    taskId: string,
    update: {
      currentStep?: string;
      completedSteps?: number;
      totalSteps?: number;
      state?: ExecutionState;
    }
  ): ProgressInfo | null {
    const progress = this.progressCache.get(taskId);
    if (!progress) return null;

    if (update.currentStep) progress.currentStep = update.currentStep;
    if (update.completedSteps !== undefined) progress.completedSteps = update.completedSteps;
    if (update.totalSteps !== undefined) progress.totalSteps = update.totalSteps;
    if (update.state) progress.state = update.state;

    progress.percentage = Math.round(
      (progress.completedSteps / progress.totalSteps) * 100
    );
    progress.lastUpdate = new Date();
    progress.elapsedTime = progress.startedAt
      ? Date.now() - progress.startedAt.getTime()
      : 0;

    return progress;
  }

  /**
   * 创建检查点
   */
  createCheckpoint(taskId: string, step: number, data?: any): Checkpoint {
    const checkpoint: Checkpoint = {
      taskId,
      step,
      timestamp: new Date(),
      data,
    };

    if (!this.checkpoints.has(taskId)) {
      this.checkpoints.set(taskId, []);
    }
    this.checkpoints.get(taskId)!.push(checkpoint);

    return checkpoint;
  }

  /**
   * 获取检查点列表
   */
  getCheckpoints(taskId: string): Checkpoint[] {
    return this.checkpoints.get(taskId) || [];
  }

  /**
   * 恢复到最近检查点
   */
  getLatestCheckpoint(taskId: string): Checkpoint | null {
    const checkpoints = this.checkpoints.get(taskId);
    if (!checkpoints || checkpoints.length === 0) return null;
    return checkpoints[checkpoints.length - 1];
  }

  /**
   * 完成追踪并记录结果
   */
  async completeTracking(
    taskId: string,
    result: Partial<ExecutionResult>
  ): Promise<ExecutionResult> {
    const progress = this.progressCache.get(taskId);
    
    if (progress) {
      progress.state = result.success ? ExecutionState.COMPLETED : ExecutionState.FAILED;
      progress.percentage = 100;
      progress.lastUpdate = new Date();
    }

    const metrics: ExecutionMetrics = result.metrics || {
      duration: progress?.elapsedTime || 0,
      retryCount: 0,
      checkpoints: this.checkpoints.get(taskId)?.length || 0,
    };

    const executionResult: ExecutionResult = {
      taskId,
      success: result.success ?? true,
      output: result.output,
      error: result.error,
      metrics,
      artifacts: result.artifacts || [],
    };

    // 更新数据库
    await this.recordExecution(taskId, executionResult);

    // 保存指标历史
    if (!this.metricsHistory.has(taskId)) {
      this.metricsHistory.set(taskId, []);
    }
    this.metricsHistory.get(taskId)!.push(metrics);

    return executionResult;
  }

  /**
   * 获取当前进度
   */
  getProgress(taskId: string): ProgressInfo | null {
    return this.progressCache.get(taskId) || null;
  }

  /**
   * 获取所有进行中的任务
   */
  getRunningTasks(): ProgressInfo[] {
    return Array.from(this.progressCache.values()).filter(
      p => p.state === ExecutionState.RUNNING
    );
  }

  /**
   * 验收执行结果
   */
  async validateResult(
    taskId: string,
    checks: ValidationCheck[]
  ): Promise<ValidationResult> {
    const passed = checks.every(c => c.passed);
    const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
    const passedWeight = checks
      .filter(c => c.passed)
      .reduce((sum, c) => sum + c.weight, 0);
    const score = Math.round((passedWeight / totalWeight) * 100);

    const result: ValidationResult = {
      passed,
      score,
      checks,
      summary: this.generateValidationSummary(checks),
      validatedAt: new Date(),
    };

    // 记录验收结果
    await this.recordValidation(taskId, result);

    return result;
  }

  /**
   * 自动验收（基于预定义规则）
   */
  async autoValidate(taskId: string): Promise<ValidationResult> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true, errorMessage: true, metadata: true },
    });

    const taskResult = task?.metadata && typeof task.metadata === 'object' ? (task.metadata as any).result : null;

    const checks: ValidationCheck[] = [
      {
        name: 'Task Completed',
        passed: task?.status === TaskStatus.COMPLETED,
        message: task?.status === TaskStatus.COMPLETED ? 'Task finished successfully' : 'Task not completed',
        weight: 40,
      },
      {
        name: 'Output Generated',
        passed: !!taskResult,
        message: taskResult ? 'Output exists' : 'No output generated',
        weight: 30,
      },
      {
        name: 'No Errors',
        passed: !task?.errorMessage,
        message: 'No error messages found',
        weight: 30,
      },
    ];

    return this.validateResult(taskId, checks);
  }

  /**
   * 生成验收摘要
   */
  private generateValidationSummary(checks: ValidationCheck[]): string {
    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;

    if (passed === total) {
      return `All ${total} checks passed`;
    } else {
      const failed = checks.filter(c => !c.passed);
      return `${passed}/${total} checks passed. Failed: ${failed.map(c => c.name).join(', ')}`;
    }
  }

  /**
   * 获取执行统计
   */
  async getExecutionStats(timeRangeMs = 24 * 60 * 60 * 1000): Promise<{
    total: number;
    completed: number;
    failed: number;
    avgDuration: number;
    successRate: number;
  }> {
    const since = new Date(Date.now() - timeRangeMs);

    const tasks = await prisma.task.findMany({
      where: {
        createdAt: { gte: since },
      },
      select: {
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED);
    const failed = tasks.filter(t => t.status === TaskStatus.FAILED);

    const durations = completed
      .filter(t => t.startedAt && t.completedAt)
      .map(t => t.completedAt!.getTime() - t.startedAt!.getTime());

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      total: tasks.length,
      completed: completed.length,
      failed: failed.length,
      avgDuration,
      successRate: tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0,
    };
  }

  /**
   * 记录执行到数据库
   */
  private async recordExecution(
    taskId: string,
    result: ExecutionResult
  ): Promise<void> {
    try {
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
          completedAt: new Date(),
          errorMessage: result.error,
          metadata: {
            output: result.output,
            error: result.error,
            metrics: result.metrics,
            artifacts: result.artifacts?.map(a => ({
              type: a.type,
              name: a.name,
              size: a.size,
            })) || [],
          } as any,
        },
      });
    } catch (error) {
      console.error('[ExecutionTracker] Failed to record execution:', error);
    }
  }

  /**
   * 记录验收结果
   */
  private async recordValidation(
    taskId: string,
    result: ValidationResult
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: 'system',
          action: 'TASK_VALIDATED',
          resourceType: 'TASK_VALIDATION',
          resourceId: taskId,
          details: JSON.parse(JSON.stringify({
            passed: result.passed,
            score: result.score,
            checks: result.checks,
            summary: result.summary,
            validatedAt: result.validatedAt.toISOString(),
          })),
        },
      });
    } catch (error) {
      console.error('[ExecutionTracker] Failed to record validation:', error);
    }
  }

  /**
   * 清理过期追踪数据
   */
  cleanup(maxAgeMs = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    for (const [taskId, progress] of this.progressCache) {
      if (progress.lastUpdate.getTime() < cutoff) {
        this.progressCache.delete(taskId);
        this.checkpoints.delete(taskId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 获取指标历史
   */
  getMetricsHistory(taskId: string): ExecutionMetrics[] {
    return this.metricsHistory.get(taskId) || [];
  }

  /**
   * 暂停追踪
   */
  pauseTracking(taskId: string): ProgressInfo | null {
    const progress = this.progressCache.get(taskId);
    if (!progress) return null;

    progress.state = ExecutionState.PAUSED;
    progress.lastUpdate = new Date();
    return progress;
  }

  /**
   * 恢复追踪
   */
  resumeTracking(taskId: string): ProgressInfo | null {
    const progress = this.progressCache.get(taskId);
    if (!progress) return null;

    progress.state = ExecutionState.RUNNING;
    progress.lastUpdate = new Date();
    return progress;
  }
}

export const executionTrackerService = new ExecutionTrackerService();
export default executionTrackerService;