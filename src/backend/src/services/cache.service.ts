import { Redis } from 'ioredis';

/**
 * Redis Cache Service
 */
export class CacheService {
  private redis: Redis;
  private defaultTTL: number = 3600; // 1 hour
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
   * Cache user session
   */
  async cacheUserSession(userId: string, session: any, ttl: number = 7 * 24 * 3600): Promise<boolean> {
    return this.set(`session:${userId}`, session, ttl);
  }

  /**
   * Get cached user session
   */
  async getUserSession(userId: string): Promise<any | null> {
    return this.get(`session:${userId}`);
  }

  /**
   * Cache server metrics
   */
  async cacheServerMetrics(serverId: string, metrics: any, ttl: number = 300): Promise<boolean> {
    return this.set(`metrics:server:${serverId}`, metrics, ttl);
  }

  /**
   * Get cached server metrics
   */
  async getServerMetrics(serverId: string): Promise<any | null> {
    return this.get(`metrics:server:${serverId}`);
  }

  /**
   * Cache GPU status
   */
  async cacheGpuStatus(gpuId: string, status: any, ttl: number = 60): Promise<boolean> {
    return this.set(`gpu:status:${gpuId}`, status, ttl);
  }

  /**
   * Get cached GPU status
   */
  async getGpuStatus(gpuId: string): Promise<any | null> {
    return this.get(`gpu:status:${gpuId}`);
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
  } {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.size,
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
}

// Export singleton instance
export const cacheService = new CacheService();
