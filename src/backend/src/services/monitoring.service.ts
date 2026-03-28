import prisma from '../utils/prisma';
import { server_status as ServerStatus } from '@prisma/client';
import serverService from './server.service';

export interface ServerHealth {
  serverId: string;
  serverName: string;
  status: ServerStatus;
  cpuUsage: number;
  memoryUsage: number;
  gpuUsage: number | null;
  temperature: number | null;
  lastUpdate: Date;
}

export class MonitoringService {
  /**
   * Collect metrics from all online servers
   * In production, this would call actual monitoring agents on each server
   *
   * Fix: Eliminated N+1 query - no longer calls findUnique inside the loop.
   * Instead, reuses the server object already fetched by findMany.
   */
  async collectMetrics() {
    const startTime = Date.now();
    const servers = await prisma.server.findMany({
      where: {
        status: ServerStatus.ONLINE,
      },
      include: {
        gpus: true,
      },
    });

    console.log(`[Monitoring] collectMetrics start, servers=${servers.length}`);

    const results: ServerHealth[] = [];

    for (const server of servers) {
      try {
        // Fix: pass the already-fetched server object directly - no redundant findUnique
        const metrics = this.collectServerMetricsFromData(server);

        if (metrics) {
          // Record metrics to database
          await serverService.recordMetrics(server.id, metrics);

          console.log(
            `[Monitoring] collected serverId=${server.id} name=${server.name} ` +
            `cpu=${metrics.cpuUsage} mem=${metrics.memoryUsage} gpu=${metrics.gpuUsage ?? 'N/A'} temp=${metrics.temperature ?? 'N/A'}`
          );

          results.push({
            serverId: server.id,
            serverName: server.name,
            status: server.status,
            cpuUsage: metrics.cpuUsage,
            memoryUsage: metrics.memoryUsage,
            gpuUsage: metrics.gpuUsage ?? null,
            temperature: metrics.temperature ?? null,
            lastUpdate: new Date(),
          });
        }
      } catch (error) {
        console.error(`[Monitoring][ERROR] failed to collect metrics from server id=${server.id} name=${server.name}:`, error);
        // Mark server as error if multiple failures (simplified logic for demo)
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Monitoring] collectMetrics done, collected=${results.length}/${servers.length}, duration=${duration}ms`);
    return results;
  }

  /**
   * Collect metrics for a specific server using an already-fetched server object.
   * This avoids the N+1 redundant findUnique call.
   * In production, this would call actual monitoring endpoint on the server.
   */
  private collectServerMetricsFromData(server: { id: string; gpus: any[] }) {
    // Simulate realistic metrics
    // In production, this would be an HTTP call to the server's monitoring agent
    const cpuUsage = Math.random() * 100;
    const memoryUsage = Math.random() * 100;
    const gpuUsage = server.gpus.length > 0 ? Math.random() * 100 : undefined;
    const diskUsage = Math.random() * 100;
    const networkIn = Math.random() * 1000000000; // bytes/sec
    const networkOut = Math.random() * 1000000000;
    const temperature = 30 + Math.random() * 50; // 30-80°C

    return {
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage: Math.round(memoryUsage * 100) / 100,
      gpuUsage: gpuUsage ? Math.round(gpuUsage * 100) / 100 : undefined,
      diskUsage: Math.round(diskUsage * 100) / 100,
      networkIn: Math.round(networkIn),
      networkOut: Math.round(networkOut),
      temperature: Math.round(temperature * 100) / 100,
    };
  }

  /**
   * Get current health status of all servers
   */
  async getServerHealth() {
    const servers = await prisma.server.findMany({
      include: {
        gpus: true,
        metrics: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });

    console.log(`[Monitoring] getServerHealth servers=${servers.length}`);

    const health: ServerHealth[] = servers.map((server) => {
      const latestMetric = server.metrics[0];

      return {
        serverId: server.id,
        serverName: server.name,
        status: server.status,
        cpuUsage: Number(latestMetric?.cpuUsage ?? 0),
        memoryUsage: Number(latestMetric?.memoryUsage ?? 0),
        gpuUsage: latestMetric?.gpuUsage ? Number(latestMetric.gpuUsage) : null,
        temperature: latestMetric?.temperature ? Number(latestMetric.temperature) : null,
        lastUpdate: latestMetric?.recordedAt ?? server.updatedAt,
      };
    });

    return health;
  }

  /**
   * Get aggregated cluster statistics
   */
  async getClusterStats() {
    const startTime = Date.now();
    const servers = await prisma.server.findMany({
      include: {
        gpus: true,
        metrics: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });

    const onlineServers = servers.filter((s) => s.status === ServerStatus.ONLINE);

    const totalGpus = onlineServers.reduce((sum, s) => sum + s.gpus.length, 0);
    const availableGpus = onlineServers.reduce(
      (sum, s) => sum + s.gpus.filter((g) => !g.allocated).length,
      0
    );

    // Calculate average resource usage
    const avgCpuUsage =
      onlineServers.reduce((sum, s) => sum + Number(s.metrics[0]?.cpuUsage ?? 0), 0) /
      (onlineServers.length || 1);
    const avgMemoryUsage =
      onlineServers.reduce((sum, s) => sum + Number(s.metrics[0]?.memoryUsage ?? 0), 0) /
      (onlineServers.length || 1);
    const avgGpuUsage =
      onlineServers.reduce((sum, s) => sum + Number(s.metrics[0]?.gpuUsage ?? 0), 0) /
      (onlineServers.length || 1);

    const duration = Date.now() - startTime;
    console.log(
      `[Monitoring] getClusterStats total=${servers.length} online=${onlineServers.length} ` +
      `gpus=${totalGpus} available=${availableGpus} duration=${duration}ms`
    );

    return {
      servers: {
        total: servers.length,
        online: onlineServers.length,
        offline: servers.filter((s) => s.status === ServerStatus.OFFLINE).length,
        maintenance: servers.filter((s) => s.status === ServerStatus.MAINTENANCE).length,
        error: servers.filter((s) => s.status === ServerStatus.ERROR).length,
      },
      resources: {
        totalGpus,
        availableGpus,
        allocatedGpus: totalGpus - availableGpus,
      },
      usage: {
        avgCpuUsage: Math.round(avgCpuUsage * 100) / 100,
        avgMemoryUsage: Math.round(avgMemoryUsage * 100) / 100,
        avgGpuUsage: Math.round(avgGpuUsage * 100) / 100,
      },
    };
  }

  /**
   * Get metrics for a specific time range
   */
  async getMetricsRange(serverId: string, startTime: Date, endTime: Date) {
    console.log(`[Monitoring] getMetricsRange serverId=${serverId} from=${startTime.toISOString()} to=${endTime.toISOString()}`);

    const metrics = await prisma.serverMetric.findMany({
      where: {
        serverId,
        recordedAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { recordedAt: 'asc' },
    });

    console.log(`[Monitoring] getMetricsRange serverId=${serverId} rows=${metrics.length}`);
    return metrics;
  }

  /**
   * Get alert conditions (simplified)
   */
  async getAlerts() {
    const health = await this.getServerHealth();
    const alerts: Array<{
      type: 'warning' | 'critical';
      serverId: string;
      serverName: string;
      message: string;
      value: number;
      threshold: number;
    }> = [];

    health.forEach((server) => {
      // High CPU usage
      if (server.cpuUsage > 90) {
        alerts.push({
          type: 'critical',
          serverId: server.serverId,
          serverName: server.serverName,
          message: 'Critical CPU usage',
          value: server.cpuUsage,
          threshold: 90,
        });
      } else if (server.cpuUsage > 80) {
        alerts.push({
          type: 'warning',
          serverId: server.serverId,
          serverName: server.serverName,
          message: 'High CPU usage',
          value: server.cpuUsage,
          threshold: 80,
        });
      }

      // High memory usage
      if (server.memoryUsage > 90) {
        alerts.push({
          type: 'critical',
          serverId: server.serverId,
          serverName: server.serverName,
          message: 'Critical memory usage',
          value: server.memoryUsage,
          threshold: 90,
        });
      } else if (server.memoryUsage > 80) {
        alerts.push({
          type: 'warning',
          serverId: server.serverId,
          serverName: server.serverName,
          message: 'High memory usage',
          value: server.memoryUsage,
          threshold: 80,
        });
      }

      // High temperature
      if (server.temperature && server.temperature > 80) {
        alerts.push({
          type: 'critical',
          serverId: server.serverId,
          serverName: server.serverName,
          message: 'Critical temperature',
          value: server.temperature,
          threshold: 80,
        });
      } else if (server.temperature && server.temperature > 70) {
        alerts.push({
          type: 'warning',
          serverId: server.serverId,
          serverName: server.serverName,
          message: 'High temperature',
          value: server.temperature,
          threshold: 70,
        });
      }
    });

    if (alerts.length > 0) {
      console.warn(`[Monitoring] getAlerts found ${alerts.length} alerts`);
    }

    return alerts;
  }
}

export const monitoringService = new MonitoringService();
export default monitoringService;
