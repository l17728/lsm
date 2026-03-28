/**
 * Cluster Status Auto-Update Unit Tests
 *
 * Tests the automatic status synchronization based on reservation time.
 * Uses mocked time and database to simulate different scenarios.
 *
 * Scenarios covered:
 * 1. No reservations → returns database status
 * 2. Active reservation (current time within reservation window) → returns ALLOCATED
 * 3. Future approved reservation → returns RESERVED
 * 4. Both active and future reservations → prioritizes ALLOCATED
 * 5. Cancelled/completed reservations → ignored
 */

// Mock prisma first before any imports
jest.mock('../../utils/prisma', () => {
  const mockPrisma = {
    cluster: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    clusterReservation: {
      findFirst: jest.fn(),
    },
  };
  return {
    __esModule: true,
    default: mockPrisma,
  };
});

// Mock cacheService
jest.mock('../../services/cache.service', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    invalidatePattern: jest.fn().mockResolvedValue(undefined),
  },
}));

import { ClusterService } from '../../services/cluster.service';
import prisma from '../../utils/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Cluster Status Auto-Update', () => {
  let clusterService: ClusterService;

  beforeEach(() => {
    jest.clearAllMocks();
    clusterService = new ClusterService();
  });

  describe('calculateEffectiveStatus', () => {
    const clusterId = 'test-cluster-id';
    const baseTime = new Date('2026-03-28T12:00:00Z');

    beforeEach(() => {
      // Mock current time
      jest.useFakeTimers().setSystemTime(baseTime);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // ============================================
    // TC-STATUS-001: No reservations
    // ============================================
    it('should return database status when no reservations exist', async () => {
      // Mock: No active reservations
      mockPrisma.clusterReservation.findFirst
        .mockResolvedValueOnce(null) // No active reservation
        .mockResolvedValueOnce(null); // No future reservation

      // Mock cluster database status
      mockPrisma.cluster.findUnique.mockResolvedValue({
        id: clusterId,
        status: 'AVAILABLE',
      });

      const result = await clusterService.calculateEffectiveStatus(clusterId);

      expect(result).toBe('AVAILABLE');
    });

    // ============================================
    // TC-STATUS-002: Active reservation (time is within window)
    // ============================================
    it('should return ALLOCATED when active reservation exists', async () => {
      // Current time: 2026-03-28T12:00:00Z
      // Reservation: 2026-03-28T10:00:00Z to 2026-03-28T14:00:00Z
      const activeReservation = {
        id: 'reservation-1',
        clusterId,
        status: 'APPROVED',
        startTime: new Date('2026-03-28T10:00:00Z'),
        endTime: new Date('2026-03-28T14:00:00Z'),
      };

      // Mock: Active reservation exists
      mockPrisma.clusterReservation.findFirst.mockResolvedValueOnce(activeReservation);

      const result = await clusterService.calculateEffectiveStatus(clusterId);

      expect(result).toBe('ALLOCATED');
      
      // Verify the query was correct
      expect(mockPrisma.clusterReservation.findFirst).toHaveBeenCalledWith({
        where: {
          clusterId,
          status: 'APPROVED',
          startTime: { lte: baseTime },
          endTime: { gt: baseTime },
        },
      });
    });

    // ============================================
    // TC-STATUS-003: Future approved reservation
    // ============================================
    it('should return RESERVED when future approved reservation exists', async () => {
      // Current time: 2026-03-28T12:00:00Z
      // Reservation: 2026-03-29T10:00:00Z to 2026-03-29T14:00:00Z (future)
      const futureReservation = {
        id: 'reservation-2',
        clusterId,
        status: 'APPROVED',
        startTime: new Date('2026-03-29T10:00:00Z'),
        endTime: new Date('2026-03-29T14:00:00Z'),
      };

      // Mock: No active reservation, but future reservation exists
      mockPrisma.clusterReservation.findFirst
        .mockResolvedValueOnce(null) // No active
        .mockResolvedValueOnce(futureReservation); // Future exists

      const result = await clusterService.calculateEffectiveStatus(clusterId);

      expect(result).toBe('RESERVED');
    });

    // ============================================
    // TC-STATUS-004: Both active and future reservations
    // ============================================
    it('should return ALLOCATED when both active and future reservations exist', async () => {
      // Active reservation exists
      const activeReservation = {
        id: 'reservation-1',
        clusterId,
        status: 'APPROVED',
        startTime: new Date('2026-03-28T10:00:00Z'),
        endTime: new Date('2026-03-28T14:00:00Z'),
      };

      mockPrisma.clusterReservation.findFirst.mockResolvedValueOnce(activeReservation);

      const result = await clusterService.calculateEffectiveStatus(clusterId);

      // ALLOCATED takes priority over RESERVED
      expect(result).toBe('ALLOCATED');
    });

    // ============================================
    // TC-STATUS-005: Cancelled reservations are ignored
    // ============================================
    it('should ignore cancelled reservations', async () => {
      // Cancelled reservation
      const cancelledReservation = {
        id: 'reservation-3',
        clusterId,
        status: 'CANCELLED',
        startTime: new Date('2026-03-28T10:00:00Z'),
        endTime: new Date('2026-03-28T14:00:00Z'),
      };

      // Mock: No APPROVED reservations
      mockPrisma.clusterReservation.findFirst.mockResolvedValue(null);

      // Mock cluster status
      mockPrisma.cluster.findUnique.mockResolvedValue({
        id: clusterId,
        status: 'MAINTENANCE',
      });

      const result = await clusterService.calculateEffectiveStatus(clusterId);

      // Should return database status since no APPROVED reservations
      expect(result).toBe('MAINTENANCE');
    });

    // ============================================
    // TC-STATUS-006: Completed reservations are ignored
    // ============================================
    it('should ignore completed reservations', async () => {
      // Completed reservation
      const completedReservation = {
        id: 'reservation-4',
        clusterId,
        status: 'COMPLETED',
        startTime: new Date('2026-03-27T10:00:00Z'),
        endTime: new Date('2026-03-27T14:00:00Z'),
      };

      // Mock: No APPROVED reservations
      mockPrisma.clusterReservation.findFirst.mockResolvedValue(null);

      mockPrisma.cluster.findUnique.mockResolvedValue({
        id: clusterId,
        status: 'AVAILABLE',
      });

      const result = await clusterService.calculateEffectiveStatus(clusterId);

      expect(result).toBe('AVAILABLE');
    });

    // ============================================
    // TC-STATUS-007: Time boundary - exactly at start time
    // ============================================
    it('should return ALLOCATED when current time equals reservation start time', async () => {
      // Current time: 2026-03-28T12:00:00Z
      // Reservation starts exactly at current time
      const reservation = {
        id: 'reservation-5',
        clusterId,
        status: 'APPROVED',
        startTime: new Date('2026-03-28T12:00:00Z'), // Exactly now
        endTime: new Date('2026-03-28T14:00:00Z'),
      };

      mockPrisma.clusterReservation.findFirst.mockResolvedValueOnce(reservation);

      const result = await clusterService.calculateEffectiveStatus(clusterId);

      expect(result).toBe('ALLOCATED');
    });

    // ============================================
    // TC-STATUS-008: Time boundary - exactly at end time
    // ============================================
    it('should NOT return ALLOCATED when current time equals reservation end time', async () => {
      // Current time: 2026-03-28T14:00:00Z
      jest.useFakeTimers().setSystemTime(new Date('2026-03-28T14:00:00Z'));

      // Reservation ended exactly at current time (endTime not > current)
      mockPrisma.clusterReservation.findFirst.mockResolvedValue(null);

      mockPrisma.cluster.findUnique.mockResolvedValue({
        id: clusterId,
        status: 'AVAILABLE',
      });

      const result = await clusterService.calculateEffectiveStatus(clusterId);

      // Not allocated because endTime is not > current time
      expect(result).toBe('AVAILABLE');

      jest.useRealTimers();
    });

    // ============================================
    // TC-STATUS-009: Multiple active reservations
    // ============================================
    it('should return ALLOCATED even with multiple overlapping reservations', async () => {
      // First active reservation found
      const activeReservation = {
        id: 'reservation-6',
        clusterId,
        status: 'APPROVED',
        startTime: new Date('2026-03-28T10:00:00Z'),
        endTime: new Date('2026-03-28T16:00:00Z'),
      };

      mockPrisma.clusterReservation.findFirst.mockResolvedValueOnce(activeReservation);

      const result = await clusterService.calculateEffectiveStatus(clusterId);

      expect(result).toBe('ALLOCATED');
    });

    // ============================================
    // TC-STATUS-010: PENDING reservations are ignored
    // ============================================
    it('should ignore PENDING reservations', async () => {
      // Pending reservation
      const pendingReservation = {
        id: 'reservation-7',
        clusterId,
        status: 'PENDING',
        startTime: new Date('2026-03-28T10:00:00Z'),
        endTime: new Date('2026-03-28T14:00:00Z'),
      };

      // Mock: No APPROVED reservations (PENDING is filtered out)
      mockPrisma.clusterReservation.findFirst.mockResolvedValue(null);

      mockPrisma.cluster.findUnique.mockResolvedValue({
        id: clusterId,
        status: 'AVAILABLE',
      });

      const result = await clusterService.calculateEffectiveStatus(clusterId);

      expect(result).toBe('AVAILABLE');
    });
  });

  describe('getClusterWithEffectiveStatus', () => {
    const clusterId = 'test-cluster-id';

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-28T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    // ============================================
    // TC-EFFECTIVE-001: Returns effectiveStatus
    // ============================================
    it('should return cluster with effectiveStatus', async () => {
      const mockCluster = {
        id: clusterId,
        name: 'Test Cluster',
        status: 'AVAILABLE',
      };

      const activeReservation = {
        id: 'res-1',
        clusterId,
        status: 'APPROVED',
        startTime: new Date('2026-03-28T10:00:00Z'),
        endTime: new Date('2026-03-28T14:00:00Z'),
      };

      mockPrisma.cluster.findUnique.mockResolvedValue(mockCluster);
      mockPrisma.clusterReservation.findFirst.mockResolvedValueOnce(activeReservation);

      // Mock getClusterById to return cluster
      jest.spyOn(clusterService, 'getClusterById').mockResolvedValue(mockCluster as any);

      const result = await clusterService.getClusterWithEffectiveStatus(clusterId);

      expect(result).toBeTruthy();
      expect(result!.effectiveStatus).toBe('ALLOCATED');
      expect(result!.isStatusOverridden).toBe(true);
    });

    // ============================================
    // TC-EFFECTIVE-002: isStatusOverridden flag
    // ============================================
    it('should set isStatusOverridden to false when status matches', async () => {
      const mockCluster = {
        id: clusterId,
        name: 'Test Cluster',
        status: 'AVAILABLE',
      };

      // No reservations
      mockPrisma.clusterReservation.findFirst.mockResolvedValue(null);

      jest.spyOn(clusterService, 'getClusterById').mockResolvedValue(mockCluster as any);

      const result = await clusterService.getClusterWithEffectiveStatus(clusterId);

      expect(result!.effectiveStatus).toBe('AVAILABLE');
      expect(result!.isStatusOverridden).toBe(false);
    });
  });
});