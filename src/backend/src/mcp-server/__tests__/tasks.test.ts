/**
 * LSM MCP Server - Task Tools Unit Tests
 * Tests lsm_create_task, lsm_cancel_task, and lsm_check_status tools
 * @version 3.2.0
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock modules before importing the actual module
jest.mock('../../utils/prisma', () => {
  const mockPrisma = {
    task: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
    server: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    gpu: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    gpuAllocation: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
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
    getAll: jest.fn(),
    getServerStats: jest.fn(),
  },
}));

import { registerTaskTools } from '../tools/tasks';
import { prisma } from '../../utils/prisma';
import { serverService } from '../../services/server.service';

describe('Task Tools', () => {
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
    it('should register lsm_create_task tool', () => {
      registerTaskTools(mockServer);
      expect(registeredTools.has('lsm_create_task')).toBe(true);
    });

    it('should register lsm_cancel_task tool', () => {
      registerTaskTools(mockServer);
      expect(registeredTools.has('lsm_cancel_task')).toBe(true);
    });

    it('should register lsm_check_status tool', () => {
      registerTaskTools(mockServer);
      expect(registeredTools.has('lsm_check_status')).toBe(true);
    });

    it('should have correct descriptions', () => {
      registerTaskTools(mockServer);
      expect(registeredTools.get('lsm_create_task')!.desc).toContain('Create');
      expect(registeredTools.get('lsm_cancel_task')!.desc).toContain('Cancel');
      expect(registeredTools.get('lsm_check_status')!.desc).toContain('Check');
    });
  });

  describe('lsm_create_task - Input Validation', () => {
    // Note: The actual implementation uses 3-param tool() call without schema
    // Input validation happens inside the handler, not via Zod schema
    it('should register tool with correct name', () => {
      registerTaskTools(mockServer);
      expect(registeredTools.has('lsm_create_task')).toBe(true);
    });
  });

  describe('lsm_create_task - Success Cases', () => {
    it('should create deploy task', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1' });
      (prisma.task.create as jest.Mock).mockResolvedValue({
        id: 't1', name: '[MCP] deploy: server1', status: 'PENDING', createdAt: new Date(), priority: 'MEDIUM',
      });

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_create_task')!;
      const result = await tool.handler({ task_type: 'deploy', target: 'server1' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.task_id).toBe('t1');
      expect(data.status).toBe('pending');
      expect(data.task_type).toBe('deploy');
    });

    it('should create task with high priority', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1' });
      (prisma.task.create as jest.Mock).mockResolvedValue({
        id: 't1', name: '[MCP] restart: api-server', status: 'PENDING', createdAt: new Date(), priority: 'HIGH',
      });

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_create_task')!;
      const result = await tool.handler({ task_type: 'restart', target: 'api-server', priority: 'high' });

      expect(result.isError).toBeUndefined();
    });

    it('should create custom task with params', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'u1' });
      (prisma.task.create as jest.Mock).mockResolvedValue({
        id: 't1', name: '[MCP] custom: special-op', status: 'PENDING', createdAt: new Date(),
      });

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_create_task')!;
      const result = await tool.handler({
        task_type: 'custom', target: 'special-op', params: { key: 'value' },
      });

      expect(result.isError).toBeUndefined();
    });
  });

  describe('lsm_cancel_task - Success Cases', () => {
    it('should cancel pending task', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({ id: 't1', status: 'PENDING' });
      (prisma.task.update as jest.Mock).mockResolvedValue({
        id: 't1', status: 'CANCELLED', completedAt: new Date(),
      });

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_cancel_task')!;
      const result = await tool.handler({ task_id: 't1', reason: 'User requested' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.status).toBe('cancelled');
      expect(data.reason).toBe('User requested');
    });

    it('should cancel running task', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({ id: 't1', status: 'RUNNING' });
      (prisma.task.update as jest.Mock).mockResolvedValue({
        id: 't1', status: 'CANCELLED', completedAt: new Date(),
      });

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_cancel_task')!;
      const result = await tool.handler({ task_id: 't1' });

      expect(result.isError).toBeUndefined();
    });
  });

  describe('lsm_cancel_task - Error Cases', () => {
    it('should return error for non-existent task', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_cancel_task')!;
      const result = await tool.handler({ task_id: 'nonexistent' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return error for completed task', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({ id: 't1', status: 'COMPLETED' });

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_cancel_task')!;
      const result = await tool.handler({ task_id: 't1' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('CONFLICT');
    });
  });

  describe('lsm_check_status - Cluster Scope', () => {
    it('should return cluster status', async () => {
      (serverService.getServerStats as jest.Mock).mockResolvedValue({
        total: 10, online: 8, offline: 1, maintenance: 1,
        totalGpus: 40, availableGpus: 25,
      });
      (prisma.task.groupBy as jest.Mock).mockResolvedValue([
        { status: 'PENDING', _count: 3 },
        { status: 'RUNNING', _count: 2 },
      ]);

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_check_status')!;
      const result = await tool.handler({ scope: 'cluster' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.scope).toBe('cluster');
      expect(data.details.total_servers).toBe(10);
      expect(data.details.gpu_utilization).toBeDefined();
    });
  });

  describe('lsm_check_status - Task Scope', () => {
    it('should return task status by id', async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({
        id: 't1', name: 'Test Task', status: 'RUNNING', priority: 'HIGH',
        createdAt: new Date(), startedAt: new Date(), completedAt: null,
        server: { id: 's1', name: 'Server1' }, result: null,
      });

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_check_status')!;
      const result = await tool.handler({ scope: 'task', target_id: 't1' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.task_id).toBe('t1');
      expect(data.status).toBe('running');
    });

    it('should return error for missing target_id', async () => {
      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_check_status')!;
      const result = await tool.handler({ scope: 'task' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('INVALID_PARAMS');
    });
  });

  describe('lsm_check_status - Server Scope', () => {
    it('should return server status by id', async () => {
      (prisma.server.findUnique as jest.Mock).mockResolvedValue({
        id: 's1', name: 'GPU-Server-01', status: 'ONLINE', location: 'US-East',
        gpus: [{ id: 'g1', model: 'A100', status: 'AVAILABLE' }],
      });

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_check_status')!;
      const result = await tool.handler({ scope: 'server', target_id: 's1' });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.server_id).toBe('s1');
      expect(data.status).toBe('online');
      expect(data.details.gpu_count).toBe(1);
    });

    it('should return error for non-existent server', async () => {
      (prisma.server.findUnique as jest.Mock).mockResolvedValue(null);

      registerTaskTools(mockServer);
      const tool = registeredTools.get('lsm_check_status')!;
      const result = await tool.handler({ scope: 'server', target_id: 'nonexistent' });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });
});