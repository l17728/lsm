/**
 * Reservation Routes Integration Tests
 *
 * Tests for reservation management API endpoints.
 * Note: reservation.routes.ts uses inline mock data (no reservationService calls),
 * so tests focus on validation logic, auth control, and response structure.
 */

import request from 'supertest';
import express from 'express';
import reservationRoutes from '../../routes/reservation.routes';

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    // Don't overwrite user pre-set by managerApp instance
    if (!req.user) {
      req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    }
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.user?.role === 'ADMIN') {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Admin access required' });
    }
  },
  requireManager: (req: any, res: any, next: any) => {
    if (['ADMIN', 'MANAGER'].includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Manager access required' });
    }
  },
  AuthRequest: {},
}));

// Mock validation middleware - pass through the data
jest.mock('../../middleware/validation.middleware', () => ({
  validate: (_schema: any, data: any) => data,
}));

// Helper: create a time string N hours from now
const hoursFromNow = (hours: number): string => {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
};

const validReservationId = '550e8400-e29b-41d4-a716-446655440000';

// App with USER role (default)
const app = express();
app.use(express.json());
app.use('/api/reservations', reservationRoutes);

// App with MANAGER role
const managerApp = express();
managerApp.use(express.json());
managerApp.use((req: any, _res: any, next: any) => {
  req.user = { userId: 'manager-1', username: 'manager', role: 'MANAGER' };
  next();
});
managerApp.use('/api/reservations', reservationRoutes);

describe('Reservation Routes', () => {
  // ==================== POST / ====================

  describe('POST /api/reservations', () => {
    it('should create reservation with auto-approval for short duration', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .send({
          title: 'Model Training',
          startTime: hoursFromNow(2),
          endTime: hoursFromNow(6),
          gpuCount: 2,
          priority: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('APPROVED');
      expect(response.body.data.requiresApproval).toBe(false);
    });

    it('should create PENDING reservation for duration > 48 hours', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .send({
          title: 'Long Training Run',
          startTime: hoursFromNow(2),
          endTime: hoursFromNow(60), // > 48 hours
          gpuCount: 2,
          priority: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PENDING');
      expect(response.body.data.requiresApproval).toBe(true);
    });

    it('should create PENDING reservation when gpuCount > 4', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .send({
          title: 'Large GPU Job',
          startTime: hoursFromNow(2),
          endTime: hoursFromNow(10),
          gpuCount: 5,
          priority: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.status).toBe('PENDING');
    });

    it('should return 400 when end time is before start time', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .send({
          title: 'Invalid Time',
          startTime: hoursFromNow(6),
          endTime: hoursFromNow(2), // end before start
          gpuCount: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('RES_004');
    });

    it('should return 400 when duration < 30 minutes', async () => {
      const now = Date.now();
      const response = await request(app)
        .post('/api/reservations')
        .send({
          title: 'Too Short',
          startTime: new Date(now + 3600000).toISOString(),
          endTime: new Date(now + 3600000 + 20 * 60000).toISOString(), // 20 minutes
          gpuCount: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('RES_005');
    });

    it('should return 400 when duration > 7 days', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .send({
          title: 'Too Long',
          startTime: hoursFromNow(2),
          endTime: hoursFromNow(2 + 8 * 24), // 8 days
          gpuCount: 1,
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('RES_005');
    });
  });

  // ==================== GET / ====================

  describe('GET /api/reservations', () => {
    it('should return paginated reservations', async () => {
      const response = await request(app).get('/api/reservations');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('page');
    });

    it('should filter reservations by status', async () => {
      const response = await request(app).get('/api/reservations?status=APPROVED');

      expect(response.status).toBe(200);
      expect(response.body.data.every((r: any) => r.status === 'APPROVED')).toBe(true);
    });

    it('should return empty array for non-matching status filter', async () => {
      const response = await request(app).get('/api/reservations?status=EXPIRED');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });
  });

  // ==================== GET /availability ====================

  describe('GET /api/reservations/availability', () => {
    it('should return availability data for valid time range', async () => {
      const response = await request(app).get(
        `/api/reservations/availability?startTime=${encodeURIComponent(hoursFromNow(2))}&endTime=${encodeURIComponent(hoursFromNow(6))}&gpuCount=2`
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('available');
      expect(response.body.data).toHaveProperty('servers');
      expect(response.body.data).toHaveProperty('sufficient');
    });

    it('should filter servers by gpuModel', async () => {
      const response = await request(app).get(
        `/api/reservations/availability?startTime=${encodeURIComponent(hoursFromNow(2))}&endTime=${encodeURIComponent(hoursFromNow(6))}&gpuModel=A100`
      );

      expect(response.status).toBe(200);
      // Only servers with A100 GPUs should be included
      expect(response.body.data.servers.every((s: any) =>
        s.availableGpus.some((g: any) => g.model.includes('A100'))
      )).toBe(true);
    });

    it('should return 400 when end time is before start time', async () => {
      const response = await request(app).get(
        `/api/reservations/availability?startTime=${encodeURIComponent(hoursFromNow(6))}&endTime=${encodeURIComponent(hoursFromNow(2))}`
      );

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('RES_004');
    });
  });

  // ==================== GET /calendar ====================

  describe('GET /api/reservations/calendar', () => {
    it('should return calendar data for valid date range', async () => {
      const response = await request(app).get(
        '/api/reservations/calendar?start=2026-03-01&end=2026-03-31'
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reservations');
      expect(response.body.data).toHaveProperty('utilization');
    });
  });

  // ==================== GET /statistics ====================

  describe('GET /api/reservations/statistics', () => {
    it('should allow manager to view statistics', async () => {
      const response = await request(managerApp).get('/api/reservations/statistics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('byStatus');
    });

    it('should deny regular user from viewing statistics', async () => {
      const response = await request(app).get('/api/reservations/statistics');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /:id ====================

  describe('GET /api/reservations/:id', () => {
    it('should return reservation details for owner', async () => {
      const response = await request(app).get(`/api/reservations/${validReservationId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('status');
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app).get('/api/reservations/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== PUT /:id ====================

  describe('PUT /api/reservations/:id', () => {
    it('should update reservation with valid data', async () => {
      const response = await request(app)
        .put(`/api/reservations/${validReservationId}`)
        .send({ title: 'Updated Training Task', priority: 7 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('title', 'Updated Training Task');
    });

    it('should return 400 when invalid time range provided', async () => {
      const response = await request(app)
        .put(`/api/reservations/${validReservationId}`)
        .send({
          startTime: hoursFromNow(6),
          endTime: hoursFromNow(2), // end before start
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('RES_004');
    });
  });

  // ==================== DELETE /:id ====================

  describe('DELETE /api/reservations/:id', () => {
    it('should cancel reservation successfully', async () => {
      const response = await request(app)
        .delete(`/api/reservations/${validReservationId}`)
        .query({ reason: 'Project cancelled' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CANCELLED');
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app).delete('/api/reservations/not-a-uuid');

      expect(response.status).toBe(400);
    });
  });

  // ==================== POST /:id/approve ====================

  describe('POST /api/reservations/:id/approve', () => {
    it('should return 400 when reservation is not PENDING (mock always returns APPROVED)', async () => {
      // generateMockReservation always returns status: 'APPROVED',
      // so approve endpoint always returns RES_010
      const response = await request(managerApp)
        .post(`/api/reservations/${validReservationId}/approve`)
        .send({ notes: 'Approved for priority research' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('RES_010');
    });

    it('should deny regular user from approving', async () => {
      const response = await request(app)
        .post(`/api/reservations/${validReservationId}/approve`)
        .send({});

      expect(response.status).toBe(403);
    });
  });

  // ==================== POST /:id/reject ====================

  describe('POST /api/reservations/:id/reject', () => {
    it('should return 400 when reservation is not PENDING (mock always returns APPROVED)', async () => {
      // generateMockReservation always returns status: 'APPROVED',
      // so reject endpoint always returns RES_010
      const response = await request(managerApp)
        .post(`/api/reservations/${validReservationId}/reject`)
        .send({ reason: 'Resources not available during this period' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('RES_010');
    });

    it('should deny regular user from rejecting', async () => {
      const response = await request(app)
        .post(`/api/reservations/${validReservationId}/reject`)
        .send({ reason: 'test' });

      expect(response.status).toBe(403);
    });
  });
});
