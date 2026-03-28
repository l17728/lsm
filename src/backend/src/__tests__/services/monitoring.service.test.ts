/**
 * Monitoring Service Tests
 *
 * Tests for server monitoring, metrics collection, and alerts.
 * Includes regression tests for the N+1 query fix.
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
  __esModule: true,
  default: {
    recordMetrics: jest.fn().mockResolvedValue({}),
  },
  recordMetrics: jest.fn().mockResolvedValue({}),
}));

import prisma from '../../utils/prisma';
import serverService from '../../services/server.service';

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    monitoringService = new MonitoringService();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // collectMetrics (N+1 regression tests)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('collectMetrics', () => {
    it('should NOT call prisma.server.findUnique inside the loop (N+1 fix)', async () => {
      const mockServers = [
        { id: 'server-1', name: 'S1', status: 'ONLINE', gpus: [] },
        { id: 'server-2', name: 'S2', status: 'ONLINE', gpus: [{ id: 'gpu-1' }] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      await monitoringService.collectMetrics();

      // The key regression assertion: findUnique must NOT be called
      expect(prisma.server.findUnique).not.toHaveBeenCalled();
    });

    it('should call findMany only once regardless of server count', async () => {
      const mockServers = Array.from({ length: 10 }, (_, i) => ({
        id: `server-${i}`,
        name: `S${i}`,
        status: 'ONLINE',
        gpus: [],
      }));
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      await monitoringService.collectMetrics();

      expect(prisma.server.findMany).toHaveBeenCalledTimes(1);
    });

    it('should call recordMetrics once per online server', async () => {
      const mockServers = [
        { id: 'server-1', name: 'S1', status: 'ONLINE', gpus: [] },
        { id: 'server-2', name: 'S2', status: 'ONLINE', gpus: [] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      await monitoringService.collectMetrics();

      expect(serverService.recordMetrics).toHaveBeenCalledTimes(2);
      expect(serverService.recordMetrics).toHaveBeenCalledWith('server-1', expect.any(Object));
      expect(serverService.recordMetrics).toHaveBeenCalledWith('server-2', expect.any(Object));
    });

    it('should pass gpu information via server object, not via extra DB call', async () => {
      const mockServers = [
        { id: 'server-1', name: 'S1', status: 'ONLINE', gpus: [{ id: 'g1' }, { id: 'g2' }] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const results = await monitoringService.collectMetrics();

      // gpuUsage should be non-null because server has GPUs
      expect(results[0].gpuUsage).not.toBeNull();
      // Still no findUnique
      expect(prisma.server.findUnique).not.toHaveBeenCalled();
    });

    it('should continue collecting from other servers if one fails', async () => {
      const mockServers = [
        { id: 'server-1', name: 'S1', status: 'ONLINE', gpus: [] },
        { id: 'server-2', name: 'S2', status: 'ONLINE', gpus: [] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      // Make server-1 recording fail
      (serverService.recordMetrics as jest.Mock)
        .mockRejectedValueOnce(new Error('DB write failed'))
        .mockResolvedValueOnce({});

      const results = await monitoringService.collectMetrics();

      // server-2 should still succeed
      expect(results.length).toBe(1);
      expect(results[0].serverId).toBe('server-2');
    });

    it('should return empty array when no online servers', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([]);

      const results = await monitoringService.collectMetrics();

      expect(results).toEqual([]);
      expect(serverService.recordMetrics).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getServerHealth
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getServerHealth', () => {
    it('should return server health status', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Server 1',
          status: 'ONLINE',
          gpus: [],
          updatedAt: new Date(),
          metrics: [{ cpuUsage: 50.5, memoryUsage: 70.2, temperature: 65, recordedAt: new Date() }],
        },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const result = await monitoringService.getServerHealth();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].serverName).toBe('Server 1');
      expect(result[0].cpuUsage).toBe(50.5);
    });

    it('should return zero usage for servers without metrics', async () => {
      const mockServers = [
        { id: '1', name: 'Server 1', status: 'ONLINE', gpus: [], updatedAt: new Date(), metrics: [] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const result = await monitoringService.getServerHealth();

      expect(result[0].cpuUsage).toBe(0);
      expect(result[0].memoryUsage).toBe(0);
      expect(result[0].gpuUsage).toBeNull();
    });

    it('should handle empty servers list', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([]);

      const result = await monitoringService.getServerHealth();

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getClusterStats
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getClusterStats', () => {
    it('should return correct online/offline counts', async () => {
      const mockServers = [
        { id: '1', status: 'ONLINE', gpus: [{ allocated: false }, { allocated: true }], metrics: [{ cpuUsage: 50, memoryUsage: 60, gpuUsage: 40 }] },
        { id: '2', status: 'OFFLINE', gpus: [], metrics: [] },
        { id: '3', status: 'ONLINE', gpus: [], metrics: [{ cpuUsage: 70, memoryUsage: 80, gpuUsage: 0 }] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const result = await monitoringService.getClusterStats();

      expect(result.servers.total).toBe(3);
      expect(result.servers.online).toBe(2);
      expect(result.servers.offline).toBe(1);
    });

    it('should correctly count GPU availability', async () => {
      const mockServers = [
        {
          id: '1',
          status: 'ONLINE',
          gpus: [{ allocated: false }, { allocated: false }, { allocated: true }],
          metrics: [],
        },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const result = await monitoringService.getClusterStats();

      expect(result.resources.totalGpus).toBe(3);
      expect(result.resources.availableGpus).toBe(2);
      expect(result.resources.allocatedGpus).toBe(1);
    });

    it('should handle empty cluster', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([]);

      const result = await monitoringService.getClusterStats();

      expect(result.servers.total).toBe(0);
      expect(result.resources.totalGpus).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getAlerts
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getAlerts', () => {
    it('should generate critical alert for CPU > 90%', async () => {
      const mockServers = [
        { id: '1', name: 'S1', status: 'ONLINE', gpus: [], updatedAt: new Date(), metrics: [{ cpuUsage: 95, memoryUsage: 60, temperature: 50, recordedAt: new Date() }] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      expect(alerts.some(a => a.message.includes('CPU') && a.type === 'critical')).toBe(true);
    });

    it('should generate warning alert for CPU between 80%-90%', async () => {
      const mockServers = [
        { id: '1', name: 'S1', status: 'ONLINE', gpus: [], updatedAt: new Date(), metrics: [{ cpuUsage: 85, memoryUsage: 50, temperature: 40, recordedAt: new Date() }] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      expect(alerts.some(a => a.message.includes('CPU') && a.type === 'warning')).toBe(true);
    });

    it('should generate critical alert for memory > 90%', async () => {
      const mockServers = [
        { id: '1', name: 'S1', status: 'ONLINE', gpus: [], updatedAt: new Date(), metrics: [{ cpuUsage: 50, memoryUsage: 95, temperature: 40, recordedAt: new Date() }] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      expect(alerts.some(a => a.message.includes('memory') && a.type === 'critical')).toBe(true);
    });

    it('should generate warning alert for temperature between 70-80°C', async () => {
      const mockServers = [
        { id: '1', name: 'S1', status: 'ONLINE', gpus: [], updatedAt: new Date(), metrics: [{ cpuUsage: 50, memoryUsage: 50, temperature: 75, recordedAt: new Date() }] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      expect(alerts.some(a => a.message.includes('temperature') && a.type === 'warning')).toBe(true);
    });

    it('should generate critical alert for temperature > 80°C', async () => {
      const mockServers = [
        { id: '1', name: 'S1', status: 'ONLINE', gpus: [], updatedAt: new Date(), metrics: [{ cpuUsage: 50, memoryUsage: 50, temperature: 85, recordedAt: new Date() }] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      expect(alerts.some(a => a.message.includes('temperature') && a.type === 'critical')).toBe(true);
    });

    it('should return no alerts for healthy server', async () => {
      const mockServers = [
        { id: '1', name: 'S1', status: 'ONLINE', gpus: [], updatedAt: new Date(), metrics: [{ cpuUsage: 30, memoryUsage: 40, temperature: 50, recordedAt: new Date() }] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      expect(alerts).toHaveLength(0);
    });

    it('should generate multiple alerts for server with multiple high metrics', async () => {
      const mockServers = [
        { id: '1', name: 'S1', status: 'ONLINE', gpus: [], updatedAt: new Date(), metrics: [{ cpuUsage: 95, memoryUsage: 95, temperature: 85, recordedAt: new Date() }] },
      ];
      (prisma.server.findMany as jest.Mock).mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      // 3 critical alerts: CPU, memory, temperature
      expect(alerts.filter(a => a.type === 'critical').length).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getMetricsRange
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getMetricsRange', () => {
    it('should return metrics for time range', async () => {
      const mockMetrics = [
        { id: '1', serverId: 'server-1', cpuUsage: 50, recordedAt: new Date() },
        { id: '2', serverId: 'server-1', cpuUsage: 60, recordedAt: new Date() },
      ];
      (prisma.serverMetric.findMany as jest.Mock).mockResolvedValue(mockMetrics);

      const result = await monitoringService.getMetricsRange(
        'server-1',
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(result).toHaveLength(2);
      expect(prisma.serverMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ serverId: 'server-1' }),
        })
      );
    });

    it('should return empty array when no metrics in range', async () => {
      (prisma.serverMetric.findMany as jest.Mock).mockResolvedValue([]);

      const result = await monitoringService.getMetricsRange(
        'server-1',
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(result).toEqual([]);
    });
  });
});
