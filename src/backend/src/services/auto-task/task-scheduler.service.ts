/**
 * Task Scheduler Service - 任务调度服务
 * 支持任务队列管理和优先级调度
 */

import prisma from '../../utils/prisma';
import { task_status as TaskStatus, task_priority as TaskPriority } from '@prisma/client';

export interface ScheduledTask {
  id: string;
  name: string;
  priority: TaskPriority;
  dependencies: string[];
  createdAt: Date;
}

export interface QueueStatus {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25,
};

export class TaskSchedulerService {
  private maxConcurrent = 10;
  private retryLimit = 3;
  private processingQueue: Map<string, NodeJS.Timeout> = new Map();

  /** 添加任务到调度队列 */
  async enqueueTask(taskId: string, options?: { dependencies?: string[] }): Promise<ScheduledTask> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, name: true, priority: true, createdAt: true },
    });
    if (!task) throw new Error(`Task ${taskId} not found`);

    // 检查依赖是否满足
    if (options?.dependencies?.length) {
      const deps = await prisma.task.findMany({
        where: { id: { in: options.dependencies }, status: TaskStatus.COMPLETED },
      });
      if (deps.length < options.dependencies.length) {
        console.log(`[TaskScheduler] Task ${taskId} waiting for dependencies`);
      }
    }

    return { ...task, dependencies: options?.dependencies || [] };
  }

  /** 获取下一个待执行任务（按优先级） */
  async getNextTask(): Promise<ScheduledTask | null> {
    const tasks = await prisma.task.findMany({
      where: { status: TaskStatus.PENDING },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 1,
    });
    if (tasks.length === 0) return null;
    const t = tasks[0];
    return { id: t.id, name: t.name, priority: t.priority, dependencies: [], createdAt: t.createdAt };
  }

  /** 获取优先级队列 */
  async getPriorityQueue(limit = 20): Promise<ScheduledTask[]> {
    const tasks = await prisma.task.findMany({
      where: { status: TaskStatus.PENDING },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });
    return tasks.map(t => ({ id: t.id, name: t.name, priority: t.priority, scheduledAt: undefined, dependencies: [], createdAt: t.createdAt }));
  }

  /** 检查并发限制 */
  async canStartNewTask(): Promise<boolean> {
    const running = await prisma.task.count({ where: { status: TaskStatus.RUNNING } });
    return running < this.maxConcurrent;
  }

  /** 更新任务优先级 */
  async updatePriority(taskId: string, priority: TaskPriority): Promise<void> {
    await prisma.task.update({ where: { id: taskId }, data: { priority } });
  }

  /** 批量重新调度失败任务 */
  async rescheduleFailedTasks(): Promise<number> {
    const failed = await prisma.task.findMany({
      where: { status: TaskStatus.FAILED, updatedAt: { gte: new Date(Date.now() - 86400000) } },
    });
    let count = 0;
    for (const task of failed) {
      const retry = this.parseRetryCount(task.metadata ? JSON.stringify(task.metadata) : null);
      if (retry < this.retryLimit) {
        await prisma.task.update({
          where: { id: task.id },
          data: { 
            status: TaskStatus.PENDING, 
            metadata: { retryCount: retry + 1 } as any,
            errorMessage: null,
          },
        });
        count++;
      }
    }
    return count;
  }

  /** 获取队列状态 */
  async getQueueStatus(): Promise<QueueStatus> {
    const counts = await prisma.task.groupBy({ by: ['status'], _count: true });
    const status: QueueStatus = { pending: 0, running: 0, completed: 0, failed: 0 };
    for (const c of counts) {
      if (c.status === TaskStatus.PENDING) status.pending = c._count;
      else if (c.status === TaskStatus.RUNNING) status.running = c._count;
      else if (c.status === TaskStatus.COMPLETED) status.completed = c._count;
      else if (c.status === TaskStatus.FAILED) status.failed = c._count;
    }
    return status;
  }

  /** 清理过期任务 */
  async cleanupExpiredTasks(days = 7): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86400000);
    const result = await prisma.task.deleteMany({
      where: { status: { in: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] }, completedAt: { lt: cutoff } },
    });
    return result.count;
  }

  private scheduleDelayedTask(taskId: string, delayMs: number): void {
    const timeout = setTimeout(() => this.processingQueue.delete(taskId), delayMs);
    this.processingQueue.set(taskId, timeout);
  }

  cancelScheduledTask(taskId: string): boolean {
    const timeout = this.processingQueue.get(taskId);
    if (timeout) { clearTimeout(timeout); this.processingQueue.delete(taskId); return true; }
    return false;
  }

  private parseRetryCount(result: string | null): number {
    if (!result) return 0;
    try { return JSON.parse(result).retryCount || 0; } catch { return 0; }
  }
}

export const taskSchedulerService = new TaskSchedulerService();