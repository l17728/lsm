/**
 * MCP Routes Integration Tests
 */

import request from 'supertest';
import express from 'express';
import mcpRoutes from '../../routes/mcp.routes';

// Mock Prisma client
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    gpu: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    gpuAllocation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    task: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    server: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock server service
jest.mock('../../services/server.service', () => ({
  serverService: {
    getAllServers: jest.fn(),
    getServerStats: jest.fn(),
  },
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  AuthRequest: {},
}));

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { serverService } from '../../services/server.service';
import prisma from '../../utils/prisma';

const app = express();
app.use(express.json());
app.use('/api/mcp', mcpRoutes);

describe('MCP Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /tools ====================

  describe('GET /api/mcp/tools', () => {
    it('should return list of available MCP tools', async () => {
      const response = await request(app).get('/api/mcp/tools');

      expect(response.status).toBe(200);
      expect(response.body.tools).toBeDefined();
      expect(Array.isArray(response.body.tools)).toBe(true);
      expect(response.body.tools.length).toBeGreaterThan(0);
    });

    it('should include tool metadata fields', async () => {
      const response = await request(app).get('/api/mcp/tools');

      expect(response.status).toBe(200);
      const tool = response.body.tools[0];
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('riskLevel');
      expect(tool).toHaveProperty('requiresConfirmation');
    });

    it('should include read-only tools that do not require confirmation', async () => {
      const response = await request(app).get('/api/mcp/tools');

      expect(response.status).toBe(200);
      const readOnlyTool = response.body.tools.find(
        (t: any) => t.name === 'lsm_list_servers'
      );
      expect(readOnlyTool).toBeDefined();
      expect(readOnlyTool.requiresConfirmation).toBe(false);
    });
  });

  // ==================== POST /preview ====================

  describe('POST /api/mcp/preview', () => {
    it('should return preview for a known tool', async () => {
      const response = await request(app)
        .post('/api/mcp/preview')
        .send({ tool: 'lsm_list_servers', params: {} });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.preview).toBeDefined();
      expect(response.body.preview.tool).toBe('lsm_list_servers');
    });

    it('should return 400 for unknown tool', async () => {
      const response = await request(app)
        .post('/api/mcp/preview')
        .send({ tool: 'unknown_tool', params: {} });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should indicate confirmation required for write operations', async () => {
      const response = await request(app)
        .post('/api/mcp/preview')
        .send({ tool: 'lsm_allocate_gpu', params: { count: 1, purpose: 'training' } });

      expect(response.status).toBe(200);
      expect(response.body.preview.requiresConfirmation).toBe(true);
    });
  });

  // ==================== POST /invoke ====================

  describe('POST /api/mcp/invoke', () => {
    it('should return 400 for unknown tool', async () => {
      const response = await request(app)
        .post('/api/mcp/invoke')
        .send({ tool: 'unknown_tool', params: {}, confirmed: true });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 409 when write operation is not confirmed', async () => {
      const response = await request(app)
        .post('/api/mcp/invoke')
        .send({ tool: 'lsm_allocate_gpu', params: { count: 1, purpose: 'test' }, confirmed: false });

      expect(response.status).toBe(409);
      expect(response.body.requiresConfirmation).toBe(true);
    });

    it('should execute read-only tool without confirmation', async () => {
      (serverService.getAllServers as jest.Mock).mockResolvedValue([
        { id: 's-1', name: 'Server 1', status: 'ONLINE', gpus: [], location: 'Lab A' },
      ]);

      const response = await request(app)
        .post('/api/mcp/invoke')
        .send({ tool: 'lsm_list_servers', params: {}, confirmed: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.result.servers).toBeDefined();
    });
  });

  // ==================== POST /call ====================

  describe('POST /api/mcp/call', () => {
    it('should execute method via JSON-RPC call', async () => {
      (serverService.getAllServers as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/mcp/call')
        .send({ method: 'lsm_list_servers', params: {}, id: 'rpc-1' });

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.id).toBe('rpc-1');
    });

    it('should return JSON-RPC error for unknown method', async () => {
      const response = await request(app)
        .post('/api/mcp/call')
        .send({ method: 'unknown_method', params: {}, id: 'rpc-2' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32601);
    });
  });
});
