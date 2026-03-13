import { Redis } from 'ioredis';

/**
 * Redis Cache Service
 */
export class CacheService {
  private redis: Redis;
  // Optimized TTL settings (Day 4 cache optimization)
  private ttlConfig = {
    userSession: 7 * 24 * 3600,      // 7 days
    serverMetrics: 600,               // 10 minutes
    gpuStatus: 120,                   // 2 minutes
    userList: 1800,                   // 30 minutes
    serverList: 900,                  // 15 minutes
    taskList: 300,                    // 5 minutes
    gpuList: 600,                     // 10 minutes
    default: 3600,                    // 1 hour
  };
  private hits: number = 0;
  private misses: number = 0;
  private size: number = 0;

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
    const ttl = this.ttlConfig[`${type}List` as keyof typeof this.ttlConfig] || this.ttlConfig.default;
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
}

// Export singleton instance
export const cacheService = new CacheService();
