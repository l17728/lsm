import { MonitoringService } from '../../services/monitoring.service';
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
    monitoringService = new MonitoringService();
  });

  afterEach(() => {
    jest.clearAllMocks();
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

      mockPrisma.server.findMany.mockResolvedValue(mockServers);

      const result = await monitoringService.getServerHealth();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].serverName).toBe('Server 1');
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
          gpus: [],
          metrics: [{ cpuUsage: 50, memoryUsage: 60 }],
        },
        {
          id: '2',
          status: 'ONLINE',
          cpuCores: 8,
          totalMemory: BigInt(16000000000),
          gpus: [],
          metrics: [{ cpuUsage: 70, memoryUsage: 80 }],
        },
      ];

      mockPrisma.server.findMany.mockResolvedValue(mockServers);

      const result = await monitoringService.getClusterStats();

      expect(result).toBeDefined();
      expect(result.servers.total).toBe(2);
      expect(result.servers.online).toBe(2);
    });
  });

  describe('getAlerts', () => {
    it('should generate alert for high CPU usage', async () => {
      const mockServers = [
        {
          id: '1',
          name: 'Server 1',
          status: 'ONLINE',
          cpuCores: 8,
          totalMemory: BigInt(16000000000),
          gpus: [],
          metrics: [{ cpuUsage: 95, memoryUsage: 60, temperature: 50, timestamp: new Date() }],
        },
      ];

      mockPrisma.server.findMany.mockResolvedValue(mockServers);

      const alerts = await monitoringService.getAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('critical');
    });
  });
});
