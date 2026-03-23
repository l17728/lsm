/**
 * Analytics Service Tests
 *
 * Tests for resource analytics, trend queries, and cost breakdowns.
 * Includes regression tests for query limit fixes.
 */

import { AnalyticsService } from '../../services/analytics.service';

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    server: {
      findMany: jest.fn(),
    },
    serverMetric: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../utils/prisma';

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService = new AnalyticsService();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getResourceTrends – query limit regression test
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getResourceTrends', () => {
    it('REGRESSION: should pass take:10000 to prevent unbounded full-table scan', async () => {
      (prisma.serverMetric.findMany as jest.Mock).mockResolvedValue([]);

      await analyticsService.getResourceTrends();

      expect(prisma.serverMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10000 })
      );
    });

    it('should filter metrics by caller-supplied time range', async () => {
      (prisma.serverMetric.findMany as jest.Mock).mockResolvedValue([]);

      const start = new Date('2024-01-01');
      const end = new Date('2024-01-08');
      await analyticsService.getResourceTrends(start, end);

      expect(prisma.serverMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recordedAt: { gte: start, lte: end },
          },
        })
      );
    });

    it('should return mock/fallback trends when no real metrics exist', async () => {
      (prisma.serverMetric.findMany as jest.Mock).mockResolvedValue([]);

      const result = await analyticsService.getResourceTrends();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('time');
      expect(result[0]).toHaveProperty('cpu');
      expect(result[0]).toHaveProperty('memory');
      expect(result[0]).toHaveProperty('gpu');
      expect(result[0]).toHaveProperty('network');
      expect(result[0]).toHaveProperty('disk');
    });

    it('should aggregate raw metrics into hourly buckets', async () => {
      (prisma.serverMetric.findMany as jest.Mock).mockResolvedValue([
        // Two points in the same hour → should merge into one bucket with avg cpu=50
        { cpuUsage: 40, memoryUsage: 60, gpuUsage: null, diskUsage: null, networkIn: null, networkOut: null, recordedAt: new Date('2024-01-01T10:00:00Z') },
        { cpuUsage: 60, memoryUsage: 80, gpuUsage: null, diskUsage: null, networkIn: null, networkOut: null, recordedAt: new Date('2024-01-01T10:30:00Z') },
        // One point in a different hour → separate bucket
        { cpuUsage: 70, memoryUsage: 90, gpuUsage: null, diskUsage: null, networkIn: null, networkOut: null, recordedAt: new Date('2024-01-01T11:00:00Z') },
      ]);

      const result = await analyticsService.getResourceTrends();

      expect(result.length).toBe(2);
      // First bucket: avg cpu = (40+60)/2 = 50
      expect(result[0].cpu).toBe(50);
      // Second bucket: cpu = 70
      expect(result[1].cpu).toBe(70);
    });

    it('should include network data when networkIn and networkOut are present', async () => {
      (prisma.serverMetric.findMany as jest.Mock).mockResolvedValue([
        {
          cpuUsage: 50, memoryUsage: 60, gpuUsage: null, diskUsage: null,
          networkIn: 1e9, networkOut: 1e9,  // 1 GB each → 2 GB total → 2 in GB
          recordedAt: new Date('2024-01-01T10:00:00Z'),
        },
      ]);

      const result = await analyticsService.getResourceTrends();
      expect(result[0].network).toBe(2); // (1e9 + 1e9) / 1e9 = 2 GB
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getSummary – query limit regression test
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getSummary', () => {
    it('REGRESSION: should use take:1 in metrics include to avoid loading full metric history', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([]);

      await analyticsService.getSummary();

      expect(prisma.server.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            metrics: expect.objectContaining({ take: 1 }),
          }),
        })
      );
    });

    it('should only count cost for ONLINE servers', async () => {
      const onlineServer = {
        id: '1', status: 'ONLINE',
        gpus: [],
        metadata: { cpuCores: 8, totalMemory: 16 },
        metrics: [{ cpuUsage: 50, memoryUsage: 60, gpuUsage: null, recordedAt: new Date() }],
      };
      const offlineServer = {
        id: '2', status: 'OFFLINE',
        gpus: [{ id: 'g1' }],
        metadata: { cpuCores: 16, totalMemory: 64 },
        metrics: [],
      };
      (prisma.server.findMany as jest.Mock).mockResolvedValue([onlineServer, offlineServer]);

      const result = await analyticsService.getSummary();

      // Offline server has more resources but should not contribute to totalCost
      // Cost for online server only: 8*0.05*168 + 16*0.01*168 = 67.2 + 26.88 = 94.08
      expect(result.totalCost).toBeCloseTo(94.08, 0);
    });

    it('should return zeros when cluster is empty', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([]);

      const result = await analyticsService.getSummary();

      expect(result.totalCost).toBe(0);
      expect(result.avgUtilization).toBe(0);
    });

    it('should include all required response fields', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([]);

      const result = await analyticsService.getSummary();

      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('costTrend');
      expect(result).toHaveProperty('avgUtilization');
      expect(result).toHaveProperty('utilizationTrend');
      expect(result).toHaveProperty('peakResource');
      expect(result.peakResource).toHaveProperty('type');
      expect(result.peakResource).toHaveProperty('value');
      expect(result.peakResource).toHaveProperty('time');
      expect(result).toHaveProperty('efficiency');
      expect(result).toHaveProperty('savings');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getServerUtilization
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getServerUtilization', () => {
    it('should use take:1 for metrics to avoid heavy JOIN', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([]);

      await analyticsService.getServerUtilization();

      expect(prisma.server.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            metrics: expect.objectContaining({ take: 1 }),
          }),
        })
      );
    });

    it('should compute weighted utilization for GPU server (30/30/40 split)', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1', name: 'GPU Server',
          gpus: [{ id: 'g1' }],
          metadata: { cpuCores: 32, totalMemory: 128 },
          metrics: [{ cpuUsage: 60, memoryUsage: 70, gpuUsage: 80, recordedAt: new Date() }],
        },
      ]);

      const result = await analyticsService.getServerUtilization();

      // 60*0.3 + 70*0.3 + 80*0.4 = 18 + 21 + 32 = 71
      expect(result[0].utilization).toBe(71);
      expect(result[0].gpuUsage).toBe(80);
    });

    it('should compute 50/50 utilization for non-GPU server', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1', name: 'CPU Server',
          gpus: [],
          metadata: { cpuCores: 32, totalMemory: 128 },
          metrics: [{ cpuUsage: 60, memoryUsage: 80, gpuUsage: null, recordedAt: new Date() }],
        },
      ]);

      const result = await analyticsService.getServerUtilization();

      // 60*0.5 + 80*0.5 = 30 + 40 = 70
      expect(result[0].utilization).toBe(70);
      expect(result[0].gpuUsage).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getCostBreakdown
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getCostBreakdown', () => {
    it('should use take:1 for metrics to avoid heavy JOIN', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([]);

      await analyticsService.getCostBreakdown();

      expect(prisma.server.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            metrics: expect.objectContaining({ take: 1 }),
          }),
        })
      );
    });

    it('should return exactly 6 cost categories', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([]);

      const result = await analyticsService.getCostBreakdown();

      expect(result).toHaveLength(6);
      const categories = result.map(r => r.category);
      expect(categories).toContain('GPU Computing');
      expect(categories).toContain('CPU Resources');
      expect(categories).toContain('Memory Usage');
      expect(categories).toContain('Network Bandwidth');
      expect(categories).toContain('Storage');
      expect(categories).toContain('Other Services');
    });

    it('should return zero amounts when no online servers', async () => {
      (prisma.server.findMany as jest.Mock).mockResolvedValue([
        { id: '1', status: 'OFFLINE', gpus: [], metadata: {}, metrics: [] },
      ]);

      const result = await analyticsService.getCostBreakdown();

      // All amounts should be 0 for offline-only cluster
      result.forEach(item => expect(item.amount).toBe(0));
    });
  });
});
