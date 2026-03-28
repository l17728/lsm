/**
 * Task Service Tests
 * 
 * Tests for task management, status updates, and notifications
 */

// Mock dependencies before import
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    task: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../services/email-queue.service', () => ({
  emailQueueService: {
    enqueue: jest.fn().mockResolvedValue(undefined),
  },
}));

import prisma from '../../utils/prisma';
import { TaskService } from '../../services/task.service';

describe('TaskService', () => {
  let taskService: TaskService;

  beforeEach(() => {
    jest.clearAllMocks();
    taskService = new TaskService();
  });

  describe('getUserTasks', () => {
    it('should return user tasks', async () => {
      const mockTasks = [
        { id: '1', name: 'Task 1', status: 'PENDING', priority: 'HIGH', userId: 'user-1', server: null },
        { id: '2', name: 'Task 2', status: 'RUNNING', priority: 'MEDIUM', userId: 'user-1', server: { id: 's1', name: 'Server 1' } },
      ];

      (prisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      const result = await taskService.getUserTasks('user-1');

      expect(result).toEqual(mockTasks);
    });

    it('should filter tasks by status', async () => {
      const mockTasks = [
        { id: '1', name: 'Task 1', status: 'PENDING', priority: 'HIGH', userId: 'user-1', server: null },
      ];

      (prisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      await taskService.getUserTasks('user-1', 'PENDING' as any);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'PENDING' },
        })
      );
    });
  });

  describe('createTask', () => {
    it('should create task successfully', async () => {
      const mockTask = {
        id: 'task-1',
        name: 'New Task',
        status: 'PENDING',
        priority: 'HIGH',
        userId: 'user-1',
        user: { id: 'user-1', username: 'testuser', email: 'test@example.com' },
      };

      (prisma.task.create as jest.Mock).mockResolvedValue(mockTask);

      const result = await taskService.createTask({
        name: 'New Task',
        userId: 'user-1',
        priority: 'HIGH' as any,
      });

      expect(result).toEqual(mockTask);
    });

    it('should use default priority when not specified', async () => {
      const mockTask = {
        id: 'task-1',
        name: 'Task',
        priority: 'MEDIUM',
        userId: 'user-1',
        user: null,
      };

      (prisma.task.create as jest.Mock).mockResolvedValue(mockTask);

      await taskService.createTask({
        name: 'Task',
        userId: 'user-1',
      });

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 'MEDIUM',
          }),
        })
      );
    });
  });

  describe('getTask', () => {
    it('should return task by ID', async () => {
      const mockTask = {
        id: '1',
        name: 'Task 1',
        status: 'PENDING',
        user: { id: 'user-1', username: 'testuser' },
        server: null,
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(mockTask);

      const result = await taskService.getTask('1');

      expect(result).toEqual(mockTask);
    });

    it('should return null for non-existent task', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await taskService.getTask('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('startTask', () => {
    it('should start task successfully', async () => {
      const mockTask = {
        id: '1',
        name: 'Task 1',
        status: 'RUNNING',
        startedAt: expect.any(Date),
        serverId: 'server-1',
      };

      (prisma.task.update as jest.Mock).mockResolvedValue(mockTask);

      const result = await taskService.startTask('1', 'server-1');

      expect(result.status).toBe('RUNNING');
    });
  });

  describe('completeTask', () => {
    it('should complete task successfully', async () => {
      const mockTask = {
        id: '1',
        name: 'Task 1',
        status: 'COMPLETED',
        completedAt: expect.any(Date),
        result: 'Success',
        user: { id: 'user-1', username: 'testuser', email: 'test@example.com' },
      };

      (prisma.task.update as jest.Mock).mockResolvedValue(mockTask);

      const result = await taskService.completeTask('1', 'Success');

      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('failTask', () => {
    it('should fail task with error message', async () => {
      const mockTask = {
        id: '1',
        name: 'Task 1',
        status: 'FAILED',
        completedAt: expect.any(Date),
        result: 'Error occurred',
        user: { id: 'user-1', username: 'testuser', email: 'test@example.com' },
      };

      (prisma.task.update as jest.Mock).mockResolvedValue(mockTask);

      const result = await taskService.failTask('1', 'Error occurred');

      expect(result.status).toBe('FAILED');
    });
  });

  describe('cancelTask', () => {
    it('should cancel task successfully', async () => {
      const existingTask = {
        id: '1',
        userId: 'user-1',
        status: 'PENDING',
      };

      const cancelledTask = {
        id: '1',
        name: 'Task 1',
        status: 'CANCELLED',
        completedAt: expect.any(Date),
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(existingTask);
      (prisma.task.update as jest.Mock).mockResolvedValue(cancelledTask);

      const result = await taskService.cancelTask('1', 'user-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error for non-existent task', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(taskService.cancelTask('nonexistent', 'user-1'))
        .rejects.toThrow('Task not found');
    });

    it('should throw error for completed task', async () => {
      const existingTask = {
        id: '1',
        userId: 'user-1',
        status: 'COMPLETED',
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(existingTask);

      await expect(taskService.cancelTask('1', 'user-1'))
        .rejects.toThrow('Cannot cancel a completed task');
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks', async () => {
      const mockTasks = [
        { id: '1', name: 'Task 1', status: 'PENDING', user: { id: 'u1', username: 'user1' }, server: null },
        { id: '2', name: 'Task 2', status: 'RUNNING', user: { id: 'u2', username: 'user2' }, server: { id: 's1', name: 'Server 1' } },
      ];

      (prisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      const result = await taskService.getAllTasks();

      expect(result).toEqual(mockTasks);
    });
  });

  describe('getPendingTasks', () => {
    it('should return pending tasks ordered by priority', async () => {
      const mockTasks = [
        { id: '1', name: 'Task 1', status: 'PENDING', priority: 'CRITICAL', user: { id: 'u1', username: 'user1' } },
        { id: '2', name: 'Task 2', status: 'PENDING', priority: 'HIGH', user: { id: 'u2', username: 'user2' } },
      ];

      (prisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      const result = await taskService.getPendingTasks();

      expect(result).toEqual(mockTasks);
    });
  });

  describe('getTaskStats', () => {
    it('should return task statistics', async () => {
      const mockTasks = [
        { status: 'PENDING' },
        { status: 'PENDING' },
        { status: 'RUNNING' },
        { status: 'COMPLETED' },
        { status: 'FAILED' },
        { status: 'CANCELLED' },
      ];

      (prisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      const stats = await taskService.getTaskStats();

      expect(stats.total).toBe(6);
      expect(stats.pending).toBe(2);
      expect(stats.running).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.cancelled).toBe(1);
    });
  });

  describe('updateTask', () => {
    it('should update task successfully', async () => {
      const existingTask = {
        id: '1',
        name: 'Old Name',
        userId: 'user-1',
      };

      const updatedTask = {
        id: '1',
        name: 'New Name',
        userId: 'user-1',
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(existingTask);
      (prisma.task.update as jest.Mock).mockResolvedValue(updatedTask);

      const result = await taskService.updateTask('1', { name: 'New Name' }, 'user-1');

      expect(result.name).toBe('New Name');
    });

    it('should throw error for non-existent task', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(taskService.updateTask('nonexistent', { name: 'New' }, 'user-1'))
        .rejects.toThrow('Task not found');
    });

    it('should throw error for unauthorized user', async () => {
      const existingTask = {
        id: '1',
        userId: 'user-1',
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(existingTask);

      await expect(taskService.updateTask('1', { name: 'New' }, 'user-2'))
        .rejects.toThrow('Not authorized to update this task');
    });
  });

  describe('deleteTask', () => {
    it('should delete task successfully', async () => {
      const existingTask = {
        id: '1',
        userId: 'user-1',
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(existingTask);
      (prisma.task.delete as jest.Mock).mockResolvedValue(undefined);

      await taskService.deleteTask('1', 'user-1');

      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should throw error for non-existent task', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(taskService.deleteTask('nonexistent', 'user-1'))
        .rejects.toThrow('Task not found');
    });

    it('should throw error for unauthorized user', async () => {
      const existingTask = {
        id: '1',
        userId: 'user-1',
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(existingTask);

      await expect(taskService.deleteTask('1', 'user-2'))
        .rejects.toThrow('Not authorized to delete this task');
    });
  });
});