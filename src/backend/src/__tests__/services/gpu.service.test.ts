import { GpuService } from '../../services/gpu.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      gpu: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      gpuAllocation: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      server: {
        findUnique: jest.fn(),
      },
    })),
  };
});

describe('GpuService', () => {
  let gpuService: GpuService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
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

      mockPrisma.gpu.findFirst.mockResolvedValue(mockGpu);
      mockPrisma.gpuAllocation.create.mockResolvedValue({ id: 'alloc-1' });
      mockPrisma.gpu.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'test@example.com', username: 'testuser' });
      mockPrisma.task.findUnique.mockResolvedValue({ name: 'Test Task' });

      const result = await gpuService.allocateGpu({
        userId: 'user-1',
        taskId: 'task-1',
      });

      expect(result).toBeDefined();
      expect(result.gpuModel).toBe('RTX 3090');
    });

    it('should throw error if no GPU available', async () => {
      mockPrisma.gpu.findFirst.mockResolvedValue(null);

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

      mockPrisma.gpuAllocation.findUnique.mockResolvedValue(mockAllocation);
      mockPrisma.gpuAllocation.update.mockResolvedValue({});
      mockPrisma.gpu.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'test@example.com', username: 'testuser' });

      const result = await gpuService.releaseGpu('alloc-1', 'user-1');

      expect(result.success).toBe(true);
    });
  });
});
