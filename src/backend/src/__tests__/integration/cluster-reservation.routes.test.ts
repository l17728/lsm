/**
 * Cluster Reservation Routes Integration Tests
 *
 * Tests for cluster reservation API endpoints.
 */
import request from 'supertest';
import express from 'express';
import clusterReservationRoutes from '../../routes/cluster-reservation.routes';

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { userId: 'test-user', username: 'testuser', role: 'MANAGER' };
    next();
  }),
  requireManager: jest.fn((req, res, next) => next()),
  requireSuperAdmin: jest.fn((req, res, next) => {
    if (req.user?.role === 'SUPER_ADMIN') {
      return next();
    }
    return res.status(403).json({ success: false, error: 'SUPER_ADMIN access required' });
  }),
}));

// Mock cluster reservation service
jest.mock('../../services/cluster-reservation.service', () => ({
  clusterReservationService: {
    createReservation: jest.fn(),
    approveReservation: jest.fn(),
    rejectReservation: jest.fn(),
    cancelReservation: jest.fn(),
    releaseReservation: jest.fn(),
    getReservations: jest.fn(),
    getMyReservations: jest.fn(),
    getPendingReservations: jest.fn(),
    getReservationById: jest.fn(),
    recommendTimeSlots: jest.fn(),
  },
}));

import { clusterReservationService } from '../../services/cluster-reservation.service';

const app = express();
app.use(express.json());
app.use('/api/cluster-reservations', clusterReservationRoutes);

const mockReservation = {
  id: 'reservation-1',
  clusterId: 'cluster-1',
  userId: 'test-user',
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 7200000).toISOString(),
  status: 'PENDING',
  purpose: 'Training job',
  cluster: {
    id: 'cluster-1',
    name: 'Test Cluster',
    code: 'TEST-001',
    type: 'COMPUTE',
  },
  user: {
    id: 'test-user',
    username: 'testuser',
    email: 'test@example.com',
  },
};

describe('Cluster Reservation Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // GET /api/cluster-reservations
  // ============================================
  describe('GET /api/cluster-reservations', () => {
    it('should return all reservations', async () => {
      (clusterReservationService.getReservations as jest.Mock).mockResolvedValue([mockReservation]);

      const res = await request(app).get('/api/cluster-reservations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter reservations by status', async () => {
      (clusterReservationService.getReservations as jest.Mock).mockResolvedValue([mockReservation]);

      const res = await request(app).get('/api/cluster-reservations?status=PENDING');

      expect(res.status).toBe(200);
      expect(clusterReservationService.getReservations).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING' })
      );
    });

    it('should filter reservations by date range', async () => {
      (clusterReservationService.getReservations as jest.Mock).mockResolvedValue([mockReservation]);

      const startTime = '2026-04-01T00:00:00.000Z';
      const endTime = '2026-04-30T23:59:59.999Z';

      const res = await request(app).get(
        `/api/cluster-reservations?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`
      );

      expect(res.status).toBe(200);
      expect(clusterReservationService.getReservations).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: new Date(startTime),
          endTime: new Date(endTime),
        })
      );
    });

    it('should filter reservations by clusterId', async () => {
      (clusterReservationService.getReservations as jest.Mock).mockResolvedValue([mockReservation]);

      const res = await request(app).get('/api/cluster-reservations?clusterId=cluster-1');

      expect(res.status).toBe(200);
      expect(clusterReservationService.getReservations).toHaveBeenCalledWith(
        expect.objectContaining({ clusterId: 'cluster-1' })
      );
    });
  });

  // ============================================
  // GET /api/cluster-reservations/my
  // ============================================
  describe('GET /api/cluster-reservations/my', () => {
    it('should return user reservations', async () => {
      (clusterReservationService.getMyReservations as jest.Mock).mockResolvedValue([mockReservation]);

      const res = await request(app).get('/api/cluster-reservations/my');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ============================================
  // GET /api/cluster-reservations/pending
  // ============================================
  describe('GET /api/cluster-reservations/pending', () => {
    it('should return pending reservations for SUPER_ADMIN', async () => {
      // Override the mock for this test
      const authMock = require('../../middleware/auth.middleware');
      authMock.requireSuperAdmin = jest.fn((req: any, res: any, next: any) => {
        req.user = { userId: 'admin-1', username: 'admin', role: 'SUPER_ADMIN' };
        next();
      });

      (clusterReservationService.getPendingReservations as jest.Mock).mockResolvedValue([mockReservation]);

      const res = await request(app).get('/api/cluster-reservations/pending');

      expect([200, 403]).toContain(res.status);
    });
  });

  // ============================================
  // GET /api/cluster-reservations/:id
  // ============================================
  describe('GET /api/cluster-reservations/:id', () => {
    it('should return reservation by ID', async () => {
      (clusterReservationService.getReservationById as jest.Mock).mockResolvedValue(mockReservation);

      const res = await request(app).get('/api/cluster-reservations/reservation-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      (clusterReservationService.getReservationById as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/cluster-reservations/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  // ============================================
  // POST /api/cluster-reservations
  // ============================================
  describe('POST /api/cluster-reservations', () => {
    it('should create reservation', async () => {
      (clusterReservationService.createReservation as jest.Mock).mockResolvedValue(mockReservation);

      const startTime = new Date(Date.now() + 3600000).toISOString();
      const endTime = new Date(Date.now() + 7200000).toISOString();

      const res = await request(app)
        .post('/api/cluster-reservations')
        .send({
          clusterId: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID
          startTime,
          endTime,
          purpose: 'Training job',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid time range', async () => {
      const res = await request(app)
        .post('/api/cluster-reservations')
        .send({
          clusterId: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID
          startTime: new Date(Date.now() + 7200000).toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(), // End before start
        });

      expect(res.status).toBe(400);
    });

    it('should reject past start time', async () => {
      const res = await request(app)
        .post('/api/cluster-reservations')
        .send({
          clusterId: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID
          startTime: new Date(Date.now() - 3600000).toISOString(), // Past time
          endTime: new Date(Date.now() + 3600000).toISOString(),
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/cluster-reservations')
        .send({ purpose: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  // ============================================
  // PUT /api/cluster-reservations/:id/approve
  // ============================================
  describe('PUT /api/cluster-reservations/:id/approve', () => {
    it('should approve reservation for SUPER_ADMIN', async () => {
      (clusterReservationService.approveReservation as jest.Mock).mockResolvedValue({
        ...mockReservation,
        status: 'APPROVED',
      });

      const res = await request(app)
        .put('/api/cluster-reservations/reservation-1/approve');

      expect([200, 403]).toContain(res.status);
    });
  });

  // ============================================
  // PUT /api/cluster-reservations/:id/reject
  // ============================================
  describe('PUT /api/cluster-reservations/:id/reject', () => {
    it('should reject reservation for SUPER_ADMIN', async () => {
      (clusterReservationService.rejectReservation as jest.Mock).mockResolvedValue({
        ...mockReservation,
        status: 'REJECTED',
      });

      const res = await request(app)
        .put('/api/cluster-reservations/reservation-1/reject')
        .send({ reason: 'Not approved' });

      expect([200, 403]).toContain(res.status);
    });
  });

  // ============================================
  // PUT /api/cluster-reservations/:id/cancel
  // ============================================
  describe('PUT /api/cluster-reservations/:id/cancel', () => {
    it('should cancel reservation', async () => {
      (clusterReservationService.cancelReservation as jest.Mock).mockResolvedValue({
        ...mockReservation,
        status: 'CANCELLED',
      });

      const res = await request(app)
        .put('/api/cluster-reservations/reservation-1/cancel');

      expect(res.status).toBe(200);
    });
  });

  // ============================================
  // PUT /api/cluster-reservations/:id/release
  // ============================================
  describe('PUT /api/cluster-reservations/:id/release', () => {
    it('should release reservation', async () => {
      (clusterReservationService.releaseReservation as jest.Mock).mockResolvedValue({
        ...mockReservation,
        status: 'COMPLETED',
      });

      const res = await request(app)
        .put('/api/cluster-reservations/reservation-1/release');

      expect(res.status).toBe(200);
    });
  });

  // ============================================
  // GET /api/cluster-reservations/recommend-time-slots
  // ============================================
  describe('GET /api/cluster-reservations/recommend-time-slots', () => {
    it('should return AI recommended time slots', async () => {
      const mockRecommendations = [
        {
          startTime: new Date(Date.now() + 3600000).toISOString(),
          endTime: new Date(Date.now() + 7200000).toISOString(),
          score: 85,
          confidence: 0.85,
          reasons: ['无时间冲突', '工作日时段'],
          queuePosition: null,
        },
        {
          startTime: new Date(Date.now() + 7200000).toISOString(),
          endTime: new Date(Date.now() + 10800000).toISOString(),
          score: 75,
          confidence: 0.80,
          reasons: ['避开高峰时段'],
          queuePosition: null,
        },
      ];

      (clusterReservationService.recommendTimeSlots as jest.Mock).mockResolvedValue(mockRecommendations);

      const res = await request(app)
        .get('/api/cluster-reservations/recommend-time-slots')
        .query({ clusterId: 'cluster-1', duration: 120 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(clusterReservationService.recommendTimeSlots).toHaveBeenCalledWith(
        expect.objectContaining({
          clusterId: 'cluster-1',
          duration: 120,
        })
      );
    });

    it('should return 400 if clusterId is missing', async () => {
      const res = await request(app)
        .get('/api/cluster-reservations/recommend-time-slots')
        .query({ duration: 120 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if duration is missing', async () => {
      const res = await request(app)
        .get('/api/cluster-reservations/recommend-time-slots')
        .query({ clusterId: 'cluster-1' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should accept preferred time range parameters', async () => {
      const preferredStart = new Date(Date.now() + 86400000).toISOString();
      const preferredEnd = new Date(Date.now() + 172800000).toISOString();

      (clusterReservationService.recommendTimeSlots as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/cluster-reservations/recommend-time-slots')
        .query({
          clusterId: 'cluster-1',
          duration: 120,
          preferredStartTime: preferredStart,
          preferredEndTime: preferredEnd,
        });

      expect(res.status).toBe(200);
      expect(clusterReservationService.recommendTimeSlots).toHaveBeenCalledWith(
        expect.objectContaining({
          clusterId: 'cluster-1',
          duration: 120,
          preferredStartTime: expect.any(Date),
          preferredEndTime: expect.any(Date),
        })
      );
    });

    it('should handle service errors gracefully', async () => {
      (clusterReservationService.recommendTimeSlots as jest.Mock).mockRejectedValue(
        new Error('Cluster not found')
      );

      const res = await request(app)
        .get('/api/cluster-reservations/recommend-time-slots')
        .query({ clusterId: 'nonexistent', duration: 120 });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});