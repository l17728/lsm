import { TaskService } from '../../services/task.service';
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
    taskService = new TaskService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserTasks', () => {
    it('should return user tasks', async () => {
      const mockTasks = [
        { id: '1', name: 'Task 1', status: 'PENDING', priority: 'HIGH' },
        { id: '2', name: 'Task 2', status: 'RUNNING', priority: 'MEDIUM' },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const result = await taskService.getUserTasks('user-1');

      expect(result).toEqual(mockTasks);
    });
  });

  describe('createTask', () => {
    it('should create task successfully', async () => {
      const mockTask = {
        id: '1',
        name: 'New Task',
        status: 'PENDING',
        priority: 'HIGH',
        userId: 'user-1',
        user: { id: 'user-1', username: 'testuser', email: 'test@example.com' },
      };

      mockPrisma.task.create.mockResolvedValue(mockTask);
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'test@example.com', username: 'testuser' });

      const result = await taskService.createTask({
        name: 'New Task',
        userId: 'user-1',
        priority: 'HIGH',
      });

      expect(result).toEqual(mockTask);
    });
  });

  describe('startTask', () => {
    it('should start task successfully', async () => {
      const mockTask = {
        id: '1',
        name: 'Task 1',
        status: 'RUNNING',
      };

      mockPrisma.task.update.mockResolvedValue(mockTask);

      const result = await taskService.startTask('1', 'server-1');

      expect(result.status).toBe('RUNNING');
    });
  });

  describe('cancelTask', () => {
    it('should cancel task successfully', async () => {
      mockPrisma.task.findUnique.mockResolvedValue({ id: '1', userId: 'user-1', status: 'PENDING' });
      mockPrisma.task.update.mockResolvedValue({
        id: '1',
        name: 'Task 1',
        status: 'CANCELLED',
      });

      const result = await taskService.cancelTask('1', 'user-1');

      expect(result.status).toBe('CANCELLED');
    });
  });
});
