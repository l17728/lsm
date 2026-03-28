/**
 * Cluster Service
 * 
 * Manages clusters - groups of servers that can be allocated together.
 * Used by Super Admins to organize and allocate computing resources.
 * 
 * Key features:
 * - CRUD operations for clusters
 * - Server assignment to clusters
 * - Cluster allocation management
 * - Resource utilization tracking
 */
import prisma from '../utils/prisma';
import { cluster_status as ClusterStatus, cluster_type as ClusterType } from '@prisma/client';
import { cacheService } from './cache.service';

// ==================== Types ====================

export interface CreateClusterRequest {
  name: string;
  code: string;
  description?: string;
  type?: ClusterType;
  tags?: string[];
  capabilities?: Record<string, any>;
  constraints?: Record<string, any>;
  metadata?: Record<string, any>;
  // 新增环境信息字段
  envName?: string;
  envAlias?: string;
  subEnvAlias?: string;
  prometheusAddress?: string;
  deviceInfo?: string;
  loginIp?: string;
  usageScenario?: string;
  // 责任人
  testOwnerId?: string;
  teamOwnerId?: string;
  userId?: string;
}

export interface UpdateClusterRequest {
  name?: string;
  description?: string;
  type?: ClusterType;
  status?: ClusterStatus;
  tags?: string[];
  capabilities?: Record<string, any>;
  constraints?: Record<string, any>;
  metadata?: Record<string, any>;
  // 新增环境信息字段
  envName?: string;
  envAlias?: string;
  subEnvAlias?: string;
  prometheusAddress?: string;
  deviceInfo?: string;
  loginIp?: string;
  usageScenario?: string;
  // 责任人
  testOwnerId?: string;
  teamOwnerId?: string;
  userId?: string;
}

export interface AddServerRequest {
  serverId: string;
  priority?: number;
  role?: string;
}

export interface AllocateClusterRequest {
  userId: string;
  teamId?: string;
  startTime: Date;
  endTime: Date;
  purpose?: string;
  requestId?: string;
}

// ==================== Service ====================

export class ClusterService {
  private static readonly CACHE_PREFIX = 'cluster:';
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Calculate the effective status of a cluster based on current reservations
   * This provides real-time status considering active/approved reservations
   */
  async calculateEffectiveStatus(clusterId: string): Promise<string> {
    const now = new Date();

    // Check for active reservations
    const activeReservation = await prisma.clusterReservation.findFirst({
      where: {
        clusterId,
        status: 'APPROVED',
        startTime: { lte: now },
        endTime: { gt: now },
      },
    });

    if (activeReservation) {
      return 'ALLOCATED';
    }

    // Check for approved future reservations
    const futureReservation = await prisma.clusterReservation.findFirst({
      where: {
        clusterId,
        status: 'APPROVED',
        startTime: { gt: now },
      },
    });

    if (futureReservation) {
      return 'RESERVED';
    }

    // Return the database status
    const cluster = await prisma.cluster.findUnique({
      where: { id: clusterId },
      select: { status: true },
    });

    return cluster?.status || 'AVAILABLE';
  }

  /**
   * Get cluster with effective status calculated from reservations
   */
  async getClusterWithEffectiveStatus(clusterId: string) {
    const cluster = await this.getClusterById(clusterId);
    if (!cluster) return null;

    const effectiveStatus = await this.calculateEffectiveStatus(clusterId);
    return {
      ...(cluster as any),
      effectiveStatus,
      isStatusOverridden: (cluster as any).status !== effectiveStatus,
    };
  }

  /**
   * Create a new cluster
   */
  async createCluster(data: CreateClusterRequest, createdBy: string) {
    console.log(`[Cluster] Creating cluster: name=${data.name}, code=${data.code}, type=${data.type || 'GENERAL'}`);
    
    // Check if code already exists
    const existing = await prisma.cluster.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      console.log(`[Cluster] Create failed: code ${data.code} already exists`);
      throw new Error(`Cluster with code '${data.code}' already exists`);
    }

    const cluster = await prisma.cluster.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        type: data.type || ClusterType.GENERAL,
        status: ClusterStatus.AVAILABLE,
        tags: data.tags || [],
        capabilities: data.capabilities || {},
        constraints: data.constraints || {},
        metadata: data.metadata || {},
        // 新增环境信息
        envName: data.envName,
        envAlias: data.envAlias,
        subEnvAlias: data.subEnvAlias,
        prometheusAddress: data.prometheusAddress,
        deviceInfo: data.deviceInfo,
        loginIp: data.loginIp,
        usageScenario: data.usageScenario,
        // 责任人
        testOwnerId: data.testOwnerId,
        teamOwnerId: data.teamOwnerId,
        userId: data.userId,
        createdBy,
      },
    });

    console.log(`[Cluster] Created successfully: id=${cluster.id}, name=${cluster.name}`);

    // Invalidate cache
    await this.invalidateCache();

    return cluster;
  }

  /**
   * Get all clusters with optional filters
   */
  async getAllClusters(filters?: {
    status?: ClusterStatus;
    type?: ClusterType;
  }) {
    console.log(`[Cluster] Fetching all clusters with filters: ${JSON.stringify(filters || {})}`);

    const cacheKey = `${ClusterService.CACHE_PREFIX}all:${JSON.stringify(filters || {})}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      console.log(`[Cluster] Returning cached clusters`);
      return cached;
    }

    const clusters = await prisma.cluster.findMany({
      where: filters,
      include: {
        servers: {
          include: {
            server: {
              include: {
                gpus: true,
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`[Cluster] Found ${clusters.length} clusters`);

    // Calculate effective status for each cluster based on current reservations
    const now = new Date();
    const clustersWithEffectiveStatus = await Promise.all(
      clusters.map(async (cluster) => {
        // Check for active reservations
        const activeReservation = await prisma.clusterReservation.findFirst({
          where: {
            clusterId: cluster.id,
            status: 'APPROVED',
            startTime: { lte: now },
            endTime: { gt: now },
          },
        });

        // Check for future approved reservations
        const futureReservation = await prisma.clusterReservation.findFirst({
          where: {
            clusterId: cluster.id,
            status: 'APPROVED',
            startTime: { gt: now },
          },
        });

        // Calculate effective status
        let effectiveStatus = cluster.status;
        if (activeReservation) {
          effectiveStatus = 'ALLOCATED';
        } else if (futureReservation) {
          effectiveStatus = 'RESERVED';
        }

        return {
          ...cluster,
          effectiveStatus,
          isStatusOverridden: cluster.status !== effectiveStatus,
        };
      })
    );
    
    await cacheService.set(cacheKey, clustersWithEffectiveStatus, ClusterService.CACHE_TTL);
    
    return clustersWithEffectiveStatus;
  }

  /**
   * Get cluster by ID
   */
  async getClusterById(id: string) {
    console.log(`[Cluster] Fetching cluster by id: ${id}`);

    const cacheKey = `${ClusterService.CACHE_PREFIX}${id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      console.log(`[Cluster] Returning cached cluster: ${id}`);
      return cached;
    }

    const cluster = await prisma.cluster.findUnique({
      where: { id },
      include: {
        servers: {
          include: {
            server: {
              include: {
                gpus: true,
              },
            },
          },
        },
        allocations: {
          where: {
            status: 'ACTIVE',
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
        creator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!cluster) {
      console.log(`[Cluster] Cluster not found: ${id}`);
      return null;
    }

    console.log(`[Cluster] Found cluster: ${cluster.name}`);
    
    await cacheService.set(cacheKey, cluster, ClusterService.CACHE_TTL);
    
    return cluster;
  }

  /**
   * Update cluster
   */
  async updateCluster(id: string, data: UpdateClusterRequest) {
    console.log(`[Cluster] Updating cluster: id=${id}, data=${JSON.stringify(data)}`);

    const cluster = await prisma.cluster.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        status: data.status,
        tags: data.tags,
        capabilities: data.capabilities,
        constraints: data.constraints,
        metadata: data.metadata,
        // 新增环境信息
        envName: data.envName,
        envAlias: data.envAlias,
        subEnvAlias: data.subEnvAlias,
        prometheusAddress: data.prometheusAddress,
        deviceInfo: data.deviceInfo,
        loginIp: data.loginIp,
        usageScenario: data.usageScenario,
        // 责任人
        testOwnerId: data.testOwnerId,
        teamOwnerId: data.teamOwnerId,
        userId: data.userId,
      },
    });

    console.log(`[Cluster] Updated cluster: id=${id}, name=${cluster.name}`);

    await this.invalidateCache(id);

    return cluster;
  }

  /**
   * Update cluster status (manual override by admin)
   */
  async updateClusterStatus(id: string, status: string, reason?: string) {
    console.log(`[Cluster] Updating cluster status: id=${id}, status=${status}, reason=${reason || 'N/A'}`);

    // Check if cluster exists
    const existingCluster = await prisma.cluster.findUnique({
      where: { id },
    });

    if (!existingCluster) {
      throw new Error('Cluster not found');
    }

    const cluster = await prisma.cluster.update({
      where: { id },
      data: {
        status: status as any,
        metadata: {
          ...(existingCluster.metadata as any || {}),
          statusUpdateReason: reason,
          statusUpdatedAt: new Date().toISOString(),
        },
      },
      include: {
        servers: {
          select: {
            id: true,
            priority: true,
            role: true,
            server: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    console.log(`[Cluster] Updated cluster status: id=${id}, status=${status}`);

    await this.invalidateCache(id);

    return cluster;
  }

  /**
   * Delete cluster
   */
  async deleteCluster(id: string) {
    console.log(`[Cluster] Deleting cluster: id=${id}`);

    // Check if cluster has active allocations
    const activeAllocations = await prisma.clusterAllocation.count({
      where: {
        clusterId: id,
        status: 'ACTIVE',
      },
    });

    if (activeAllocations > 0) {
      console.log(`[Cluster] Delete failed: cluster ${id} has ${activeAllocations} active allocations`);
      throw new Error('Cannot delete cluster with active allocations');
    }

    await prisma.cluster.delete({
      where: { id },
    });

    console.log(`[Cluster] Deleted cluster: id=${id}`);

    await this.invalidateCache(id);
  }

  /**
   * Add server to cluster
   */
  async addServer(clusterId: string, data: AddServerRequest, addedBy: string) {
    console.log(`[Cluster] Adding server to cluster: clusterId=${clusterId}, serverId=${data.serverId}`);

    // Verify server exists
    const server = await prisma.server.findUnique({
      where: { id: data.serverId },
    });

    if (!server) {
      console.log(`[Cluster] Add server failed: server ${data.serverId} not found`);
      throw new Error('Server not found');
    }

    // Check if server is already in this cluster
    const existing = await prisma.clusterServer.findUnique({
      where: {
        clusterId_serverId: {
          clusterId,
          serverId: data.serverId,
        },
      },
    });

    if (existing) {
      console.log(`[Cluster] Add server failed: server ${data.serverId} already in cluster ${clusterId}`);
      throw new Error('Server already in cluster');
    }

    const clusterServer = await prisma.clusterServer.create({
      data: {
        clusterId,
        serverId: data.serverId,
        priority: data.priority || 0,
        role: data.role,
        addedBy,
      },
    });

    // Update cluster resource counts
    await this.updateClusterResources(clusterId);

    console.log(`[Cluster] Added server ${data.serverId} to cluster ${clusterId}`);

    await this.invalidateCache(clusterId);

    return clusterServer;
  }

  /**
   * Remove server from cluster
   */
  async removeServer(clusterId: string, serverId: string) {
    console.log(`[Cluster] Removing server from cluster: clusterId=${clusterId}, serverId=${serverId}`);

    await prisma.clusterServer.delete({
      where: {
        clusterId_serverId: {
          clusterId,
          serverId,
        },
      },
    });

    // Update cluster resource counts
    await this.updateClusterResources(clusterId);

    console.log(`[Cluster] Removed server ${serverId} from cluster ${clusterId}`);

    await this.invalidateCache(clusterId);
  }

  /**
   * Allocate cluster to user
   */
  async allocateCluster(clusterId: string, data: AllocateClusterRequest) {
    console.log(`[Cluster] Allocating cluster: clusterId=${clusterId}, userId=${data.userId}`);

    // Verify cluster is available
    const cluster = await prisma.cluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster) {
      console.log(`[Cluster] Allocate failed: cluster ${clusterId} not found`);
      throw new Error('Cluster not found');
    }

    if (cluster.status !== ClusterStatus.AVAILABLE) {
      console.log(`[Cluster] Allocate failed: cluster ${clusterId} status is ${cluster.status}`);
      throw new Error(`Cluster is not available (status: ${cluster.status})`);
    }

    // Create allocation and update cluster in transaction
    const result = await prisma.$transaction(async (tx) => {
      const allocation = await tx.clusterAllocation.create({
        data: {
          clusterId,
          userId: data.userId,
          teamId: data.teamId,
          startTime: data.startTime,
          endTime: data.endTime,
          requestId: data.requestId,
          purpose: data.purpose,
          status: 'ACTIVE',
        },
      });

      await tx.cluster.update({
        where: { id: clusterId },
        data: {
          status: ClusterStatus.ALLOCATED,
          assignedTo: data.userId,
          assignedAt: new Date(),
          assignmentEnd: data.endTime,
        },
      });

      return allocation;
    });

    console.log(`[Cluster] Allocated cluster ${clusterId} to user ${data.userId}, allocationId=${result.id}`);

    await this.invalidateCache(clusterId);

    return result;
  }

  /**
   * Release cluster allocation
   */
  async releaseCluster(allocationId: string) {
    console.log(`[Cluster] Releasing allocation: allocationId=${allocationId}`);

    const allocation = await prisma.clusterAllocation.findUnique({
      where: { id: allocationId },
    });

    if (!allocation) {
      console.log(`[Cluster] Release failed: allocation ${allocationId} not found`);
      throw new Error('Allocation not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.clusterAllocation.update({
        where: { id: allocationId },
        data: {
          status: 'COMPLETED',
          actualEnd: new Date(),
        },
      });

      await tx.cluster.update({
        where: { id: allocation.clusterId },
        data: {
          status: ClusterStatus.AVAILABLE,
          assignedTo: null,
          assignedAt: null,
          assignmentEnd: null,
        },
      });
    });

    console.log(`[Cluster] Released allocation ${allocationId}`);

    await this.invalidateCache(allocation.clusterId);
  }

  /**
   * Get available servers for cluster
   */
  async getAvailableServers() {
    console.log(`[Cluster] Fetching available servers for cluster creation`);

    const servers = await prisma.server.findMany({
      where: {
        status: 'ONLINE',
      },
      include: {
        gpus: true,
        clusterServers: true,
      },
    });

    // Filter out servers that are already in clusters
    const availableServers = servers.filter(s => s.clusterServers.length === 0);

    console.log(`[Cluster] Found ${availableServers.length} available servers`);

    return availableServers;
  }

  /**
   * Get cluster statistics
   */
  async getClusterStats() {
    console.log(`[Cluster] Fetching cluster statistics`);

    const [total, available, allocated, reserved, maintenance] = await Promise.all([
      prisma.cluster.count(),
      prisma.cluster.count({ where: { status: ClusterStatus.AVAILABLE } }),
      prisma.cluster.count({ where: { status: ClusterStatus.ALLOCATED } }),
      prisma.cluster.count({ where: { status: ClusterStatus.RESERVED } }),
      prisma.cluster.count({ where: { status: ClusterStatus.MAINTENANCE } }),
    ]);

    const totalResources = await prisma.cluster.aggregate({
      _sum: {
        totalServers: true,
        totalGpus: true,
        totalCpuCores: true,
        totalMemory: true,
      },
    });

    const stats = {
      total,
      byStatus: {
        available,
        allocated,
        reserved,
        maintenance,
      },
      resources: {
        totalServers: totalResources._sum.totalServers || 0,
        totalGpus: totalResources._sum.totalGpus || 0,
        totalCpuCores: totalResources._sum.totalCpuCores || 0,
        totalMemory: totalResources._sum.totalMemory || 0,
      },
    };

    console.log(`[Cluster] Stats: total=${total}, available=${available}, allocated=${allocated}`);

    return stats;
  }

  // ==================== Private Methods ====================

  /**
   * Update cluster resource counts based on servers
   */
  private async updateClusterResources(clusterId: string) {
    const servers = await prisma.clusterServer.findMany({
      where: { clusterId },
      include: {
        server: {
          include: { gpus: true },
        },
      },
    });

    const totalServers = servers.length;
    const totalGpus = servers.reduce((sum, cs) => sum + (cs.server.gpuCount || 0), 0);
    const totalCpuCores = servers.reduce((sum, cs) => sum + (cs.server.cpuCores || 0), 0);
    const totalMemory = servers.reduce((sum, cs) => sum + (cs.server.totalMemory || 0), 0);

    await prisma.cluster.update({
      where: { id: clusterId },
      data: {
        totalServers,
        totalGpus,
        totalCpuCores,
        totalMemory,
      },
    });

    console.log(`[Cluster] Updated resources for cluster ${clusterId}: servers=${totalServers}, gpus=${totalGpus}`);
  }

  /**
   * Invalidate cache
   */
  private async invalidateCache(clusterId?: string) {
    // Clear all cluster list caches (with any filter params)
    await cacheService.invalidatePattern(`${ClusterService.CACHE_PREFIX}all:*`);
    
    if (clusterId) {
      await cacheService.delete(`${ClusterService.CACHE_PREFIX}${clusterId}`);
    }
    console.log(`[Cluster] Cache invalidated`);
  }
}

// Export singleton instance
export const clusterService = new ClusterService();
export default clusterService;