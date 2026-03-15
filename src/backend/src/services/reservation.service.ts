import prisma from '../utils/prisma';
import { 
  reservation_status as ReservationStatus, 
  server_status as ServerStatus, 
  user_role as UserRole,
  approval_status as ApprovalStatus,
  slot_status as SlotStatus,
} from '@prisma/client';
import { cacheService } from './cache.service';

// ==================== 类型定义 ====================

/**
 * 预约状态枚举
 */
export { ReservationStatus };

/**
 * 创建预约请求
 */
export interface CreateReservationRequest {
  serverId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  priority?: number;
  gpuCount?: number;
  minMemory?: number;
  cpuCores?: number;
  memoryGb?: number;
  notes?: string;
  taskId?: string;
}

/**
 * 更新预约请求
 */
export interface UpdateReservationRequest {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  priority?: number;
  gpuCount?: number;
  cpuCores?: number;
  memoryGb?: number;
  notes?: string;
}

/**
 * 预约查询参数
 */
export interface ReservationQueryParams {
  status?: ReservationStatus;
  serverId?: string;
  userId?: string;
  startTime?: Date;
  endTime?: Date;
  page?: number;
  limit?: number;
  sort?: 'startTime' | 'createdAt' | 'priority';
  order?: 'asc' | 'desc';
}

/**
 * 可用性查询参数
 */
export interface AvailabilityQueryParams {
  startTime: Date;
  endTime: Date;
  gpuCount?: number;
  minMemory?: number;
  gpuModel?: string;
}

/**
 * 可用 GPU 信息
 */
export interface AvailableGpu {
  id: string;
  model: string;
  memory: number;
  status: string;
}

/**
 * 可用服务器信息
 */
export interface AvailableServer {
  id: string;
  name: string;
  ipAddress: string | null;
  status: string;
  availableGpus: AvailableGpu[];
  availableGpuCount: number;
}

/**
 * 可用性查询结果
 */
export interface AvailabilityResult {
  available: boolean;
  servers: AvailableServer[];
  totalAvailableGpus: number;
  sufficient: boolean;
}

/**
 * 冲突检测结果
 */
export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    gpuCount: number;
  }>;
}

/**
 * 配额检查结果
 */
export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: {
    concurrentReservations: number;
    totalGpus: number;
    totalHours: number;
  };
  limits?: {
    maxGpus: number;
    maxHours: number;
    maxConcurrent: number;
  };
}

/**
 * 日历查询参数
 */
export interface CalendarQueryParams {
  serverId?: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

/**
 * 时间槽查询参数
 */
export interface SlotQueryParams {
  date: string; // YYYY-MM-DD
  slotDuration?: 30 | 60 | 120; // 分钟
}

/**
 * 审批请求
 */
export interface ApprovalRequest {
  notes?: string;
}

/**
 * 拒绝请求
 */
export interface RejectionRequest {
  reason: string;
}

// ==================== 预约服务类 ====================

export class ReservationService {
  // ==================== 常量定义 ====================

  /** 最小预约时长（分钟） */
  private readonly MIN_DURATION_MINUTES = 30;

  /** 最大预约时长（小时） */
  private readonly MAX_DURATION_HOURS = 24 * 7; // 7 天

  /** 最小提前预约时间（小时） */
  private readonly MIN_ADVANCE_HOURS = 1;

  /** 最大提前预约天数 */
  private readonly MAX_ADVANCE_DAYS = 30;

  /** 时间对齐粒度（分钟） */
  private readonly TIME_ALIGNMENT_MINUTES = 15;

  // ==================== 创建预约 ====================

  /**
   * 创建预约
   */
  async createReservation(
    userId: string,
    data: CreateReservationRequest
  ): Promise<{ reservation: any; warnings?: string[] }> {
    const warnings: string[] = [];

    // 1. 验证时间范围
    this.validateTimeRange(data.startTime, data.endTime);

    // 2. 检查配额
    const quotaCheck = await this.checkQuota(userId, data.gpuCount || 1, data.startTime, data.endTime);
    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.reason || '配额限制');
    }

    // 3. 检查是否需要审批
    const requiresApproval = this.checkRequiresApproval(data);

    // 4. 查找可用服务器和 GPU
    const availability = await this.checkAvailability({
      startTime: data.startTime,
      endTime: data.endTime,
      gpuCount: data.gpuCount || 1,
      minMemory: data.minMemory,
      gpuModel: undefined,
    });

    if (!availability.sufficient) {
      throw new Error('资源不足，无法满足需求');
    }

    // 5. 确定目标服务器
    let targetServer: AvailableServer | null = null;
    let allocatedGpus: AvailableGpu[] = [];

    if (data.serverId) {
      // 指定服务器
      targetServer = availability.servers.find(s => s.id === data.serverId) || null;
      if (!targetServer) {
        throw new Error('指定的服务器不存在或不可用');
      }
      if (targetServer.availableGpuCount < (data.gpuCount || 1)) {
        throw new Error('指定服务器资源不足');
      }
    } else {
      // 自动选择最优服务器（可用 GPU 最多的）
      targetServer = availability.servers
        .filter(s => s.availableGpuCount >= (data.gpuCount || 1))
        .sort((a, b) => b.availableGpuCount - a.availableGpuCount)[0];
    }

    if (!targetServer) {
      throw new Error('没有找到可用的服务器');
    }

    // 分配 GPU
    allocatedGpus = targetServer.availableGpus.slice(0, data.gpuCount || 1);

    // 6. 检查时间冲突
    const conflictCheck = await this.detectConflicts(
      targetServer.id,
      data.startTime,
      data.endTime,
      allocatedGpus.map(g => g.id)
    );

    if (conflictCheck.hasConflict) {
      throw new Error(`时间冲突，与预约 "${conflictCheck.conflicts[0].title}" 存在重叠`);
    }

    // 7. 创建预约记录（使用事务）
    const status = requiresApproval ? ReservationStatus.PENDING : ReservationStatus.APPROVED;

    const reservation = await prisma.$transaction(async (tx) => {
      // 创建预约
      const newReservation = await tx.reservation.create({
        data: {
          userId,
          serverId: targetServer!.id,
          title: data.title,
          description: data.description,
          startTime: data.startTime,
          endTime: data.endTime,
          status,
          gpuCount: data.gpuCount || 1,
          cpuCores: data.cpuCores,
          memoryGb: data.memoryGb,
          taskId: data.taskId,
          metadata: { 
            priority: data.priority || 1,
            minMemory: data.minMemory,
            notes: data.notes,
            requiresApproval,
          },
        },
      });

      // 创建 GPU 预约关联
      if (allocatedGpus.length > 0) {
        await tx.gpuReservation.createMany({
          data: allocatedGpus.map(gpu => ({
            reservationId: newReservation.id,
            gpuId: gpu.id,
            allocatedAt: new Date(),
          })),
        });
      }

      return newReservation;
    });

    // 8. 如果自动批准，添加提示
    if (status === ReservationStatus.APPROVED) {
      warnings.push('预约已自动批准');
    }

    // 清除缓存
    await this.invalidateCache(targetServer.id);

    return { reservation, warnings: warnings.length > 0 ? warnings : undefined };
  }

  // ==================== 查询预约 ====================

  /**
   * 查询预约列表
   */
  async getReservations(params: ReservationQueryParams) {
    const {
      status,
      serverId,
      userId,
      startTime,
      endTime,
      page = 1,
      limit = 20,
      sort = 'startTime',
      order = 'asc',
    } = params;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (serverId) {
      where.serverId = serverId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startTime || endTime) {
      where.startTime = {};
      if (startTime) where.startTime.gte = startTime;
      if (endTime) where.startTime.lte = endTime;
    }

    const [total, reservations] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.findMany({
        where,
        include: {
          server: {
            select: {
              id: true,
              name: true,
              ipAddress: true,
              status: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          gpuReservations: {
            include: {
              gpu: {
                select: {
                  id: true,
                  model: true,
                  memory: true,
                },
              },
            },
          },
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: reservations.map(r => ({
        ...r,
        allocatedGpus: r.gpuReservations?.map(gr => ({
          id: gr.gpu.id,
          model: gr.gpu.model,
          memory: gr.gpu.memory,
        })) || [],
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取预约详情
   */
  async getReservationById(id: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            ipAddress: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        canceller: {
          select: {
            id: true,
            username: true,
          },
        },
        gpuReservations: {
          include: {
            gpu: {
              select: {
                id: true,
                model: true,
                memory: true,
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
              },
            },
          },
        },
      },
    });

    if (!reservation) {
      throw new Error('预约不存在');
    }

    return {
      ...reservation,
      allocatedGpus: reservation.gpuReservations?.map(gr => ({
        id: gr.gpu.id,
        model: gr.gpu.model,
        memory: gr.gpu.memory,
        status: gr.releasedAt ? 'RELEASED' : 'ALLOCATED',
      })) || [],
      priority: (reservation.metadata as any)?.priority || 1,
      notes: (reservation.metadata as any)?.notes,
      requiresApproval: (reservation.metadata as any)?.requiresApproval || false,
    };
  }

  // ==================== 更新预约 ====================

  /**
   * 更新预约
   */
  async updateReservation(
    id: string,
    userId: string,
    data: UpdateReservationRequest,
    isAdmin: boolean = false
  ) {
    // 1. 获取现有预约
    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: {
        gpuReservations: true,
      },
    });

    if (!existing) {
      throw new Error('预约不存在');
    }

    // 2. 权限检查
    if (!isAdmin && existing.userId !== userId) {
      throw new Error('无权限修改此预约');
    }

    // 3. 状态检查
    if (existing.status === ReservationStatus.ACTIVE) {
      throw new Error('预约已开始，无法修改');
    }

    if (existing.status === ReservationStatus.COMPLETED) {
      throw new Error('预约已完成，无法修改');
    }

    if (existing.status === ReservationStatus.CANCELLED) {
      throw new Error('预约已取消，无法修改');
    }

    // 4. 计算更新后的值
    const newStartTime = data.startTime || existing.startTime;
    const newEndTime = data.endTime || existing.endTime;
    const newGpuCount = data.gpuCount || existing.gpuCount;

    // 5. 验证时间范围
    if (data.startTime || data.endTime) {
      this.validateTimeRange(newStartTime, newEndTime);
    }

    // 6. 如果时间或 GPU 数量变化，检查冲突
    if (data.startTime || data.endTime || data.gpuCount) {
      const currentGpuIds = existing.gpuReservations?.map(gr => gr.gpuId) || [];
      
      const availability = await this.checkAvailability({
        startTime: newStartTime,
        endTime: newEndTime,
        gpuCount: newGpuCount,
        minMemory: (existing.metadata as any)?.minMemory,
      });

      if (!availability.sufficient) {
        throw new Error('资源不足，无法满足需求');
      }

      // 检查冲突（排除当前预约）
      const conflictCheck = await this.detectConflicts(
        existing.serverId,
        newStartTime,
        newEndTime,
        currentGpuIds,
        id
      );

      if (conflictCheck.hasConflict) {
        throw new Error(`时间冲突，与预约 "${conflictCheck.conflicts[0].title}" 存在重叠`);
      }
    }

    // 7. 更新预约
    const metadata = existing.metadata as any || {};
    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        gpuCount: data.gpuCount,
        cpuCores: data.cpuCores,
        memoryGb: data.memoryGb,
        metadata: data.notes ? { ...metadata, notes: data.notes } : metadata,
      },
    });

    // 清除缓存
    await this.invalidateCache(existing.serverId);

    return updated;
  }

  // ==================== 取消预约 ====================

  /**
   * 取消预约
   */
  async cancelReservation(
    id: string,
    userId: string,
    reason?: string,
    isAdmin: boolean = false
  ) {
    const existing = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('预约不存在');
    }

    // 权限检查
    if (!isAdmin && existing.userId !== userId) {
      throw new Error('无权限取消此预约');
    }

    // 状态检查
    if (existing.status === ReservationStatus.COMPLETED) {
      throw new Error('预约已完成，无法取消');
    }

    if (existing.status === ReservationStatus.CANCELLED) {
      throw new Error('预约已取消');
    }

    // 正在进行的预约需要管理员权限
    if (existing.status === ReservationStatus.ACTIVE && !isAdmin) {
      throw new Error('正在进行的预约需要管理员权限取消');
    }

    // 使用事务更新
    const updated = await prisma.$transaction(async (tx) => {
      // 更新预约状态
      const reservation = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CANCELLED,
          cancelledBy: userId,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });

      // 释放 GPU 预约
      await tx.gpuReservation.updateMany({
        where: { reservationId: id },
        data: { releasedAt: new Date() },
      });

      return reservation;
    });

    // 清除缓存
    await this.invalidateCache(existing.serverId);

    return updated;
  }

  // ==================== 释放预约 ====================

  /**
   * 释放预约（完成或提前结束）
   */
  async releaseReservation(id: string, userId: string, isAdmin: boolean = false) {
    const existing = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('预约不存在');
    }

    // 权限检查
    if (!isAdmin && existing.userId !== userId) {
      throw new Error('无权限释放此预约');
    }

    // 只能释放进行中的预约
    if (existing.status !== ReservationStatus.ACTIVE) {
      throw new Error('只能释放进行中的预约');
    }

    // 使用事务更新
    const updated = await prisma.$transaction(async (tx) => {
      // 更新预约状态
      const reservation = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.COMPLETED,
          actualEndTime: new Date(),
        },
      });

      // 释放 GPU 预约
      await tx.gpuReservation.updateMany({
        where: { reservationId: id, releasedAt: null },
        data: { releasedAt: new Date() },
      });

      return reservation;
    });

    // 清除缓存
    await this.invalidateCache(existing.serverId);

    return updated;
  }

  // ==================== 审批管理 ====================

  /**
   * 批准预约
   */
  async approveReservation(
    id: string,
    approverId: string,
    data: ApprovalRequest
  ) {
    const existing = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('预约不存在');
    }

    if (existing.status !== ReservationStatus.PENDING) {
      throw new Error('预约状态不允许审批');
    }

    // 使用事务
    const updated = await prisma.$transaction(async (tx) => {
      // 更新预约状态
      const reservation = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.APPROVED,
          approvedBy: approverId,
          approvedAt: new Date(),
        },
      });

      // 创建审批记录
      await tx.reservationApproval.create({
        data: {
          reservationId: id,
          approverId,
          status: ApprovalStatus.APPROVED,
          comment: data.notes,
          approvedAt: new Date(),
        },
      });

      return reservation;
    });

    await this.invalidateCache(existing.serverId);

    return updated;
  }

  /**
   * 拒绝预约
   */
  async rejectReservation(
    id: string,
    rejecterId: string,
    data: RejectionRequest
  ) {
    if (!data.reason) {
      throw new Error('拒绝原因为必填项');
    }

    const existing = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('预约不存在');
    }

    if (existing.status !== ReservationStatus.PENDING) {
      throw new Error('预约状态不允许审批');
    }

    // 使用事务
    const updated = await prisma.$transaction(async (tx) => {
      // 更新预约状态
      const reservation = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.REJECTED,
          rejectionReason: data.reason,
        },
      });

      // 创建审批记录
      await tx.reservationApproval.create({
        data: {
          reservationId: id,
          approverId: rejecterId,
          status: ApprovalStatus.REJECTED,
          comment: data.reason,
        },
      });

      // 释放 GPU 预约
      await tx.gpuReservation.updateMany({
        where: { reservationId: id, releasedAt: null },
        data: { releasedAt: new Date() },
      });

      return reservation;
    });

    await this.invalidateCache(existing.serverId);

    return updated;
  }

  // ==================== 资源查询 ====================

  /**
   * 检查资源可用性
   */
  async checkAvailability(params: AvailabilityQueryParams): Promise<AvailabilityResult> {
    const { startTime, endTime, gpuCount = 1, minMemory = 0, gpuModel } = params;

    // 获取所有在线服务器
    const servers = await prisma.server.findMany({
      where: {
        status: ServerStatus.ONLINE,
      },
      include: {
        gpus: {
          where: {
            ...(gpuModel ? { model: gpuModel } : {}),
            ...(minMemory ? { memory: { gte: minMemory } } : {}),
          },
        },
      },
    });

    // 获取时间范围内的所有预约的 GPU
    const gpuReservations = await prisma.gpuReservation.findMany({
      where: {
        reservation: {
          status: { in: [ReservationStatus.APPROVED, ReservationStatus.ACTIVE] },
          OR: [
            {
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          ],
        },
        releasedAt: null,
      },
      select: {
        gpuId: true,
        reservationId: true,
      },
    });

    // 被预约的 GPU ID 集合
    const allocatedGpuIds = new Set(gpuReservations.map(gr => gr.gpuId));

    // 计算每个服务器的可用 GPU
    const availableServers: AvailableServer[] = servers
      .map(server => {
        const availableGpus = server.gpus
          .filter(gpu => !allocatedGpuIds.has(gpu.id))
          .map(gpu => ({
            id: gpu.id,
            model: gpu.model,
            memory: gpu.memory,
            status: 'AVAILABLE',
          }));

        return {
          id: server.id,
          name: server.name,
          ipAddress: server.ipAddress,
          status: server.status,
          availableGpus,
          availableGpuCount: availableGpus.length,
        };
      })
      .filter(server => server.availableGpuCount > 0);

    const totalAvailableGpus = availableServers.reduce(
      (sum, s) => sum + s.availableGpuCount,
      0
    );

    return {
      available: totalAvailableGpus > 0,
      servers: availableServers,
      totalAvailableGpus,
      sufficient: totalAvailableGpus >= gpuCount,
    };
  }

  /**
   * 获取日历数据
   */
  async getCalendarData(params: CalendarQueryParams) {
    const { serverId, start, end } = params;

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const where: any = {
      startTime: { gte: startDate },
      endTime: { lte: endDate },
      status: { in: [ReservationStatus.APPROVED, ReservationStatus.ACTIVE, ReservationStatus.COMPLETED] },
    };

    if (serverId) {
      where.serverId = serverId;
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        server: { select: { id: true, name: true } },
        user: { select: { id: true, username: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // 计算利用率
    const totalHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const reservedHours = reservations.reduce((sum, r) => {
      const duration = (r.endTime.getTime() - r.startTime.getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);

    return {
      serverId,
      range: { start, end },
      reservations: reservations.map(r => ({
        id: r.id,
        title: r.title,
        startTime: r.startTime,
        endTime: r.endTime,
        status: r.status,
        gpuCount: r.gpuCount,
        userId: r.userId,
        userName: r.user?.username,
        color: this.getStatusColor(r.status),
      })),
      utilization: {
        totalHours,
        reservedHours,
        utilizationRate: totalHours > 0 ? (reservedHours / totalHours) * 100 : 0,
      },
    };
  }

  /**
   * 获取服务器时间槽
   */
  async getServerSlots(serverId: string, params: SlotQueryParams) {
    const { date, slotDuration = 60 } = params;

    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // 获取服务器信息
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: { gpus: true },
    });

    if (!server) {
      throw new Error('服务器不存在');
    }

    const totalGpus = server.gpus.length;

    // 获取当天的预约
    const reservations = await prisma.reservation.findMany({
      where: {
        serverId,
        status: { in: [ReservationStatus.APPROVED, ReservationStatus.ACTIVE] },
        OR: [
          {
            startTime: { lt: endDate },
            endTime: { gt: startDate },
          },
        ],
      },
      include: {
        user: { select: { username: true } },
      },
    });

    // 生成时间槽
    const slots = [];
    const slotCount = (24 * 60) / slotDuration;

    for (let i = 0; i < slotCount; i++) {
      const slotStart = new Date(startDate);
      slotStart.setMinutes(i * slotDuration);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

      // 计算该时间槽内被占用的 GPU 数量
      let maxAllocated = 0;
      const slotReservations: any[] = [];

      reservations.forEach(r => {
        const rStart = new Date(r.startTime);
        const rEnd = new Date(r.endTime);

        // 检查是否与时间槽重叠
        if (rStart < slotEnd && rEnd > slotStart) {
          maxAllocated = Math.max(maxAllocated, r.gpuCount);
          slotReservations.push({
            id: r.id,
            title: r.title,
            gpuCount: r.gpuCount,
            userName: r.user?.username,
          });
        }
      });

      const availableGpus = totalGpus - maxAllocated;

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        availableGpus,
        status: availableGpus === 0 ? 'FULL' : availableGpus < totalGpus ? 'PARTIAL' : 'AVAILABLE',
        reservations: slotReservations.length > 0 ? slotReservations : undefined,
      });
    }

    return {
      serverId,
      serverName: server.name,
      date,
      slotDuration,
      totalGpus,
      slots,
      workingHours: {
        start: '00:00',
        end: '23:59',
      },
    };
  }

  // ==================== 配额管理 ====================

  /**
   * 检查配额
   */
  async checkQuota(
    userId: string,
    gpuCount: number,
    startTime: Date,
    endTime: Date
  ): Promise<QuotaCheckResult> {
    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { allowed: false, reason: '用户不存在' };
    }

    // 获取配额设置（优先级：用户 > 角色 > 全局）
    let quota = await prisma.resourceQuota.findFirst({
      where: { quotaType: 'USER', targetId: userId },
    });

    if (!quota) {
      quota = await prisma.resourceQuota.findFirst({
        where: { quotaType: 'ROLE', targetId: user.role },
      });
    }

    if (!quota) {
      quota = await prisma.resourceQuota.findFirst({
        where: { quotaType: 'GLOBAL', targetId: null },
      });
    }

    // 默认配额
    const limits = {
      maxGpus: quota?.maxGpus || 4,
      maxHours: quota?.maxGpuHours || 48,
      maxConcurrent: 2, // 默认最大并发数
    };

    // 检查 GPU 数量限制
    if (gpuCount > limits.maxGpus) {
      return {
        allowed: false,
        reason: `GPU 数量超过限制（最大 ${limits.maxGpus} 个）`,
        limits,
      };
    }

    // 检查时长限制
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (durationHours > limits.maxHours) {
      return {
        allowed: false,
        reason: `预约时长超过限制（最大 ${limits.maxHours} 小时）`,
        limits,
      };
    }

    // 检查并发预约数
    const concurrentReservations = await prisma.reservation.count({
      where: {
        userId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED, ReservationStatus.ACTIVE] },
      },
    });

    if (concurrentReservations >= limits.maxConcurrent) {
      return {
        allowed: false,
        reason: `并发预约数超过限制（最大 ${limits.maxConcurrent} 个）`,
        currentUsage: { concurrentReservations, totalGpus: 0, totalHours: 0 },
        limits,
      };
    }

    return {
      allowed: true,
      currentUsage: {
        concurrentReservations,
        totalGpus: 0,
        totalHours: 0,
      },
      limits,
    };
  }

  // ==================== 冲突检测 ====================

  /**
   * 时间冲突检测
   */
  async detectConflicts(
    serverId: string,
    startTime: Date,
    endTime: Date,
    gpuIds: string[],
    excludeReservationId?: string
  ): Promise<ConflictResult> {
    // 查找时间重叠的预约
    const overlappingReservations = await prisma.reservation.findMany({
      where: {
        serverId,
        status: { in: [ReservationStatus.APPROVED, ReservationStatus.ACTIVE] },
        OR: [
          {
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        ],
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
      include: {
        gpuReservations: {
          select: { gpuId: true },
        },
      },
    });

    // 检查 GPU 是否有冲突
    const conflicts = overlappingReservations
      .filter(r => {
        // 检查是否有 GPU 重叠
        const reservedGpuIds = r.gpuReservations?.map(gr => gr.gpuId) || [];
        return reservedGpuIds.some(id => gpuIds.includes(id));
      })
      .map(r => ({
        id: r.id,
        title: r.title,
        startTime: r.startTime,
        endTime: r.endTime,
        gpuCount: r.gpuCount,
      }));

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  // ==================== 状态机管理 ====================

  /**
   * 更新预约状态（定时任务调用）
   */
  async updateReservationStatus(): Promise<{
    activated: number;
    completed: number;
    expired: number;
  }> {
    const now = new Date();
    let activated = 0;
    let completed = 0;
    let expired = 0;

    // 1. 将已到开始时间的 APPROVED 预约改为 ACTIVE
    const toActivate = await prisma.reservation.updateMany({
      where: {
        status: ReservationStatus.APPROVED,
        startTime: { lte: now },
        endTime: { gt: now },
      },
      data: { 
        status: ReservationStatus.ACTIVE,
        actualStartTime: now,
      },
    });
    activated = toActivate.count;

    // 2. 将已到结束时间的 ACTIVE 预约改为 COMPLETED
    const toComplete = await prisma.$transaction(async (tx) => {
      // 获取需要完成的预约
      const reservations = await tx.reservation.findMany({
        where: {
          status: ReservationStatus.ACTIVE,
          endTime: { lte: now },
        },
        select: { id: true },
      });

      // 更新预约状态
      await tx.reservation.updateMany({
        where: {
          status: ReservationStatus.ACTIVE,
          endTime: { lte: now },
        },
        data: { 
          status: ReservationStatus.COMPLETED,
          actualEndTime: now,
        },
      });

      // 释放 GPU
      if (reservations.length > 0) {
        await tx.gpuReservation.updateMany({
          where: {
            reservationId: { in: reservations.map(r => r.id) },
            releasedAt: null,
          },
          data: { releasedAt: now },
        });
      }

      return { count: reservations.length };
    });
    completed = toComplete.count;

    // 3. 将未及时开始的 APPROVED 预约改为 EXPIRED（开始时间已过但未激活）
    const toExpire = await prisma.$transaction(async (tx) => {
      // 获取需要过期的预约
      const reservations = await tx.reservation.findMany({
        where: {
          status: ReservationStatus.APPROVED,
          endTime: { lte: now },
        },
        select: { id: true },
      });

      // 更新预约状态
      await tx.reservation.updateMany({
        where: {
          status: ReservationStatus.APPROVED,
          endTime: { lte: now },
        },
        data: { status: ReservationStatus.EXPIRED },
      });

      // 释放 GPU
      if (reservations.length > 0) {
        await tx.gpuReservation.updateMany({
          where: {
            reservationId: { in: reservations.map(r => r.id) },
            releasedAt: null,
          },
          data: { releasedAt: now },
        });
      }

      return { count: reservations.length };
    });
    expired = toExpire.count;

    // 清除缓存
    await cacheService.invalidatePattern('reservations:*');

    return { activated, completed, expired };
  }

  // ==================== 辅助方法 ====================

  /**
   * 验证时间范围
   */
  private validateTimeRange(startTime: Date, endTime: Date): void {
    const now = new Date();

    // 检查开始时间是否早于结束时间
    if (startTime >= endTime) {
      throw new Error('时间范围无效：开始时间必须早于结束时间');
    }

    // 检查是否提前足够时间
    const advanceHours = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (advanceHours < this.MIN_ADVANCE_HOURS) {
      throw new Error(`预约时间无效：需要至少提前 ${this.MIN_ADVANCE_HOURS} 小时`);
    }

    // 检查是否提前太多
    const advanceDays = advanceHours / 24;
    if (advanceDays > this.MAX_ADVANCE_DAYS) {
      throw new Error(`预约时间无效：最多提前 ${this.MAX_ADVANCE_DAYS} 天`);
    }

    // 检查时长是否在允许范围内
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    if (durationMinutes < this.MIN_DURATION_MINUTES) {
      throw new Error(`预约时长无效：最少 ${this.MIN_DURATION_MINUTES} 分钟`);
    }

    const durationHours = durationMinutes / 60;
    if (durationHours > this.MAX_DURATION_HOURS) {
      throw new Error(`预约时长无效：最多 ${this.MAX_DURATION_HOURS} 小时`);
    }

    // 检查时间对齐
    const alignMinutes = (startTime.getMinutes() + startTime.getHours() * 60) % this.TIME_ALIGNMENT_MINUTES;
    if (alignMinutes !== 0) {
      throw new Error(`时间对齐无效：时间需按 ${this.TIME_ALIGNMENT_MINUTES} 分钟对齐`);
    }
  }

  /**
   * 检查是否需要审批
   */
  private checkRequiresApproval(data: CreateReservationRequest): boolean {
    const durationHours = (data.endTime.getTime() - data.startTime.getTime()) / (1000 * 60 * 60);

    // 预约时长超过 48 小时
    if (durationHours > 48) {
      return true;
    }

    // GPU 数量超过 4 个
    if ((data.gpuCount || 1) > 4) {
      return true;
    }

    // 优先级为高（通过 metadata 存储）
    if ((data.priority || 1) >= 10) {
      return true;
    }

    return false;
  }

  /**
   * 获取状态对应的颜色
   */
  private getStatusColor(status: ReservationStatus): string {
    const colors: Record<ReservationStatus, string> = {
      PENDING: '#FFC107',
      APPROVED: '#4CAF50',
      REJECTED: '#F44336',
      ACTIVE: '#2196F3',
      COMPLETED: '#9E9E9E',
      CANCELLED: '#9E9E9E',
      EXPIRED: '#FF9800',
    };
    return colors[status] || '#9E9E9E';
  }

  /**
   * 清除相关缓存
   */
  private async invalidateCache(serverId?: string | null): Promise<void> {
    const promises: Promise<number>[] = [];

    promises.push(cacheService.invalidatePattern('reservations:*'));

    if (serverId) {
      promises.push(cacheService.invalidatePattern(`availability:${serverId}:*`));
      promises.push(cacheService.invalidatePattern(`slots:${serverId}:*`));
    }

    await Promise.all(promises);
  }
}

// 导出单例实例
export const reservationService = new ReservationService();
export default reservationService;