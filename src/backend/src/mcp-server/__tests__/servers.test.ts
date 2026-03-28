/**
 * LSM MCP Server - Server Tools Unit Tests
 * Tests lsm_list_servers tool functionality
 * @version 3.2.0
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { serverService } from '../../__mocks__/server.service';

jest.mock('../../utils/prisma', () => require('../../__mocks__/prisma'));
jest.mock('../../services/server.service', () => require('../../__mocks__/server.service'));

import { registerServerTools } from '../tools/servers';

describe('Server Tools - lsm_list_servers', () => {
  let mockServer: McpServer;
  let registeredTools: Map<string, { desc: string; schema: any; handler: Function }>;

  beforeEach(() => {
    jest.clearAllMocks();
    registeredTools = new Map();
    mockServer = {
      tool: jest.fn((name: string, desc: string, schema: any, handler: Function) => {
        registeredTools.set(name, { desc, schema, handler });
      }),
    } as unknown as McpServer;
  });

  describe('Tool Registration', () => {
    it('should register lsm_list_servers tool', () => {
      registerServerTools(mockServer);
      expect(registeredTools.has('lsm_list_servers')).toBe(true);
    });

    it('should have correct tool description', () => {
      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;
      expect(tool.desc).toContain('Query the list of servers');
    });

    it('should have valid parameter schema', () => {
      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;
      expect(tool.schema).toBeDefined();
      expect(tool.schema.status).toBeDefined();
      expect(tool.schema.region).toBeDefined();
      expect(tool.schema.limit).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should accept valid status parameter', async () => {
      (serverService.getAllServers as jest.Mock).mockResolvedValue([]);
      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;

      for (const status of ['online', 'offline', 'maintenance', 'all']) {
        const result = await tool.handler({ status });
        expect(result.isError).toBeUndefined();
      }
    });

    it('should accept valid limit range', async () => {
      (serverService.getAllServers as jest.Mock).mockResolvedValue([]);
      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;

      const result = await tool.handler({ limit: 100 });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('Return Value Format', () => {
    it('should return servers in correct format', async () => {
      (serverService.getAllServers as jest.Mock).mockResolvedValue([
        { id: 's1', name: 'GPU-Server-01', status: 'ONLINE', location: 'US-East', gpus: [{ id: 'g1' }, { id: 'g2' }] },
      ]);

      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;
      const result = await tool.handler({});
      const data = JSON.parse(result.content[0].text);

      expect(data.servers).toBeDefined();
      expect(data.servers[0]).toHaveProperty('id');
      expect(data.servers[0]).toHaveProperty('name');
      expect(data.servers[0]).toHaveProperty('status');
      expect(data.servers[0]).toHaveProperty('gpu_count');
      expect(data.servers[0]).toHaveProperty('region');
      expect(data.total).toBeDefined();
      expect(data.filtered).toBeDefined();
    });

    it('should return text content type', async () => {
      (serverService.getAllServers as jest.Mock).mockResolvedValue([]);
      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;

      const result = await tool.handler({});
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('Filtering Logic', () => {
    it('should filter by status online', async () => {
      (serverService.getAllServers as jest.Mock).mockResolvedValue([
        { id: 's1', name: 'Server1', status: 'ONLINE', gpus: [] },
        { id: 's2', name: 'Server2', status: 'OFFLINE', gpus: [] },
      ]);

      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;
      const result = await tool.handler({ status: 'online' });
      const data = JSON.parse(result.content[0].text);

      expect(data.servers).toHaveLength(1);
      expect(data.servers[0].status).toBe('online');
    });

    it('should filter by region case-insensitive', async () => {
      (serverService.getAllServers as jest.Mock).mockResolvedValue([
        { id: 's1', name: 'Server1', status: 'ONLINE', location: 'US-EAST', gpus: [] },
        { id: 's2', name: 'Server2', status: 'ONLINE', location: 'EU-WEST', gpus: [] },
      ]);

      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;
      const result = await tool.handler({ region: 'us' });
      const data = JSON.parse(result.content[0].text);

      expect(data.servers).toHaveLength(1);
      expect(data.servers[0].region).toBe('US-EAST');
    });

    it('should apply limit to results', async () => {
      const servers = Array.from({ length: 100 }, (_, i) => ({
        id: `s${i}`, name: `Server${i}`, status: 'ONLINE', gpus: [],
      }));
      (serverService.getAllServers as jest.Mock).mockResolvedValue(servers);

      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;
      const result = await tool.handler({ limit: 10 });
      const data = JSON.parse(result.content[0].text);

      expect(data.filtered).toBe(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      (serverService.getAllServers as jest.Mock).mockRejectedValue(new Error('Database error'));

      registerServerTools(mockServer);
      const tool = registeredTools.get('lsm_list_servers')!;
      const result = await tool.handler({});

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error.code).toBe('INTERNAL_ERROR');
      expect(data.error.message).toContain('Database error');
    });
  });
});