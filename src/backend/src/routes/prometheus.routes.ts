import { Router } from 'express';
import prisma from '../utils/prisma';
import { cacheService } from '../services/cache.service';
import { healthCheckService } from '../services/health-check.service';

const router = Router();

/**
 * Prometheus Metrics Service
 * Exposes metrics in Prometheus text format
 */
class PrometheusMetricsService {
  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    const lines: string[] = [];
    const timestamp = Date.now();

    // Helper to add metric
    const addMetric = (
      name: string,
      type: 'counter' | 'gauge' | 'histogram' | 'summary',
      value: number | string,
      help?: string,
      labels?: Record<string, string>
    ) => {
      if (help) {
        lines.push(`# HELP ${name} ${help}`);
      }
      lines.push(`# TYPE ${name} ${type}`);
      
      const labelStr = labels
        ? `{${Object.entries(labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',')}}`
        : '';
      
      lines.push(`${name}${labelStr} ${value}`);
    };

    try {
      // Application metrics
      addMetric(
        'lsm_app_uptime_seconds',
        'counter',
        process.uptime(),
        'Application uptime in seconds'
      );

      addMetric(
        'lsm_app_memory_usage_bytes',
        'gauge',
        process.memoryUsage().heapUsed,
        'Application heap memory usage in bytes'
      );

      addMetric(
        'lsm_app_memory_rss_bytes',
        'gauge',
        process.memoryUsage().rss,
        'Application resident set size in bytes'
      );

      // Database metrics
      try {
        const [userCount, serverCount, taskCount, gpuCount] = await Promise.all([
          prisma.user.count(),
          prisma.server.count(),
          prisma.task.count(),
          prisma.gpu.count(),
        ]);

        addMetric('lsm_db_users_total', 'gauge', userCount, 'Total number of users');
        addMetric('lsm_db_servers_total', 'gauge', serverCount, 'Total number of servers');
        addMetric('lsm_db_tasks_total', 'gauge', taskCount, 'Total number of tasks');
        addMetric('lsm_db_gpus_total', 'gauge', gpuCount, 'Total number of GPUs');

        // Task status breakdown
        const taskStats = await this.getTaskStats();
        addMetric(
          'lsm_db_tasks_pending',
          'gauge',
          taskStats.pending,
          'Number of pending tasks'
        );
        addMetric(
          'lsm_db_tasks_running',
          'gauge',
          taskStats.running,
          'Number of running tasks'
        );
        addMetric(
          'lsm_db_tasks_completed',
          'gauge',
          taskStats.completed,
          'Number of completed tasks'
        );
        addMetric(
          'lsm_db_tasks_failed',
          'gauge',
          taskStats.failed,
          'Number of failed tasks'
        );

        // GPU status breakdown
        const gpuStats = await this.getGpuStats();
        addMetric(
          'lsm_db_gpus_available',
          'gauge',
          gpuStats.available,
          'Number of available GPUs'
        );
        addMetric(
          'lsm_db_gpus_allocated',
          'gauge',
          gpuStats.allocated,
          'Number of allocated GPUs'
        );
      } catch (error) {
        console.error('[Prometheus] Failed to get DB metrics:', error);
      }

      // Cache metrics
      try {
        const cacheStats = cacheService.getStats();
        addMetric(
          'lsm_cache_hits_total',
          'counter',
          cacheStats.hits,
          'Total cache hits'
        );
        addMetric(
          'lsm_cache_misses_total',
          'counter',
          cacheStats.misses,
          'Total cache misses'
        );
        addMetric(
          'lsm_cache_size',
          'gauge',
          cacheStats.size,
          'Current cache size'
        );
        
        // Cache hit rate
        const totalRequests = cacheStats.hits + cacheStats.misses;
        const hitRate = totalRequests > 0 ? (cacheStats.hits / totalRequests) * 100 : 0;
        addMetric(
          'lsm_cache_hit_rate_percent',
          'gauge',
          hitRate.toFixed(2),
          'Cache hit rate percentage'
        );
      } catch (error) {
        console.error('[Prometheus] Failed to get cache metrics:', error);
      }

      // System health metrics
      try {
        const health = await healthCheckService.getOverallHealth();
        
        const healthStatus = {
          healthy: 1,
          degraded: 0.5,
          unhealthy: 0,
        };

        addMetric(
          'lsm_health_status',
          'gauge',
          healthStatus[health.status],
          'Overall system health status (1=healthy, 0.5=degraded, 0=unhealthy)'
        );

        // Individual component health
        addMetric(
          'lsm_health_database',
          'gauge',
          health.checks.database.status === 'healthy' ? 1 : 0,
          'Database health status'
        );
        addMetric(
          'lsm_health_redis',
          'gauge',
          health.checks.redis?.status === 'healthy' ? 1 : 0,
          'Redis health status'
        );
        addMetric(
          'lsm_health_disk_percent',
          'gauge',
          health.checks.disk.usage,
          'Disk usage percentage'
        );
        addMetric(
          'lsm_health_memory_percent',
          'gauge',
          health.checks.memory.usage,
          'Memory usage percentage'
        );
      } catch (error) {
        console.error('[Prometheus] Failed to get health metrics:', error);
      }

      // Email queue metrics
      try {
        const { emailQueueService } = await import('../services/email-queue.service');
        const queueStats = emailQueueService.getStats();
        
        addMetric(
          'lsm_email_queue_pending',
          'gauge',
          queueStats.pending,
          'Number of pending emails in queue'
        );
        addMetric(
          'lsm_email_queue_processing',
          'gauge',
          queueStats.processing,
          'Number of emails currently processing'
        );
        addMetric(
          'lsm_email_queue_failed',
          'gauge',
          queueStats.failed,
          'Number of failed emails in queue'
        );
      } catch (error) {
        console.error('[Prometheus] Failed to get email queue metrics:', error);
      }
    } catch (error) {
      console.error('[Prometheus] Error generating metrics:', error);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Get task statistics
   */
  private async getTaskStats(): Promise<{
    pending: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    const tasks = await prisma.task.findMany({
      select: { status: true },
    });

    return {
      pending: tasks.filter((t) => t.status === 'PENDING').length,
      running: tasks.filter((t) => t.status === 'RUNNING').length,
      completed: tasks.filter((t) => t.status === 'COMPLETED').length,
      failed: tasks.filter((t) => t.status === 'FAILED').length,
    };
  }

  /**
   * Get GPU statistics
   */
  private async getGpuStats(): Promise<{
    available: number;
    allocated: number;
  }> {
    const gpus = await prisma.gpu.findMany({
      select: { 
        id: true,
        model: true,
        memory: true,
        serverId: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
        allocated: true,
      },
    });

    return {
      available: gpus.filter((g) => !g.allocated).length,
      allocated: gpus.filter((g) => g.allocated).length,
    };
  }
}

export const prometheusMetricsService = new PrometheusMetricsService();

/**
 * GET /api/monitoring/metrics
 * Expose Prometheus metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await prometheusMetricsService.getMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/monitoring/health/detailed
 * Enhanced health check with detailed metrics
 */
router.get('/health/detailed', async (req, res) => {
  try {
    const health = await healthCheckService.getOverallHealth();
    const dbStats = await healthCheckService.getDatabaseStats();
    const cacheStats = await healthCheckService.getCacheStats();

    res.json({
      success: true,
      data: {
        ...health,
        database: dbStats,
        cache: cacheStats,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
