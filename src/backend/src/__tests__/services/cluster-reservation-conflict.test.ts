/**
 * Cluster Reservation Service - Conflict Detection Tests
 * 
 * Tests for the conflict detection feature in cluster reservations.
 */

import { ClusterReservationService } from '../../services/cluster-reservation.service'
import prisma from '../../utils/prisma'

// Mock Prisma
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    cluster: {
      findUnique: jest.fn(),
    },
    clusterReservation: {
      findMany: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}))

describe('ClusterReservationService - Conflict Detection', () => {
  let service: ClusterReservationService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new ClusterReservationService()
  })

  describe('checkConflicts', () => {
    const mockClusterId = 'cluster-1'
    const startTime = new Date('2024-03-28T10:00:00Z')
    const endTime = new Date('2024-03-28T14:00:00Z')

    it('should return no conflicts when time slot is available', async () => {
      ;(prisma.clusterReservation.findMany as jest.Mock).mockResolvedValue([])

      const result = await service.checkConflicts(mockClusterId, startTime, endTime)

      expect(result.hasConflicts).toBe(false)
      expect(result.conflicts).toHaveLength(0)
    })

    it('should detect conflict when time range overlaps with existing reservation', async () => {
      const existingReservation = {
        id: 'res-1',
        clusterId: mockClusterId,
        startTime: new Date('2024-03-28T12:00:00Z'),
        endTime: new Date('2024-03-28T16:00:00Z'),
        status: 'APPROVED',
        queuePosition: null,
        userId: 'user-2',
        user: {
          id: 'user-2',
          username: 'testuser',
          displayName: 'Test User',
        },
      }

      ;(prisma.clusterReservation.findMany as jest.Mock).mockResolvedValue([existingReservation])

      const result = await service.checkConflicts(mockClusterId, startTime, endTime)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].id).toBe('res-1')
      expect(result.conflicts[0].user.username).toBe('testuser')
    })

    it('should detect multiple conflicts', async () => {
      const existingReservations = [
        {
          id: 'res-1',
          clusterId: mockClusterId,
          startTime: new Date('2024-03-28T09:00:00Z'),
          endTime: new Date('2024-03-28T11:00:00Z'),
          status: 'APPROVED',
          queuePosition: null,
          userId: 'user-1',
          user: {
            id: 'user-1',
            username: 'user1',
            displayName: 'User One',
          },
        },
        {
          id: 'res-2',
          clusterId: mockClusterId,
          startTime: new Date('2024-03-28T13:00:00Z'),
          endTime: new Date('2024-03-28T15:00:00Z'),
          status: 'PENDING',
          queuePosition: 1,
          userId: 'user-2',
          user: {
            id: 'user-2',
            username: 'user2',
            displayName: 'User Two',
          },
        },
      ]

      ;(prisma.clusterReservation.findMany as jest.Mock).mockResolvedValue(existingReservations)

      const result = await service.checkConflicts(mockClusterId, startTime, endTime)

      expect(result.hasConflicts).toBe(true)
      expect(result.conflicts).toHaveLength(2)
    })

    it('should include queue position in conflict info', async () => {
      const existingReservation = {
        id: 'res-1',
        clusterId: mockClusterId,
        startTime: new Date('2024-03-28T12:00:00Z'),
        endTime: new Date('2024-03-28T16:00:00Z'),
        status: 'PENDING',
        queuePosition: 3,
        userId: 'user-2',
        user: {
          id: 'user-2',
          username: 'testuser',
          displayName: 'Test User',
        },
      }

      ;(prisma.clusterReservation.findMany as jest.Mock).mockResolvedValue([existingReservation])

      const result = await service.checkConflicts(mockClusterId, startTime, endTime)

      expect(result.conflicts[0].queuePosition).toBe(3)
    })

    it('should only check PENDING, APPROVED, and ACTIVE reservations', async () => {
      ;(prisma.clusterReservation.findMany as jest.Mock).mockResolvedValue([])

      await service.checkConflicts(mockClusterId, startTime, endTime)

      const whereClause = (prisma.clusterReservation.findMany as jest.Mock).mock.calls[0][0].where
      
      expect(whereClause.status.in).toEqual(['PENDING', 'APPROVED', 'ACTIVE'])
    })

    it('should not detect conflict when reservations are adjacent', async () => {
      ;(prisma.clusterReservation.findMany as jest.Mock).mockResolvedValue([])

      const result = await service.checkConflicts(
        mockClusterId,
        new Date('2024-03-28T14:00:00Z'),
        new Date('2024-03-28T18:00:00Z')
      )

      expect(result.hasConflicts).toBe(false)
    })
  })
})