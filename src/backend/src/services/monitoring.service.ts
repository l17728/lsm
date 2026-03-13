import prisma from '../utils/prisma';
import { server_status as ServerStatus, gpu_status as GpuStatus } from '@prisma/client';
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
   */
  async collectMetrics() {
    const servers = await prisma.server.findMany({
      where: {
        status: ServerStatus.ONLINE,
      },
      include: {
        gpus: true,
      },
    });

    const results: ServerHealth[] = [];

    for (const server of servers) {
      try {
        // Simulate metrics collection
        // In production, this would be an API call to the server's monitoring agent
        const metrics = await this.collectServerMetrics(server.id);

        if (metrics) {
          // Record metrics to database
          await serverService.recordMetrics(server.id, metrics);

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
        console.error(`Failed to collect metrics from server ${server.name}:`, error);

        // Mark server as error if multiple failures
        // (simplified logic for demo)
      }
    }

    return results;
  }

  /**
   * Collect metrics for a specific server
   * This is a simulation - in production would call actual monitoring endpoint
   */
  private async collectServerMetrics(serverId: string) {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        gpus: true,
      },
    });

    if (!server) {
      return null;
    }

    // Simulate realistic metrics
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
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

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
        lastUpdate: latestMetric?.timestamp ?? server.updatedAt,
      };
    });

    return health;
  }

  /**
   * Get aggregated cluster statistics
   */
  async getClusterStats() {
    const servers = await prisma.server.findMany({
      include: {
        gpus: true,
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    const onlineServers = servers.filter((s) => s.status === ServerStatus.ONLINE);

    const totalCpuCores = onlineServers.reduce((sum, s) => sum + s.cpuCores, 0);
    const totalMemory = onlineServers.reduce((sum, s) => sum + Number(s.totalMemory), 0);
    const totalGpus = onlineServers.reduce((sum, s) => sum + s.gpus.length, 0);
    const availableGpus = onlineServers.reduce(
      (sum, s) => sum + s.gpus.filter((g) => g.status === GpuStatus.AVAILABLE).length,
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

    return {
      servers: {
        total: servers.length,
        online: onlineServers.length,
        offline: servers.filter((s) => s.status === ServerStatus.OFFLINE).length,
        maintenance: servers.filter((s) => s.status === ServerStatus.MAINTENANCE).length,
        error: servers.filter((s) => s.status === ServerStatus.ERROR).length,
      },
      resources: {
        totalCpuCores,
        totalMemoryGb: totalMemory,
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
    const metrics = await prisma.serverMetric.findMany({
      where: {
        serverId,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

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

    return alerts;
  }
}

export const monitoringService = new MonitoringService();
export default monitoringService;
