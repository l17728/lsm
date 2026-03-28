/**
 * LSM MCP Server Tools - Unit Tests
 * @version 3.2.0
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Mock modules before importing the actual modules
jest.mock('../../utils/prisma', () => {
  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    gpu: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    gpuAllocation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    server: {
      findUnique: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
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
    getAllServers: jest.fn(),
    getServerById: jest.fn(),
    getServerStats: jest.fn(),
  },
}));

// Import after mocking
import { prisma } from '../../utils/prisma';
import { serverService } from '../../services/server.service';
import { registerServerTools } from '../tools/servers';
import { registerGpuTools } from '../tools/gpu';
import { registerTaskTools } from '../tools/tasks';

describe('MCP Server Tools', () => {
  let mockServer: McpServer;
  let registeredTools: Map<string, { desc: string; schema: any; handler: Function }>;

  beforeEach(() => {
    jest.clearAllMocks();
    registeredTools = new Map();
    
    // Create mock server that captures tool registrations
    // Support both 3-param (name, desc, handler) and 4-param (name, desc, schema, handler) calls
    mockServer = {
      tool: jest.fn((...args: any[]) => {
        // 4-param: tool(name, description, schema, handler)
        // 3-param: tool(name, description, handler)
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

  describe('Server Tools', () => {
    it('should register lsm_list_servers tool', () => {
      registerServerTools(mockServer);
      
      expect(registeredTools.has('lsm_list_servers')).toBe(true);
      const tool = registeredTools.get('lsm_list_servers')!;
      expect(tool.desc).toContain('Query the list of servers');
    });

    it('should return server list on successful query', async () => {
      (serverService.getAllServers as jest.Mock).mockResolvedValue([
        { id: 's1', name: 'Server1', status: 'ONLINE', location: 'US', gpus: [{ id: 'g1' }] },
        { id: 's2', name: 'Server2', status: 'OFFLINE', location: 'EU', gpus: [] },
      ]);

      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;
      
      const result = await tool.handler({ status: 'online' });
      
      expect(result.content[0].type).toBe('text');
      const data = JSON.parse(result.content[0].text);
      expect(data.servers).toHaveLength(1);
      expect(data.servers[0].name).toBe('Server1');
    });

    it('should filter servers by region', async () => {
      (serverService.getAllServers as jest.Mock).mockResolvedValue([
        { id: 's1', name: 'Server1', status: 'ONLINE', location: 'US-East', gpus: [] },
        { id: 's2', name: 'Server2', status: 'ONLINE', location: 'EU-West', gpus: [] },
      ]);

      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;
      
      const result = await tool.handler({ region: 'EU' });
      const data = JSON.parse(result.content[0].text);
      expect(data.servers).toHaveLength(1);
      expect(data.servers[0].region).toBe('EU-West');
    });
  });

  describe('GPU Tools', () => {
    it('should register lsm_allocate_gpu and lsm_release_gpu tools', () => {
      registerGpuTools(mockServer);
      
      expect(registeredTools.has('lsm_allocate_gpu')).toBe(true);
      expect(registeredTools.has('lsm_release_gpu')).toBe(true);
    });

    it('should allocate GPU successfully', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1', username: 'mcp-system' });
      (prisma.gpu.findMany as jest.Mock).mockResolvedValue([
        { id: 'g1', model: 'A100', serverId: 's1', allocated: false, server: { id: 's1', status: 'ONLINE' } },
      ]);
      (prisma.gpuAllocation.create as jest.Mock).mockResolvedValue({ id: 'a1' });
      (prisma.gpu.update as jest.Mock).mockResolvedValue({ id: 'g1', allocated: true });

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_allocate_gpu')!;
      
      const result = await tool.handler({ count: 1, purpose: 'Test training' });
      const data = JSON.parse(result.content[0].text);
      
      // Should succeed with allocation
      expect(result.isError).toBeUndefined();
      expect(data.gpu_ids).toEqual(['g1']);
      expect(data.allocation_ids).toEqual(['a1']);
    });

    it('should release GPU allocation successfully', async () => {
      (prisma.gpuAllocation.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1', gpuId: 'g1', gpu: { id: 'g1', allocated: true }, releasedAt: null,
      });
      (prisma.gpuAllocation.update as jest.Mock).mockResolvedValue({ id: 'a1', releasedAt: new Date() });
      (prisma.gpu.update as jest.Mock).mockResolvedValue({ id: 'g1', allocated: false });

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_release_gpu')!;
      
      const result = await tool.handler({ allocation_id: 'a1' });
      
      const data = JSON.parse(result.content[0].text);
      expect(data.allocation_id).toBe('a1');
      expect(data.released_at).toBeDefined();
    });
  });

  describe('Task Tools', () => {
    it('should register lsm_create_task, lsm_cancel_task, and lsm_check_status tools', () => {
      registerTaskTools(mockServer);
      
      expect(registeredTools.has('lsm_create_task')).toBe(true);
      expect(registeredTools.has('lsm_cancel_task')).toBe(true);
      expect(registeredTools.has('lsm_check_status')).toBe(true);
    });

    it('should create task successfully', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1' });
      (prisma.task.create as jest.Mock).mockResolvedValue({
        id: 't1', name: '[MCP] deploy: server1', status: 'PENDING', createdAt: new Date(),
      });

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_create_task')!;
      
      const result = await tool.handler({ task_type: 'deploy', target: 'server1' });
      
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.task_id).toBe('t1');
      expect(data.status).toBe('pending');
    });

    it('should cancel task successfully', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: 't1', status: 'PENDING',
      });
      (prisma.task.update as jest.Mock).mockResolvedValue({
        id: 't1', status: 'CANCELLED', completedAt: new Date(),
      });

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_cancel_task')!;
      
      const result = await tool.handler({ task_id: 't1', reason: 'User request' });
      
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.status).toBe('cancelled');
    });

    it('should return cluster status', async () => {
      (serverService.getServerStats as jest.Mock).mockResolvedValue({
        total: 10, online: 8, offline: 2, maintenance: 0,
        totalGpus: 20, availableGpus: 15,
      });
      (prisma.task.groupBy as jest.Mock).mockResolvedValue([
        { status: 'PENDING', _count: 5 },
        { status: 'RUNNING', _count: 3 },
      ]);

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_check_status')!;
      
      const result = await tool.handler({ scope: 'cluster' });
      
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.scope).toBe('cluster');
      expect(data.details.total_servers).toBe(10);
    });
  });

  describe('Error Handling', () => {
    it('should return error when allocation not found', async () => {
      (prisma.gpuAllocation.findUnique as jest.Mock).mockResolvedValue(null);

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_release_gpu')!;
      
      const result = await tool.handler({ allocation_id: 'nonexistent' });
      
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return error when task not found', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_cancel_task')!;
      
      const result = await tool.handler({ task_id: 'nonexistent' });
      
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return error when insufficient GPUs available', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1' });
      // Only 1 GPU available but requesting 5
      (prisma.gpu.findMany as jest.Mock).mockResolvedValue([
        { id: 'g1', model: 'A100', serverId: 's1', allocated: false, server: { status: 'ONLINE' } },
      ]);

      registerGpuTools(mockServer);
      const tool = registeredTools.get('lsm_allocate_gpu')!;
      
      const result = await tool.handler({ count: 5, purpose: 'Large training' });
      
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('RESOURCE_EXHAUSTED');
      expect(data.error.message).toContain('Insufficient GPUs');
    });

    it('should return error when task already completed', async () => {
      // Use the actual enum value format that Prisma returns
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: 't1', status: 'COMPLETED',
      });

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_cancel_task')!;
      
      const result = await tool.handler({ task_id: 't1' });
      
      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('CONFLICT');
    });
  });
});