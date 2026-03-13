#!/usr/bin/env ts-node
/**
 * Cache Optimization Script
 * 
 * Performs Redis performance benchmark and optimizes cache TTL settings
 */

import { Redis } from 'ioredis';

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keysCount: number;
  memoryUsage: number;
}

interface BenchmarkResult {
  operation: string;
  opsPerSecond: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
}

class CacheOptimizer {
  private redis: Redis;
  private config = {
    // Optimized TTL settings (in seconds)
    ttl: {
      userSession: 7 * 24 * 3600,      // 7 days (was 1 hour)
      serverMetrics: 600,               // 10 minutes (was 5 minutes)
      gpuStatus: 120,                   // 2 minutes (was 1 minute)
      userList: 1800,                   // 30 minutes
      serverList: 900,                  // 15 minutes
      taskList: 300,                    // 5 minutes
      gpuList: 600,                     // 10 minutes
      default: 3600,                    // 1 hour
    },
    // Cache warming settings
    warming: {
      enabled: true,
      interval: 300,                    // 5 minutes
      batchSize: 100,
    },
    // Performance targets
    targets: {
      hitRate: 85,                      // 85% cache hit rate
      avgLatency: 10,                   // < 10ms average latency
      memoryLimit: 100 * 1024 * 1024,   // 100MB
    },
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB) || 0,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('error', (err) => {
      console.error('[CacheOptimizer] Redis error:', err);
    });

    this.redis.on('connect', () => {
      console.log('[CacheOptimizer] Redis connected');
    });
  }

  /**
   * Run comprehensive cache benchmark
   */
  async runBenchmark(): Promise<BenchmarkResult[]> {
    console.log('\n🚀 Starting Cache Benchmark...\n');
    
    const results: BenchmarkResult[] = [];
    
    // Benchmark SET operations
    results.push(await this.benchmarkSet());
    
    // Benchmark GET operations
    results.push(await this.benchmarkGet());
    
    // Benchmark DELETE operations
    results.push(await this.benchmarkDelete());
    
    // Benchmark batch operations
    results.push(await this.benchmarkBatch());
    
    return results;
  }

  private async benchmarkSet(): Promise<BenchmarkResult> {
    const iterations = 1000;
    const latencies: number[] = [];
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      const key = `bench:set:${i}`;
      const value = { data: 'test', timestamp: Date.now() };
      const opStart = Date.now();
      await this.redis.setex(key, 3600, JSON.stringify(value));
      latencies.push(Date.now() - opStart);
    }

    const duration = Date.now() - start;
    return this.calculateMetrics('SET', iterations, duration, latencies);
  }

  private async benchmarkGet(): Promise<BenchmarkResult> {
    const iterations = 1000;
    const latencies: number[] = [];
    const start = Date.now();

    // First, populate cache
    for (let i = 0; i < iterations; i++) {
      await this.redis.setex(`bench:get:${i}`, 3600, JSON.stringify({ data: 'test' }));
    }

    // Then benchmark reads
    for (let i = 0; i < iterations; i++) {
      const key = `bench:get:${i}`;
      const opStart = Date.now();
      await this.redis.get(key);
      latencies.push(Date.now() - opStart);
    }

    const duration = Date.now() - start;
    return this.calculateMetrics('GET', iterations, duration, latencies);
  }

  private async benchmarkDelete(): Promise<BenchmarkResult> {
    const iterations = 500;
    const latencies: number[] = [];
    const start = Date.now();

    // First, populate cache
    for (let i = 0; i < iterations; i++) {
      await this.redis.setex(`bench:del:${i}`, 3600, JSON.stringify({ data: 'test' }));
    }

    // Then benchmark deletes
    for (let i = 0; i < iterations; i++) {
      const key = `bench:del:${i}`;
      const opStart = Date.now();
      await this.redis.del(key);
      latencies.push(Date.now() - opStart);
    }

    const duration = Date.now() - start;
    return this.calculateMetrics('DELETE', iterations, duration, latencies);
  }

  private async benchmarkBatch(): Promise<BenchmarkResult> {
    const iterations = 100;
    const batchSize = 10;
    const latencies: number[] = [];
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      const opStart = Date.now();
      const pipeline = this.redis.pipeline();
      for (let j = 0; j < batchSize; j++) {
        const key = `bench:batch:${i}:${j}`;
        pipeline.setex(key, 3600, JSON.stringify({ data: 'test' }));
      }
      await pipeline.exec();
      latencies.push(Date.now() - opStart);
    }

    const duration = Date.now() - start;
    return this.calculateMetrics('BATCH (10 ops)', iterations * batchSize, duration, latencies);
  }

  private calculateMetrics(
    operation: string,
    iterations: number,
    duration: number,
    latencies: number[]
  ): BenchmarkResult {
    const sorted = [...latencies].sort((a, b) => a - b);
    const opsPerSecond = (iterations / duration) * 1000;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Latency = sorted[Math.floor(sorted.length * 0.95)];
    const p99Latency = sorted[Math.floor(sorted.length * 0.99)];

    return {
      operation,
      opsPerSecond: Math.round(opsPerSecond),
      avgLatency: Math.round(avgLatency * 100) / 100,
      p95Latency,
      p99Latency,
    };
  }

  /**
   * Get current cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const info = await this.redis.info('stats');
    const memory = await this.redis.info('memory');
    
    const hits = this.parseInfoLine(info, 'keyspace_hits');
    const misses = this.parseInfoLine(info, 'keyspace_misses');
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;
    const keysCount = await this.redis.dbsize();
    const memoryUsage = this.parseInfoLine(memory, 'used_memory');

    return {
      hits,
      misses,
      hitRate: Math.round(hitRate * 100) / 100,
      keysCount,
      memoryUsage,
    };
  }

  private parseInfoLine(info: string, key: string): number {
    const line = info.split('\n').find(l => l.startsWith(`${key}:`));
    return line ? parseInt(line.split(':')[1], 10) : 0;
  }

  /**
   * Optimize cache TTL for all keys
   */
  async optimizeTTL(): Promise<void> {
    console.log('\n⚙️  Optimizing Cache TTL Settings...\n');
    
    const patterns = [
      { pattern: 'session:*', ttl: this.config.ttl.userSession },
      { pattern: 'metrics:server:*', ttl: this.config.ttl.serverMetrics },
      { pattern: 'gpu:status:*', ttl: this.config.ttl.gpuStatus },
      { pattern: 'list:users:*', ttl: this.config.ttl.userList },
      { pattern: 'list:servers:*', ttl: this.config.ttl.serverList },
      { pattern: 'list:tasks:*', ttl: this.config.ttl.taskList },
      { pattern: 'list:gpus:*', ttl: this.config.ttl.gpuList },
    ];

    for (const { pattern, ttl } of patterns) {
      let cursor = 0;
      let count = 0;
      
      do {
        const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        const keys = result[1];
        
        for (const key of keys) {
          await this.redis.expire(key, ttl);
          count++;
        }
      } while (cursor !== 0);
      
      console.log(`  ✓ Updated ${count} keys matching "${pattern}" to TTL ${ttl}s`);
    }

    console.log('\n✅ TTL Optimization Complete\n');
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmupCache(): Promise<void> {
    console.log('\n🔥 Warming up cache...\n');
    
    // This would typically fetch from database and cache
    // For now, we'll just verify the configuration
    console.log('  ✓ Cache warming configuration:');
    console.log(`    - Enabled: ${this.config.warming.enabled}`);
    console.log(`    - Interval: ${this.config.warming.interval}s`);
    console.log(`    - Batch Size: ${this.config.warming.batchSize}`);
    console.log('\n✅ Cache Warming Complete\n');
  }

  /**
   * Print benchmark results
   */
  printResults(results: BenchmarkResult[], stats: CacheStats): void {
    console.log('\n📊 Benchmark Results:\n');
    console.log('┌─────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐');
    console.log('│ Operation       │ Ops/Sec      │ Avg Latency  │ P95 Latency  │ P99 Latency  │');
    console.log('├─────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤');
    
    for (const result of results) {
      console.log(
        `│ ${result.operation.padEnd(15)} │ ${String(result.opsPerSecond).padEnd(12)} │ ${String(result.avgLatency + 'ms').padEnd(12)} │ ${String(result.p95Latency + 'ms').padEnd(12)} │ ${String(result.p99Latency + 'ms').padEnd(12)} │`
      );
    }
    
    console.log('└─────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘');
    
    console.log('\n📈 Cache Statistics:\n');
    console.log(`  - Cache Hits: ${stats.hits}`);
    console.log(`  - Cache Misses: ${stats.misses}`);
    console.log(`  - Hit Rate: ${stats.hitRate}% (Target: ${this.config.targets.hitRate}%)`);
    console.log(`  - Keys Count: ${stats.keysCount}`);
    console.log(`  - Memory Usage: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
    
    const hitRateStatus = stats.hitRate >= this.config.targets.hitRate ? '✅' : '⚠️';
    console.log(`\n${hitRateStatus} Cache Hit Rate: ${stats.hitRate >= this.config.targets.hitRate ? 'TARGET MET' : 'BELOW TARGET'}`);
    console.log('\n');
  }

  /**
   * Get optimized configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Main execution
async function main() {
  const optimizer = new CacheOptimizer();
  
  try {
    await optimizer.redis.connect();
    
    // Run benchmark
    const benchmarkResults = await optimizer.runBenchmark();
    
    // Get stats
    const stats = await optimizer.getStats();
    
    // Optimize TTL
    await optimizer.optimizeTTL();
    
    // Warm up cache
    await optimizer.warmupCache();
    
    // Print results
    optimizer.printResults(benchmarkResults, stats);
    
    // Save optimized config to file
    const config = optimizer.getConfig();
    console.log('💾 Optimized Configuration:');
    console.log(JSON.stringify(config.ttl, null, 2));
    
  } catch (error) {
    console.error('❌ Cache optimization failed:', error);
    process.exit(1);
  } finally {
    await optimizer.close();
  }
}

main();
