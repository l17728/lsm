import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const prisma = new PrismaClient();
const execAsync = promisify(exec);

/**
 * System Health Check Service
 */
export class HealthCheckService {
  /**
   * Check database health
   */
  async checkDatabase(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    message: string;
  }> {
    const startTime = Date.now();
    
    try {
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;
      
      return {
        status: responseTime < 1000 ? 'healthy' : 'unhealthy',
        responseTime,
        message: responseTime < 1000 ? 'Database is responsive' : 'Database response slow',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  /**
   * Check Redis health
   */
  async checkRedis(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    message: string;
  }> {
    const startTime = Date.now();
    
    try {
      const { Redis } = await import('ioredis');
      const redis = new Redis();
      
      await redis.ping();
      const responseTime = Date.now() - startTime;
      await redis.quit();
      
      return {
        status: responseTime < 100 ? 'healthy' : 'unhealthy',
        responseTime,
        message: responseTime < 100 ? 'Redis is responsive' : 'Redis response slow',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  /**
   * Check disk space
   */
  async checkDiskSpace(): Promise<{
    status: 'healthy' | 'warning' | 'unhealthy';
    usage: number;
    message: string;
  }> {
    try {
      const { stdout } = await execAsync('df -h / | tail -1 | awk \'{print $5}\'');
      const usage = parseInt(stdout.replace('%', ''));
      
      if (usage > 90) {
        return {
          status: 'unhealthy',
          usage,
          message: `Disk usage critical: ${usage}%`,
        };
      } else if (usage > 80) {
        return {
          status: 'warning',
          usage,
          message: `Disk usage high: ${usage}%`,
        };
      } else {
        return {
          status: 'healthy',
          usage,
          message: `Disk usage normal: ${usage}%`,
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        usage: 0,
        message: error instanceof Error ? error.message : 'Failed to check disk space',
      };
    }
  }

  /**
   * Check memory usage
   */
  async checkMemory(): Promise<{
    status: 'healthy' | 'warning' | 'unhealthy';
    usage: number;
    message: string;
  }> {
    try {
      const { stdout } = await execAsync(
        'free | grep Mem | awk \'{printf("%.2f", $3/$2 * 100.0)}\''
      );
      const usage = parseFloat(stdout);
      
      if (usage > 90) {
        return {
          status: 'unhealthy',
          usage,
          message: `Memory usage critical: ${usage.toFixed(2)}%`,
        };
      } else if (usage > 80) {
        return {
          status: 'warning',
          usage,
          message: `Memory usage high: ${usage.toFixed(2)}%`,
        };
      } else {
        return {
          status: 'healthy',
          usage,
          message: `Memory usage normal: ${usage.toFixed(2)}%`,
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        usage: 0,
        message: error instanceof Error ? error.message : 'Failed to check memory',
      };
    }
  }

  /**
   * Check API health
   */
  async checkApi(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    message: string;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/health`);
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        return {
          status: 'healthy',
          responseTime,
          message: 'API is responsive',
        };
      } else {
        return {
          status: 'unhealthy',
          responseTime,
          message: `API returned status ${response.status}`,
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'API connection failed',
      };
    }
  }

  /**
   * Get overall system health
   */
  async getOverallHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, any>;
    timestamp: string;
  }> {
    const [database, redis, disk, memory, api] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkDiskSpace(),
      this.checkMemory(),
      this.checkApi(),
    ]);

    const checks = {
      database,
      redis,
      disk,
      memory,
      api,
    };

    // Determine overall status
    const unhealthyCount = Object.values(checks).filter(
      (check: any) => check.status === 'unhealthy'
    ).length;
    
    const warningCount = Object.values(checks).filter(
      (check: any) => check.status === 'warning'
    ).length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (unhealthyCount > 0) {
      status = unhealthyCount > 2 ? 'unhealthy' : 'degraded';
    } else if (warningCount > 0) {
      status = 'degraded';
    }

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    tableCount: number;
    totalRows: number;
    databaseSize: string;
  }> {
    try {
      // Get table count
      const tables = await prisma.$queryRaw<
        Array<{ table_name: string }>
      >`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;

      // Get total rows (sample from main tables)
      const [users, servers, tasks] = await Promise.all([
        prisma.user.count(),
        prisma.server.count(),
        prisma.task.count(),
      ]);

      // Get database size
      const sizeResult = await prisma.$queryRaw<
        Array<{ pg_size_pretty: string }>
      >`SELECT pg_size_pretty(pg_database_size(current_database()))`;

      return {
        tableCount: tables.length,
        totalRows: users + servers + tasks,
        databaseSize: sizeResult[0]?.pg_size_pretty || 'Unknown',
      };
    } catch (error) {
      console.error('[HealthCheck] Failed to get database stats:', error);
      return {
        tableCount: 0,
        totalRows: 0,
        databaseSize: 'Unknown',
      };
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    connected: boolean;
    memoryUsage?: string;
    keyCount?: number;
  }> {
    try {
      const { Redis } = await import('ioredis');
      const redis = new Redis();
      
      const info = await redis.info('memory');
      const dbSize = await redis.dbsize();
      
      await redis.quit();
      
      const memoryLine = info.split('\n').find((line) => line.startsWith('used_memory_human'));
      const memoryUsage = memoryLine ? memoryLine.split(':')[1].trim() : 'Unknown';

      return {
        connected: true,
        memoryUsage,
        keyCount: dbSize,
      };
    } catch (error) {
      return {
        connected: false,
      };
    }
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();
