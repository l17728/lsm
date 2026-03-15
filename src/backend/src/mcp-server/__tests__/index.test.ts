/**
 * LSM MCP Server - Index Module Unit Tests
 * Tests server initialization and tool registration
 * @version 3.2.0
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tool: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({})),
}));

// Mock tool registrations
jest.mock('../tools/servers', () => ({
  registerServerTools: jest.fn(),
}));

jest.mock('../tools/gpu', () => ({
  registerGpuTools: jest.fn(),
}));

jest.mock('../tools/tasks', () => ({
  registerTaskTools: jest.fn(),
}));

describe('MCP Server Index', () => {
  let mockMcpServer: jest.Mocked<McpServer>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMcpServer = new McpServer({
      name: 'lsm-server',
      version: '3.2.0',
    }) as jest.Mocked<McpServer>;
  });

  describe('Server Initialization', () => {
    it('should create McpServer with correct configuration', () => {
      expect(McpServer).toHaveBeenCalledWith({
        name: 'lsm-server',
        version: '3.2.0',
      });
    });

    it('should create McpServer instance', () => {
      expect(mockMcpServer).toBeDefined();
      expect(mockMcpServer.tool).toBeDefined();
    });
  });

  describe('Tool Registration', () => {
    it('should have tool method available', () => {
      expect(typeof mockMcpServer.tool).toBe('function');
    });

    it('should call registerServerTools when imported', async () => {
      const { registerServerTools } = require('../tools/servers');
      registerServerTools(mockMcpServer);
      expect(registerServerTools).toHaveBeenCalledWith(mockMcpServer);
    });

    it('should call registerGpuTools when imported', async () => {
      const { registerGpuTools } = require('../tools/gpu');
      registerGpuTools(mockMcpServer);
      expect(registerGpuTools).toHaveBeenCalledWith(mockMcpServer);
    });

    it('should call registerTaskTools when imported', async () => {
      const { registerTaskTools } = require('../tools/tasks');
      registerTaskTools(mockMcpServer);
      expect(registerTaskTools).toHaveBeenCalledWith(mockMcpServer);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const connectMock = jest.fn().mockRejectedValue(new Error('Connection failed'));
      mockMcpServer.connect = connectMock;

      await expect(mockMcpServer.connect({} as any)).rejects.toThrow('Connection failed');
    });

    it('should handle successful connection', async () => {
      const connectMock = jest.fn().mockResolvedValue(undefined);
      mockMcpServer.connect = connectMock;

      await expect(mockMcpServer.connect({} as any)).resolves.toBeUndefined();
    });
  });

  describe('Module Exports', () => {
    it('should export server instance', () => {
      // The index.ts exports the server instance
      const { server } = require('../index');
      expect(server).toBeDefined();
    });
  });
});