import { Redis } from 'ioredis';

/**
 * Redis Cache Service
 */
export class CacheService {
  private redis: Redis;
  // Optimized TTL settings (Day 7 cache optimization)
  private ttlConfig = {
    userSession: 7 * 24 * 3600,      // 7 days
    serverMetrics: 600,               // 10 minutes
    gpuStatus: 120,                   // 2 minutes (frequently changing)
    userList: 1800,                   // 30 minutes
    serverList: 900,                  // 15 minutes
    taskList: 300,                    // 5 minutes (frequently changing)
    gpuList: 600,                     // 10 minutes
    clusterStats: 60,                 // 1 minute (real-time stats)
    healthCheck: 30,                  // 30 seconds (frequent checks)
    default: 3600,                    // 1 hour
  };

  // Cache warming configuration (Day 7)
  private warmupKeys = [
    'list:users:all',
    'list:servers:all',
    'list:gpus:all',
    'list:tasks:all',
  ];

  private hits: number = 0;
  private misses: number = 0;
  private size: number = 0;
  private lastStatsReset: Date = new Date();

  get defaultTTL(): number {
    return this.ttlConfig.default;
  }

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB) || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('error', (err) => {
      console.error('[Cache] Redis error:', err);
    });

    this.redis.on('connect', () => {
      console.log('[Cache] Redis connected');
    });
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value !== null) {
        this.hits++;
        return JSON.parse(value) as T;
      } else {
        this.misses++;
        return null;
      }
    } catch (error) {
      this.misses++;
      console.error('[Cache] Get error:', error);
      return null;
    }
  }

  /**
   * Set value to cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const expireTime = ttl || this.defaultTTL;
      await this.redis.setex(key, expireTime, serialized);
      this.size++;
      return true;
    } catch (error) {
      console.error('[Cache] Set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      if (result > 0) {
        this.size--;
      }
      return true;
    } catch (error) {
      console.error('[Cache] Delete error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('[Cache] Exists error:', error);
      return false;
    }
  }

  /**
   * Get cache with fallback function
   */
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fallback();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Cache user session (optimized TTL: 7 days)
   */
  async cacheUserSession(userId: string, session: any): Promise<boolean> {
    return this.set(`session:${userId}`, session, this.ttlConfig.userSession);
  }

  /**
   * Get cached user session
   */
  async getUserSession(userId: string): Promise<any | null> {
    return this.get(`session:${userId}`);
  }

  /**
   * Cache server metrics (optimized TTL: 10 minutes)
   */
  async cacheServerMetrics(serverId: string, metrics: any): Promise<boolean> {
    return this.set(`metrics:server:${serverId}`, metrics, this.ttlConfig.serverMetrics);
  }

  /**
   * Get cached server metrics
   */
  async getServerMetrics(serverId: string): Promise<any | null> {
    return this.get(`metrics:server:${serverId}`);
  }

  /**
   * Cache GPU status (optimized TTL: 2 minutes)
   */
  async cacheGpuStatus(gpuId: string, status: any): Promise<boolean> {
    return this.set(`gpu:status:${gpuId}`, status, this.ttlConfig.gpuStatus);
  }

  /**
   * Get cached GPU status
   */
  async getGpuStatus(gpuId: string): Promise<any | null> {
    return this.get(`gpu:status:${gpuId}`);
  }

  /**
   * Cache list data with optimized TTL
   */
  async cacheList(type: 'users' | 'servers' | 'tasks' | 'gpus', data: any): Promise<boolean> {
    // TTL config keys use singular form: userList, serverList, taskList, gpuList
    const singular = type.replace(/s$/, ''); // 'users' → 'user', 'servers' → 'server'
    const ttl = this.ttlConfig[`${singular}List` as keyof typeof this.ttlConfig] || this.ttlConfig.default;
    return this.set(`list:${type}:all`, data, ttl);
  }

  /**
   * Get cached list data
   */
  async getList(type: 'users' | 'servers' | 'tasks' | 'gpus'): Promise<any | null> {
    return this.get(`list:${type}:all`);
  }

  /**
   * Clear all cache (for development)
   */
  async clear(): Promise<void> {
    await this.redis.flushdb();
    console.log('[Cache] Cache cleared');
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
    ttlConfig: any;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.size,
      hitRate: Math.round(hitRate * 100) / 100,
      ttlConfig: this.ttlConfig,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.size = 0;
  }

  /**
   * Get current hit rate percentage
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }

  /**
   * Cache warming - Pre-populate frequently accessed data (Day 7)
   */
  async warmupCache(data: {
    users?: any;
    servers?: any;
    gpus?: any;
    tasks?: any;
  }): Promise<void> {
    const warmupPromises: Promise<boolean>[] = [];

    if (data.users) {
      warmupPromises.push(this.cacheList('users', data.users));
    }
    if (data.servers) {
      warmupPromises.push(this.cacheList('servers', data.servers));
    }
    if (data.gpus) {
      warmupPromises.push(this.cacheList('gpus', data.gpus));
    }
    if (data.tasks) {
      warmupPromises.push(this.cacheList('tasks', data.tasks));
    }

    await Promise.all(warmupPromises);
    console.log('[Cache] Cache warming completed');
  }

  /**
   * Get detailed cache analytics (Day 7)
   */
  getAnalytics(): {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
    ttlConfig: any;
    uptime: number;
    warmupKeys: string[];
  } {
    const uptime = Date.now() - this.lastStatsReset.getTime();
    return {
      ...this.getStats(),
      uptime,
      warmupKeys: this.warmupKeys,
    };
  }

  /**
   * Invalidate specific cache pattern (Day 7)
   *
   * Fix: Replaced `KEYS` (O(N) blocking scan) with `SCAN` (non-blocking iteration).
   * `KEYS` blocks the entire Redis server during scan; `SCAN` iterates in small
   * batches and is safe to use in production.
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const startTime = Date.now();
    const matchedKeys: string[] = [];

    let cursor = '0';
    do {
      // SCAN count:100 means "try to return ~100 keys per call" (approximate)
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      matchedKeys.push(...keys);
    } while (cursor !== '0');

    if (matchedKeys.length > 0) {
      await this.redis.del(...matchedKeys);
      this.size = Math.max(0, this.size - matchedKeys.length);
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Cache] invalidatePattern pattern=${pattern} found=${matchedKeys.length} keys duration=${duration}ms`
    );

    return matchedKeys.length;
  }

  /**
   * Optimize cache based on access patterns (Day 7)
   */
  async optimize(): Promise<{
    optimized: boolean;
    keysAdjusted: number;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    const hitRate = this.getHitRate();

    // Analyze hit rate and provide recommendations
    if (hitRate < 50) {
      recommendations.push('Consider increasing TTL for frequently accessed keys');
      recommendations.push('Review cache key design for better hit rates');
    } else if (hitRate > 95) {
      recommendations.push('Excellent hit rate - consider reducing TTL to save memory');
    }

    // Check for stale keys
    const info = await this.redis.info('stats');
    recommendations.push(`Redis memory: Check INFO memory for detailed stats`);

    return {
      optimized: true,
      keysAdjusted: 0,
      recommendations,
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();
