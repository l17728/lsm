import prisma from '../utils/prisma';
import { task_status as TaskStatus, task_priority as TaskPriority } from '@prisma/client';
import { emailQueueService } from './email-queue.service';
import { EmailType } from './email.service';

export interface CreateTaskRequest {
  name: string;
  description?: string;
  userId: string;
  teamId?: string;
  priority?: TaskPriority;
  gpuRequirements?: Record<string, any>;
}

export interface UpdateTaskRequest {
  name?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  gpuRequirements?: Record<string, any>;
}

export class TaskService {
  /**
   * Get user email by ID
   */
  private async getUserEmail(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email || null;
  }
  /**
   * Create a new task
   */
  async createTask(data: CreateTaskRequest) {
    const task = await prisma.task.create({
      data: {
        name: data.name,
        description: data.description,
        userId: data.userId,
        teamId: data.teamId,
        priority: data.priority ?? TaskPriority.MEDIUM,
        gpuRequirements: data.gpuRequirements,
        status: TaskStatus.PENDING,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Send email notification for task assignment
    const user = task.user;
    if (user && user.email) {
      await emailQueueService.enqueue(
        EmailType.TASK_ASSIGNED,
        user.email,
        {
          userId: user.id,
          username: user.username,
          taskName: task.name,
          priority: this.getPriorityLabel(task.priority),
          taskUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks/${task.id}`,
        },
        'high'
      );
    }

    return task;
  }

  /**
   * Get priority label
   */
  private getPriorityLabel(priority: TaskPriority): string {
    return priority;
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return task;
  }

  /**
   * Get user's tasks
   */
  async getUserTasks(userId: string, status?: TaskStatus, limit = 50) {
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return tasks;
  }

  /**
   * Get all tasks (admin)
   */
  async getAllTasks(status?: TaskStatus, limit = 100) {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return tasks;
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, data: UpdateTaskRequest, userId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.userId !== userId) {
      throw new Error('Not authorized to update this task');
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data,
    });

    return updatedTask;
  }

  /**
   * Start a task
   */
  async startTask(taskId: string) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    return task;
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    // Send email notification for task completion
    if (task.user && task.user.email) {
      await emailQueueService.enqueue(
        EmailType.TASK_COMPLETED,
        task.user.email,
        {
          userId: task.user.id,
          username: task.user.username,
          taskName: task.name,
          status: 'COMPLETED',
        },
        'medium'
      );
    }

    return task;
  }

  /**
   * Fail a task
   */
  async failTask(taskId: string, error?: string) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.FAILED,
        failedAt: new Date(),
        errorMessage: error,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    // Send email notification for task failure
    if (task.user && task.user.email) {
      await emailQueueService.enqueue(
        EmailType.TASK_COMPLETED,
        task.user.email,
        {
          userId: task.user.id,
          username: task.user.username,
          taskName: task.name,
          status: 'FAILED',
          result: error || 'Unknown error',
        },
        'high'
      );
    }

    return task;
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string, userId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.userId !== userId && task.status !== TaskStatus.PENDING) {
      throw new Error('Not authorized to cancel this task');
    }

    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
      throw new Error('Cannot cancel a completed task');
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    return updatedTask;
  }

  /**
   * Get pending tasks ordered by priority and creation time
   */
  async getPendingTasks() {
    const tasks = await prisma.task.findMany({
      where: {
        status: TaskStatus.PENDING,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return tasks;
  }

  /**
   * Get task statistics
   */
  async getTaskStats() {
    const tasks = await prisma.task.findMany();

    const stats = {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === TaskStatus.PENDING).length,
      running: tasks.filter((t) => t.status === TaskStatus.RUNNING).length,
      completed: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      failed: tasks.filter((t) => t.status === TaskStatus.FAILED).length,
      cancelled: tasks.filter((t) => t.status === TaskStatus.CANCELLED).length,
    };

    return stats;
  }

  /**
   * Delete task
   */
  async deleteTask(taskId: string, userId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.userId !== userId) {
      throw new Error('Not authorized to delete this task');
    }

    await prisma.task.delete({
      where: { id: taskId },
    });
  }
}

export const taskService = new TaskService();
export default taskService;