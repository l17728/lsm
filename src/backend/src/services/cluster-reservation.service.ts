/**
 * Cluster Reservation Service
 * 
 * Manages cluster reservations for MANAGER users.
 * Features:
 * - Create reservation requests (require SUPER_ADMIN approval)
 * - Wait queue for time conflicts
 * - Approve/reject workflow
 * - Release resources
 * 
 * @version 1.0.0
 */
import prisma from '../utils/prisma';
import { safeLogger } from '../middleware/logging.middleware';

// ==================== Types ====================

export interface CreateClusterReservationRequest {
  clusterId: string;
  startTime: Date;
  endTime: Date;
  purpose?: string;
  teamId?: string;
}

export interface TimeSlotRecommendation {
  startTime: Date;
  endTime: Date;
  score: number;
  confidence: number;
  reasons: string[];
  queuePosition: number | null;
}

export interface RecommendTimeSlotsRequest {
  clusterId: string;
  duration: number; // in minutes
  preferredStartTime?: Date;
  preferredEndTime?: Date;
}

export interface ReservationQueryFilters {
  status?: string;
  clusterId?: string;
  userId?: string;
  startTime?: Date;
  endTime?: Date;
}

export type ReservationStatus = 
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';

// ==================== Service ====================

export class ClusterReservationService {
  private static readonly CACHE_PREFIX = 'cluster_reservation:';
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Create a new cluster reservation request
   * If time conflicts with existing reservations, add to wait queue
   */
  async createReservation(
    data: CreateClusterReservationRequest,
    userId: string
  ) {
    safeLogger.info('Creating cluster reservation', {
      clusterId: data.clusterId,
      userId,
      startTime: data.startTime,
      endTime: data.endTime,
    });

    // Verify cluster exists
    const cluster = await prisma.cluster.findUnique({
      where: { id: data.clusterId },
    });

    if (!cluster) {
      safeLogger.warn('Cluster not found', { clusterId: data.clusterId });
      throw new Error('Cluster not found');
    }

    // Check for time conflicts with existing APPROVED/PENDING reservations
    const conflictingReservations = await this.findConflictingReservations(
      data.clusterId,
      data.startTime,
      data.endTime
    );

    const hasConflict = conflictingReservations.length > 0;
    let queuePosition: number | null = null;

    if (hasConflict) {
      // Calculate queue position
      const maxPosition = await prisma.clusterReservation.aggregate({
        where: {
          clusterId: data.clusterId,
          status: 'PENDING',
          queuePosition: { not: null },
        },
        _max: { queuePosition: true },
      });
      queuePosition = (maxPosition._max.queuePosition || 0) + 1;
      
      safeLogger.info('Reservation added to wait queue', {
        clusterId: data.clusterId,
        queuePosition,
      });
    }

    // Create reservation
    const reservation = await prisma.clusterReservation.create({
      data: {
        clusterId: data.clusterId,
        userId,
        teamId: data.teamId,
        startTime: data.startTime,
        endTime: data.endTime,
        purpose: data.purpose,
        status: 'PENDING',
        queuePosition,
      },
      include: {
        cluster: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
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
      },
    });

    safeLogger.info('Cluster reservation created', {
      reservationId: reservation.id,
      clusterId: data.clusterId,
      userId,
      status: reservation.status,
      queuePosition,
    });

    return reservation;
  }

  /**
   * Approve a pending reservation (SUPER_ADMIN only)
   */
  async approveReservation(
    reservationId: string,
    approverId: string
  ) {
    safeLogger.info('Approving cluster reservation', {
      reservationId,
      approverId,
    });

    const reservation = await prisma.clusterReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.status !== 'PENDING') {
      throw new Error(`Cannot approve reservation with status ${reservation.status}`);
    }

    const updated = await prisma.clusterReservation.update({
      where: { id: reservationId },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
        queuePosition: null, // Clear queue position
      },
      include: {
        cluster: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    // Update cluster status
    await prisma.cluster.update({
      where: { id: reservation.clusterId },
      data: {
        status: 'RESERVED',
        assignedTo: reservation.userId,
        assignedAt: reservation.startTime,
        assignmentEnd: reservation.endTime,
      },
    });

    // Re-calculate queue positions for remaining reservations
    await this.recalculateQueuePositions(reservation.clusterId);

    safeLogger.info('Cluster reservation approved', {
      reservationId,
      clusterId: reservation.clusterId,
      approverId,
    });

    return updated;
  }

  /**
   * Reject a pending reservation (SUPER_ADMIN only)
   */
  async rejectReservation(
    reservationId: string,
    rejecterId: string,
    reason?: string
  ) {
    safeLogger.info('Rejecting cluster reservation', {
      reservationId,
      rejecterId,
    });

    const reservation = await prisma.clusterReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.status !== 'PENDING') {
      throw new Error(`Cannot reject reservation with status ${reservation.status}`);
    }

    const updated = await prisma.clusterReservation.update({
      where: { id: reservationId },
      data: {
        status: 'REJECTED',
        rejectedBy: rejecterId,
        rejectedAt: new Date(),
        rejectionReason: reason,
        queuePosition: null,
      },
    });

    // Re-calculate queue positions
    await this.recalculateQueuePositions(reservation.clusterId);

    safeLogger.info('Cluster reservation rejected', {
      reservationId,
      rejecterId,
      reason,
    });

    return updated;
  }

  /**
   * Cancel a reservation (by the user who created it)
   */
  async cancelReservation(reservationId: string, userId: string) {
    safeLogger.info('Cancelling cluster reservation', {
      reservationId,
      userId,
    });

    const reservation = await prisma.clusterReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.userId !== userId) {
      throw new Error('Not authorized to cancel this reservation');
    }

    if (!['PENDING', 'APPROVED'].includes(reservation.status)) {
      throw new Error(`Cannot cancel reservation with status ${reservation.status}`);
    }

    const wasActive = reservation.status === 'APPROVED';

    const updated = await prisma.clusterReservation.update({
      where: { id: reservationId },
      data: {
        status: 'CANCELLED',
        queuePosition: null,
      },
    });

    // If reservation was approved, update cluster status
    if (wasActive) {
      await prisma.cluster.update({
        where: { id: reservation.clusterId },
        data: {
          status: 'AVAILABLE',
          assignedTo: null,
          assignedAt: null,
          assignmentEnd: null,
        },
      });

      // Check if next in queue can be activated
      await this.processQueueAfterRelease(reservation.clusterId);
    }

    // Re-calculate queue positions
    await this.recalculateQueuePositions(reservation.clusterId);

    safeLogger.info('Cluster reservation cancelled', {
      reservationId,
      userId,
    });

    return updated;
  }

  /**
   * Release cluster resources (end current reservation early)
   */
  async releaseReservation(reservationId: string, userId: string) {
    safeLogger.info('Releasing cluster reservation', {
      reservationId,
      userId,
    });

    const reservation = await prisma.clusterReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.userId !== userId) {
      throw new Error('Not authorized to release this reservation');
    }

    if (!['APPROVED', 'ACTIVE'].includes(reservation.status)) {
      throw new Error(`Cannot release reservation with status ${reservation.status}`);
    }

    const updated = await prisma.clusterReservation.update({
      where: { id: reservationId },
      data: {
        status: 'COMPLETED',
        actualEndTime: new Date(),
      },
    });

    // Update cluster status
    await prisma.cluster.update({
      where: { id: reservation.clusterId },
      data: {
        status: 'AVAILABLE',
        assignedTo: null,
        assignedAt: null,
        assignmentEnd: null,
      },
    });

    // Process wait queue
    await this.processQueueAfterRelease(reservation.clusterId);

    safeLogger.info('Cluster reservation released', {
      reservationId,
      userId,
    });

    return updated;
  }

  /**
   * Get all reservations with optional filters
   */
  async getReservations(filters: ReservationQueryFilters = {}) {
    safeLogger.debug('Fetching cluster reservations', { filters });

    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.clusterId) where.clusterId = filters.clusterId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.startTime || filters.endTime) {
      where.OR = [];
      if (filters.startTime && filters.endTime) {
        where.OR.push(
          { startTime: { gte: filters.startTime, lte: filters.endTime } },
          { endTime: { gte: filters.startTime, lte: filters.endTime } },
          {
            AND: [
              { startTime: { lte: filters.startTime } },
              { endTime: { gte: filters.endTime } },
            ],
          }
        );
      }
    }

    const reservations = await prisma.clusterReservation.findMany({
      where,
      include: {
        cluster: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            status: true,
            totalServers: true,
            totalGpus: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: [
        { queuePosition: 'asc' },
        { startTime: 'asc' },
      ],
    });

    return reservations;
  }

  /**
   * Get reservation by ID
   */
  async getReservationById(id: string) {
    safeLogger.debug('Fetching reservation by ID', { reservationId: id });
    
    return prisma.clusterReservation.findUnique({
      where: { id },
      include: {
        cluster: {
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
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get user's own reservations
   */
  async getMyReservations(userId: string) {
    return prisma.clusterReservation.findMany({
      where: { userId },
      include: {
        cluster: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get pending reservations for approval (SUPER_ADMIN)
   */
  async getPendingReservations() {
    return prisma.clusterReservation.findMany({
      where: { status: 'PENDING' },
      include: {
        cluster: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [
        { queuePosition: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * AI-assisted time slot recommendations
   * Analyzes existing reservations and recommends optimal time slots
   */
  async recommendTimeSlots(
    params: RecommendTimeSlotsRequest
  ): Promise<TimeSlotRecommendation[]> {
    safeLogger.info('Generating AI time slot recommendations', {
      clusterId: params.clusterId,
      duration: params.duration,
    });

    // Verify cluster exists
    const cluster = await prisma.cluster.findUnique({
      where: { id: params.clusterId },
    });

    if (!cluster) {
      throw new Error('Cluster not found');
    }

    // Get all existing reservations for this cluster
    const existingReservations = await prisma.clusterReservation.findMany({
      where: {
        clusterId: params.clusterId,
        status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
      },
      orderBy: { startTime: 'asc' },
    });

    // Get historical usage patterns for smarter recommendations
    const historicalPatterns = await this.analyzeHistoricalPatterns(params.clusterId);

    // Calculate time windows
    const now = new Date();
    const searchStart = params.preferredStartTime || now;
    const searchEnd = params.preferredEndTime || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days default

    const durationMs = params.duration * 60 * 1000;
    const recommendations: TimeSlotRecommendation[] = [];

    // Find gaps between existing reservations
    const timeSlots = this.findAvailableTimeSlots(
      existingReservations,
      searchStart,
      searchEnd,
      durationMs
    );

    // Score and rank time slots
    for (const slot of timeSlots) {
      const score = this.calculateTimeSlotScore(
        slot,
        existingReservations,
        historicalPatterns,
        params.duration
      );

      recommendations.push({
        startTime: slot.start,
        endTime: slot.end,
        score: score.score,
        confidence: score.confidence,
        reasons: score.reasons,
        queuePosition: null, // Will be set if conflict exists
      });
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    // Return top 5 recommendations
    const topRecommendations = recommendations.slice(0, 5);

    safeLogger.info('AI time slot recommendations generated', {
      clusterId: params.clusterId,
      recommendationCount: topRecommendations.length,
      topScore: topRecommendations[0]?.score || 0,
    });

    return topRecommendations;
  }

  /**
   * Analyze historical usage patterns for a cluster
   */
  private async analyzeHistoricalPatterns(clusterId: string): Promise<{
    peakHours: number[];
    avgDuration: number;
    utilizationByDay: Record<number, number>;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const historicalReservations = await prisma.clusterReservation.findMany({
      where: {
        clusterId,
        status: { in: ['COMPLETED', 'ACTIVE'] },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Analyze peak hours
    const hourCounts: Record<number, number> = {};
    const dayUtilization: Record<number, number> = {};
    let totalDuration = 0;

    for (const res of historicalReservations) {
      const startHour = new Date(res.startTime).getHours();
      hourCounts[startHour] = (hourCounts[startHour] || 0) + 1;

      const dayOfWeek = new Date(res.startTime).getDay();
      dayUtilization[dayOfWeek] = (dayUtilization[dayOfWeek] || 0) + 1;

      const duration = (new Date(res.endTime).getTime() - new Date(res.startTime).getTime()) / 60000;
      totalDuration += duration;
    }

    // Find peak hours (top 4 busiest)
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([hour]) => parseInt(hour));

    const avgDuration = historicalReservations.length > 0
      ? totalDuration / historicalReservations.length
      : 120; // Default 2 hours

    safeLogger.debug('Historical patterns analyzed', {
      clusterId,
      peakHours,
      avgDuration,
      sampleSize: historicalReservations.length,
    });

    return {
      peakHours,
      avgDuration,
      utilizationByDay: dayUtilization,
    };
  }

  /**
   * Find available time slots between existing reservations
   */
  private findAvailableTimeSlots(
    reservations: any[],
    searchStart: Date,
    searchEnd: Date,
    durationMs: number
  ): Array<{ start: Date; end: Date }> {
    const slots: Array<{ start: Date; end: Date }> = [];

    // Start from now or preferred start time
    let currentStart = new Date(searchStart);

    // Round up to next hour for cleaner slots
    currentStart.setMinutes(0, 0, 0);
    currentStart.setHours(currentStart.getHours() + 1);

    // Filter reservations that overlap with search window
    const relevantReservations = reservations.filter(r => {
      const resStart = new Date(r.startTime);
      const resEnd = new Date(r.endTime);
      return resStart < searchEnd && resEnd > searchStart;
    });

    // Sort by start time
    relevantReservations.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Find gaps
    for (const reservation of relevantReservations) {
      const resStart = new Date(reservation.startTime);
      const resEnd = new Date(reservation.endTime);

      // Check if there's a gap before this reservation
      if (currentStart < resStart) {
        const gapDuration = resStart.getTime() - currentStart.getTime();

        // If gap is large enough for the requested duration
        if (gapDuration >= durationMs) {
          slots.push({
            start: new Date(currentStart),
            end: new Date(currentStart.getTime() + durationMs),
          });
        }
      }

      // Move current start past this reservation
      if (resEnd > currentStart) {
        currentStart = new Date(resEnd);
        // Round up to next 30-minute mark
        const minutes = currentStart.getMinutes();
        if (minutes > 0 && minutes < 30) {
          currentStart.setMinutes(30, 0, 0);
        } else if (minutes >= 30) {
          currentStart.setHours(currentStart.getHours() + 1, 0, 0, 0);
        }
      }
    }

    // Add slot after last reservation if within search window
    if (currentStart.getTime() + durationMs <= searchEnd.getTime()) {
      slots.push({
        start: new Date(currentStart),
        end: new Date(currentStart.getTime() + durationMs),
      });
    }

    // Also add some future slots (next 2-3 days) even if they overlap
    // These will have queue positions
    const futureStarts = [1, 2, 3].map(days => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      d.setHours(9, 0, 0, 0); // 9 AM
      return d;
    });

    for (const start of futureStarts) {
      if (start >= searchStart && start < searchEnd) {
        const hasConflict = relevantReservations.some(r => {
          const resStart = new Date(r.startTime);
          const resEnd = new Date(r.endTime);
          const slotEnd = new Date(start.getTime() + durationMs);
          return start < resEnd && slotEnd > resStart;
        });

        if (hasConflict) {
          // Still add but mark as having queue position
          slots.push({
            start: new Date(start),
            end: new Date(start.getTime() + durationMs),
          });
        }
      }
    }

    return slots;
  }

  /**
   * Calculate score for a time slot
   */
  private calculateTimeSlotScore(
    slot: { start: Date; end: Date },
    existingReservations: any[],
    patterns: { peakHours: number[]; avgDuration: number; utilizationByDay: Record<number, number> },
    requestedDuration: number
  ): { score: number; confidence: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // 1. Time proximity score (closer to now = higher score, but not too close)
    const hoursFromNow = (slot.start.getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursFromNow >= 1 && hoursFromNow <= 24) {
      score += 25;
      reasons.push('时间合适，可尽快安排');
    } else if (hoursFromNow > 24 && hoursFromNow <= 72) {
      score += 20;
      reasons.push('未来1-3天内可用');
    } else {
      score += 10;
      reasons.push('需要提前规划');
    }

    // 2. Avoid peak hours (inverse scoring - lower is better)
    const startHour = slot.start.getHours();
    if (!patterns.peakHours.includes(startHour)) {
      score += 20;
      reasons.push('避开高峰时段');
    } else {
      score += 5;
    }

    // 3. Day of week scoring (weekdays preferred for business use)
    const dayOfWeek = slot.start.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      score += 15;
      if (dayOfWeek !== 5) { // Not Friday
        reasons.push('工作日时段');
      }
    } else {
      score += 10;
      reasons.push('周末时段');
    }

    // 4. Morning preference (9-12 AM often better for compute tasks)
    if (startHour >= 9 && startHour < 12) {
      score += 15;
      reasons.push('上午时段效率较高');
    } else if (startHour >= 14 && startHour < 18) {
      score += 10;
    }

    // 5. Duration fit score
    const durationDiff = Math.abs(requestedDuration - patterns.avgDuration);
    if (durationDiff < 30) {
      score += 10;
      reasons.push('时长与历史使用模式匹配');
    }

    // 6. Check for conflicts
    const hasConflict = existingReservations.some(r => {
      const resStart = new Date(r.startTime);
      const resEnd = new Date(r.endTime);
      return slot.start < resEnd && slot.end > resStart;
    });

    if (!hasConflict) {
      score += 15;
      reasons.push('无时间冲突');
    } else {
      reasons.push('需排队等待');
    }

    // Calculate confidence based on available data
    const confidence = patterns.peakHours.length > 0 ? 0.85 : 0.65;

    return { score, confidence, reasons };
  }

  // ==================== Private Methods ====================

  /**
   * Find reservations that conflict with the given time range
   */
  private async findConflictingReservations(
    clusterId: string,
    startTime: Date,
    endTime: Date
  ) {
    safeLogger.debug('Checking for time conflicts', {
      clusterId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });
    
    const conflicts = await prisma.clusterReservation.findMany({
      where: {
        clusterId,
        status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
        OR: [
          // Starts during existing reservation
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          // Ends during existing reservation
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
          // Completely overlaps existing reservation
          {
            AND: [
              { startTime: { gte: startTime } },
              { endTime: { lte: endTime } },
            ],
          },
        ],
      },
    });

    if (conflicts.length > 0) {
      safeLogger.debug('Found time conflicts', {
        clusterId,
        conflictCount: conflicts.length,
        conflictingReservationIds: conflicts.map(c => c.id),
      });
    }

    return conflicts;
  }

  /**
   * Re-calculate queue positions after status change
   */
  private async recalculateQueuePositions(clusterId: string) {
    safeLogger.debug('Recalculating queue positions', { clusterId });
    
    const queuedReservations = await prisma.clusterReservation.findMany({
      where: {
        clusterId,
        status: 'PENDING',
        queuePosition: { not: null },
      },
      orderBy: { queuePosition: 'asc' },
    });

    for (let i = 0; i < queuedReservations.length; i++) {
      await prisma.clusterReservation.update({
        where: { id: queuedReservations[i].id },
        data: { queuePosition: i + 1 },
      });
    }

    if (queuedReservations.length > 0) {
      safeLogger.debug('Queue positions updated', {
        clusterId,
        queueSize: queuedReservations.length,
      });
    }
  }

  /**
   * Process wait queue after a reservation is released
   * Auto-approve next reservation if no conflicts
   */
  private async processQueueAfterRelease(clusterId: string) {
    // Find next in queue
    const nextInQueue = await prisma.clusterReservation.findFirst({
      where: {
        clusterId,
        status: 'PENDING',
        queuePosition: { not: null },
      },
      orderBy: { queuePosition: 'asc' },
    });

    if (!nextInQueue) {
      return;
    }

    // Check if time is still valid (in the future)
    if (nextInQueue.startTime <= new Date()) {
      // Mark as expired if start time has passed
      await prisma.clusterReservation.update({
        where: { id: nextInQueue.id },
        data: {
          status: 'CANCELLED',
          queuePosition: null,
        },
      });
      // Process next in queue
      await this.processQueueAfterRelease(clusterId);
      return;
    }

    safeLogger.info('Queue position advanced', {
      reservationId: nextInQueue.id,
      queuePosition: nextInQueue.queuePosition,
    });

    // Note: We don't auto-approve here, SUPER_ADMIN still needs to approve
    // The queue position is just reorganized
  }

  /**
   * Activate approved reservations when start time is reached
   * (Should be called by a cron job)
   */
  async activateReservations() {
    safeLogger.info('Running reservation activation job');
    
    const now = new Date();

    const toActivate = await prisma.clusterReservation.findMany({
      where: {
        status: 'APPROVED',
        startTime: { lte: now },
        endTime: { gt: now },
      },
    });

    if (toActivate.length > 0) {
      safeLogger.info('Found reservations to activate', { count: toActivate.length });
    }

    for (const reservation of toActivate) {
      await prisma.clusterReservation.update({
        where: { id: reservation.id },
        data: {
          status: 'ACTIVE',
          actualStartTime: now,
        },
      });

      await prisma.cluster.update({
        where: { id: reservation.clusterId },
        data: { status: 'ALLOCATED' },
      });

      safeLogger.info('Reservation activated', { reservationId: reservation.id });
    }

    return toActivate.length;
  }

  /**
   * Complete expired reservations
   * (Should be called by a cron job)
   */
  async completeExpiredReservations() {
    safeLogger.info('Running expired reservation cleanup job');
    
    const now = new Date();

    const toComplete = await prisma.clusterReservation.findMany({
      where: {
        status: 'ACTIVE',
        endTime: { lt: now },
      },
    });

    if (toComplete.length > 0) {
      safeLogger.info('Found expired reservations to complete', { count: toComplete.length });
    }

    for (const reservation of toComplete) {
      await prisma.clusterReservation.update({
        where: { id: reservation.id },
        data: {
          status: 'COMPLETED',
          actualEndTime: now,
        },
      });

      await prisma.cluster.update({
        where: { id: reservation.clusterId },
        data: {
          status: 'AVAILABLE',
          assignedTo: null,
          assignedAt: null,
          assignmentEnd: null,
        },
      });

      safeLogger.info('Reservation completed', { reservationId: reservation.id });

      // Process queue
      await this.processQueueAfterRelease(reservation.clusterId);
    }

    return toComplete.length;
  }
}

// Export singleton instance
export const clusterReservationService = new ClusterReservationService();
export default clusterReservationService;