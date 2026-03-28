import { GpuService } from '../../services/gpu.service';

// Mock prisma from utils/prisma
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    gpu: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    gpuAllocation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    server: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock email-queue.service to prevent actual email operations
jest.mock('../../services/email-queue.service', () => ({
  emailQueueService: {
    enqueue: jest.fn().mockResolvedValue(undefined),
  },
}));

import prisma from '../../utils/prisma';

describe('GpuService', () => {
  let gpuService: GpuService;

  beforeEach(() => {
    gpuService = new GpuService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('allocateGpu', () => {
    it('should allocate GPU successfully', async () => {
      const mockGpu = {
        id: '1',
        model: 'RTX 3090',
        memory: 24,
        serverId: 'server-1',
        server: { name: 'Test Server' },
      };

      (prisma.gpu.findFirst as jest.Mock).mockResolvedValue(mockGpu);
      (prisma.gpuAllocation.create as jest.Mock).mockResolvedValue({ id: 'alloc-1' });
      (prisma.gpu.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'test@example.com', username: 'testuser' });
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({ name: 'Test Task' });

      const result = await gpuService.allocateGpu({
        userId: 'user-1',
        taskId: 'task-1',
      });

      expect(result).toBeDefined();
      expect(result.gpuModel).toBe('RTX 3090');
    });

    it('should throw error if no GPU available', async () => {
      (prisma.gpu.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        gpuService.allocateGpu({
          userId: 'user-1',
        })
      ).rejects.toThrow('No available GPU matching criteria');
    });
  });

  describe('releaseGpu', () => {
    it('should release GPU successfully', async () => {
      const mockAllocation = {
        id: 'alloc-1',
        userId: 'user-1',
        status: 'ACTIVE',
        gpuId: 'gpu-1',
        gpu: {
          model: 'RTX 3090',
          memory: 24,
          server: { name: 'Test Server' },
        },
      };

      (prisma.gpuAllocation.findUnique as jest.Mock).mockResolvedValue(mockAllocation);
      (prisma.gpuAllocation.update as jest.Mock).mockResolvedValue({});
      (prisma.gpu.update as jest.Mock).mockResolvedValue({});
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'test@example.com', username: 'testuser' });

      const result = await gpuService.releaseGpu('alloc-1', 'user-1');

      expect(result.success).toBe(true);
    });
  });
});