/**
 * Cache Service Tests
 *
 * Tests for Redis caching, TTL management, and cache warming.
 * Includes regression tests for the KEYS→SCAN fix.
 */

import { Redis } from 'ioredis';
import { CacheService } from '../../services/cache.service';

// Mock ioredis
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    quit: jest.fn(),
    flushdb: jest.fn(),
    keys: jest.fn(),
    scan: jest.fn(),
    info: jest.fn(),
    on: jest.fn(),
  };

  return {
    Redis: jest.fn().mockImplementation(() => mockRedis),
  };
});

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      quit: jest.fn(),
      flushdb: jest.fn(),
      keys: jest.fn(),
      scan: jest.fn(),
      info: jest.fn(),
      on: jest.fn(),
    };
    (Redis as jest.Mock).mockImplementation(() => mockRedis);
    cacheService = new CacheService();
  });

  describe('get', () => {
    it('should return parsed value from cache', async () => {
      const cachedData = { id: '1', name: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await cacheService.get('test-key');

      expect(result).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.get('nonexistent-key');

      expect(result).toBeNull();
    });

    it('should return null and count as miss on JSON parse errors', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await cacheService.get('bad-key');

      expect(result).toBeNull();
    });

    it('should increment hit counter on cache hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'test' }));

      await cacheService.get('key1');
      await cacheService.get('key2');
      mockRedis.get.mockResolvedValue(null);
      await cacheService.get('key3');

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });
  });

  describe('set', () => {
    it('should set value with default TTL in seconds', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await cacheService.set('test-key', { data: 'value' });

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        3600, // default TTL in seconds
        JSON.stringify({ data: 'value' })
      );
    });

    it('should set value with custom TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.set('test-key', { data: 'value' }, 600);

      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 600, expect.any(String));
    });

    it('should return false on Redis error', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.set('test-key', { data: 'value' });

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete key successfully', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.delete('test-key');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should return true even when key did not exist', async () => {
      mockRedis.del.mockResolvedValue(0);

      const result = await cacheService.delete('nonexistent-key');

      expect(result).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);
      expect(await cacheService.exists('existing-key')).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);
      expect(await cacheService.exists('nonexistent-key')).toBe(false);
    });

    it('should return false on error', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Redis error'));
      expect(await cacheService.exists('key')).toBe(false);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value without calling fallback', async () => {
      const cachedValue = { id: '1' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedValue));

      const fallback = jest.fn();
      const result = await cacheService.getOrSet('key', fallback);

      expect(result).toEqual(cachedValue);
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should call fallback and cache result when key not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const freshValue = { id: '2', name: 'fresh' };
      const fallback = jest.fn().mockResolvedValue(freshValue);

      const result = await cacheService.getOrSet('key', fallback, 600);

      expect(result).toEqual(freshValue);
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).toHaveBeenCalledWith('key', 600, JSON.stringify(freshValue));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // invalidatePattern – KEYS→SCAN regression tests
  // ─────────────────────────────────────────────────────────────────────────────
  describe('invalidatePattern', () => {
    it('REGRESSION: should use SCAN instead of KEYS command', async () => {
      // SCAN returns [cursor, keys]; cursor '0' means iteration complete
      mockRedis.scan.mockResolvedValue(['0', ['key1', 'key2', 'key3']]);
      mockRedis.del.mockResolvedValue(3);

      await cacheService.invalidatePattern('session:*');

      expect(mockRedis.scan).toHaveBeenCalled();
      expect(mockRedis.keys).not.toHaveBeenCalled(); // KEYS must NOT be called
    });

    it('should delete all keys found by SCAN', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['key1', 'key2', 'key3']]);
      mockRedis.del.mockResolvedValue(3);

      const count = await cacheService.invalidatePattern('session:*');

      expect(count).toBe(3);
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should handle multi-iteration SCAN (cursor != 0 on first call)', async () => {
      // First call returns cursor '42' (not done), second call returns '0' (done)
      mockRedis.scan
        .mockResolvedValueOnce(['42', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', ['key3']]);
      mockRedis.del.mockResolvedValue(3);

      const count = await cacheService.invalidatePattern('servers:*');

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(count).toBe(3);
    });

    it('should return 0 and not call del when no keys match', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);

      const count = await cacheService.invalidatePattern('nonexistent:*');

      expect(count).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TTL configuration
  // ─────────────────────────────────────────────────────────────────────────────
  describe('TTL configuration', () => {
    it('should have correct TTL values (in seconds) for each data type', () => {
      const stats = cacheService.getStats();

      expect(stats.ttlConfig.userSession).toBe(7 * 24 * 3600); // 7 days
      expect(stats.ttlConfig.serverMetrics).toBe(600);           // 10 minutes
      expect(stats.ttlConfig.gpuStatus).toBe(120);               // 2 minutes
      expect(stats.ttlConfig.taskList).toBe(300);                // 5 minutes
      expect(stats.ttlConfig.serverList).toBe(900);              // 15 minutes
      expect(stats.ttlConfig.userList).toBe(1800);               // 30 minutes
    });

    it('cacheUserSession should use 7-day TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.cacheUserSession('user-123', { token: 'abc' });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'session:user-123',
        7 * 24 * 3600,
        expect.any(String)
      );
    });

    it('cacheServerMetrics should use 10-minute TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.cacheServerMetrics('server-1', { cpu: 50 });

      expect(mockRedis.setex).toHaveBeenCalledWith('metrics:server:server-1', 600, expect.any(String));
    });

    it('cacheList("users") should use 30-minute TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.cacheList('users', []);

      expect(mockRedis.setex).toHaveBeenCalledWith('list:users:all', 1800, expect.any(String));
    });

    it('cacheList("servers") should use 15-minute TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.cacheList('servers', []);

      expect(mockRedis.setex).toHaveBeenCalledWith('list:servers:all', 900, expect.any(String));
    });

    it('cacheList("tasks") should use 5-minute TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.cacheList('tasks', []);

      expect(mockRedis.setex).toHaveBeenCalledWith('list:tasks:all', 300, expect.any(String));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────────
  describe('getStats / resetStats', () => {
    it('should calculate hit rate correctly', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'test' }));
      await cacheService.get('key1');
      await cacheService.get('key2');
      mockRedis.get.mockResolvedValue(null);
      await cacheService.get('key3');
      await cacheService.get('key4');

      const stats = cacheService.getStats();
      expect(stats.hitRate).toBe(50); // 2 hits / 4 total = 50%
    });

    it('should reset all statistics to zero', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({}));
      await cacheService.get('key1');

      cacheService.resetStats();
      const stats = cacheService.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should call Redis flushdb', async () => {
      mockRedis.flushdb.mockResolvedValue('OK');
      await cacheService.clear();
      expect(mockRedis.flushdb).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should quit Redis connection', async () => {
      mockRedis.quit.mockResolvedValue('OK');
      await cacheService.close();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('warmupCache', () => {
    it('should call setex for each provided data type', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.warmupCache({
        users: [{ id: '1' }],
        servers: [{ id: 's1' }],
        gpus: [{ id: 'g1' }],
        tasks: [{ id: 't1' }],
      });

      expect(mockRedis.setex).toHaveBeenCalledTimes(4);
    });

    it('should handle partial data (only provided types are cached)', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.warmupCache({ users: [{ id: '1' }] });

      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAnalytics', () => {
    it('should include uptime and warmupKeys fields', () => {
      const analytics = cacheService.getAnalytics();

      expect(analytics).toHaveProperty('uptime');
      expect(analytics).toHaveProperty('warmupKeys');
      expect(Array.isArray(analytics.warmupKeys)).toBe(true);
    });
  });

  describe('optimize', () => {
    it('should return recommendations array', async () => {
      mockRedis.info.mockResolvedValue('# Stats\nused_memory:1000000');

      const result = await cacheService.optimize();

      expect(result.optimized).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});
