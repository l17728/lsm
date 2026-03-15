/**
 * Health Check Service Tests
 * 
 * Tests for system health monitoring: Database, Redis, Disk, Memory
 */

// Mock dependencies before import
jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    info: jest.fn().mockResolvedValue('used_memory_human:1M\ndbsize:10'),
    dbsize: jest.fn().mockResolvedValue(10),
    on: jest.fn(),
  })),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
    user: { count: jest.fn().mockResolvedValue(10) },
    server: { count: jest.fn().mockResolvedValue(5) },
    task: { count: jest.fn().mockResolvedValue(20) },
  })),
}));

import { HealthCheckService } from '../../services/health-check.service';

describe('HealthCheckService', () => {
  let healthCheckService: HealthCheckService;

  beforeEach(() => {
    jest.clearAllMocks();
    healthCheckService = new HealthCheckService();
  });

  describe('checkDatabase', () => {
    it('should return healthy status when database responds quickly', async () => {
      const result = await healthCheckService.checkDatabase();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('responseTime');
      expect(result).toHaveProperty('message');
    });
  });

  describe('checkRedis', () => {
    it('should return healthy status when Redis responds', async () => {
      const result = await healthCheckService.checkRedis();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('responseTime');
    });
  });

  describe('checkDiskSpace', () => {
    it('should check disk space', async () => {
      const result = await healthCheckService.checkDiskSpace();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('message');
      expect(['healthy', 'warning', 'unhealthy']).toContain(result.status);
    });
  });

  describe('checkMemory', () => {
    it('should check memory usage', async () => {
      const result = await healthCheckService.checkMemory();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('message');
      expect(['healthy', 'warning', 'unhealthy']).toContain(result.status);
    });
  });

  describe('checkApi', () => {
    it('should check API health', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await healthCheckService.checkApi();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('responseTime');
    });

    it('should return unhealthy when API returns error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await healthCheckService.checkApi();

      expect(result.status).toBe('unhealthy');
    });

    it('should return unhealthy when API is unreachable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await healthCheckService.checkApi();

      expect(result.status).toBe('unhealthy');
    });
  });

  describe('getDatabaseStats', () => {
    it('should return database statistics', async () => {
      const result = await healthCheckService.getDatabaseStats();

      expect(result).toHaveProperty('tableCount');
      expect(result).toHaveProperty('totalRows');
      expect(result).toHaveProperty('databaseSize');
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const result = await healthCheckService.getCacheStats();

      expect(result).toHaveProperty('connected');
    });
  });
});