/**
 * LSM MCP Server - GPU Tools Unit Tests
 * Tests lsm_allocate_gpu and lsm_release_gpu tools
 * @version 3.2.0
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock modules before importing the actual module
jest.mock('../../utils/prisma', () => {
  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    gpu: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    gpuAllocation: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    server: {
      findUnique: jest.fn(),
    },
  };
  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  };
});

jest.mock('../../services/server.service', () => ({
  serverService: {
    getById: jest.fn(),
  },
}));

import { registerGpuTools } from '../tools/gpu';
import { prisma } from '../../utils/prisma';

describe('GPU Tools', () => {
  let mockServer: McpServer;
  let registeredTools: Map<string, { desc: string; schema: any; handler: Function }>;

  beforeEach(() => {
    jest.clearAllMocks();
    registeredTools = new Map();
    mockServer = {
      // Support both 3-param (name, desc, handler) and 4-param (name, desc, schema, handler) calls
      tool: jest.fn((...args: any[]) => {
        const [name, description, third, fourth] = args;
        
        if (typeof fourth === 'function') {
          // 4-param call
          registeredTools.set(name, { desc: description, schema: third, handler: fourth });
        } else if (typeof third === 'function') {
          // 3-param call (no schema)
          registeredTools.set(name, { desc: description, schema: undefined, handler: third });
        }
      }),
    } as unknown as McpServer;
  });

  describe('Tool Registration', () => {
    it('should register lsm_allocate_gpu tool', () => {
      registerGpuTools(mockServer);
      expect(registeredTools.has('lsm_allocate_gpu')).toBe(true);
    });

    it('should register lsm_release_gpu tool', () => {
      registerGpuTools(mockServer);
      expect(registeredTools.has('lsm_release_gpu')).toBe(true);
    });

    it('should have correct descriptions', () => {
      registerGpuTools(mockServer);
      expect(registeredTools.get('lsm_allocate_gpu')!.desc).toContain('Allocate GPU');
      expect(registeredTools.get('lsm_release_gpu')!.desc).toContain('Release');
    });
  });

  describe('lsm_allocate_gpu - Input Validation', () => {
    it('should require count parameter', () => {
      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_allocate_gpu')!;
      expect(tool.schema.count).toBeDefined();
    });

    it('should require purpose parameter', () => {
      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_allocate_gpu')!;
      expect(tool.schema.purpose).toBeDefined();
    });

    it('should have optional gpu_type with valid enum', () => {
      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_allocate_gpu')!;
      expect(tool.schema.gpu_type).toBeDefined();
    });
  });

  describe('lsm_allocate_gpu - Success Cases', () => {
    it('should allocate single GPU successfully', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1', username: 'mcp-system' });
      (prisma.gpu.findMany as jest.Mock).mockResolvedValue([
        { id: 'g1', model: 'NVIDIA A100', serverId: 's1', allocated: false, server: { id: 's1', status: 'ONLINE' } },
      ]);
      (prisma.gpuAllocation.create as jest.Mock).mockResolvedValue({ id: 'a1' });
      (prisma.gpu.update as jest.Mock).mockResolvedValue({});

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_allocate_gpu')!;
      const result = await tool.handler({ count: 1, purpose: 'Model training' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.gpu_ids).toEqual(['g1']);
      expect(data.allocation_ids).toEqual(['a1']);
      expect(data.purpose).toBe('Model training');
    });

    it('should filter by GPU type preference', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1' });
      (prisma.gpu.findMany as jest.Mock).mockResolvedValue([]);

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_allocate_gpu')!;
      await tool.handler({ count: 1, purpose: 'Test', gpu_type: 'H100' });

      const findManyCall = (prisma.gpu.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.model).toBeDefined();
    });
  });

  describe('lsm_allocate_gpu - Error Cases', () => {
    it('should return error when insufficient GPUs', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1' });
      (prisma.gpu.findMany as jest.Mock).mockResolvedValue([
        { id: 'g1', model: 'A100', serverId: 's1', allocated: false, server: { status: 'ONLINE' } },
      ]);

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_allocate_gpu')!;
      const result = await tool.handler({ count: 5, purpose: 'Large job' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('RESOURCE_EXHAUSTED');
      expect(data.error.message).toContain('Insufficient GPUs');
    });

    it('should handle database errors', async () => {
      (prisma.user.findFirst as jest.Mock).mockRejectedValue(new Error('DB connection failed'));

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_allocate_gpu')!;
      const result = await tool.handler({ count: 1, purpose: 'Test' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('lsm_release_gpu - Success Cases', () => {
    it('should release active allocation', async () => {
      (prisma.gpuAllocation.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1', gpuId: 'g1', gpu: { id: 'g1', allocated: true }, releasedAt: null,
      });
      (prisma.gpuAllocation.update as jest.Mock).mockResolvedValue({ id: 'a1', releasedAt: new Date() });
      (prisma.gpu.update as jest.Mock).mockResolvedValue({ id: 'g1', allocated: false });

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_release_gpu')!;
      const result = await tool.handler({ allocation_id: 'a1' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.allocation_id).toBe('a1');
      expect(data.released_at).toBeDefined();
    });

    it('should force release already released allocation', async () => {
      (prisma.gpuAllocation.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1', gpuId: 'g1', gpu: { id: 'g1', allocated: false }, releasedAt: new Date(),
      });
      (prisma.gpuAllocation.update as jest.Mock).mockResolvedValue({});
      (prisma.gpu.update as jest.Mock).mockResolvedValue({});

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_release_gpu')!;
      const result = await tool.handler({ allocation_id: 'a1', force: true });

      expect(result.isError).toBeUndefined();
    });
  });

  describe('lsm_release_gpu - Error Cases', () => {
    it('should return error for non-existent allocation', async () => {
      (prisma.gpuAllocation.findUnique as jest.Mock).mockResolvedValue(null);

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_release_gpu')!;
      const result = await tool.handler({ allocation_id: 'nonexistent' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return error for already released allocation without force', async () => {
      // The actual implementation checks releasedAt, not status
      (prisma.gpuAllocation.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1', gpuId: 'g1', gpu: { id: 'g1' }, releasedAt: new Date('2024-01-15T10:00:00Z'),
      });

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_release_gpu')!;
      const result = await tool.handler({ allocation_id: 'a1' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('CONFLICT');
    });
  });
});