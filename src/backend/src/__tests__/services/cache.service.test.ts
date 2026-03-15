/**
 * Cache Service Tests
 * 
 * Tests for Redis caching, TTL management, and cache warming
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

    it('should handle JSON parse errors', async () => {
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
    it('should set value with default TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await cacheService.set('test-key', { data: 'value' });

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        3600, // default TTL
        JSON.stringify({ data: 'value' })
      );
    });

    it('should set value with custom TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await cacheService.set('test-key', { data: 'value' }, 600);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        600,
        expect.any(String)
      );
    });

    it('should return false on error', async () => {
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

    it('should handle delete errors', async () => {
      mockRedis.del.mockRejectedValue(new Error('Delete error'));

      const result = await cacheService.delete('test-key');

      expect(result).toBe(true); // Returns true even on error (graceful failure)
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await cacheService.exists('existing-key');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await cacheService.exists('nonexistent-key');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Error'));

      const result = await cacheService.exists('key');

      expect(result).toBe(false);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
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
      expect(fallback).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith('key', 600, JSON.stringify(freshValue));
    });
  });

  describe('cacheUserSession', () => {
    it('should cache user session with 7-day TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.cacheUserSession('user-123', { token: 'abc' });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'session:user-123',
        7 * 24 * 3600, // 7 days
        expect.any(String)
      );
    });
  });

  describe('getUserSession', () => {
    it('should get cached user session', async () => {
      const session = { token: 'abc', userId: '123' };
      mockRedis.get.mockResolvedValue(JSON.stringify(session));

      const result = await cacheService.getUserSession('user-123');

      expect(result).toEqual(session);
      expect(mockRedis.get).toHaveBeenCalledWith('session:user-123');
    });
  });

  describe('cacheServerMetrics', () => {
    it('should cache metrics with 10-minute TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.cacheServerMetrics('server-1', { cpu: 50 });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'metrics:server:server-1',
        600, // 10 minutes
        expect.any(String)
      );
    });
  });

  describe('cacheList', () => {
    it('should cache user list with correct TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.cacheList('users', [{ id: '1' }]);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'list:users:all',
        1800, // 30 minutes
        expect.any(String)
      );
    });

    it('should cache server list with correct TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.cacheList('servers', [{ id: '1' }]);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'list:servers:all',
        900, // 15 minutes
        expect.any(String)
      );
    });

    it('should cache task list with correct TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.cacheList('tasks', [{ id: '1' }]);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'list:tasks:all',
        300, // 5 minutes
        expect.any(String)
      );
    });

    it('should cache GPU list with correct TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.cacheList('gpus', [{ id: '1' }]);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'list:gpus:all',
        600, // 10 minutes
        expect.any(String)
      );
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ data: 'test' }));
      mockRedis.get.mockResolvedValueOnce(null);
      
      await cacheService.get('key1');
      await cacheService.get('key2');

      const stats = cacheService.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('ttlConfig');
    });

    it('should calculate hit rate correctly', async () => {
      // 2 hits
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'test' }));
      await cacheService.get('key1');
      await cacheService.get('key2');
      
      // 2 misses
      mockRedis.get.mockResolvedValue(null);
      await cacheService.get('key3');
      await cacheService.get('key4');

      const stats = cacheService.getStats();

      expect(stats.hitRate).toBe(50); // 50% hit rate
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ data: 'test' }));
      await cacheService.get('key1');

      cacheService.resetStats();
      const stats = cacheService.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all cache', async () => {
      mockRedis.flushdb.mockResolvedValue('OK');

      await cacheService.clear();

      expect(mockRedis.flushdb).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close Redis connection', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await cacheService.close();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('warmupCache', () => {
    it('should warm up all provided data', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.warmupCache({
        users: [{ id: '1' }],
        servers: [{ id: 's1' }],
        gpus: [{ id: 'g1' }],
        tasks: [{ id: 't1' }],
      });

      expect(mockRedis.setex).toHaveBeenCalledTimes(4);
    });

    it('should handle partial data', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cacheService.warmupCache({
        users: [{ id: '1' }],
      });

      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate keys matching pattern', async () => {
      mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3']);
      mockRedis.del.mockResolvedValue(3);

      const count = await cacheService.invalidatePattern('session:*');

      expect(count).toBe(3);
      expect(mockRedis.keys).toHaveBeenCalledWith('session:*');
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should return 0 when no keys match', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const count = await cacheService.invalidatePattern('nonexistent:*');

      expect(count).toBe(0);
    });
  });

  describe('optimize', () => {
    it('should return optimization recommendations', async () => {
      mockRedis.info.mockResolvedValue('# Stats\nused_memory:1000000');

      const result = await cacheService.optimize();

      expect(result.optimized).toBe(true);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('getAnalytics', () => {
    it('should return comprehensive analytics', async () => {
      const analytics = cacheService.getAnalytics();

      expect(analytics).toHaveProperty('hits');
      expect(analytics).toHaveProperty('misses');
      expect(analytics).toHaveProperty('hitRate');
      expect(analytics).toHaveProperty('uptime');
      expect(analytics).toHaveProperty('warmupKeys');
    });
  });

  describe('TTL Configuration', () => {
    it('should have correct TTL for different data types', () => {
      const stats = cacheService.getStats();
      
      expect(stats.ttlConfig.userSession).toBe(7 * 24 * 3600); // 7 days
      expect(stats.ttlConfig.serverMetrics).toBe(600); // 10 minutes
      expect(stats.ttlConfig.gpuStatus).toBe(120); // 2 minutes
      expect(stats.ttlConfig.taskList).toBe(300); // 5 minutes
    });
  });
});