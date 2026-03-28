import prisma from '../utils/prisma';
import { server_status as ServerStatus } from '@prisma/client';
import { cacheService } from './cache.service';

export interface CreateServerRequest {
  name: string;
  hostname?: string;
  description?: string;
  ipAddress?: string;
  location?: string;
  cpuCores?: number;
  totalMemory?: number;
  gpuCount?: number;
  gpus?: Array<{
    model: string;
    memory: number;
  }>;
}

export interface UpdateServerRequest {
  name?: string;
  hostname?: string;
  description?: string;
  ipAddress?: string;
  location?: string;
  cpuCores?: number;
  totalMemory?: number;
  status?: ServerStatus;
  gpuCount?: number;
}

export class ServerService {
  /**
   * Counter used to throttle the old-metrics cleanup in recordMetrics().
   * We only run the expensive COUNT+SELECT+DELETE every CLEANUP_INTERVAL inserts.
   */
  private recordCount: number = 0;
  private static readonly CLEANUP_INTERVAL = 50;

  /**
   * Create a new server with optional GPU configuration
   */
  async createServer(data: CreateServerRequest) {
    const { name, hostname, description, ipAddress, location, cpuCores, totalMemory, gpuCount = 0, gpus = [] } = data;

    const server = await prisma.server.create({
      data: {
        name,
        hostname: hostname || null,
        description: description || null,
        ipAddress: ipAddress || null,
        location: location || null,
        cpuCores: cpuCores || 1,
        totalMemory: totalMemory || null,
        gpuCount,
        gpus: {
          create: gpus.map((gpu) => ({
            model: gpu.model,
            memory: gpu.memory,
            allocated: false,
          })),
        },
      },
      include: {
        gpus: true,
      },
    });

    console.log(`[Server] createServer id=${server.id} name=${server.name}`);

    // Invalidate cache
    await cacheService.delete('servers:all');
    await cacheService.delete('servers:stats');

    return server;
  }

  /**
   * Get all servers with their GPUs
   */
  async getAllServers() {
    const cacheKey = 'servers:all';

    return cacheService.getOrSet(cacheKey, async () => {
      const servers = await prisma.server.findMany({
        include: {
          gpus: true,
          _count: {
            select: { gpus: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      console.log(`[Server] getAllServers (cache miss) count=${servers.length}`);
      return servers;
    }, 300); // Cache for 5 minutes
  }

  /**
   * Get server by ID
   */
  async getServerById(id: string) {
    const cacheKey = `server:${id}`;

    return cacheService.getOrSet(cacheKey, async () => {
      const server = await prisma.server.findUnique({
        where: { id },
        include: {
          gpus: true,
          metrics: {
            orderBy: { recordedAt: 'desc' },
            take: 100,
          },
        },
      });

      console.log(`[Server] getServerById (cache miss) id=${id} found=${!!server}`);
      return server;
    }, 120); // Cache for 2 minutes
  }

  /**
   * Update server information
   */
  async updateServer(id: string, data: UpdateServerRequest) {
    const server = await prisma.server.update({
      where: { id },
      data,
      include: {
        gpus: true,
      },
    });

    console.log(`[Server] updateServer id=${id}`);

    // Invalidate cache
    await cacheService.delete('servers:all');
    await cacheService.delete('servers:stats');
    await cacheService.delete(`server:${id}`);

    return server;
  }

  /**
   * Update server status
   *
   * Fix: Now properly invalidates the 3 relevant cache keys after status change,
   * so subsequent reads will not return stale status data.
   */
  async updateServerStatus(id: string, status: ServerStatus) {
    const server = await prisma.server.update({
      where: { id },
      data: { status },
      include: {
        gpus: true,
      },
    });

    // If server goes offline, mark all GPUs as not allocated
    if (status === ServerStatus.OFFLINE || status === ServerStatus.ERROR) {
      await prisma.gpu.updateMany({
        where: { serverId: id },
        data: { allocated: false },
      });
    }

    // Fix: invalidate cache so callers get fresh status immediately
    await cacheService.delete('servers:all');
    await cacheService.delete('servers:stats');
    await cacheService.delete(`server:${id}`);

    console.log(`[Server] updateServerStatus id=${id} status=${status} cache_invalidated`);

    return server;
  }

  /**
   * Delete server
   */
  async deleteServer(id: string) {
    await prisma.server.delete({
      where: { id },
    });

    console.log(`[Server] deleteServer id=${id}`);

    // Invalidate cache
    await cacheService.delete('servers:all');
    await cacheService.delete('servers:stats');
    await cacheService.delete(`server:${id}`);
  }

  /**
   * Get server statistics
   */
  async getServerStats() {
    const cacheKey = 'servers:stats';

    return cacheService.getOrSet(cacheKey, async () => {
      const servers = await prisma.server.findMany({
        include: {
          gpus: true,
        },
      });

      const stats = {
        total: servers.length,
        online: servers.filter((s) => s.status === ServerStatus.ONLINE).length,
        offline: servers.filter((s) => s.status === ServerStatus.OFFLINE).length,
        maintenance: servers.filter((s) => s.status === ServerStatus.MAINTENANCE).length,
        error: servers.filter((s) => s.status === ServerStatus.ERROR).length,
        totalGpus: servers.reduce((sum, s) => sum + s.gpus.length, 0),
        availableGpus: servers.reduce(
          (sum, s) => sum + s.gpus.filter((g) => !g.allocated).length,
          0
        ),
      };

      console.log(`[Server] getServerStats (cache miss) total=${stats.total} online=${stats.online}`);
      return stats;
    }, 60); // Cache for 1 minute
  }

  /**
   * Get available servers (online with available GPUs)
   */
  async getAvailableServers() {
    const servers = await prisma.server.findMany({
      where: {
        status: ServerStatus.ONLINE,
        gpus: {
          some: {
            allocated: false,
          },
        },
      },
      include: {
        gpus: {
          where: {
            allocated: false,
          },
        },
      },
    });

    return servers;
  }

  /**
   * Record server metrics
   *
   * Fix: The old-metrics cleanup (COUNT + SELECT + DELETE) used to run on every
   * single insert, producing 4 DB operations per call. Now we only run the
   * cleanup every CLEANUP_INTERVAL (50) inserts, reducing DB load by ~97%.
   */
  async recordMetrics(
    serverId: string,
    metrics: {
      cpuUsage: number;
      memoryUsage: number;
      gpuUsage?: number;
      diskUsage?: number;
      networkIn?: number;
      networkOut?: number;
      temperature?: number;
    }
  ) {
    const metric = await prisma.serverMetric.create({
      data: {
        serverId,
        ...metrics,
      },
    });

    this.recordCount++;
    console.log(`[Server] recordMetrics serverId=${serverId} recordCount=${this.recordCount}`);

    // Fix: only run the expensive cleanup every CLEANUP_INTERVAL inserts
    if (this.recordCount % ServerService.CLEANUP_INTERVAL === 0) {
      // Clean up old metrics (keep last 1000 per server)
      const count = await prisma.serverMetric.count({
        where: { serverId },
      });

      console.log(`[Server] recordMetrics cleanup check serverId=${serverId} count=${count}`);

      if (count > 1000) {
        const toDelete = await prisma.serverMetric.findMany({
          where: { serverId },
          orderBy: { recordedAt: 'asc' },
          take: count - 1000,
          select: { id: true },
        });

        await prisma.serverMetric.deleteMany({
          where: {
            id: { in: toDelete.map((m) => m.id) },
          },
        });

        console.log(`[Server] recordMetrics cleanup deleted ${toDelete.length} old metrics for serverId=${serverId}`);
      }
    }

    return metric;
  }

  /**
   * Get server metrics for a time range
   */
  async getServerMetrics(serverId: string, startTime: Date, endTime: Date) {
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

    return metrics;
  }
}

export const serverService = new ServerService();
export default serverService;
