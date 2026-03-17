/**
 * OpenClawService Unit Tests
 *
 * Tests for OpenClaw AI integration service.
 * Mocks axios to avoid real HTTP calls.
 */

jest.mock('axios');

import axios from 'axios';
import { openClawService } from '../../services/openclaw.service';

// Reset the token cache before each test by accessing the private property
const service = openClawService as any;

describe('OpenClawService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset cached token state
    service.lsmToken = null;
    service.tokenExpiry = 0;
  });

  // ==================== getLSMAdminToken ====================

  describe('getLSMAdminToken', () => {
    it('should fetch and cache the admin token', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: { token: 'jwt-token-abc123' },
        },
      });

      const token = await service.getLSMAdminToken();

      expect(token).toBe('jwt-token-abc123');
      expect(service.lsmToken).toBe('jwt-token-abc123');
      expect(service.tokenExpiry).toBeGreaterThan(Date.now());
    });

    it('should return cached token on second call within 24h', async () => {
      service.lsmToken = 'cached-token';
      service.tokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour ahead

      const token = await service.getLSMAdminToken();

      expect(token).toBe('cached-token');
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should re-fetch token when cache is expired', async () => {
      service.lsmToken = 'expired-token';
      service.tokenExpiry = Date.now() - 1000; // expired

      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: { token: 'new-token-xyz' },
        },
      });

      const token = await service.getLSMAdminToken();

      expect(token).toBe('new-token-xyz');
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('should throw error when login response is not success', async () => {
      (axios.post as jest.Mock).mockResolvedValue({
        data: { success: false },
      });

      await expect(service.getLSMAdminToken()).rejects.toThrow('Failed to get admin token');
    });

    it('should throw error when axios call fails', async () => {
      (axios.post as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(service.getLSMAdminToken()).rejects.toThrow('Network error');
    });
  });

  // ==================== chat ====================

  describe('chat', () => {
    beforeEach(() => {
      // Provide a cached token so we don't need to mock login in every test
      service.lsmToken = 'test-token';
      service.tokenExpiry = Date.now() + 60 * 60 * 1000;
    });

    it('should return server stats for server-related messages', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: { total: 10, online: 8, offline: 1, maintenance: 1, error: 0 },
        },
      });

      const result = await service.chat('查看服务器状态');

      expect(result.success).toBe(true);
      expect(result.message).toContain('服务器');
    });

    it('should return GPU stats for GPU-related messages', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: { total: 20, available: 15, allocated: 5 },
        },
      });

      const result = await service.chat('有多少可用GPU');

      expect(result.success).toBe(true);
      expect(result.message).toContain('GPU');
    });

    it('should return task stats for task-related messages', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          data: { total: 50, running: 5, pending: 10, completed: 30, failed: 5 },
        },
      });

      const result = await service.chat('查看任务列表');

      expect(result.success).toBe(true);
      expect(result.message).toContain('任务');
    });

    it('should return help message for unrecognized messages', async () => {
      const result = await service.chat('Hello, how are you?');

      expect(result.success).toBe(true);
      expect(result.message).toContain('LSM');
    });

    it('should return error response when API call fails', async () => {
      service.lsmToken = null;
      service.tokenExpiry = 0;

      (axios.post as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const result = await service.chat('服务器状态');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle English keywords for server query', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: { success: true, data: { total: 5, online: 5 } },
      });

      const result = await service.chat('show me server status');

      expect(result.success).toBe(true);
    });
  });

  // ==================== executeLSMOperation ====================

  describe('executeLSMOperation', () => {
    beforeEach(() => {
      service.lsmToken = 'test-token';
      service.tokenExpiry = Date.now() + 60 * 60 * 1000;
    });

    it('should execute GET operation and return data', async () => {
      const mockData = { success: true, data: [{ id: 'server-1' }] };
      (axios as unknown as jest.Mock).mockResolvedValue({ data: mockData });

      const result = await service.executeLSMOperation('servers.list', {});

      expect(result).toEqual(mockData);
    });

    it('should execute POST operation with params', async () => {
      const mockData = { success: true, data: { id: 'task-1' } };
      (axios as unknown as jest.Mock).mockResolvedValue({ data: mockData });

      const result = await service.executeLSMOperation('tasks.create', {
        name: 'Test Task',
        priority: 5,
      });

      expect(result).toEqual(mockData);
    });

    it('should throw error for unknown action', async () => {
      await expect(
        service.executeLSMOperation('unknown.action', {})
      ).rejects.toThrow('Unknown action: unknown.action');
    });
  });

  // ==================== healthCheck ====================

  describe('healthCheck', () => {
    it('should return true for both when both services are up', async () => {
      (axios.get as jest.Mock)
        .mockResolvedValueOnce({ data: { ok: true } })   // openclaw health
        .mockResolvedValueOnce({ data: {} });              // lsm health

      const result = await service.healthCheck();

      expect(result.openclaw).toBe(true);
      expect(result.lsm).toBe(true);
    });

    it('should return false for openclaw when it is down', async () => {
      (axios.get as jest.Mock)
        .mockRejectedValueOnce(new Error('Connection refused'))  // openclaw down
        .mockResolvedValueOnce({ data: {} });                    // lsm up

      const result = await service.healthCheck();

      expect(result.openclaw).toBe(false);
      expect(result.lsm).toBe(true);
    });

    it('should return false for lsm when it is down', async () => {
      (axios.get as jest.Mock)
        .mockResolvedValueOnce({ data: { status: 'live' } })  // openclaw up
        .mockRejectedValueOnce(new Error('Connection refused')); // lsm down

      const result = await service.healthCheck();

      expect(result.openclaw).toBe(true);
      expect(result.lsm).toBe(false);
    });

    it('should return false for both when both services are down', async () => {
      (axios.get as jest.Mock)
        .mockRejectedValue(new Error('Network error'));

      const result = await service.healthCheck();

      expect(result.openclaw).toBe(false);
      expect(result.lsm).toBe(false);
    });
  });
});
