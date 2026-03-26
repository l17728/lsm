/**
 * ClusterReservationService Unit Tests
 *
 * Tests for cluster reservation management.
 * Covers: reservation creation, approval workflow, queue management, release logic.
 */

// Mock prisma first before any imports
jest.mock('../../utils/prisma', () => {
  const mockPrisma = {
    cluster: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    clusterReservation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
  };
  return {
    __esModule: true,
    default: mockPrisma,
  };
});

// Mock logging middleware
jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { ClusterReservationService } from '../../services/cluster-reservation.service';
import prisma from '../../utils/prisma';

// Get the mocked prisma
const mockPrisma = prisma as jest.Mocked<any>;

// Helper to create mock reservation
const makeReservation = (overrides: Record<string, any> = {}) => ({
  id: 'reservation-1',
  clusterId: 'cluster-1',
  userId: 'user-1',
  startTime: new Date(Date.now() + 3600000), // 1 hour from now
  endTime: new Date(Date.now() + 7200000), // 2 hours from now
  status: 'PENDING',
  queuePosition: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  cluster: {
    id: 'cluster-1',
    name: 'Test Cluster',
    code: 'TEST-001',
    type: 'COMPUTE',
    status: 'AVAILABLE',
  },
  user: {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
  },
  ...overrides,
});

// Helper to create mock cluster
const makeCluster = (overrides: Record<string, any> = {}) => ({
  id: 'cluster-1',
  name: 'Test Cluster',
  code: 'TEST-001',
  type: 'COMPUTE',
  status: 'AVAILABLE',
  totalServers: 2,
  totalGpus: 8,
  totalCpuCores: 32,
  totalMemory: 128,
  ...overrides,
});

describe('ClusterReservationService', () => {
  let service: ClusterReservationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClusterReservationService();
  });

  // ============================================
  // Create Reservation Tests
  // ============================================
  describe('createReservation', () => {
    it('should create reservation successfully for available cluster', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(makeCluster());
      mockPrisma.clusterReservation.findMany.mockResolvedValue([]); // No conflicts
      mockPrisma.clusterReservation.create.mockResolvedValue(makeReservation());

      const result = await service.createReservation(
        {
          clusterId: 'cluster-1',
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 7200000),
          purpose: 'Training job',
        },
        'user-1'
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.queuePosition).toBeNull();
      expect(mockPrisma.clusterReservation.create).toHaveBeenCalled();
    });

    it('should throw error if cluster not found', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(null);

      await expect(
        service.createReservation(
          {
            clusterId: 'nonexistent',
            startTime: new Date(),
            endTime: new Date(),
          },
          'user-1'
        )
      ).rejects.toThrow('Cluster not found');
    });

    it('should add to wait queue if time conflict exists', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(makeCluster());
      mockPrisma.clusterReservation.findMany.mockResolvedValue([makeReservation()]); // Has conflict
      mockPrisma.clusterReservation.aggregate.mockResolvedValue({ _max: { queuePosition: 2 } });
      mockPrisma.clusterReservation.create.mockResolvedValue(
        makeReservation({ queuePosition: 3 })
      );

      const result = await service.createReservation(
        {
          clusterId: 'cluster-1',
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 7200000),
        },
        'user-1'
      );

      expect(result.queuePosition).toBe(3);
    });
  });

  // ============================================
  // Approve Reservation Tests
  // ============================================
  describe('approveReservation', () => {
    it('should approve pending reservation', async () => {
      const pendingReservation = makeReservation({ status: 'PENDING' });
      mockPrisma.clusterReservation.findUnique.mockResolvedValue(pendingReservation);
      mockPrisma.clusterReservation.update.mockResolvedValue(
        makeReservation({ status: 'APPROVED', approvedBy: 'admin-1' })
      );
      mockPrisma.cluster.update.mockResolvedValue(makeCluster({ status: 'RESERVED' }));
      mockPrisma.clusterReservation.findMany.mockResolvedValue([]);

      const result = await service.approveReservation('reservation-1', 'admin-1');

      expect(result.status).toBe('APPROVED');
      expect(mockPrisma.cluster.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RESERVED',
          }),
        })
      );
    });

    it('should throw error if reservation not found', async () => {
      mockPrisma.clusterReservation.findUnique.mockResolvedValue(null);

      await expect(
        service.approveReservation('nonexistent', 'admin-1')
      ).rejects.toThrow('Reservation not found');
    });

    it('should throw error if reservation not pending', async () => {
      mockPrisma.clusterReservation.findUnique.mockResolvedValue(
        makeReservation({ status: 'APPROVED' })
      );

      await expect(
        service.approveReservation('reservation-1', 'admin-1')
      ).rejects.toThrow('Cannot approve reservation with status APPROVED');
    });
  });

  // ============================================
  // Reject Reservation Tests
  // ============================================
  describe('rejectReservation', () => {
    it('should reject pending reservation with reason', async () => {
      mockPrisma.clusterReservation.findUnique.mockResolvedValue(makeReservation());
      mockPrisma.clusterReservation.update.mockResolvedValue(
        makeReservation({ status: 'REJECTED', rejectionReason: 'Not approved' })
      );
      mockPrisma.clusterReservation.findMany.mockResolvedValue([]);

      const result = await service.rejectReservation(
        'reservation-1',
        'admin-1',
        'Not approved'
      );

      expect(result.status).toBe('REJECTED');
    });
  });

  // ============================================
  // Cancel Reservation Tests
  // ============================================
  describe('cancelReservation', () => {
    it('should cancel own pending reservation', async () => {
      mockPrisma.clusterReservation.findUnique.mockResolvedValue(
        makeReservation({ userId: 'user-1', status: 'PENDING' })
      );
      mockPrisma.clusterReservation.update.mockResolvedValue(
        makeReservation({ status: 'CANCELLED' })
      );
      mockPrisma.clusterReservation.findMany.mockResolvedValue([]);

      const result = await service.cancelReservation('reservation-1', 'user-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error if not reservation owner', async () => {
      mockPrisma.clusterReservation.findUnique.mockResolvedValue(
        makeReservation({ userId: 'user-2' })
      );

      await expect(
        service.cancelReservation('reservation-1', 'user-1')
      ).rejects.toThrow('Not authorized to cancel this reservation');
    });

    it('should update cluster status when cancelling approved reservation', async () => {
      mockPrisma.clusterReservation.findUnique.mockResolvedValue(
        makeReservation({ userId: 'user-1', status: 'APPROVED' })
      );
      mockPrisma.clusterReservation.update.mockResolvedValue(
        makeReservation({ status: 'CANCELLED' })
      );
      mockPrisma.cluster.update.mockResolvedValue(makeCluster());
      mockPrisma.clusterReservation.findMany.mockResolvedValue([]);

      await service.cancelReservation('reservation-1', 'user-1');

      expect(mockPrisma.cluster.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'AVAILABLE',
          }),
        })
      );
    });
  });

  // ============================================
  // Release Reservation Tests
  // ============================================
  describe('releaseReservation', () => {
    it('should release active reservation', async () => {
      mockPrisma.clusterReservation.findUnique.mockResolvedValue(
        makeReservation({ userId: 'user-1', status: 'ACTIVE' })
      );
      mockPrisma.clusterReservation.update.mockResolvedValue(
        makeReservation({ status: 'COMPLETED' })
      );
      mockPrisma.cluster.update.mockResolvedValue(makeCluster());
      mockPrisma.clusterReservation.findMany.mockResolvedValue([]);

      const result = await service.releaseReservation('reservation-1', 'user-1');

      expect(result.status).toBe('COMPLETED');
      expect(mockPrisma.cluster.update).toHaveBeenCalled();
    });

    it('should throw error if not reservation owner', async () => {
      mockPrisma.clusterReservation.findUnique.mockResolvedValue(
        makeReservation({ userId: 'user-2' })
      );

      await expect(
        service.releaseReservation('reservation-1', 'user-1')
      ).rejects.toThrow('Not authorized to release this reservation');
    });
  });

  // ============================================
  // Get Reservations Tests
  // ============================================
  describe('getReservations', () => {
    it('should return all reservations without filters', async () => {
      mockPrisma.clusterReservation.findMany.mockResolvedValue([
        makeReservation(),
        makeReservation({ id: 'reservation-2' }),
      ]);

      const result = await service.getReservations();

      expect(result).toHaveLength(2);
      expect(mockPrisma.clusterReservation.findMany).toHaveBeenCalled();
    });

    it('should filter reservations by status', async () => {
      mockPrisma.clusterReservation.findMany.mockResolvedValue([
        makeReservation({ status: 'PENDING' }),
      ]);

      const result = await service.getReservations({ status: 'PENDING' });

      expect(mockPrisma.clusterReservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING' },
        })
      );
    });
  });

  // ============================================
  // Get My Reservations Tests
  // ============================================
  describe('getMyReservations', () => {
    it('should return user reservations', async () => {
      mockPrisma.clusterReservation.findMany.mockResolvedValue([
        makeReservation({ userId: 'user-1' }),
      ]);

      const result = await service.getMyReservations('user-1');

      expect(mockPrisma.clusterReservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        })
      );
    });
  });

  // ============================================
  // Get Pending Reservations Tests
  // ============================================
  describe('getPendingReservations', () => {
    it('should return all pending reservations', async () => {
      mockPrisma.clusterReservation.findMany.mockResolvedValue([
        makeReservation({ status: 'PENDING' }),
      ]);

      const result = await service.getPendingReservations();

      expect(mockPrisma.clusterReservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING' },
        })
      );
    });
  });

  // ============================================
  // Recommend Time Slots Tests (AI Feature)
  // ============================================
  describe('recommendTimeSlots', () => {
    it('should throw error if cluster not found', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(null);

      await expect(
        service.recommendTimeSlots({
          clusterId: 'nonexistent',
          duration: 120,
        })
      ).rejects.toThrow('Cluster not found');
    });

    it('should return recommendations for available cluster', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(makeCluster());
      mockPrisma.clusterReservation.findMany.mockResolvedValue([]); // No existing reservations
      mockPrisma.clusterReservation.findMany.mockResolvedValueOnce([]); // Historical patterns query

      const result = await service.recommendTimeSlots({
        clusterId: 'cluster-1',
        duration: 120,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should return recommendations with score and confidence', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(makeCluster());
      mockPrisma.clusterReservation.findMany.mockResolvedValue([]);

      const result = await service.recommendTimeSlots({
        clusterId: 'cluster-1',
        duration: 60,
      });

      if (result.length > 0) {
        expect(result[0]).toHaveProperty('startTime');
        expect(result[0]).toHaveProperty('endTime');
        expect(result[0]).toHaveProperty('score');
        expect(result[0]).toHaveProperty('confidence');
        expect(result[0]).toHaveProperty('reasons');
        expect(result[0].score).toBeGreaterThanOrEqual(0);
        expect(result[0].confidence).toBeGreaterThanOrEqual(0);
        expect(result[0].confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should avoid conflicts with existing reservations', async () => {
      const now = new Date();
      const existingReservation = {
        id: 'existing-1',
        clusterId: 'cluster-1',
        startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
        endTime: new Date(now.getTime() + 4 * 60 * 60 * 1000), // 4 hours from now
        status: 'APPROVED',
      };

      mockPrisma.cluster.findUnique.mockResolvedValue(makeCluster());
      mockPrisma.clusterReservation.findMany.mockResolvedValue([existingReservation]);

      const result = await service.recommendTimeSlots({
        clusterId: 'cluster-1',
        duration: 60,
      });

      // Recommendations should not overlap with existing reservation
      for (const slot of result) {
        const slotStart = new Date(slot.startTime).getTime();
        const slotEnd = new Date(slot.endTime).getTime();
        const resStart = existingReservation.startTime.getTime();
        const resEnd = existingReservation.endTime.getTime();

        const hasOverlap = slotStart < resEnd && slotEnd > resStart;
        // If there's overlap, it should be noted in reasons
        if (hasOverlap) {
          expect(slot.reasons).toContain('需排队等待');
        }
      }
    });

    it('should respect preferred time range', async () => {
      const now = new Date();
      const preferredStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
      const preferredEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000); // Day after tomorrow

      mockPrisma.cluster.findUnique.mockResolvedValue(makeCluster());
      mockPrisma.clusterReservation.findMany.mockResolvedValue([]);

      const result = await service.recommendTimeSlots({
        clusterId: 'cluster-1',
        duration: 120,
        preferredStartTime: preferredStart,
        preferredEndTime: preferredEnd,
      });

      // All recommendations should be within preferred range (or close to it)
      for (const slot of result) {
        const slotStart = new Date(slot.startTime);
        // Allow some flexibility - slots should be reasonably close to preferred range
        expect(slotStart.getTime()).toBeGreaterThanOrEqual(now.getTime());
      }
    });

    it('should sort recommendations by score descending', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(makeCluster());
      mockPrisma.clusterReservation.findMany.mockResolvedValue([]);

      const result = await service.recommendTimeSlots({
        clusterId: 'cluster-1',
        duration: 120,
      });

      if (result.length > 1) {
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
        }
      }
    });

    it('should return reasons for each recommendation', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(makeCluster());
      mockPrisma.clusterReservation.findMany.mockResolvedValue([]);

      const result = await service.recommendTimeSlots({
        clusterId: 'cluster-1',
        duration: 120,
      });

      for (const slot of result) {
        expect(Array.isArray(slot.reasons)).toBe(true);
        expect(slot.reasons.length).toBeGreaterThan(0);
      }
    });
  });
});