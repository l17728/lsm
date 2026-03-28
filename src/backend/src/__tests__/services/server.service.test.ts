/**
 * ServerService Unit Tests
 *
 * Covers: createServer, getAllServers, getServerById, updateServer,
 * updateServerStatus (with cache-invalidation REGRESSION), deleteServer,
 * getServerStats, getAvailableServers, recordMetrics (with throttled-cleanup
 * REGRESSION), and getServerMetrics.
 *
 * Key regressions guarded here:
 *   - updateServerStatus must invalidate 'servers:all', 'servers:stats', and `server:${id}`
 *   - recordMetrics cleanup must NOT run unless recordCount % 50 === 0
 *   - recordMetrics cleanup must run COUNT+SELECT+DELETE only when count > 1000
 */

// ─── Mock prisma singleton ────────────────────────────────────────────────────
const mockPrisma = {
  server: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  gpu: {
    updateMany: jest.fn(),
  },
  serverMetric: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// ─── Mock cacheService ────────────────────────────────────────────────────────
const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  getOrSet: jest.fn(),
};

jest.mock('../../services/cache.service', () => ({
  cacheService: mockCacheService,
}));

// Import after mocks are registered
import { ServerService } from '../../services/server.service';

// Helper: build a minimal server object
const makeServer = (overrides: Record<string, any> = {}) => ({
  id: 'server-1',
  name: 'Test Server',
  hostname: 'host-1',
  description: null,
  ipAddress: '10.0.0.1',
  location: 'DC1',
  cpuCores: 8,
  totalMemory: 64,
  gpuCount: 2,
  status: 'ONLINE',
  createdAt: new Date('2024-01-01'),
  gpus: [],
  ...overrides,
});

// Helper: minimal metric object
const makeMetric = (overrides: Record<string, any> = {}) => ({
  serverId: 'server-1',
  cpuUsage: 55,
  memoryUsage: 60,
  gpuUsage: 40,
  diskUsage: 30,
  networkIn: 100,
  networkOut: 200,
  temperature: 45,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('ServerService', () => {
  let service: ServerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServerService();

    // Default: cacheService.getOrSet delegates to factory
    mockCacheService.getOrSet.mockImplementation(
      async (_key: string, factory: () => Promise<any>) => factory()
    );
  });

  // ─── createServer ───────────────────────────────────────────────────────────
  describe('createServer', () => {
    it('should create a server and return it', async () => {
      const expectedServer = makeServer();
      mockPrisma.server.create.mockResolvedValue(expectedServer);

      const result = await service.createServer({ name: 'Test Server', gpuCount: 2 });

      expect(result).toEqual(expectedServer);
      expect(mockPrisma.server.create).toHaveBeenCalledTimes(1);
    });

    it('should pass name and gpuCount in data.create', async () => {
      mockPrisma.server.create.mockResolvedValue(makeServer());

      await service.createServer({ name: 'Test Server', gpuCount: 4 });

      const callArg = mockPrisma.server.create.mock.calls[0][0];
      expect(callArg.data.name).toBe('Test Server');
      expect(callArg.data.gpuCount).toBe(4);
    });

    it('should use gpuCount=0 when not provided', async () => {
      mockPrisma.server.create.mockResolvedValue(makeServer({ gpuCount: 0 }));

      await service.createServer({ name: 'Minimal' });

      const callArg = mockPrisma.server.create.mock.calls[0][0];
      expect(callArg.data.gpuCount).toBe(0);
    });

    it('should invalidate servers:all and servers:stats caches after create', async () => {
      mockPrisma.server.create.mockResolvedValue(makeServer());

      await service.createServer({ name: 'New Server' });

      expect(mockCacheService.delete).toHaveBeenCalledWith('servers:all');
      expect(mockCacheService.delete).toHaveBeenCalledWith('servers:stats');
    });

    it('should create GPU records when gpus array is provided', async () => {
      mockPrisma.server.create.mockResolvedValue(makeServer());
      const gpus = [{ model: 'A100', memory: 80 }, { model: 'V100', memory: 32 }];

      await service.createServer({ name: 'GPU Server', gpus });

      const callArg = mockPrisma.server.create.mock.calls[0][0];
      expect(callArg.data.gpus.create).toHaveLength(2);
      expect(callArg.data.gpus.create[0].model).toBe('A100');
    });
  });

  // ─── getAllServers ──────────────────────────────────────────────────────────
  describe('getAllServers', () => {
    it('should return servers list from DB (cache miss)', async () => {
      const servers = [makeServer({ id: 'a' }), makeServer({ id: 'b' })];
      mockPrisma.server.findMany.mockResolvedValue(servers);

      const result = await service.getAllServers();

      expect(result).toEqual(servers);
      expect(mockPrisma.server.findMany).toHaveBeenCalledTimes(1);
    });

    it('should use cache key "servers:all"', async () => {
      mockPrisma.server.findMany.mockResolvedValue([]);

      await service.getAllServers();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'servers:all',
        expect.any(Function),
        300
      );
    });

    it('should return cached value without hitting DB on cache hit', async () => {
      const cached = [makeServer()];
      mockCacheService.getOrSet.mockResolvedValue(cached);

      const result = await service.getAllServers();

      expect(result).toEqual(cached);
      expect(mockPrisma.server.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── getServerById ─────────────────────────────────────────────────────────
  describe('getServerById', () => {
    it('should return the server matching the id', async () => {
      const server = makeServer({ id: 'server-42' });
      mockPrisma.server.findUnique.mockResolvedValue(server);

      const result = await service.getServerById('server-42');

      expect(result).toEqual(server);
      expect(mockPrisma.server.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'server-42' } })
      );
    });

    it('should use per-server cache key', async () => {
      mockPrisma.server.findUnique.mockResolvedValue(makeServer());

      await service.getServerById('srv-99');

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'server:srv-99',
        expect.any(Function),
        120
      );
    });
  });

  // ─── updateServer ──────────────────────────────────────────────────────────
  describe('updateServer', () => {
    it('should update and return the server', async () => {
      const updated = makeServer({ name: 'Renamed' });
      mockPrisma.server.update.mockResolvedValue(updated);

      const result = await service.updateServer('server-1', { name: 'Renamed' });

      expect(result).toEqual(updated);
      expect(mockPrisma.server.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'server-1' } })
      );
    });

    it('should invalidate servers:all, servers:stats, and server:<id> caches', async () => {
      mockPrisma.server.update.mockResolvedValue(makeServer());

      await service.updateServer('server-1', { name: 'Updated' });

      expect(mockCacheService.delete).toHaveBeenCalledWith('servers:all');
      expect(mockCacheService.delete).toHaveBeenCalledWith('servers:stats');
      expect(mockCacheService.delete).toHaveBeenCalledWith('server:server-1');
    });
  });

  // ─── updateServerStatus ────────────────────────────────────────────────────
  describe('updateServerStatus', () => {
    it('should call prisma.server.update with correct where and data', async () => {
      mockPrisma.server.update.mockResolvedValue(makeServer({ status: 'ONLINE' }));

      await service.updateServerStatus('server-1', 'ONLINE' as any);

      expect(mockPrisma.server.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'server-1' },
          data: { status: 'ONLINE' },
        })
      );
    });

    it('should return the updated server object', async () => {
      const updated = makeServer({ status: 'MAINTENANCE' });
      mockPrisma.server.update.mockResolvedValue(updated);

      const result = await service.updateServerStatus('server-1', 'MAINTENANCE' as any);

      expect(result).toEqual(updated);
    });

    // ── REGRESSION: cache invalidation ──────────────────────────────────────
    it('REGRESSION: should invalidate "servers:all" cache after status update', async () => {
      mockPrisma.server.update.mockResolvedValue(makeServer());

      await service.updateServerStatus('server-1', 'ONLINE' as any);

      expect(mockCacheService.delete).toHaveBeenCalledWith('servers:all');
    });

    it('REGRESSION: should invalidate "servers:stats" cache after status update', async () => {
      mockPrisma.server.update.mockResolvedValue(makeServer());

      await service.updateServerStatus('server-1', 'ONLINE' as any);

      expect(mockCacheService.delete).toHaveBeenCalledWith('servers:stats');
    });

    it('REGRESSION: should invalidate "server:<id>" cache for the specific server', async () => {
      mockPrisma.server.update.mockResolvedValue(makeServer());

      await service.updateServerStatus('server-abc', 'OFFLINE' as any);

      expect(mockCacheService.delete).toHaveBeenCalledWith('server:server-abc');
    });

    it('REGRESSION: should invalidate all 3 cache keys regardless of status value', async () => {
      mockPrisma.server.update.mockResolvedValue(makeServer());
      mockPrisma.gpu.updateMany.mockResolvedValue({ count: 0 });

      await service.updateServerStatus('server-xyz', 'ERROR' as any);

      const deletedKeys: string[] = mockCacheService.delete.mock.calls.map(
        (call: [string]) => call[0]
      );
      expect(deletedKeys).toContain('servers:all');
      expect(deletedKeys).toContain('servers:stats');
      expect(deletedKeys).toContain('server:server-xyz');
    });

    it('should de-allocate GPUs when status is OFFLINE', async () => {
      mockPrisma.server.update.mockResolvedValue(makeServer({ status: 'OFFLINE' }));
      mockPrisma.gpu.updateMany.mockResolvedValue({ count: 2 });

      await service.updateServerStatus('server-1', 'OFFLINE' as any);

      expect(mockPrisma.gpu.updateMany).toHaveBeenCalledWith({
        where: { serverId: 'server-1' },
        data: { allocated: false },
      });
    });

    it('should de-allocate GPUs when status is ERROR', async () => {
      mockPrisma.server.update.mockResolvedValue(makeServer({ status: 'ERROR' }));
      mockPrisma.gpu.updateMany.mockResolvedValue({ count: 1 });

      await service.updateServerStatus('server-1', 'ERROR' as any);

      expect(mockPrisma.gpu.updateMany).toHaveBeenCalled();
    });

    it('should NOT call gpu.updateMany when status is ONLINE', async () => {
      mockPrisma.server.update.mockResolvedValue(makeServer({ status: 'ONLINE' }));

      await service.updateServerStatus('server-1', 'ONLINE' as any);

      expect(mockPrisma.gpu.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── deleteServer ──────────────────────────────────────────────────────────
  describe('deleteServer', () => {
    it('should call prisma.server.delete with the correct id', async () => {
      mockPrisma.server.delete.mockResolvedValue(undefined);

      await service.deleteServer('server-1');

      expect(mockPrisma.server.delete).toHaveBeenCalledWith({ where: { id: 'server-1' } });
    });

    it('should invalidate all 3 cache entries after deletion', async () => {
      mockPrisma.server.delete.mockResolvedValue(undefined);

      await service.deleteServer('server-del');

      expect(mockCacheService.delete).toHaveBeenCalledWith('servers:all');
      expect(mockCacheService.delete).toHaveBeenCalledWith('servers:stats');
      expect(mockCacheService.delete).toHaveBeenCalledWith('server:server-del');
    });
  });

  // ─── getServerStats ────────────────────────────────────────────────────────
  describe('getServerStats', () => {
    it('should return correct online/offline counts', async () => {
      const servers = [
        makeServer({ id: '1', status: 'ONLINE', gpus: [] }),
        makeServer({ id: '2', status: 'ONLINE', gpus: [] }),
        makeServer({ id: '3', status: 'OFFLINE', gpus: [] }),
      ];
      mockPrisma.server.findMany.mockResolvedValue(servers);

      const stats = await service.getServerStats();

      expect(stats.total).toBe(3);
      expect(stats.online).toBe(2);
      expect(stats.offline).toBe(1);
    });

    it('should use cache key "servers:stats" with 60s TTL', async () => {
      mockPrisma.server.findMany.mockResolvedValue([]);

      await service.getServerStats();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'servers:stats',
        expect.any(Function),
        60
      );
    });

    it('should count totalGpus and availableGpus', async () => {
      const servers = [
        makeServer({
          id: '1',
          status: 'ONLINE',
          gpus: [
            { id: 'g1', allocated: false },
            { id: 'g2', allocated: true },
          ],
        }),
      ];
      mockPrisma.server.findMany.mockResolvedValue(servers);

      const stats = await service.getServerStats();

      expect(stats.totalGpus).toBe(2);
      expect(stats.availableGpus).toBe(1);
    });
  });

  // ─── getAvailableServers ───────────────────────────────────────────────────
  describe('getAvailableServers', () => {
    it('should query only ONLINE servers with at least one free GPU', async () => {
      mockPrisma.server.findMany.mockResolvedValue([]);

      await service.getAvailableServers();

      expect(mockPrisma.server.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ONLINE' }),
        })
      );
    });

    it('should return the list returned by prisma', async () => {
      const availableServers = [makeServer()];
      mockPrisma.server.findMany.mockResolvedValue(availableServers);

      const result = await service.getAvailableServers();

      expect(result).toEqual(availableServers);
    });
  });

  // ─── recordMetrics (REGRESSION: throttled cleanup) ─────────────────────────
  describe('recordMetrics', () => {
    const BASE_METRICS = {
      cpuUsage: 55,
      memoryUsage: 60,
    };

    beforeEach(() => {
      mockPrisma.serverMetric.create.mockResolvedValue({ id: 'metric-1', ...BASE_METRICS });
      mockPrisma.serverMetric.count.mockResolvedValue(500); // under 1000 by default
    });

    it('should insert a metric record via prisma.serverMetric.create', async () => {
      await service.recordMetrics('server-1', BASE_METRICS);

      expect(mockPrisma.serverMetric.create).toHaveBeenCalledWith({
        data: { serverId: 'server-1', ...BASE_METRICS },
      });
    });

    it('should return the created metric', async () => {
      const metric = { id: 'm1', serverId: 'server-1', ...BASE_METRICS };
      mockPrisma.serverMetric.create.mockResolvedValue(metric);

      const result = await service.recordMetrics('server-1', BASE_METRICS);

      expect(result).toEqual(metric);
    });

    // ── REGRESSION: cleanup throttle ────────────────────────────────────────
    it('REGRESSION: should NOT call serverMetric.count for the first 49 inserts', async () => {
      const freshService = new ServerService();

      for (let i = 0; i < 49; i++) {
        await freshService.recordMetrics('server-1', BASE_METRICS);
      }

      expect(mockPrisma.serverMetric.count).not.toHaveBeenCalled();
    });

    it('REGRESSION: should call serverMetric.count exactly once on the 50th insert', async () => {
      const freshService = new ServerService();

      for (let i = 0; i < 50; i++) {
        await freshService.recordMetrics('server-1', BASE_METRICS);
      }

      expect(mockPrisma.serverMetric.count).toHaveBeenCalledTimes(1);
    });

    it('REGRESSION: should call count on 50th and 100th inserts but not in between', async () => {
      const freshService = new ServerService();

      for (let i = 0; i < 100; i++) {
        await freshService.recordMetrics('server-1', BASE_METRICS);
      }

      expect(mockPrisma.serverMetric.count).toHaveBeenCalledTimes(2);
    });

    it('REGRESSION: should NOT trigger DELETE when count <= 1000', async () => {
      const freshService = new ServerService();
      mockPrisma.serverMetric.count.mockResolvedValue(800);

      // Drive recordCount to 50 to trigger the cleanup check
      for (let i = 0; i < 50; i++) {
        await freshService.recordMetrics('server-1', BASE_METRICS);
      }

      expect(mockPrisma.serverMetric.deleteMany).not.toHaveBeenCalled();
    });

    it('REGRESSION: should trigger DELETE when count > 1000 on cleanup interval', async () => {
      const freshService = new ServerService();
      // Return >1000 so cleanup runs
      mockPrisma.serverMetric.count.mockResolvedValue(1050);
      // findMany provides the ids to delete
      const oldIds = Array.from({ length: 50 }, (_, i) => ({ id: `old-${i}` }));
      mockPrisma.serverMetric.findMany.mockResolvedValue(oldIds);
      mockPrisma.serverMetric.deleteMany.mockResolvedValue({ count: 50 });

      for (let i = 0; i < 50; i++) {
        await freshService.recordMetrics('server-1', BASE_METRICS);
      }

      expect(mockPrisma.serverMetric.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.serverMetric.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: oldIds.map((m) => m.id) } },
        })
      );
    });

    it('should keep the 50 oldest records after trimming (take = count - 1000)', async () => {
      const freshService = new ServerService();
      mockPrisma.serverMetric.count.mockResolvedValue(1050);
      const oldIds = Array.from({ length: 50 }, (_, i) => ({ id: `old-${i}` }));
      mockPrisma.serverMetric.findMany.mockResolvedValue(oldIds);
      mockPrisma.serverMetric.deleteMany.mockResolvedValue({ count: 50 });

      for (let i = 0; i < 50; i++) {
        await freshService.recordMetrics('server-1', BASE_METRICS);
      }

      const findCall = mockPrisma.serverMetric.findMany.mock.calls[0][0];
      // take = 1050 - 1000 = 50
      expect(findCall.take).toBe(50);
      expect(findCall.orderBy).toEqual({ recordedAt: 'asc' });
    });
  });

  // ─── getServerMetrics ──────────────────────────────────────────────────────
  describe('getServerMetrics', () => {
    it('should query metrics within the provided time range', async () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-02');
      mockPrisma.serverMetric.findMany.mockResolvedValue([]);

      await service.getServerMetrics('server-1', start, end);

      expect(mockPrisma.serverMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            serverId: 'server-1',
            recordedAt: { gte: start, lte: end },
          },
        })
      );
    });

    it('should return the list of metrics', async () => {
      const metrics = [makeMetric(), makeMetric()];
      mockPrisma.serverMetric.findMany.mockResolvedValue(metrics);

      const result = await service.getServerMetrics(
        'server-1',
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(result).toEqual(metrics);
    });

    it('should order results ascending by recordedAt', async () => {
      mockPrisma.serverMetric.findMany.mockResolvedValue([]);

      await service.getServerMetrics('server-1', new Date(), new Date());

      expect(mockPrisma.serverMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { recordedAt: 'asc' } })
      );
    });
  });
});
