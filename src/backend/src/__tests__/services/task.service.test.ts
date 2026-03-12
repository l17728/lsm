import { TaskService } from '../services/task.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      task: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    })),
  };
});

describe('TaskService', () => {
  let taskService: TaskService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    taskService = new TaskService(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTasks', () => {
    it('should return all tasks', async () => {
      const mockTasks = [
        { id: '1', name: 'Task 1', status: 'PENDING', priority: 'HIGH' },
        { id: '2', name: 'Task 2', status: 'RUNNING', priority: 'MEDIUM' },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const result = await taskService.getTasks();

      expect(result).toEqual(mockTasks);
      expect(mockPrisma.task.findMany).toHaveBeenCalled();
    });
  });

  describe('createTask', () => {
    it('should create task successfully', async () => {
      const mockTask = {
        id: '1',
        name: 'New Task',
        status: 'PENDING',
        priority: 'HIGH',
      };

      mockPrisma.task.create.mockResolvedValue(mockTask);

      const result = await taskService.createTask({
        name: 'New Task',
        priority: 'HIGH',
      });

      expect(result).toEqual(mockTask);
      expect(mockPrisma.task.create).toHaveBeenCalledWith({
        data: {
          name: 'New Task',
          priority: 'HIGH',
          status: 'PENDING',
        },
      });
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status successfully', async () => {
      const mockTask = {
        id: '1',
        name: 'Task 1',
        status: 'RUNNING',
      };

      mockPrisma.task.update.mockResolvedValue(mockTask);

      const result = await taskService.updateTaskStatus('1', 'RUNNING');

      expect(result.status).toBe('RUNNING');
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: 'RUNNING' },
      });
    });

    it('should throw error if task not found', async () => {
      mockPrisma.task.update.mockRejectedValue(new Error('Task not found'));

      await expect(
        taskService.updateTaskStatus('999', 'COMPLETED')
      ).rejects.toThrow('Task not found');
    });
  });

  describe('cancelTask', () => {
    it('should cancel task successfully', async () => {
      const mockTask = {
        id: '1',
        name: 'Task 1',
        status: 'CANCELLED',
      };

      mockPrisma.task.update.mockResolvedValue(mockTask);

      const result = await taskService.cancelTask('1');

      expect(result.status).toBe('CANCELLED');
    });
  });
});
