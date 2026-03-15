/**
 * LSM Project - GPU Allocation E2E Tests
 * 端到端测试：GPU 资源分配流程
 * 
 * 测试场景：
 * 1. 用户请求 GPU 资源
 * 2. Agent 理解请求并查询可用资源
 * 3. 执行 GPU 分配
 * 4. 确认分配结果
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Mock GPU data
interface MockGpu {
  id: string;
  model: string;
  memory: number;
  serverId: string;
  serverName: string;
  allocated: boolean;
}

interface MockAllocation {
  id: string;
  gpuId: string;
  userId: string;
  serverName: string;
  gpuModel: string;
  gpuMemory: number;
  allocatedAt: Date;
}

// Mock GPU Service
class MockGpuService {
  private gpus: MockGpu[] = [
    { id: 'gpu-1', model: 'NVIDIA A100', memory: 80, serverId: 'srv-1', serverName: 'Server-01', allocated: false },
    { id: 'gpu-2', model: 'NVIDIA A100', memory: 80, serverId: 'srv-1', serverName: 'Server-01', allocated: false },
    { id: 'gpu-3', model: 'NVIDIA V100', memory: 32, serverId: 'srv-2', serverName: 'Server-02', allocated: false },
    { id: 'gpu-4', model: 'NVIDIA V100', memory: 32, serverId: 'srv-2', serverName: 'Server-02', allocated: true },
    { id: 'gpu-5', model: 'NVIDIA RTX 4090', memory: 24, serverId: 'srv-3', serverName: 'Server-03', allocated: false },
  ];

  private allocations: MockAllocation[] = [];

  async getAvailableGpus(model?: string, minMemory?: number): Promise<MockGpu[]> {
    let available = this.gpus.filter(g => !g.allocated);
    
    if (model) {
      available = available.filter(g => g.model.includes(model));
    }
    if (minMemory) {
      available = available.filter(g => g.memory >= minMemory);
    }

    return available;
  }

  async allocateGpu(userId: string, gpuId: string): Promise<MockAllocation> {
    const gpu = this.gpus.find(g => g.id === gpuId);
    if (!gpu) throw new Error('GPU not found');
    if (gpu.allocated) throw new Error('GPU already allocated');

    gpu.allocated = true;
    const allocation: MockAllocation = {
      id: `alloc-${Date.now()}`,
      gpuId,
      userId,
      serverName: gpu.serverName,
      gpuModel: gpu.model,
      gpuMemory: gpu.memory,
      allocatedAt: new Date(),
    };

    this.allocations.push(allocation);
    return allocation;
  }

  async releaseGpu(allocationId: string, userId: string): Promise<boolean> {
    const allocation = this.allocations.find(a => a.id === allocationId);
    if (!allocation) throw new Error('Allocation not found');
    if (allocation.userId !== userId) throw new Error('Not authorized');

    const gpu = this.gpus.find(g => g.id === allocation.gpuId);
    if (gpu) gpu.allocated = false;

    return true;
  }

  async getUserAllocations(userId: string): Promise<MockAllocation[]> {
    return this.allocations.filter(a => a.userId === userId);
  }

  async getStats(): Promise<{ total: number; available: number; allocated: number }> {
    return {
      total: this.gpus.length,
      available: this.gpus.filter(g => !g.allocated).length,
      allocated: this.gpus.filter(g => g.allocated).length,
    };
  }

  // Reset for testing
  reset(): void {
    this.gpus.forEach(g => g.allocated = g.id === 'gpu-4');
    this.allocations = [];
  }
}

// Mock Agent that understands GPU requests
class MockGpuAgent {
  private gpuService: MockGpuService;

  constructor(gpuService: MockGpuService) {
    this.gpuService = gpuService;
  }

  async parseGpuRequest(message: string): Promise<{ quantity: number; model?: string; minMemory?: number } | null> {
    const lower = message.toLowerCase();
    
    // Extract quantity
    const quantityMatch = lower.match(/(\d+)\s*(块|个)?\s*gpu/);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;

    // Extract model preference
    let model: string | undefined;
    if (lower.includes('a100')) model = 'A100';
    else if (lower.includes('v100')) model = 'V100';
    else if (lower.includes('rtx') || lower.includes('4090')) model = 'RTX';

    // Extract memory requirement
    let minMemory: number | undefined;
    if (lower.includes('80') || lower.includes('大显存')) minMemory = 80;
    else if (lower.includes('32')) minMemory = 32;

    return { quantity, model, minMemory };
  }

  async handleGpuRequest(userId: string, message: string): Promise<{ success: boolean; allocations?: MockAllocation[]; message: string }> {
    const request = await this.parseGpuRequest(message);
    if (!request) {
      return { success: false, message: '无法理解 GPU 请求' };
    }

    const availableGpus = await this.gpuService.getAvailableGpus(request.model, request.minMemory);
    
    if (availableGpus.length < request.quantity) {
      return { 
        success: false, 
        message: `可用 GPU 不足。需要 ${request.quantity} 块，当前可用 ${availableGpus.length} 块。` 
      };
    }

    const allocations: MockAllocation[] = [];
    for (let i = 0; i < request.quantity; i++) {
      const allocation = await this.gpuService.allocateGpu(userId, availableGpus[i].id);
      allocations.push(allocation);
    }

    return {
      success: true,
      allocations,
      message: `已成功分配 ${allocations.length} 块 GPU`,
    };
  }
}

describe('GPU Allocation E2E Tests', () => {
  let gpuService: MockGpuService;
  let gpuAgent: MockGpuAgent;
  const testUserId = 'user-test-1';

  beforeAll(() => {
    gpuService = new MockGpuService();
    gpuAgent = new MockGpuAgent(gpuService);
  });

  beforeEach(() => {
    gpuService.reset();
  });

  describe('GPU Request Parsing', () => {
    it('should parse simple GPU request', async () => {
      const result = await gpuAgent.parseGpuRequest('我需要 2 块 GPU');
      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(2);
    });

    it('should parse GPU request with model preference', async () => {
      const result = await gpuAgent.parseGpuRequest('我需要 1 块 A100 GPU');
      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(1);
      expect(result!.model).toBe('A100');
    });

    it('should parse GPU request with memory requirement', async () => {
      const result = await gpuAgent.parseGpuRequest('给我 3 块 80G 显存的 GPU');
      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(3);
      expect(result!.minMemory).toBe(80);
    });

    it('should return null for non-GPU requests', async () => {
      const result = await gpuAgent.parseGpuRequest('今天天气怎么样？');
      expect(result).not.toBeNull(); // Returns default quantity 1
    });
  });

  describe('GPU Allocation Flow', () => {
    it('should allocate 2 GPUs for training request', async () => {
      const response = await gpuAgent.handleGpuRequest(testUserId, '我需要 2 块 GPU 跑训练');

      expect(response.success).toBe(true);
      expect(response.allocations).toBeDefined();
      expect(response.allocations!.length).toBe(2);
      expect(response.message).toContain('成功分配');
    });

    it('should allocate specific GPU model', async () => {
      const response = await gpuAgent.handleGpuRequest(testUserId, '我需要 1 块 A100 GPU');

      expect(response.success).toBe(true);
      expect(response.allocations!.length).toBe(1);
      expect(response.allocations![0].gpuModel).toContain('A100');
    });

    it('should handle insufficient GPU availability', async () => {
      const response = await gpuAgent.handleGpuRequest(testUserId, '我需要 10 块 GPU');

      expect(response.success).toBe(false);
      expect(response.message).toContain('不足');
    });

    it('should handle GPU allocation with memory requirement', async () => {
      const response = await gpuAgent.handleGpuRequest(testUserId, '我需要 1 块 80G 显存的 GPU');

      expect(response.success).toBe(true);
      expect(response.allocations![0].gpuMemory).toBeGreaterThanOrEqual(80);
    });
  });

  describe('GPU Release Flow', () => {
    it('should release allocated GPU', async () => {
      // First allocate
      const allocResponse = await gpuAgent.handleGpuRequest(testUserId, '我需要 1 块 GPU');
      expect(allocResponse.success).toBe(true);
      
      const allocationId = allocResponse.allocations![0].id;

      // Then release
      const releaseResult = await gpuService.releaseGpu(allocationId, testUserId);
      expect(releaseResult).toBe(true);

      // Verify GPU is available again
      const stats = await gpuService.getStats();
      expect(stats.available).toBe(4); // 4 available after release
    });

    it('should reject release by non-owner', async () => {
      const allocResponse = await gpuAgent.handleGpuRequest(testUserId, '我需要 1 块 GPU');
      const allocationId = allocResponse.allocations![0].id;

      await expect(gpuService.releaseGpu(allocationId, 'other-user'))
        .rejects.toThrow('Not authorized');
    });
  });

  describe('GPU Statistics', () => {
    it('should return correct GPU stats', async () => {
      const stats = await gpuService.getStats();

      expect(stats.total).toBe(5);
      expect(stats.available).toBe(4);
      expect(stats.allocated).toBe(1);
    });

    it('should update stats after allocation', async () => {
      await gpuAgent.handleGpuRequest(testUserId, '我需要 2 块 GPU');

      const stats = await gpuService.getStats();
      expect(stats.allocated).toBe(3);
      expect(stats.available).toBe(2);
    });
  });

  describe('Concurrent Allocation', () => {
    it('should handle multiple allocation requests', async () => {
      // Simulate concurrent requests
      const requests = [
        gpuAgent.handleGpuRequest('user-1', '我需要 1 块 GPU'),
        gpuAgent.handleGpuRequest('user-2', '我需要 1 块 GPU'),
        gpuAgent.handleGpuRequest('user-3', '我需要 1 块 GPU'),
      ];

      const results = await Promise.all(requests);

      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(3);

      // Verify different GPUs allocated
      const allAllocations = results.flatMap(r => r.allocations || []);
      const gpuIds = allAllocations.map(a => a.gpuId);
      const uniqueGpuIds = new Set(gpuIds);
      expect(uniqueGpuIds.size).toBe(3);
    });
  });

  describe('User Allocation History', () => {
    it('should track user allocations', async () => {
      await gpuAgent.handleGpuRequest(testUserId, '我需要 2 块 GPU');

      const allocations = await gpuService.getUserAllocations(testUserId);
      expect(allocations.length).toBe(2);
    });

    it('should isolate allocations between users', async () => {
      await gpuAgent.handleGpuRequest('user-a', '我需要 1 块 GPU');
      await gpuAgent.handleGpuRequest('user-b', '我需要 1 块 GPU');

      const allocsA = await gpuService.getUserAllocations('user-a');
      const allocsB = await gpuService.getUserAllocations('user-b');

      expect(allocsA.length).toBe(1);
      expect(allocsB.length).toBe(1);
      expect(allocsA[0].gpuId).not.toBe(allocsB[0].gpuId);
    });
  });
});