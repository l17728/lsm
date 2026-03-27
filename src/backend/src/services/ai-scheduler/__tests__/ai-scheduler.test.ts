/**
 * AI 智能调度系统 - 单元测试
 * @version 3.1.0
 */

import { AISchedulerService } from '../ai-scheduler.service';
import { GpuPredictorService } from '../gpu-predictor.service';
import { LoadBalancerService } from '../load-balancer.service';
import { task_priority as TaskPriority } from '@prisma/client';

// Mock Prisma
jest.mock('../../../utils/prisma', () => {
  const mockPrisma = {
    task: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
      create: jest.fn(),
    },
    server: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    gpu: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    gpuAllocation: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    serverMetric: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockPrisma,
  };
});

describe('AISchedulerService', () => {
  let service: AISchedulerService;

  beforeEach(() => {
    service = new AISchedulerService();
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Mock is already set up at module level with mockResolvedValue([])
      await service.initialize();

      expect(service.getModelStatus().initialized).toBe(true);
    });
  });

  describe('priorityToNumber', () => {
    it('should convert LOW priority to 0', () => {
      // Test with string directly first
      const resultStr = (service as any).priorityToNumber('LOW');
      expect(resultStr).toBe(0);
      
      // Then test with enum
      const result = (service as any).priorityToNumber(TaskPriority.LOW);
      expect(result).toBe(0);
    });

    it('should convert MEDIUM priority to 1', () => {
      const result = (service as any).priorityToNumber('MEDIUM');
      expect(result).toBe(1);
    });

    it('should convert HIGH priority to 2', () => {
      const result = (service as any).priorityToNumber('HIGH');
      expect(result).toBe(2);
    });

    it('should convert CRITICAL priority to 3', () => {
      const result = (service as any).priorityToNumber('CRITICAL');
      expect(result).toBe(3);
    });
  });

  describe('normalize', () => {
    it('should normalize value within range', () => {
      const result = (service as any).normalize(50, 0, 100);
      expect(result).toBe(0.5);
    });

    it('should return 0 for value below min', () => {
      const result = (service as any).normalize(-10, 0, 100);
      expect(result).toBe(0);
    });

    it('should return 1 for value above max', () => {
      const result = (service as any).normalize(150, 0, 100);
      expect(result).toBe(1);
    });
  });

  describe('getModelStatus', () => {
    it('should return model status', () => {
      const status = service.getModelStatus();

      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('weights');
      expect(status).toHaveProperty('historySize');
    });
  });

  describe('estimateResourceRequirements', () => {
    it('should estimate training task requirements', () => {
      const result = (service as any).estimateResourceRequirements('Model Training Task', null);

      expect(result.duration).toBeGreaterThan(60);
      expect(result.gpuMemory).toBeGreaterThan(10);
    });

    it('should estimate inference task requirements', () => {
      const result = (service as any).estimateResourceRequirements('Model Inference', null);

      expect(result.duration).toBeLessThan(60);
    });

    it('should estimate fine-tuning task requirements', () => {
      const result = (service as any).estimateResourceRequirements('Fine-tune model', null);

      expect(result.duration).toBeGreaterThan(60);
      expect(result.gpuMemory).toBeGreaterThan(10);
    });
  });
});

describe('GpuPredictorService', () => {
  let service: GpuPredictorService;

  beforeEach(() => {
    service = new GpuPredictorService();
    jest.clearAllMocks();
  });

  describe('categorizeTask', () => {
    it('should categorize training tasks', () => {
      const result = (service as any).categorizeTask('Model Training Task');
      expect(result).toBe('training');
    });

    it('should categorize inference tasks', () => {
      const result = (service as any).categorizeTask('Model Inference');
      expect(result).toBe('inference');
    });

    it('should categorize fine-tuning tasks', () => {
      const result = (service as any).categorizeTask('Fine-tune model');
      expect(result).toBe('fine-tuning');
    });

    it('should return null for unknown task types', () => {
      const result = (service as any).categorizeTask('Random Task');
      expect(result).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Mock is already set up at module level with mockResolvedValue([])
      await service.initialize();

      expect((service as any).initialized).toBe(true);
    });
  });

  describe('getGpuPatterns', () => {
    it('should return empty array when no patterns', () => {
      const patterns = service.getGpuPatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });
});

describe('LoadBalancerService', () => {
  let service: LoadBalancerService;

  beforeEach(() => {
    service = new LoadBalancerService();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect((service as any).config).toBeDefined();
      expect((service as any).config.cpuThreshold).toBe(80);
    });

    it('should accept custom config', () => {
      const customService = new LoadBalancerService({ cpuThreshold: 90 });
      expect((customService as any).config.cpuThreshold).toBe(90);
    });
  });

  describe('calculateLoadScore', () => {
    it('should calculate weighted load score', () => {
      const result = (service as any).calculateLoadScore({
        cpuLoad: 50,
        memoryLoad: 60,
        gpuLoad: 40,
        networkLoad: 20,
        diskLoad: 10,
      });

      // CPU (0.35 * 50) + Memory (0.25 * 60) + GPU (0.25 * 40) + Network (0.10 * 20) + Disk (0.05 * 10)
      // = 17.5 + 15 + 10 + 2 + 0.5 = 45
      expect(result).toBeCloseTo(45, 1);
    });
  });

  describe('updateConfig', () => {
    it('should update config values', () => {
      service.updateConfig({ cpuThreshold: 95 });

      expect((service as any).config.cpuThreshold).toBe(95);
    });
  });

  describe('isInCoolingPeriod', () => {
    it('should return false after cooling period', () => {
      // Set last balancing time to past
      (service as any).lastBalancingTime = new Date(Date.now() - 600000); // 10 minutes ago
      
      const result = (service as any).isInCoolingPeriod();
      expect(result).toBe(false);
    });

    it('should return true during cooling period', () => {
      (service as any).lastBalancingTime = new Date();
      
      const result = (service as any).isInCoolingPeriod();
      expect(result).toBe(true);
    });
  });

  describe('detectImbalance', () => {
    it('should detect imbalance when load difference is high', () => {
      const loads = [
        { loadScore: 80, serverId: '1', serverName: 'Server1' },
        { loadScore: 20, serverId: '2', serverName: 'Server2' },
      ];

      const result = (service as any).detectImbalance(loads);

      expect(result.isImbalanced).toBe(true);
    });

    it('should not detect imbalance when load is balanced', () => {
      const loads = [
        { loadScore: 50, serverId: '1', serverName: 'Server1' },
        { loadScore: 55, serverId: '2', serverName: 'Server2' },
      ];

      const result = (service as any).detectImbalance(loads);

      expect(result.isImbalanced).toBe(false);
    });
  });
});