import { PrismaClient } from '@prisma/client';
import { cacheService } from './cache.service';

const prisma = new PrismaClient();

/**
 * Cache warmup configuration
 */
export interface CacheWarmupConfig {
  enabled: boolean;
  warmupOnStartup: boolean;
  scheduledWarmup: boolean;
  warmupIntervalMinutes: number;
  warmupItems: WarmupItem[];
  maxConcurrentWarmups: number;
}

/**
 * Warmup item configuration
 */
export interface WarmupItem {
  key: string;
  type: 'servers' | 'gpus' | 'tasks' | 'users' | 'metrics';
  filter?: Record<string, any>;
  ttl?: number;
  priority: number; // Lower = higher priority
}

/**
 * Cache warmup statistics
 */
export interface WarmupStats {
  totalWarmups: number;
  successfulWarmups: number;
  failedWarmups: number;
  lastWarmupAt?: Date;
  nextWarmupAt?: Date;
  averageWarmupTimeMs: number;
  cacheHitRateBefore: number;
  cacheHitRateAfter: number;
}

/**
 * Cache Warmup Service
 * 
 * Implements intelligent cache warming strategies:
 * - Startup warmup
 * - Scheduled warmup
 * - Hot data identification
 * - Adaptive TTL adjustment
 */
export class CacheWarmupService {
  private config: CacheWarmupConfig;
  private stats: WarmupStats;
  private warmupTimer?: NodeJS.Timeout;
  private accessFrequency: Map<string, number> = new Map();
  private lastAccessTime: Map<string, number> = new Map();

  constructor() {
    this.config = {
      enabled: process.env.CACHE_WARMUP_ENABLED === 'true',
      warmupOnStartup: true,
      scheduledWarmup: true,
      warmupIntervalMinutes: 30,
      maxConcurrentWarmups: 5,
      warmupItems: [
        { key: 'servers:all', type: 'servers', priority: 1 },
        { key: 'gpus:available', type: 'gpus', filter: { allocated: false }, priority: 2 },
        { key: 'tasks:pending', type: 'tasks', filter: { status: 'PENDING' }, priority: 3 },
        { key: 'users:active', type: 'users', filter: { isActive: true }, priority: 4 },
      ],
    };

    this.stats = {
      totalWarmups: 0,
      successfulWarmups: 0,
      failedWarmups: 0,
      averageWarmupTimeMs: 0,
      cacheHitRateBefore: 0,
      cacheHitRateAfter: 0,
    };
  }

  /**
   * Initialize cache warmup service
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[CacheWarmup] Service disabled');
      return;
    }

    console.log('[CacheWarmup] Initializing...');

    // Warmup on startup
    if (this.config.warmupOnStartup) {
      await this.performWarmup();
    }

    // Schedule periodic warmup
    if (this.config.scheduledWarmup) {
      this.scheduleWarmup();
    }

    console.log('[CacheWarmup] Initialization complete');
  }

  /**
   * Perform cache warmup
   */
  async performWarmup(): Promise<void> {
    const startTime = Date.now();
    console.log('[CacheWarmup] Starting warmup...');

    // Get cache hit rate before warmup
    this.stats.cacheHitRateBefore = await this.getCacheHitRate();

    // Sort items by priority
    const sortedItems = [...this.config.warmupItems].sort((a, b) => a.priority - b.priority);

    // Process items with concurrency limit
    const batches = this.chunkArray(sortedItems, this.config.maxConcurrentWarmups);

    for (const batch of batches) {
      const promises = batch.map(item => this.warmupItem(item).catch(error => {
        console.error(`[CacheWarmup] Failed to warmup ${item.key}:`, error);
        this.stats.failedWarmups++;
      }));

      await Promise.all(promises);
      this.stats.successfulWarmups += batch.length;
    }

    this.stats.totalWarmups++;
    this.stats.lastWarmupAt = new Date();

    const duration = Date.now() - startTime;
    this.updateAverageWarmupTime(duration);

    // Get cache hit rate after warmup
    this.stats.cacheHitRateAfter = await this.getCacheHitRate();

    console.log(`[CacheWarmup] Warmup completed in ${duration}ms`);
    console.log(`[CacheWarmup] Cache hit rate: ${this.stats.cacheHitRateBefore.toFixed(1)}% → ${this.stats.cacheHitRateAfter.toFixed(1)}%`);
  }

  /**
   * Warmup a single item
   */
  private async warmupItem(item: WarmupItem): Promise<void> {
    const startTime = Date.now();
    console.log(`[CacheWarmup] Warming up: ${item.key}`);

    let data: any;

    switch (item.type) {
      case 'servers':
        data = await this.warmupServers(item.filter);
        break;
      case 'gpus':
        data = await this.warmupGpus(item.filter);
        break;
      case 'tasks':
        data = await this.warmupTasks(item.filter);
        break;
      case 'users':
        data = await this.warmupUsers(item.filter);
        break;
      case 'metrics':
        data = await this.warmupMetrics();
        break;
    }

    if (data) {
      const ttl = item.ttl || 300000; // Default 5 minutes
      await cacheService.set(item.key, data, ttl);
      
      const duration = Date.now() - startTime;
      console.log(`[CacheWarmup] ✓ ${item.key} cached (${duration}ms, TTL: ${ttl}ms)`);
    }
  }

  /**
   * Warmup servers data
   */
  private async warmupServers(filter?: Record<string, any>): Promise<any> {
    return prisma.server.findMany({
      where: filter,
      include: {
        gpus: true,
        _count: {
          select: { metrics: true },
        },
      },
    });
  }

  /**
   * Warmup GPUs data
   */
  private async warmupGpus(filter?: Record<string, any>): Promise<any> {
    return prisma.gpu.findMany({
      where: filter,
      include: {
        server: true,
      },
    });
  }

  /**
   * Warmup tasks data
   */
  private async warmupTasks(filter?: Record<string, any>): Promise<any> {
    return prisma.task.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Warmup users data
   */
  private async warmupUsers(filter?: Record<string, any>): Promise<any> {
    return prisma.user.findMany({
      where: filter,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
  }

  /**
   * Warmup metrics data
   */
  private async warmupMetrics(): Promise<any> {
    const [serverMetrics, gpuMetrics] = await Promise.all([
      prisma.serverMetric.findMany({
        orderBy: { recordedAt: 'desc' },
        take: 1000,
      }),
      prisma.gpu.findMany({
        select: {
          id: true,
          model: true,
          memory: true,
          allocated: true,
        },
      }),
    ]);

    return {
      serverMetrics,
      gpuMetrics,
    };
  }

  /**
   * Schedule periodic warmup
   */
  private scheduleWarmup(): void {
    if (this.warmupTimer) {
      clearTimeout(this.warmupTimer);
    }

    const interval = this.config.warmupIntervalMinutes * 60 * 1000;
    
    this.warmupTimer = setTimeout(async () => {
      await this.performWarmup();
      this.scheduleWarmup();
    }, interval);

    this.stats.nextWarmupAt = new Date(Date.now() + interval);
    console.log(`[CacheWarmup] Next warmup scheduled in ${this.config.warmupIntervalMinutes} minutes`);
  }

  /**
   * Identify hot data based on access patterns
   */
  identifyHotData(): string[] {
    const hotData: Array<{ key: string; score: number }> = [];

    for (const [key, count] of this.accessFrequency.entries()) {
      const lastAccess = this.lastAccessTime.get(key) || 0;
      const recency = Math.max(0, 1 - (Date.now() - lastAccess) / (60 * 60 * 1000)); // 1 hour decay
      const score = count * recency;

      hotData.push({ key, score });
    }

    // Sort by score and return top 20
    return hotData
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(item => item.key);
  }

  /**
   * Record cache access for hot data identification
   */
  recordAccess(key: string): void {
    const count = this.accessFrequency.get(key) || 0;
    this.accessFrequency.set(key, count + 1);
    this.lastAccessTime.set(key, Date.now());
  }

  /**
   * Dynamically adjust TTL based on access frequency
   */
  calculateDynamicTTL(key: string, baseTTL: number): number {
    const accessCount = this.accessFrequency.get(key) || 0;
    const lastAccess = this.lastAccessTime.get(key) || 0;
    const timeSinceAccess = Date.now() - lastAccess;

    // Increase TTL for frequently accessed data
    if (accessCount > 100) {
      return baseTTL * 2; // Double TTL for hot data
    }

    // Decrease TTL for stale data
    if (timeSinceAccess > 30 * 60 * 1000) {
      return baseTTL / 2; // Half TTL for cold data
    }

    return baseTTL;
  }

  /**
   * Add a warmup item
   */
  addWarmupItem(item: WarmupItem): void {
    this.config.warmupItems.push(item);
    console.log(`[CacheWarmup] Added warmup item: ${item.key}`);
  }

  /**
   * Remove a warmup item
   */
  removeWarmupItem(key: string): boolean {
    const index = this.config.warmupItems.findIndex(item => item.key === key);
    if (index !== -1) {
      this.config.warmupItems.splice(index, 1);
      console.log(`[CacheWarmup] Removed warmup item: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CacheWarmupConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[CacheWarmup] Configuration updated');

    if (config.scheduledWarmup !== undefined) {
      if (config.scheduledWarmup) {
        this.scheduleWarmup();
      } else if (this.warmupTimer) {
        clearTimeout(this.warmupTimer);
        this.warmupTimer = undefined;
      }
    }
  }

  /**
   * Get warmup statistics
   */
  getStats(): WarmupStats {
    return this.stats;
  }

  /**
   * Get configuration
   */
  getConfig(): CacheWarmupConfig {
    return this.config;
  }

  /**
   * Get cache hit rate
   */
  private async getCacheHitRate(): Promise<number> {
    const stats = await cacheService.getStats();
    return stats.hitRate || 0;
  }

  /**
   * Update average warmup time
   */
  private updateAverageWarmupTime(latestTime: number): void {
    const total = this.stats.totalWarmups;
    const oldAverage = this.stats.averageWarmupTimeMs;
    this.stats.averageWarmupTimeMs = ((oldAverage * (total - 1)) + latestTime) / total;
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.warmupTimer) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = undefined;
    }
    console.log('[CacheWarmup] Service destroyed');
  }
}

// Export singleton instance
export const cacheWarmupService = new CacheWarmupService();
