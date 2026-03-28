import prisma from '../utils/prisma';
import { quota_type as QuotaType } from '@prisma/client';

export { QuotaType };

export interface CreateQuotaDto {
  teamId?: string;
  quotaType: QuotaType;
  targetId?: string;
  maxServers?: number;
  maxServerHours?: number;
  maxGpus?: number;
  maxGpuHours?: number;
  maxReservationDays?: number;
  maxAdvanceDays?: number;
  maxConcurrent?: number;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  metadata?: Record<string, any>;
}

export interface UpdateQuotaDto {
  maxServers?: number;
  maxServerHours?: number;
  maxGpus?: number;
  maxGpuHours?: number;
  maxReservationDays?: number;
  maxAdvanceDays?: number;
  maxConcurrent?: number;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  metadata?: Record<string, any>;
}

/**
 * Resource Quota Service
 * Handles team resource quota management
 */
export class ResourceQuotaService {
  /**
   * Create or update quota
   */
  async upsertQuota(data: CreateQuotaDto) {
    const existing = await prisma.resourceQuota.findFirst({
      where: {
        teamId: data.teamId,
        quotaType: data.quotaType,
        targetId: data.targetId,
      },
    });

    if (existing) {
      return prisma.resourceQuota.update({
        where: { id: existing.id },
        data: {
          maxServers: data.maxServers,
          maxServerHours: data.maxServerHours,
          maxGpus: data.maxGpus,
          maxGpuHours: data.maxGpuHours,
          maxReservationDays: data.maxReservationDays,
          maxAdvanceDays: data.maxAdvanceDays,
          maxConcurrent: data.maxConcurrent,
          effectiveFrom: data.effectiveFrom,
          effectiveUntil: data.effectiveUntil,
          metadata: data.metadata,
        },
      });
    }

    const quota = await prisma.resourceQuota.create({
      data: {
        teamId: data.teamId,
        quotaType: data.quotaType,
        targetId: data.targetId,
        maxServers: data.maxServers,
        maxServerHours: data.maxServerHours,
        maxGpus: data.maxGpus,
        maxGpuHours: data.maxGpuHours,
        maxReservationDays: data.maxReservationDays,
        maxAdvanceDays: data.maxAdvanceDays,
        maxConcurrent: data.maxConcurrent,
        effectiveFrom: data.effectiveFrom,
        effectiveUntil: data.effectiveUntil,
        metadata: data.metadata || {},
      },
    });

    console.log(`[Quota] Created quota ${data.quotaType} for team ${data.teamId}`);
    return quota;
  }

  /**
   * Get quota by ID
   */
  async getQuotaById(quotaId: string) {
    return prisma.resourceQuota.findUnique({
      where: { id: quotaId },
    });
  }

  /**
   * Get team quotas
   */
  async getTeamQuotas(teamId: string) {
    return prisma.resourceQuota.findMany({
      where: { teamId },
      orderBy: { quotaType: 'asc' },
    });
  }

  /**
   * Get specific quota type for team
   */
  async getTeamQuotaByType(teamId: string, quotaType: QuotaType) {
    return prisma.resourceQuota.findFirst({
      where: {
        teamId,
        quotaType,
      },
    });
  }

  /**
   * Update quota
   */
  async updateQuota(quotaId: string, data: UpdateQuotaDto) {
    const quota = await prisma.resourceQuota.update({
      where: { id: quotaId },
      data,
    });

    console.log(`[Quota] Updated quota ${quota.quotaType} (${quotaId})`);
    return quota;
  }

  /**
   * Delete quota
   */
  async deleteQuota(quotaId: string) {
    await prisma.resourceQuota.delete({
      where: { id: quotaId },
    });

    console.log(`[Quota] Deleted quota ${quotaId}`);
  }

  /**
   * Check if concurrent limit is available
   */
  async checkConcurrentLimit(teamId: string, required: number = 1): Promise<{
    available: boolean;
    maxConcurrent: number | null;
  }> {
    const quota = await this.getTeamQuotaByType(teamId, QuotaType.TEAM);

    if (!quota || quota.maxConcurrent === null) {
      return { available: true, maxConcurrent: null };
    }

    return {
      available: required <= quota.maxConcurrent,
      maxConcurrent: quota.maxConcurrent,
    };
  }

  /**
   * Get quota usage summary for team
   */
  async getQuotaSummary(teamId: string) {
    const quotas = await this.getTeamQuotas(teamId);

    return quotas.map((quota) => ({
      quotaType: quota.quotaType,
      maxServers: quota.maxServers,
      maxServerHours: quota.maxServerHours,
      maxGpus: quota.maxGpus,
      maxGpuHours: quota.maxGpuHours,
      maxReservationDays: quota.maxReservationDays,
      maxAdvanceDays: quota.maxAdvanceDays,
      maxConcurrent: quota.maxConcurrent,
    }));
  }

  /**
   * Set default quotas for new team
   */
  async setDefaultQuotas(teamId: string) {
    const defaultQuota = await this.upsertQuota({
      teamId,
      quotaType: QuotaType.TEAM,
      maxServers: 5,
      maxGpus: 4,
      maxGpuHours: 100,
      maxConcurrent: 10,
    });

    console.log(`[Quota] Set default quotas for team ${teamId}`);
    return this.getTeamQuotas(teamId);
  }

  /**
   * Bulk update quotas
   */
  async bulkUpdateQuotas(
    teamId: string,
    quotas: Array<{
      quotaType: QuotaType;
      maxServers?: number;
      maxGpus?: number;
      maxConcurrent?: number;
    }>
  ) {
    const results = [];

    for (const quota of quotas) {
      const result = await this.upsertQuota({
        teamId,
        quotaType: quota.quotaType,
        maxServers: quota.maxServers,
        maxGpus: quota.maxGpus,
        maxConcurrent: quota.maxConcurrent,
      });
      results.push(result);
    }

    console.log(`[Quota] Bulk updated ${results.length} quotas for team ${teamId}`);
    return results;
  }
}

export const resourceQuotaService = new ResourceQuotaService();
export default resourceQuotaService;