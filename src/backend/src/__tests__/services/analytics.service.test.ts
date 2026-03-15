import analyticsService from '../services/analytics.service';

// Mock prisma
jest.mock('../utils/prisma', () => ({
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

const mockPrisma = require('../utils/prisma').default;

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSummary', () => {
    it('should return analytics summary with correct structure', async () => {
      mockPrisma.server.findMany.mockResolvedValue([
        {
          id: '1',
          name: 'Test Server',
          status: 'ONLINE',
          cpuCores: 32,
          totalMemory: 128,
          gpus: [{ id: 'gpu1', status: 'AVAILABLE' }],
          metrics: [
            {
              timestamp: new Date(),
              cpuUsage: 65.5,
              memoryUsage: 72.3,
              gpuUsage: 45.2,
            },
          ],
        },
      ]);

      const result = await analyticsService.getSummary();

      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('costTrend');
      expect(result).toHaveProperty('avgUtilization');
      expect(result).toHaveProperty('utilizationTrend');
      expect(result).toHaveProperty('peakResource');
      expect(result).toHaveProperty('efficiency');
      expect(result).toHaveProperty('savings');
      expect(typeof result.totalCost).toBe('number');
      expect(typeof result.avgUtilization).toBe('number');
    });

    it('should handle empty server list', async () => {
      mockPrisma.server.findMany.mockResolvedValue([]);

      const result = await analyticsService.getSummary();

      expect(result.totalCost).toBe(0);
      expect(result.avgUtilization).toBe(0);
    });
  });

  describe('getResourceTrends', () => {
    it('should return resource trends array', async () => {
      mockPrisma.serverMetric.findMany.mockResolvedValue([
        {
          timestamp: new Date(),
          cpuUsage: 50,
          memoryUsage: 60,
          gpuUsage: 40,
          diskUsage: 55,
          networkIn: 1000000000,
          networkOut: 500000000,
        },
        {
          timestamp: new Date(Date.now() - 3600000),
          cpuUsage: 45,
          memoryUsage: 55,
          gpuUsage: 35,
          diskUsage: 50,
          networkIn: 800000000,
          networkOut: 400000000,
        },
      ]);

      const result = await analyticsService.getResourceTrends();

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('time');
        expect(result[0]).toHaveProperty('cpu');
        expect(result[0]).toHaveProperty('memory');
        expect(result[0]).toHaveProperty('gpu');
      }
    });
  });

  describe('getCostBreakdown', () => {
    it('should return cost breakdown by category', async () => {
      mockPrisma.server.findMany.mockResolvedValue([
        {
          id: '1',
          name: 'GPU Server',
          status: 'ONLINE',
          cpuCores: 32,
          totalMemory: 128,
          gpus: [
            { id: 'gpu1', status: 'AVAILABLE' },
            { id: 'gpu2', status: 'ALLOCATED' },
          ],
          metrics: [
            {
              cpuUsage: 65,
              memoryUsage: 72,
              networkIn: 1000000000,
              networkOut: 500000000,
            },
          ],
        },
      ]);

      const result = await analyticsService.getCostBreakdown();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('amount');
      expect(result[0]).toHaveProperty('percentage');
      expect(result[0]).toHaveProperty('trend');
    });
  });

  describe('getServerUtilization', () => {
    it('should return server utilization data', async () => {
      mockPrisma.server.findMany.mockResolvedValue([
        {
          id: '1',
          name: 'Test Server',
          status: 'ONLINE',
          cpuCores: 32,
          totalMemory: 128,
          gpus: [{ id: 'gpu1' }],
          metrics: [
            {
              cpuUsage: 65.5,
              memoryUsage: 72.3,
              gpuUsage: 45.2,
            },
          ],
        },
      ]);

      const result = await analyticsService.getServerUtilization();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('serverId', '1');
      expect(result[0]).toHaveProperty('serverName', 'Test Server');
      expect(result[0]).toHaveProperty('cpuCores', 32);
      expect(result[0]).toHaveProperty('totalMemory', 128);
      expect(result[0]).toHaveProperty('utilization');
      expect(result[0]).toHaveProperty('cost');
      expect(result[0]).toHaveProperty('efficiency');
    });
  });

  describe('getEfficiencyReport', () => {
    it('should return efficiency report with recommendations', async () => {
      mockPrisma.server.findMany.mockResolvedValue([
        {
          id: '1',
          name: 'Under-utilized Server',
          status: 'ONLINE',
          cpuCores: 32,
          totalMemory: 128,
          gpus: [{ id: 'gpu1' }],
          metrics: [
            {
              cpuUsage: 25, // Low CPU
              memoryUsage: 30, // Low memory
              gpuUsage: 20, // Low GPU
            },
          ],
        },
      ]);

      const result = await analyticsService.getEfficiencyReport();

      expect(result).toHaveProperty('overallEfficiency');
      expect(result).toHaveProperty('serverEfficiency');
      expect(result).toHaveProperty('totalSavings');
      expect(result).toHaveProperty('potentialSavings');
      expect(Array.isArray(result.serverEfficiency)).toBe(true);
      
      // Should have recommendations for under-utilized server
      const serverEff = result.serverEfficiency[0];
      expect(serverEff.recommendations.length).toBeGreaterThan(0);
    });
  });
});