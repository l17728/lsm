import { MonitoringService } from '../services/monitoring.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      serverMetric: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      server: {
        findMany: jest.fn(),
      },
      alert: {
        create: jest.fn(),
      },
    })),
  };
});

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    monitoringService = new MonitoringService(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordMetrics', () => {
    it('should record server metrics successfully', async () => {
      const mockMetric = {
        id: '1',
        serverId: '1',
        cpuUsage: 50.5,
        memoryUsage: 70.2,
        temperature: 65,
      };

      mockPrisma.serverMetric.create.mockResolvedValue(mockMetric);

      const result = await monitoringService.recordMetrics({
        serverId: '1',
        cpuUsage: 50.5,
        memoryUsage: 70.2,
        temperature: 65,
      });

      expect(result).toEqual(mockMetric);
      expect(mockPrisma.serverMetric.create).toHaveBeenCalled();
    });
  });

  describe('getClusterStats', () => {
    it('should return cluster statistics', async () => {
      const mockServers = [
        { id: '1', status: 'ONLINE', cpuUsage: 50, memoryUsage: 60 },
        { id: '2', status: 'ONLINE', cpuUsage: 70, memoryUsage: 80 },
      ];

      mockPrisma.server.findMany.mockResolvedValue(mockServers);

      const result = await monitoringService.getClusterStats();

      expect(result).toBeDefined();
      expect(result.totalServers).toBe(2);
      expect(result.averageCpuUsage).toBe(60);
      expect(result.averageMemoryUsage).toBe(70);
    });
  });

  describe('checkAlerts', () => {
    it('should generate alert for high CPU usage', async () => {
      mockPrisma.server.findMany.mockResolvedValue([
        { id: '1', status: 'ONLINE', cpuUsage: 95, memoryUsage: 60 },
      ]);

      const alerts = await monitoringService.checkAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('HIGH_CPU');
    });

    it('should generate alert for high memory usage', async () => {
      mockPrisma.server.findMany.mockResolvedValue([
        { id: '1', status: 'ONLINE', cpuUsage: 50, memoryUsage: 95 },
      ]);

      const alerts = await monitoringService.checkAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('HIGH_MEMORY');
    });
  });
});
