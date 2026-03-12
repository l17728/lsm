import { ServerService } from '../services/server.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      server: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      gpu: {
        findMany: jest.fn(),
      },
      serverMetric: {
        create: jest.fn(),
      },
    })),
  };
});

describe('ServerService', () => {
  let serverService: ServerService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    serverService = new ServerService(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllServers', () => {
    it('should return all servers', async () => {
      const mockServers = [
        { id: '1', name: 'Server 1', status: 'ONLINE' },
        { id: '2', name: 'Server 2', status: 'OFFLINE' },
      ];

      mockPrisma.server.findMany.mockResolvedValue(mockServers);

      const result = await serverService.getAllServers();

      expect(result).toEqual(mockServers);
      expect(mockPrisma.server.findMany).toHaveBeenCalled();
    });
  });

  describe('createServer', () => {
    it('should create server successfully', async () => {
      const mockServer = {
        id: '1',
        name: 'New Server',
        status: 'OFFLINE',
        gpuCount: 4,
      };

      mockPrisma.server.create.mockResolvedValue(mockServer);

      const result = await serverService.createServer({
        name: 'New Server',
        gpuCount: 4,
      });

      expect(result).toEqual(mockServer);
      expect(mockPrisma.server.create).toHaveBeenCalledWith({
        data: {
          name: 'New Server',
          gpuCount: 4,
          status: 'OFFLINE',
        },
      });
    });
  });

  describe('updateServerStatus', () => {
    it('should update server status', async () => {
      const mockServer = {
        id: '1',
        name: 'Server 1',
        status: 'ONLINE',
      };

      mockPrisma.server.update.mockResolvedValue(mockServer);

      const result = await serverService.updateServerStatus('1', 'ONLINE');

      expect(result).toEqual(mockServer);
      expect(mockPrisma.server.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: 'ONLINE' },
      });
    });
  });
});
