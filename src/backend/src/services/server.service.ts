import prisma from '../utils/prisma';
import { ServerStatus, GpuStatus } from '@prisma/client';

export interface CreateServerRequest {
  name: string;
  hostname: string;
  ipAddress: string;
  cpuCores: number;
  totalMemory: number;
  gpuCount?: number;
  gpus?: Array<{
    deviceId: number;
    model: string;
    memory: number;
  }>;
}

export interface UpdateServerRequest {
  name?: string;
  hostname?: string;
  ipAddress?: string;
  cpuCores?: number;
  totalMemory?: number;
  status?: ServerStatus;
}

export class ServerService {
  /**
   * Create a new server with optional GPU configuration
   */
  async createServer(data: CreateServerRequest) {
    const { name, hostname, ipAddress, cpuCores, totalMemory, gpuCount = 0, gpus = [] } = data;

    const server = await prisma.server.create({
      data: {
        name,
        hostname,
        ipAddress,
        cpuCores,
        totalMemory,
        gpuCount,
        gpus: {
          create: gpus.map((gpu) => ({
            deviceId: gpu.deviceId,
            model: gpu.model,
            memory: gpu.memory,
            status: GpuStatus.AVAILABLE,
          })),
        },
      },
      include: {
        gpus: true,
      },
    });

    return server;
  }

  /**
   * Get all servers with their GPUs
   */
  async getAllServers() {
    const servers = await prisma.server.findMany({
      include: {
        gpus: true,
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return servers;
  }

  /**
   * Get server by ID
   */
  async getServerById(id: string) {
    const server = await prisma.server.findUnique({
      where: { id },
      include: {
        gpus: true,
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        metrics: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
      },
    });

    return server;
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

    return server;
  }

  /**
   * Update server status
   */
  async updateServerStatus(id: string, status: ServerStatus) {
    const server = await prisma.server.update({
      where: { id },
      data: { status },
      include: {
        gpus: true,
      },
    });

    // If server goes offline, update all GPUs to error status
    if (status === ServerStatus.OFFLINE || status === ServerStatus.ERROR) {
      await prisma.gpu.updateMany({
        where: { serverId: id },
        data: { status: GpuStatus.ERROR },
      });
    }

    return server;
  }

  /**
   * Delete server
   */
  async deleteServer(id: string) {
    await prisma.server.delete({
      where: { id },
    });
  }

  /**
   * Get server statistics
   */
  async getServerStats() {
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
        (sum, s) => sum + s.gpus.filter((g) => g.status === GpuStatus.AVAILABLE).length,
        0
      ),
    };

    return stats;
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
            status: GpuStatus.AVAILABLE,
          },
        },
      },
      include: {
        gpus: {
          where: {
            status: GpuStatus.AVAILABLE,
          },
        },
      },
    });

    return servers;
  }

  /**
   * Record server metrics
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

    // Clean up old metrics (keep last 1000 per server)
    const count = await prisma.serverMetric.count({
      where: { serverId },
    });

    if (count > 1000) {
      const toDelete = await prisma.serverMetric.findMany({
        where: { serverId },
        orderBy: { timestamp: 'asc' },
        take: count - 1000,
        select: { id: true },
      });

      await prisma.serverMetric.deleteMany({
        where: {
          id: { in: toDelete.map((m) => m.id) },
        },
      });
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
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    return metrics;
  }
}

export const serverService = new ServerService();
export default serverService;
