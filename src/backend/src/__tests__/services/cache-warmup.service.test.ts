/**
 * CacheWarmupService Unit Tests
 *
 * Tests for warmup initialization, hot-data identification, TTL calculation,
 * item management, and statistics.
 * Dependencies (cache.service, Prisma) are mocked.
 */

// Mock cacheService used inside cache-warmup.service.ts
jest.mock('../../services/cache.service', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    getStats: jest.fn().mockResolvedValue({ hitRate: 75 }),
  },
}));

// cache-warmup.service.ts creates its own PrismaClient instance
const mockPrisma = {
  server: { findMany: jest.fn() },
  gpu: { findMany: jest.fn() },
  task: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  serverMetric: { findMany: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { CacheWarmupService } from '../../services/cache-warmup.service';
import { cacheService } from '../../services/cache.service';

describe('CacheWarmupService', () => {
  let service: CacheWarmupService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set env flag so the service is enabled in initialization tests
    process.env.CACHE_WARMUP_ENABLED = 'true';
    service = new CacheWarmupService();
  });

  afterEach(() => {
    service.destroy();
    delete process.env.CACHE_WARMUP_ENABLED;
  });

  describe('getStats', () => {
    it('should return initial zero statistics', () => {
      const stats = service.getStats();

      expect(stats.totalWarmups).toBe(0);
      expect(stats.successfulWarmups).toBe(0);
      expect(stats.failedWarmups).toBe(0);
      expect(stats.averageWarmupTimeMs).toBe(0);
    });
  });

  describe('getConfig', () => {
    it('should return configuration with default warmup items', () => {
      const config = service.getConfig();

      expect(config.warmupItems.length).toBeGreaterThan(0);
      expect(config.maxConcurrentWarmups).toBeGreaterThan(0);
    });
  });

  describe('addWarmupItem / removeWarmupItem', () => {
    it('should add a new warmup item to the config', () => {
      service.addWarmupItem({ key: 'custom:key', type: 'metrics', priority: 10 });

      const config = service.getConfig();
      expect(config.warmupItems.some(item => item.key === 'custom:key')).toBe(true);
    });

    it('should remove an existing warmup item and return true', () => {
      service.addWarmupItem({ key: 'removable:key', type: 'servers', priority: 5 });

      const removed = service.removeWarmupItem('removable:key');

      expect(removed).toBe(true);
      expect(service.getConfig().warmupItems.some(item => item.key === 'removable:key')).toBe(false);
    });

    it('should return false when removing a non-existent key', () => {
      const result = service.removeWarmupItem('does-not-exist');

      expect(result).toBe(false);
    });
  });

  describe('recordAccess and identifyHotData', () => {
    it('should track access counts and rank keys by frequency', () => {
      // Record 'hot:key' many times and 'cold:key' once
      for (let i = 0; i < 50; i++) {
        service.recordAccess('hot:key');
      }
      service.recordAccess('cold:key');

      const hotData = service.identifyHotData();

      expect(hotData[0]).toBe('hot:key');
      expect(hotData).toContain('cold:key');
    });

    it('should return empty array when no access has been recorded', () => {
      const hotData = service.identifyHotData();

      expect(hotData).toEqual([]);
    });
  });

  describe('calculateDynamicTTL', () => {
    it('should double baseTTL for very frequently accessed keys', () => {
      for (let i = 0; i < 101; i++) {
        service.recordAccess('frequent:key');
      }

      const ttl = service.calculateDynamicTTL('frequent:key', 1000);

      expect(ttl).toBe(2000);
    });

    it('should return baseTTL unchanged for a key with moderate access count', () => {
      service.recordAccess('moderate:key'); // count = 1

      const ttl = service.calculateDynamicTTL('moderate:key', 1000);

      expect(ttl).toBe(1000);
    });

    it('should halve baseTTL for a completely unknown key (treated as cold data)', () => {
      // An unknown key has lastAccess = 0, so timeSinceAccess is very large (> 30 min),
      // which triggers the cold-data path: baseTTL / 2.
      const ttl = service.calculateDynamicTTL('unknown:key', 500);

      expect(ttl).toBe(250);
    });
  });

  describe('updateConfig', () => {
    it('should merge new config values without overwriting unrelated fields', () => {
      service.updateConfig({ warmupIntervalMinutes: 60 });

      expect(service.getConfig().warmupIntervalMinutes).toBe(60);
      // Other fields remain intact
      expect(service.getConfig().maxConcurrentWarmups).toBeGreaterThan(0);
    });
  });

  // ── REGRESSION: TTL unit fix ──────────────────────────────────────────────
  describe('warmupItem TTL (REGRESSION)', () => {
    /**
     * Before the fix, warmupItem used `item.ttl || 300000`.
     * 300000 was intended as milliseconds but Redis SETEX expects SECONDS,
     * resulting in a ~3.47-day TTL instead of 5 minutes.
     *
     * After the fix: `item.ttl || 300` (300 seconds = 5 minutes).
     *
     * We verify by spying on cacheService.set and asserting the TTL argument
     * is 300 (not 300000) when no explicit TTL is configured on the item.
     */

    beforeEach(() => {
      // Ensure warmup is enabled for this group
      process.env.CACHE_WARMUP_ENABLED = 'true';
      // Stub DB calls used by warmupServers()
      mockPrisma.server.findMany.mockResolvedValue([{ id: 's1', name: 'S', gpus: [], _count: { metrics: 0 } }]);
    });

    it('REGRESSION: default TTL should be 300 seconds, NOT 300000', async () => {
      // Add a warmup item with NO explicit ttl (triggers the default)
      service.addWarmupItem({ key: 'test:ttl:default', type: 'servers', priority: 99 });

      await service.performWarmup();

      // Find the set() call for our test key
      // cacheService is the imported mock object (from jest.mock above)
      const calls: Array<[string, any, number]> = (cacheService.set as jest.Mock).mock.calls;
      const testCall = calls.find((c) => c[0] === 'test:ttl:default');

      expect(testCall).toBeDefined();
      const actualTtl = testCall![2];

      // Must be 300 (seconds), NOT 300000 (milliseconds)
      expect(actualTtl).toBe(300);
      expect(actualTtl).not.toBe(300000);
    });

    it('REGRESSION: explicit item TTL should be respected as-is', async () => {
      service.addWarmupItem({ key: 'test:ttl:explicit', type: 'servers', priority: 99, ttl: 600 });

      await service.performWarmup();

      const calls: Array<[string, any, number]> = (cacheService.set as jest.Mock).mock.calls;
      const testCall = calls.find((c) => c[0] === 'test:ttl:explicit');

      expect(testCall).toBeDefined();
      expect(testCall![2]).toBe(600);
    });

    it('REGRESSION: default TTL of 300s should never exceed 1 day (86400s)', async () => {
      service.addWarmupItem({ key: 'test:ttl:sanity', type: 'servers', priority: 99 });

      await service.performWarmup();

      const calls: Array<[string, any, number]> = (cacheService.set as jest.Mock).mock.calls;
      const testCall = calls.find((c) => c[0] === 'test:ttl:sanity');

      expect(testCall).toBeDefined();
      const ttl = testCall![2];
      // 300000 seconds would be ~3.47 days – far more than 1 day.
      // The fix ensures we never accidentally set a huge TTL.
      expect(ttl).toBeLessThanOrEqual(86400);
    });

    it('built-in warmup items should all use reasonable TTLs (≤ 86400s)', async () => {
      // Stub all DB types
      mockPrisma.gpu.findMany.mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.performWarmup();

      const calls: Array<[string, any, number]> = (cacheService.set as jest.Mock).mock.calls;
      for (const [key, , ttl] of calls) {
        expect(ttl).toBeLessThanOrEqual(86400);
        expect(ttl).toBeGreaterThan(0);
        // Should never be the erroneous 300000
        expect(ttl).not.toBe(300000);
      }
    });
  });
});
