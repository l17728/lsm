import prisma from '../utils/prisma';
import { emailQueueService } from './email-queue.service';
import { EmailType } from './email.service';

export interface AllocateGpuRequest {
  userId: string;
  taskId?: string;
  gpuModel?: string; // Optional: prefer specific GPU model
  minMemory?: number; // Optional: minimum GPU memory in GB
}

export interface GpuAllocationResult {
  allocationId: string;
  gpuId: string;
  serverId: string;
  serverName: string;
  gpuModel: string;
  gpuMemory: number;
}

export class GpuService {
  /**
   * Get user email by ID
   */
  private async getUserEmail(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email || null;
  }
  /**
   * Allocate a GPU to a user
   */
  async allocateGpu(data: AllocateGpuRequest): Promise<GpuAllocationResult> {
    const { userId, taskId, gpuModel, minMemory } = data;

    // Find available GPU matching criteria
    const whereClause: any = {
      allocated: false,
      server: {
        status: 'ONLINE',
      },
    };

    if (gpuModel) {
      whereClause.model = gpuModel;
    }

    if (minMemory) {
      whereClause.memory = { gte: minMemory };
    }

    const availableGpu = await prisma.gpu.findFirst({
      where: whereClause,
      include: {
        server: true,
      },
      orderBy: { memory: 'desc' }, // Prefer higher memory GPUs
    });

    if (!availableGpu) {
      throw new Error('No available GPU matching criteria');
    }

    // Create allocation
    const allocation = await prisma.gpuAllocation.create({
      data: {
        userId,
        gpuId: availableGpu.id,
        taskId: taskId || undefined,
      },
    });

    // Update GPU status
    await prisma.gpu.update({
      where: { id: availableGpu.id },
      data: {
        allocated: true,
      },
    });

    // Get user email and send notification
    const userEmail = await this.getUserEmail(userId);
    if (userEmail) {
      const taskInfo = taskId ? await this.getTaskName(taskId) : null;
      await emailQueueService.enqueue(
        EmailType.GPU_ALLOCATED,
        userEmail,
        {
          userId,
          username: await this.getUsername(userId),
          gpuModel: availableGpu.model,
          memory: availableGpu.memory,
          serverName: availableGpu.server.name,
          taskName: taskInfo || 'N/A',
        },
        'high'
      );
    }

    return {
      allocationId: allocation.id,
      gpuId: availableGpu.id,
      serverId: availableGpu.serverId,
      serverName: availableGpu.server.name,
      gpuModel: availableGpu.model,
      gpuMemory: availableGpu.memory,
    };
  }

  /**
   * Get username by ID
   */
  private async getUsername(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    return user?.username || 'User';
  }

  /**
   * Get task name by ID
   */
  private async getTaskName(taskId: string): Promise<string | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { name: true },
    });
    return task?.name || null;
  }

  /**
   * Release a GPU allocation
   */
  async releaseGpu(allocationId: string, userId: string) {
    const allocation = await prisma.gpuAllocation.findUnique({
      where: { id: allocationId },
      include: {
        gpu: {
          include: {
            server: true,
          },
        },
      },
    });

    if (!allocation) {
      throw new Error('Allocation not found');
    }

    if (allocation.userId !== userId) {
      throw new Error('Not authorized to release this GPU');
    }

    if (allocation.releasedAt) {
      throw new Error('Allocation is not active');
    }

    // Update allocation
    const now = new Date();
    const duration = allocation.allocatedAt 
      ? Math.floor((now.getTime() - allocation.allocatedAt.getTime()) / 1000)
      : 0;

    await prisma.gpuAllocation.update({
      where: { id: allocationId },
      data: {
        releasedAt: now,
        duration,
      },
    });

    // Release GPU
    await prisma.gpu.update({
      where: { id: allocation.gpuId },
      data: {
        allocated: false,
      },
    });

    // Send email notification for GPU release
    const userEmail = await this.getUserEmail(userId);
    if (userEmail) {
      await emailQueueService.enqueue(
        EmailType.GPU_ALLOCATED, // Reuse GPU allocated template with different context
        userEmail,
        {
          userId,
          username: await this.getUsername(userId),
          gpuModel: allocation.gpu.model,
          memory: allocation.gpu.memory,
          serverName: allocation.gpu.server.name,
          taskName: 'Released',
          releaseTime: new Date().toISOString(),
        },
        'medium'
      );
    }

    return { success: true, gpuId: allocation.gpuId };
  }

  /**
   * Get user's active GPU allocations
   */
  async getUserAllocations(userId: string) {
    const allocations = await prisma.gpuAllocation.findMany({
      where: {
        userId,
        releasedAt: null,
      },
      include: {
        gpu: {
          include: {
            server: true,
          },
        },
      },
    });

    return allocations;
  }

  /**
   * Get all active allocations (admin)
   */
  async getAllActiveAllocations() {
    const allocations = await prisma.gpuAllocation.findMany({
      where: {
        releasedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        gpu: {
          include: {
            server: true,
          },
        },
      },
      orderBy: { allocatedAt: 'desc' },
    });

    return allocations;
  }

  /**
   * Get allocation history for a user
   */
  async getAllocationHistory(userId: string, limit = 50) {
    const allocations = await prisma.gpuAllocation.findMany({
      where: { userId },
      include: {
        gpu: {
          include: {
            server: true,
          },
        },
      },
      orderBy: { allocatedAt: 'desc' },
      take: limit,
    });

    return allocations;
  }

  /**
   * Force terminate an allocation (admin)
   */
  async forceTerminate(allocationId: string) {
    const allocation = await prisma.gpuAllocation.findUnique({
      where: { id: allocationId },
      include: {
        gpu: true,
      },
    });

    if (!allocation) {
      throw new Error('Allocation not found');
    }

    // Update allocation
    const now = new Date();
    const duration = allocation.allocatedAt 
      ? Math.floor((now.getTime() - allocation.allocatedAt.getTime()) / 1000)
      : 0;

    await prisma.gpuAllocation.update({
      where: { id: allocationId },
      data: {
        releasedAt: now,
        duration,
      },
    });

    // Release GPU
    await prisma.gpu.update({
      where: { id: allocation.gpuId },
      data: {
        allocated: false,
      },
    });

    return { success: true, gpuId: allocation.gpuId };
  }

  /**
   * Get GPU statistics
   */
  async getGpuStats() {
    const gpus = await prisma.gpu.findMany({
      include: {
        server: true,
      },
    });

    const stats = {
      total: gpus.length,
      available: gpus.filter((g) => !g.allocated).length,
      allocated: gpus.filter((g) => g.allocated).length,
      byModel: {} as Record<string, number>,
    };

    // Group by model
    gpus.forEach((gpu) => {
      stats.byModel[gpu.model] = (stats.byModel[gpu.model] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get allocation by ID
   */
  async getAllocation(allocationId: string) {
    const allocation = await prisma.gpuAllocation.findUnique({
      where: { id: allocationId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        gpu: {
          include: {
            server: true,
          },
        },
      },
    });

    return allocation;
  }
}

export const gpuService = new GpuService();
export default gpuService;