/**
 * ReservationService Unit Tests
 *
 * Tests for core reservation operations: create, query, cancel, conflict detection.
 * Uses mocked Prisma and cacheService.
 */

// Mock prisma with all needed models
jest.mock('../../utils/prisma', () => ({
  reservation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  gpuReservation: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
  },
  server: {
    findMany: jest.fn(),
  },
  gpu: {
    findMany: jest.fn(),
  },
  resourceQuota: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
}));

// Mock @prisma/client enums
jest.mock('@prisma/client', () => ({
  reservation_status: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED',
  },
  server_status: {
    ONLINE: 'ONLINE',
    OFFLINE: 'OFFLINE',
    MAINTENANCE: 'MAINTENANCE',
  },
  user_role: {
    USER: 'USER',
    MANAGER: 'MANAGER',
    ADMIN: 'ADMIN',
  },
  approval_status: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
  },
  slot_status: {
    AVAILABLE: 'AVAILABLE',
    RESERVED: 'RESERVED',
    BLOCKED: 'BLOCKED',
  },
}));

// Mock cache service
jest.mock('../../services/cache.service', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    invalidatePattern: jest.fn().mockResolvedValue(1),
  },
}));

import { ReservationService } from '../../services/reservation.service';
import prisma from '../../utils/prisma';

const mockServer = {
  id: 'server-1',
  name: 'GPU-Server-01',
  ipAddress: '192.168.1.1',
  status: 'ONLINE',
  gpus: [
    { id: 'gpu-1', model: 'NVIDIA A100', memory: 40, allocated: false },
    { id: 'gpu-2', model: 'NVIDIA A100', memory: 40, allocated: false },
  ],
};

describe('ReservationService', () => {
  let service: ReservationService;

  const futureStart = new Date(Date.now() + 2 * 3600 * 1000);  // 2 hours from now
  const futureEnd = new Date(Date.now() + 6 * 3600 * 1000);    // 6 hours from now

  beforeEach(() => {
    service = new ReservationService();
    jest.clearAllMocks();
    // Make $transaction execute the callback with the prisma mock as transaction client
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(prisma));
  });

  // ==================== getReservations ====================

  describe('getReservations', () => {
    it('should return paginated reservations', async () => {
      const mockReservations = [
        {
          id: 'res-1',
          title: 'Training Run',
          status: 'APPROVED',
          gpuReservations: [],
          server: { id: 'server-1', name: 'GPU-Server-01' },
          user: { id: 'user-1', username: 'testuser', email: 'test@example.com' },
        },
      ];

      (prisma.reservation.count as jest.Mock).mockResolvedValue(1);
      (prisma.reservation.findMany as jest.Mock).mockResolvedValue(mockReservations);

      const result = await service.getReservations({});

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should apply userId filter', async () => {
      (prisma.reservation.count as jest.Mock).mockResolvedValue(0);
      (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);

      await service.getReservations({ userId: 'user-1' });

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        })
      );
    });

    it('should apply status filter', async () => {
      (prisma.reservation.count as jest.Mock).mockResolvedValue(0);
      (prisma.reservation.findMany as jest.Mock).mockResolvedValue([]);

      await service.getReservations({ status: 'APPROVED' as any });

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'APPROVED' }),
        })
      );
    });
  });

  // ==================== getReservationById ====================

  describe('getReservationById', () => {
    it('should return reservation when found', async () => {
      const mockReservation = {
        id: 'res-1',
        title: 'Training Run',
        status: 'APPROVED',
        gpuReservations: [],
      };
      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(mockReservation);

      const result = await service.getReservationById('res-1');

      expect(result).toBeDefined();
      expect(prisma.reservation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'res-1' } })
      );
    });

    it('should throw when reservation not found', async () => {
      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getReservationById('non-existent')).rejects.toThrow();
    });
  });

  // ==================== cancelReservation ====================

  describe('cancelReservation', () => {
    it('should cancel reservation when user is the owner', async () => {
      const mockReservation = {
        id: 'res-1',
        userId: 'user-1',
        serverId: 'server-1',
        status: 'APPROVED',
        gpuReservations: [],
      };
      const cancelledReservation = { ...mockReservation, status: 'CANCELLED' };

      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(mockReservation);
      (prisma.reservation.update as jest.Mock).mockResolvedValue(cancelledReservation);
      (prisma.gpuReservation.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await service.cancelReservation('res-1', 'user-1');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-1' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        })
      );
    });

    it('should throw error when reservation not found', async () => {
      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.cancelReservation('non-existent', 'user-1')).rejects.toThrow();
    });

    it('should throw error when user is not the owner and not admin', async () => {
      const mockReservation = {
        id: 'res-1',
        userId: 'other-user',
        status: 'APPROVED',
      };
      (prisma.reservation.findUnique as jest.Mock).mockResolvedValue(mockReservation);

      await expect(service.cancelReservation('res-1', 'user-1')).rejects.toThrow();
    });
  });

  // ==================== detectConflicts ====================

  describe('detectConflicts', () => {
    it('should return no conflict when no overlapping reservations exist', async () => {
      (prisma.gpuReservation.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.detectConflicts(
        'server-1',
        futureStart,
        futureEnd,
        ['gpu-1']
      );

      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect conflict when GPU is already reserved in overlapping time', async () => {
      const conflictingReservation = {
        id: 'res-existing',
        title: 'Existing Training',
        startTime: new Date(Date.now() + 3 * 3600 * 1000),
        endTime: new Date(Date.now() + 7 * 3600 * 1000),
        gpuCount: 1,
        // detectConflicts calls prisma.reservation.findMany with include.gpuReservations
        gpuReservations: [{ gpuId: 'gpu-1' }],
      };

      (prisma.reservation.findMany as jest.Mock).mockResolvedValue([conflictingReservation]);

      const result = await service.detectConflicts(
        'server-1',
        futureStart,
        futureEnd,
        ['gpu-1']
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });
});
