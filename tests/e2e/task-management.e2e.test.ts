/**
 * LSM Project - Task Management E2E Tests
 * 端到端测试：任务管理流程
 * 
 * 测试场景：
 * 1. 创建任务
 * 2. 分配资源给任务
 * 3. 执行任务
 * 4. 监控任务状态
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Task status enum
enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// Mock Task
interface MockTask {
  id: string;
  name: string;
  description?: string;
  userId: string;
  status: TaskStatus;
  priority: TaskPriority;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: string;
  serverId?: string;
  createdAt: Date;
}

// Mock Task Service
class MockTaskService {
  private tasks: MockTask[] = [];
  private idCounter = 0;

  async createTask(data: {
    name: string;
    description?: string;
    userId: string;
    priority?: TaskPriority;
    scheduledAt?: Date;
  }): Promise<MockTask> {
    const task: MockTask = {
      id: `task-${++this.idCounter}`,
      name: data.name,
      description: data.description,
      userId: data.userId,
      status: TaskStatus.PENDING,
      priority: data.priority ?? TaskPriority.MEDIUM,
      scheduledAt: data.scheduledAt,
      createdAt: new Date(),
    };

    this.tasks.push(task);
    return task;
  }

  async getTask(taskId: string): Promise<MockTask | null> {
    return this.tasks.find(t => t.id === taskId) || null;
  }

  async getUserTasks(userId: string, status?: TaskStatus): Promise<MockTask[]> {
    let userTasks = this.tasks.filter(t => t.userId === userId);
    if (status) {
      userTasks = userTasks.filter(t => t.status === status);
    }
    return userTasks;
  }

  async startTask(taskId: string, serverId: string): Promise<MockTask> {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');
    if (task.status !== TaskStatus.PENDING) throw new Error('Task cannot be started');

    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();
    task.serverId = serverId;
    return task;
  }

  async completeTask(taskId: string, result?: string): Promise<MockTask> {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');
    if (task.status !== TaskStatus.RUNNING) throw new Error('Task is not running');

    task.status = TaskStatus.COMPLETED;
    task.completedAt = new Date();
    task.result = result;
    return task;
  }

  async failTask(taskId: string, error: string): Promise<MockTask> {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');

    task.status = TaskStatus.FAILED;
    task.completedAt = new Date();
    task.result = error;
    return task;
  }

  async cancelTask(taskId: string, userId: string): Promise<MockTask> {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Task not found');
    if (task.userId !== userId) throw new Error('Not authorized');
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
      throw new Error('Cannot cancel completed task');
    }

    task.status = TaskStatus.CANCELLED;
    task.completedAt = new Date();
    return task;
  }

  async getStats(): Promise<Record<string, number>> {
    return {
      total: this.tasks.length,
      pending: this.tasks.filter(t => t.status === TaskStatus.PENDING).length,
      running: this.tasks.filter(t => t.status === TaskStatus.RUNNING).length,
      completed: this.tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
      failed: this.tasks.filter(t => t.status === TaskStatus.FAILED).length,
      cancelled: this.tasks.filter(t => t.status === TaskStatus.CANCELLED).length,
    };
  }

  reset(): void {
    this.tasks = [];
    this.idCounter = 0;
  }
}

// Mock Task Agent
class MockTaskAgent {
  private taskService: MockTaskService;

  constructor(taskService: MockTaskService) {
    this.taskService = taskService;
  }

  async parseTaskRequest(message: string): Promise<{ name: string; description?: string; priority?: TaskPriority } | null> {
    const lower = message.toLowerCase();

    // Determine priority from keywords
    let priority: TaskPriority | undefined;
    if (lower.includes('紧急') || lower.includes('urgent')) priority = TaskPriority.URGENT;
    else if (lower.includes('重要') || lower.includes('high')) priority = TaskPriority.HIGH;
    else if (lower.includes('低优先级')) priority = TaskPriority.LOW;

    // Extract task name
    const nameMatch = message.match(/创建任务[：:\s]*(.+)|任务[：:\s]*(.+)/);
    const name = nameMatch ? (nameMatch[1] || nameMatch[2]).trim() : message.slice(0, 50);

    return { name, priority };
  }

  async handleTaskCreation(userId: string, message: string): Promise<{ success: boolean; task?: MockTask; message: string }> {
    const request = await this.parseTaskRequest(message);
    if (!request) {
      return { success: false, message: '无法理解任务请求' };
    }

    const task = await this.taskService.createTask({
      name: request.name,
      description: request.description,
      userId,
      priority: request.priority,
    });

    return {
      success: true,
      task,
      message: `任务 "${task.name}" 已创建，优先级: ${task.priority}`,
    };
  }
}

describe('Task Management E2E Tests', () => {
  let taskService: MockTaskService;
  let taskAgent: MockTaskAgent;
  const testUserId = 'user-task-1';

  beforeAll(() => {
    taskService = new MockTaskService();
    taskAgent = new MockTaskAgent(taskService);
  });

  beforeEach(() => {
    taskService.reset();
  });

  describe('Task Creation', () => {
    it('should create a basic task', async () => {
      const response = await taskAgent.handleTaskCreation(testUserId, '创建任务：模型训练');

      expect(response.success).toBe(true);
      expect(response.task).toBeDefined();
      expect(response.task!.name).toContain('模型训练');
      expect(response.task!.status).toBe(TaskStatus.PENDING);
    });

    it('should create task with priority', async () => {
      const response = await taskAgent.handleTaskCreation(testUserId, '创建紧急任务：故障修复');

      expect(response.success).toBe(true);
      expect(response.task!.priority).toBe(TaskPriority.URGENT);
    });

    it('should create high priority task', async () => {
      const response = await taskAgent.handleTaskCreation(testUserId, '创建重要任务：数据备份');

      expect(response.success).toBe(true);
      expect(response.task!.priority).toBe(TaskPriority.HIGH);
    });
  });

  describe('Task Lifecycle', () => {
    it('should progress task through full lifecycle', async () => {
      // Create
      const createResponse = await taskAgent.handleTaskCreation(testUserId, '训练任务');
      const taskId = createResponse.task!.id;
      expect(createResponse.task!.status).toBe(TaskStatus.PENDING);

      // Start
      const startedTask = await taskService.startTask(taskId, 'server-1');
      expect(startedTask.status).toBe(TaskStatus.RUNNING);
      expect(startedTask.startedAt).toBeDefined();
      expect(startedTask.serverId).toBe('server-1');

      // Complete
      const completedTask = await taskService.completeTask(taskId, '训练完成，准确率 95%');
      expect(completedTask.status).toBe(TaskStatus.COMPLETED);
      expect(completedTask.result).toContain('95%');
      expect(completedTask.completedAt).toBeDefined();
    });

    it('should handle task failure', async () => {
      const createResponse = await taskAgent.handleTaskCreation(testUserId, '测试任务');
      const taskId = createResponse.task!.id;

      await taskService.startTask(taskId, 'server-1');
      const failedTask = await taskService.failTask(taskId, '内存不足');

      expect(failedTask.status).toBe(TaskStatus.FAILED);
      expect(failedTask.result).toBe('内存不足');
    });

    it('should cancel pending task', async () => {
      const createResponse = await taskAgent.handleTaskCreation(testUserId, '待取消任务');
      const taskId = createResponse.task!.id;

      const cancelledTask = await taskService.cancelTask(taskId, testUserId);
      expect(cancelledTask.status).toBe(TaskStatus.CANCELLED);
    });

    it('should cancel running task', async () => {
      const createResponse = await taskAgent.handleTaskCreation(testUserId, '运行中任务');
      const taskId = createResponse.task!.id;

      await taskService.startTask(taskId, 'server-1');
      const cancelledTask = await taskService.cancelTask(taskId, testUserId);
      expect(cancelledTask.status).toBe(TaskStatus.CANCELLED);
    });
  });

  describe('Task Query', () => {
    it('should retrieve user tasks', async () => {
      await taskAgent.handleTaskCreation(testUserId, '任务1');
      await taskAgent.handleTaskCreation(testUserId, '任务2');
      await taskAgent.handleTaskCreation(testUserId, '任务3');

      const tasks = await taskService.getUserTasks(testUserId);
      expect(tasks.length).toBe(3);
    });

    it('should filter tasks by status', async () => {
      const response1 = await taskAgent.handleTaskCreation(testUserId, '待处理任务');
      const response2 = await taskAgent.handleTaskCreation(testUserId, '运行中任务');

      await taskService.startTask(response2.task!.id, 'server-1');

      const pendingTasks = await taskService.getUserTasks(testUserId, TaskStatus.PENDING);
      expect(pendingTasks.length).toBe(1);

      const runningTasks = await taskService.getUserTasks(testUserId, TaskStatus.RUNNING);
      expect(runningTasks.length).toBe(1);
    });

    it('should get task by ID', async () => {
      const createResponse = await taskAgent.handleTaskCreation(testUserId, '查询任务');
      const taskId = createResponse.task!.id;

      const task = await taskService.getTask(taskId);
      expect(task).not.toBeNull();
      expect(task!.id).toBe(taskId);
    });
  });

  describe('Task Statistics', () => {
    it('should return correct task statistics', async () => {
      // Create multiple tasks
      const r1 = await taskAgent.handleTaskCreation(testUserId, '任务A');
      const r2 = await taskAgent.handleTaskCreation(testUserId, '任务B');
      const r3 = await taskAgent.handleTaskCreation(testUserId, '任务C');
      const r4 = await taskAgent.handleTaskCreation(testUserId, '任务D');

      // Start and complete some
      await taskService.startTask(r1.task!.id, 'server-1');
      await taskService.completeTask(r1.task!.id, '完成');

      await taskService.startTask(r2.task!.id, 'server-2');
      await taskService.failTask(r2.task!.id, '失败');

      await taskService.cancelTask(r3.task!.id, testUserId);

      const stats = await taskService.getStats();
      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(1);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.cancelled).toBe(1);
    });
  });

  describe('Authorization', () => {
    it('should prevent unauthorized cancellation', async () => {
      const createResponse = await taskAgent.handleTaskCreation(testUserId, '用户任务');
      const taskId = createResponse.task!.id;

      await expect(taskService.cancelTask(taskId, 'other-user'))
        .rejects.toThrow('Not authorized');
    });

    it('should allow owner to cancel', async () => {
      const createResponse = await taskAgent.handleTaskCreation(testUserId, '所有者任务');
      const taskId = createResponse.task!.id;

      const result = await taskService.cancelTask(taskId, testUserId);
      expect(result.status).toBe(TaskStatus.CANCELLED);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent task', async () => {
      const task = await taskService.getTask('non-existent');
      expect(task).toBeNull();
    });

    it('should prevent starting non-pending task', async () => {
      const r = await taskAgent.handleTaskCreation(testUserId, '已完成任务');
      await taskService.startTask(r.task!.id, 'server-1');
      await taskService.completeTask(r.task!.id, '完成');

      await expect(taskService.startTask(r.task!.id, 'server-2'))
        .rejects.toThrow('cannot be started');
    });

    it('should prevent completing non-running task', async () => {
      const r = await taskAgent.handleTaskCreation(testUserId, '待处理任务');

      await expect(taskService.completeTask(r.task!.id, '结果'))
        .rejects.toThrow('not running');
    });

    it('should prevent cancelling completed task', async () => {
      const r = await taskAgent.handleTaskCreation(testUserId, '已完成任务');
      await taskService.startTask(r.task!.id, 'server-1');
      await taskService.completeTask(r.task!.id, '完成');

      await expect(taskService.cancelTask(r.task!.id, testUserId))
        .rejects.toThrow('Cannot cancel completed task');
    });
  });

  describe('Task Priority', () => {
    it('should create tasks with different priorities', async () => {
      const low = await taskService.createTask({ name: '低优先级', userId: testUserId, priority: TaskPriority.LOW });
      const medium = await taskService.createTask({ name: '中等优先级', userId: testUserId, priority: TaskPriority.MEDIUM });
      const high = await taskService.createTask({ name: '高优先级', userId: testUserId, priority: TaskPriority.HIGH });
      const urgent = await taskService.createTask({ name: '紧急', userId: testUserId, priority: TaskPriority.URGENT });

      expect(low.priority).toBe(TaskPriority.LOW);
      expect(medium.priority).toBe(TaskPriority.MEDIUM);
      expect(high.priority).toBe(TaskPriority.HIGH);
      expect(urgent.priority).toBe(TaskPriority.URGENT);
    });

    it('should default to medium priority', async () => {
      const task = await taskService.createTask({ name: '默认优先级', userId: testUserId });
      expect(task.priority).toBe(TaskPriority.MEDIUM);
    });
  });
});