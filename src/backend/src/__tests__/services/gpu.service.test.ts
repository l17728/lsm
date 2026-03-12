import { GpuService } from '../services/gpu.service';
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
    gpuService = new GpuService(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableGpus', () => {
    it('should return available GPUs', async () => {
      const mockGpus = [
        { id: '1', model: 'RTX 3090', memory: 24, allocated: false },
        { id: '2', model: 'RTX 3080', memory: 10, allocated: false },
      ];

      mockPrisma.gpu.findMany.mockResolvedValue(mockGpus);

      const result = await gpuService.getAvailableGpus();

      expect(result).toEqual(mockGpus);
      expect(mockPrisma.gpu.findMany).toHaveBeenCalledWith({
        where: { allocated: false },
      });
    });
  });

  describe('allocateGpu', () => {
    it('should allocate GPU successfully', async () => {
      const mockGpu = {
        id: '1',
        model: 'RTX 3090',
        memory: 24,
        allocated: true,
      };

      mockPrisma.gpu.findUnique.mockResolvedValue({
        id: '1',
        allocated: false,
      });
      mockPrisma.gpu.update.mockResolvedValue(mockGpu);
      mockPrisma.gpuAllocation.create.mockResolvedValue({ id: 'alloc-1' });

      const result = await gpuService.allocateGpu({
        userId: 'user-1',
        gpuId: '1',
        taskId: 'task-1',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.gpu.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { allocated: true },
      });
    });

    it('should throw error if GPU not found', async () => {
      mockPrisma.gpu.findUnique.mockResolvedValue(null);

      await expect(
        gpuService.allocateGpu({
          userId: 'user-1',
          gpuId: '999',
          taskId: 'task-1',
        })
      ).rejects.toThrow('GPU not found');
    });
  });

  describe('releaseGpu', () => {
    it('should release GPU successfully', async () => {
      mockPrisma.gpu.findUnique.mockResolvedValue({ id: '1', allocated: true });
      mockPrisma.gpu.update.mockResolvedValue({
        id: '1',
        allocated: false,
      });

      const result = await gpuService.releaseGpu('1');

      expect(result.allocated).toBe(false);
      expect(mockPrisma.gpu.update).toHaveBeenCalled();
    });
  });
});
