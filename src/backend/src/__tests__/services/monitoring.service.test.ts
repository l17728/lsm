/**
 * Monitoring Service Tests
 * 
 * Tests for server monitoring, metrics collection, and alerts
 */

import { MonitoringService } from '../../services/monitoring.service';

// Mock dependencies before import
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    server: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    serverMetric: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../../services/server.service', () => ({
  recordMetrics: jest.fn().mockResolvedValue({}),
}));

import prisma from '../../utils/prisma';

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    monitoringService = new MonitoringService();
  });

  describe('getServerHealth', () => {
    it('should return server health status', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Server 1',
          status: 'ONLINE',
          cpuCores: 8,
          totalMemory: BigInt(16000000000),
          gpus: [],
          metrics: [{ cpuUsage: 50.5, memoryUsage: 70.2, temperature: 65, timestamp: new Date() }],
        },
      ];

      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const result = await monitoringService.getServerHealth();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].serverName).toBe('Server 1');
    });

    it('should handle empty servers list', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([]);

      const result = await monitoringService.getServerHealth();

      expect(result).toBeDefined();
      expect(result.length).toBe(0);
    });

    it('should handle servers without metrics', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Server 1',
          status: 'ONLINE',
          gpus: [],
          metrics: [],
        },
      ];

      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const result = await monitoringService.getServerHealth();

      expect(result).toBeDefined();
      expect(result[0].cpuUsage).toBe(0);
    });
  });

  describe('getClusterStats', () => {
    it('should return cluster statistics', async () => {
      const mockServers = [
        {
          id: '1',
          status: 'ONLINE',
          cpuCores: 8,
          totalMemory: BigInt(16000000000),
          gpus: [{ status: 'AVAILABLE' }, { status: 'ALLOCATED' }],
          metrics: [{ cpuUsage: 50, memoryUsage: 60, gpuUsage: 40 }],
        },
        {
          id: '2',
          status: 'ONLINE',
          cpuCores: 8,
          totalMemory: BigInt(16000000000),
          gpus: [],
          metrics: [{ cpuUsage: 70, memoryUsage: 80, gpuUsage: 0 }],
        },
      ];

      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const result = await monitoringService.getClusterStats();

      expect(result).toBeDefined();
      expect(result.servers.total).toBe(2);
      expect(result.servers.online).toBe(2);
    });

    it('should handle empty cluster', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([]);

      const result = await monitoringService.getClusterStats();

      expect(result).toBeDefined();
      expect(result.servers.total).toBe(0);
    });
  });

  describe('getAlerts', () => {
    it('should generate alert for high CPU usage', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Server 1',
          status: 'ONLINE',
          gpus: [],
          metrics: [{ cpuUsage: 95, memoryUsage: 60, temperature: 50, timestamp: new Date() }],
        },
      ];

      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('critical');
    });

    it('should generate warning for moderate CPU usage', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Server 1',
          status: 'ONLINE',
          gpus: [],
          metrics: [{ cpuUsage: 85, memoryUsage: 50, temperature: 40, timestamp: new Date() }],
        },
      ];

      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      expect(alerts.some(a => a.message.includes('CPU') && a.type === 'warning')).toBe(true);
    });

    it('should generate alert for high memory usage', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Server 1',
          status: 'ONLINE',
          gpus: [],
          metrics: [{ cpuUsage: 50, memoryUsage: 95, temperature: 40, timestamp: new Date() }],
        },
      ];

      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      expect(alerts.some(a => a.message.includes('memory'))).toBe(true);
    });

    it('should generate alert for high temperature', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Server 1',
          status: 'ONLINE',
          gpus: [],
          metrics: [{ cpuUsage: 50, memoryUsage: 50, temperature: 85, timestamp: new Date() }],
        },
      ];

      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      expect(alerts.some(a => a.message.includes('temperature'))).toBe(true);
    });
  });

  describe('getMetricsRange', () => {
    it('should return metrics for time range', async () => {
      const mockMetrics = [
        { id: '1', serverId: 'server-1', cpuUsage: 50, timestamp: new Date() },
        { id: '2', serverId: 'server-1', cpuUsage: 60, timestamp: new Date() },
      ];

      (prisma.serverMetric.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const result = await monitoringService.getMetricsRange(
        'server-1',
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });
  });
});