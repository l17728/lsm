import { ResourceQuotaService, QuotaType, CreateQuotaDto } from '../../services/resource-quota.service';
import prisma from '../../utils/prisma';

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const makeService = () => new ResourceQuotaService();

const mockQuota = {
  id: 'quota-1',
  teamId: 'team-1',
  quotaType: QuotaType.TEAM,
  targetId: null,
  maxServers: 5,
  maxServerHours: null,
  maxGpus: 4,
  maxGpuHours: 100,
  maxReservationDays: null,
  maxAdvanceDays: null,
  maxConcurrent: 10,
  effectiveFrom: null,
  effectiveUntil: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ResourceQuotaService', () => {
  let service: ResourceQuotaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = makeService();
  });

  describe('upsertQuota', () => {
    it('should create a new quota when none exists', async () => {
      (prisma.resourceQuota.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.resourceQuota.create as jest.Mock).mockResolvedValue(mockQuota);

      const dto: CreateQuotaDto = {
        teamId: 'team-1',
        quotaType: QuotaType.TEAM,
        maxServers: 5,
        maxGpus: 4,
        maxGpuHours: 100,
        maxConcurrent: 10,
      };

      const result = await service.upsertQuota(dto);

      expect(prisma.resourceQuota.create as jest.Mock).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('quota-1');
      expect(result.maxServers).toBe(5);
    });

    it('should update existing quota when one already exists', async () => {
      (prisma.resourceQuota.findFirst as jest.Mock).mockResolvedValue(mockQuota);
      const updated = { ...mockQuota, maxGpus: 8 };
      (prisma.resourceQuota.update as jest.Mock).mockResolvedValue(updated);

      const dto: CreateQuotaDto = {
        teamId: 'team-1',
        quotaType: QuotaType.TEAM,
        maxGpus: 8,
      };

      const result = await service.upsertQuota(dto);

      expect(prisma.resourceQuota.update as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'quota-1' } })
      );
      expect(prisma.resourceQuota.create as jest.Mock).not.toHaveBeenCalled();
      expect(result.maxGpus).toBe(8);
    });
  });

  describe('getTeamQuotas', () => {
    it('should return all quotas for a team', async () => {
      (prisma.resourceQuota.findMany as jest.Mock).mockResolvedValue([mockQuota]);

      const result = await service.getTeamQuotas('team-1');

      expect(prisma.resourceQuota.findMany as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teamId: 'team-1' } })
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('quota-1');
    });
  });

  describe('updateQuota', () => {
    it('should update and return the updated quota', async () => {
      const updated = { ...mockQuota, maxConcurrent: 20 };
      (prisma.resourceQuota.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateQuota('quota-1', { maxConcurrent: 20 });

      expect(prisma.resourceQuota.update as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'quota-1' }, data: { maxConcurrent: 20 } })
      );
      expect(result.maxConcurrent).toBe(20);
    });

    it('should throw when update fails (record not found)', async () => {
      (prisma.resourceQuota.update as jest.Mock).mockRejectedValue(
        new Error('Record to update not found')
      );

      await expect(service.updateQuota('nonexistent', { maxServers: 1 })).rejects.toThrow(
        'Record to update not found'
      );
    });
  });

  describe('checkConcurrentLimit', () => {
    it('should return available=true when no quota is set', async () => {
      (prisma.resourceQuota.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.checkConcurrentLimit('team-1', 5);

      expect(result.available).toBe(true);
      expect(result.maxConcurrent).toBeNull();
    });

    it('should return available=false when required exceeds maxConcurrent', async () => {
      (prisma.resourceQuota.findFirst as jest.Mock).mockResolvedValue({
        ...mockQuota,
        maxConcurrent: 3,
      });

      const result = await service.checkConcurrentLimit('team-1', 5);

      expect(result.available).toBe(false);
      expect(result.maxConcurrent).toBe(3);
    });

    it('should return available=true when within limit', async () => {
      (prisma.resourceQuota.findFirst as jest.Mock).mockResolvedValue({
        ...mockQuota,
        maxConcurrent: 10,
      });

      const result = await service.checkConcurrentLimit('team-1', 5);

      expect(result.available).toBe(true);
      expect(result.maxConcurrent).toBe(10);
    });
  });
});
