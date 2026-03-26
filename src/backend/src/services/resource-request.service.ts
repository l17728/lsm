/**
 * Resource Request Service
 * 
 * Manages resource requests from managers and users.
 * Handles the complete lifecycle: draft -> pending -> approved/rejected -> fulfilled.
 * 
 * Key features:
 * - CRUD operations for resource requests
 * - Approval workflow management
 * - Cluster assignment
 * - Optimization result storage
 */
import prisma from '../utils/prisma';
import { request_status as RequestStatus, request_priority as RequestPriority } from '@prisma/client';
import { cacheService } from './cache.service';

// ==================== Types ====================

export interface CreateResourceRequestRequest {
  title: string;
  description?: string;
  purpose?: string;
  minServers?: number;
  maxServers?: number;
  minGpus?: number;
  maxGpus?: number;
  minCpuCores?: number;
  minMemory?: number;
  gpuModel?: string;
  startTime: Date;
  endTime: Date;
  priority?: RequestPriority;
  constraints?: Record<string, any>;
}

export interface UpdateResourceRequestRequest {
  title?: string;
  description?: string;
  purpose?: string;
  minServers?: number;
  maxServers?: number;
  minGpus?: number;
  maxGpus?: number;
  minCpuCores?: number;
  minMemory?: number;
  gpuModel?: string;
  startTime?: Date;
  endTime?: Date;
  priority?: RequestPriority;
  constraints?: Record<string, any>;
}

export interface ApproveRequestRequest {
  comment?: string;
}

export interface RejectRequestRequest {
  reason: string;
}

export interface AllocateRequestRequest {
  clusterId: string;
  optimizationResult?: Record<string, any>;
  optimizationMode?: 'MANUAL' | 'AUTO' | 'HYBRID';
}

// ==================== Service ====================

export class ResourceRequestService {
  private static readonly CACHE_PREFIX = 'request:';
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly REQUEST_CODE_PREFIX = 'REQ';

  /**
   * Generate a unique request code
   */
  private async generateRequestCode(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.resourceRequest.count({
      where: {
        createdAt: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        },
      },
    });
    const sequence = String(count + 1).padStart(4, '0');
    return `${ResourceRequestService.REQUEST_CODE_PREFIX}-${dateStr}-${sequence}`;
  }

  /**
   * Create a new resource request
   */
  async createRequest(data: CreateResourceRequestRequest, requesterId: string, teamId?: string) {
    console.log(`[ResourceRequest] Creating request: title=${data.title}, requester=${requesterId}`);

    const requestCode = await this.generateRequestCode();
    const duration = Math.ceil((data.endTime.getTime() - data.startTime.getTime()) / (1000 * 60 * 60)); // hours

    const request = await prisma.resourceRequest.create({
      data: {
        requestCode,
        requesterId,
        teamId,
        title: data.title,
        description: data.description,
        purpose: data.purpose,
        minServers: data.minServers,
        maxServers: data.maxServers,
        minGpus: data.minGpus,
        maxGpus: data.maxGpus,
        minCpuCores: data.minCpuCores,
        minMemory: data.minMemory,
        gpuModel: data.gpuModel,
        startTime: data.startTime,
        endTime: data.endTime,
        duration,
        priority: data.priority || RequestPriority.NORMAL,
        constraints: data.constraints || {},
        status: RequestStatus.DRAFT,
      },
    });

    console.log(`[ResourceRequest] Created request: id=${request.id}, code=${requestCode}`);

    await this.invalidateCache();

    return request;
  }

  /**
   * Get all requests with optional filters
   */
  async getAllRequests(filters?: {
    status?: RequestStatus;
    priority?: RequestPriority;
    requesterId?: string;
    teamId?: string;
  }) {
    console.log(`[ResourceRequest] Fetching all requests with filters: ${JSON.stringify(filters || {})}`);

    const requests = await prisma.resourceRequest.findMany({
      where: filters,
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
        approver: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        assignedCluster: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
        approvals: true,
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    console.log(`[ResourceRequest] Found ${requests.length} requests`);

    return requests;
  }

  /**
   * Get request by ID
   */
  async getRequestById(id: string) {
    console.log(`[ResourceRequest] Fetching request by id: ${id}`);

    const request = await prisma.resourceRequest.findUnique({
      where: { id },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
        approver: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        assignedCluster: {
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
          },
        },
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
        allocation: true,
      },
    });

    if (!request) {
      console.log(`[ResourceRequest] Request not found: ${id}`);
      return null;
    }

    console.log(`[ResourceRequest] Found request: ${request.requestCode}`);

    return request;
  }

  /**
   * Get request by code
   */
  async getRequestByCode(code: string) {
    console.log(`[ResourceRequest] Fetching request by code: ${code}`);

    const request = await prisma.resourceRequest.findUnique({
      where: { requestCode: code },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        assignedCluster: true,
      },
    });

    if (!request) {
      console.log(`[ResourceRequest] Request not found: ${code}`);
      return null;
    }

    console.log(`[ResourceRequest] Found request: ${request.id}`);
    return request;
  }

  /**
   * Update request (only in DRAFT status)
   */
  async updateRequest(id: string, data: UpdateResourceRequestRequest) {
    console.log(`[ResourceRequest] Updating request: id=${id}`);

    const existing = await prisma.resourceRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`[ResourceRequest] Update failed: request ${id} not found`);
      throw new Error('Request not found');
    }

    if (existing.status !== RequestStatus.DRAFT) {
      console.log(`[ResourceRequest] Update failed: request ${id} status is ${existing.status}`);
      throw new Error('Can only update requests in DRAFT status');
    }

    const updateData: any = { ...data };
    if (data.startTime || data.endTime) {
      const startTime = data.startTime || existing.startTime;
      const endTime = data.endTime || existing.endTime;
      updateData.duration = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));
    }

    const request = await prisma.resourceRequest.update({
      where: { id },
      data: updateData,
    });

    console.log(`[ResourceRequest] Updated request: id=${id}`);

    await this.invalidateCache();

    return request;
  }

  /**
   * Submit request for approval
   */
  async submitRequest(id: string) {
    console.log(`[ResourceRequest] Submitting request for approval: id=${id}`);

    const existing = await prisma.resourceRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`[ResourceRequest] Submit failed: request ${id} not found`);
      throw new Error('Request not found');
    }

    if (existing.status !== RequestStatus.DRAFT) {
      console.log(`[ResourceRequest] Submit failed: request ${id} status is ${existing.status}`);
      throw new Error('Can only submit requests in DRAFT status');
    }

    const request = await prisma.resourceRequest.update({
      where: { id },
      data: {
        status: RequestStatus.PENDING,
      },
    });

    console.log(`[ResourceRequest] Submitted request: id=${id}, status=PENDING`);

    await this.invalidateCache();

    return request;
  }

  /**
   * Approve request
   */
  async approveRequest(id: string, approverId: string, data: ApproveRequestRequest = {}) {
    console.log(`[ResourceRequest] Approving request: id=${id}, approver=${approverId}`);

    const existing = await prisma.resourceRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`[ResourceRequest] Approve failed: request ${id} not found`);
      throw new Error('Request not found');
    }

    if (existing.status !== RequestStatus.PENDING) {
      console.log(`[ResourceRequest] Approve failed: request ${id} status is ${existing.status}`);
      throw new Error('Can only approve requests in PENDING status');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create approval record
      await tx.requestApproval.create({
        data: {
          requestId: id,
          approverId,
          status: 'APPROVED',
          comment: data.comment,
          approvedAt: new Date(),
        },
      });

      // Update request status
      return await tx.resourceRequest.update({
        where: { id },
        data: {
          status: RequestStatus.APPROVED,
          approvedBy: approverId,
          approvedAt: new Date(),
        },
      });
    });

    console.log(`[ResourceRequest] Approved request: id=${id}`);

    await this.invalidateCache();

    return result;
  }

  /**
   * Reject request
   */
  async rejectRequest(id: string, approverId: string, data: RejectRequestRequest) {
    console.log(`[ResourceRequest] Rejecting request: id=${id}, approver=${approverId}`);

    const existing = await prisma.resourceRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`[ResourceRequest] Reject failed: request ${id} not found`);
      throw new Error('Request not found');
    }

    if (existing.status !== RequestStatus.PENDING) {
      console.log(`[ResourceRequest] Reject failed: request ${id} status is ${existing.status}`);
      throw new Error('Can only reject requests in PENDING status');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create approval record
      await tx.requestApproval.create({
        data: {
          requestId: id,
          approverId,
          status: 'REJECTED',
          comment: data.reason,
        },
      });

      // Update request status
      return await tx.resourceRequest.update({
        where: { id },
        data: {
          status: RequestStatus.REJECTED,
          approvedBy: approverId,
          approvedAt: new Date(),
          rejectionReason: data.reason,
        },
      });
    });

    console.log(`[ResourceRequest] Rejected request: id=${id}, reason=${data.reason}`);

    await this.invalidateCache();

    return result;
  }

  /**
   * Allocate cluster to request
   */
  async allocateToRequest(id: string, data: AllocateRequestRequest) {
    console.log(`[ResourceRequest] Allocating cluster to request: id=${id}, clusterId=${data.clusterId}`);

    const existing = await prisma.resourceRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`[ResourceRequest] Allocate failed: request ${id} not found`);
      throw new Error('Request not found');
    }

    if (existing.status !== RequestStatus.APPROVED) {
      console.log(`[ResourceRequest] Allocate failed: request ${id} status is ${existing.status}`);
      throw new Error('Can only allocate to APPROVED requests');
    }

    // Verify cluster exists and is available
    const cluster = await prisma.cluster.findUnique({
      where: { id: data.clusterId },
    });

    if (!cluster) {
      console.log(`[ResourceRequest] Allocate failed: cluster ${data.clusterId} not found`);
      throw new Error('Cluster not found');
    }

    if (cluster.status !== 'AVAILABLE') {
      console.log(`[ResourceRequest] Allocate failed: cluster ${data.clusterId} status is ${cluster.status}`);
      throw new Error('Cluster is not available');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create cluster allocation
      const allocation = await tx.clusterAllocation.create({
        data: {
          clusterId: data.clusterId,
          userId: existing.requesterId,
          teamId: existing.teamId,
          startTime: existing.startTime,
          endTime: existing.endTime,
          requestId: id,
          status: 'ACTIVE',
        },
      });

      // Update cluster status
      await tx.cluster.update({
        where: { id: data.clusterId },
        data: {
          status: 'ALLOCATED',
          assignedTo: existing.requesterId,
          assignedAt: new Date(),
          assignmentEnd: existing.endTime,
        },
      });

      // Update request status
      const request = await tx.resourceRequest.update({
        where: { id },
        data: {
          status: RequestStatus.FULFILLED,
          assignedClusterId: data.clusterId,
          optimizationResult: data.optimizationResult,
          optimizationMode: data.optimizationMode || 'MANUAL',
        },
      });

      return { request, allocation };
    });

    console.log(`[ResourceRequest] Allocated cluster ${data.clusterId} to request ${id}`);

    await this.invalidateCache();

    return result;
  }

  /**
   * Cancel request
   */
  async cancelRequest(id: string) {
    console.log(`[ResourceRequest] Cancelling request: id=${id}`);

    const existing = await prisma.resourceRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      console.log(`[ResourceRequest] Cancel failed: request ${id} not found`);
      throw new Error('Request not found');
    }

    const cancellableStatuses: RequestStatus[] = [RequestStatus.DRAFT, RequestStatus.PENDING, RequestStatus.APPROVED];
    if (!cancellableStatuses.includes(existing.status)) {
      console.log(`[ResourceRequest] Cancel failed: request ${id} status is ${existing.status}`);
      throw new Error('Can only cancel requests in DRAFT, PENDING, or APPROVED status');
    }

    // If request has an allocation, release it
    if (existing.assignedClusterId) {
      const allocation = await prisma.clusterAllocation.findFirst({
        where: {
          requestId: id,
          status: 'ACTIVE',
        },
      });

      if (allocation) {
        await prisma.$transaction(async (tx) => {
          await tx.clusterAllocation.update({
            where: { id: allocation.id },
            data: {
              status: 'CANCELLED',
              actualEnd: new Date(),
            },
          });

          await tx.cluster.update({
            where: { id: existing.assignedClusterId! },
            data: {
              status: 'AVAILABLE',
              assignedTo: null,
              assignedAt: null,
              assignmentEnd: null,
            },
          });
        });

        console.log(`[ResourceRequest] Released cluster allocation for cancelled request`);
      }
    }

    const request = await prisma.resourceRequest.update({
      where: { id },
      data: {
        status: RequestStatus.CANCELLED,
      },
    });

    console.log(`[ResourceRequest] Cancelled request: id=${id}`);

    await this.invalidateCache();

    return request;
  }

  /**
   * Get my requests (for current user)
   */
  async getMyRequests(requesterId: string) {
    console.log(`[ResourceRequest] Fetching my requests for user: ${requesterId}`);

    const requests = await prisma.resourceRequest.findMany({
      where: { requesterId },
      include: {
        assignedCluster: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`[ResourceRequest] Found ${requests.length} requests for user ${requesterId}`);

    return requests;
  }

  /**
   * Get pending requests (for approval)
   */
  async getPendingRequests() {
    console.log(`[ResourceRequest] Fetching pending requests for approval`);

    const requests = await prisma.resourceRequest.findMany({
      where: { status: RequestStatus.PENDING },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    console.log(`[ResourceRequest] Found ${requests.length} pending requests`);

    return requests;
  }

  /**
   * Get request statistics
   */
  async getRequestStats() {
    console.log(`[ResourceRequest] Fetching request statistics`);

    const [total, draft, pending, approved, rejected, fulfilled, cancelled] = await Promise.all([
      prisma.resourceRequest.count(),
      prisma.resourceRequest.count({ where: { status: RequestStatus.DRAFT } }),
      prisma.resourceRequest.count({ where: { status: RequestStatus.PENDING } }),
      prisma.resourceRequest.count({ where: { status: RequestStatus.APPROVED } }),
      prisma.resourceRequest.count({ where: { status: RequestStatus.REJECTED } }),
      prisma.resourceRequest.count({ where: { status: RequestStatus.FULFILLED } }),
      prisma.resourceRequest.count({ where: { status: RequestStatus.CANCELLED } }),
    ]);

    const stats = {
      total,
      byStatus: {
        draft,
        pending,
        approved,
        rejected,
        fulfilled,
        cancelled,
      },
    };

    console.log(`[ResourceRequest] Stats: total=${total}, pending=${pending}, fulfilled=${fulfilled}`);

    return stats;
  }

  // ==================== Private Methods ====================

  /**
   * Invalidate cache
   */
  private async invalidateCache(requestId?: string) {
    await cacheService.delete(`${ResourceRequestService.CACHE_PREFIX}all:`);
    if (requestId) {
      await cacheService.delete(`${ResourceRequestService.CACHE_PREFIX}${requestId}`);
    }
    console.log(`[ResourceRequest] Cache invalidated`);
  }
}

// Export singleton instance
export const resourceRequestService = new ResourceRequestService();
export default resourceRequestService;