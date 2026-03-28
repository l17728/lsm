/**
 * Cluster Reservation Routes
 * 
 * API endpoints for cluster reservation management.
 * MANAGER users can create reservations, SUPER_ADMIN must approve.
 * 
 * Endpoints:
 * - GET    /api/cluster-reservations              - Get all reservations (filtered)
 * - GET    /api/cluster-reservations/my           - Get user's own reservations
 * - GET    /api/cluster-reservations/pending      - Get pending reservations (SUPER_ADMIN)
 * - GET    /api/cluster-reservations/:id          - Get reservation by ID
 * - POST   /api/cluster-reservations              - Create reservation
 * - PUT    /api/cluster-reservations/:id/approve  - Approve reservation (SUPER_ADMIN)
 * - PUT    /api/cluster-reservations/:id/reject   - Reject reservation (SUPER_ADMIN)
 * - PUT    /api/cluster-reservations/:id/cancel   - Cancel reservation (owner)
 * - PUT    /api/cluster-reservations/:id/release  - Release resources (owner)
 */
import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { clusterReservationService } from '../services/cluster-reservation.service';
import {
  authenticate,
  requireManager,
  requireSuperAdmin,
  AuthRequest,
} from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== Validation ====================

// Validation error handler
const handleValidationErrors = (req: any, res: any, next: any) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: errors.array()[0]?.msg || 'Validation error',
    });
  }
  next();
};

const createReservationValidation = [
  body('clusterId').isUUID().withMessage('Valid cluster ID required'),
  body('startTime').isISO8601().withMessage('Valid start time required'),
  body('endTime').isISO8601().withMessage('Valid end time required'),
  body('purpose').optional().isString().isLength({ max: 500 }),
];

const approveRejectValidation = [
  param('id').isUUID().withMessage('Valid reservation ID required'),
  body('reason').optional().isString().isLength({ max: 500 }),
];

// ==================== Routes ====================

/**
 * @route   GET /api/cluster-reservations
 * @desc    Get all reservations with optional filters
 * @access  Private (MANAGER+)
 */
router.get('/', requireManager, async (req: AuthRequest, res: Response) => {
  try {
    const filters: any = {};

    if (req.query.status) filters.status = req.query.status;
    if (req.query.clusterId) filters.clusterId = req.query.clusterId;
    if (req.query.userId) filters.userId = req.query.userId;
    if (req.query.startTime) {
      filters.startTime = new Date(req.query.startTime as string);
    }
    if (req.query.endTime) {
      filters.endTime = new Date(req.query.endTime as string);
    }

    const reservations = await clusterReservationService.getReservations(filters);

    res.json({ success: true, data: reservations });
  } catch (error: any) {
    safeLogger.error('Error fetching reservations', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/cluster-reservations/my
 * @desc    Get user's own reservations
 * @access  Private (All authenticated users)
 */
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const reservations = await clusterReservationService.getMyReservations(
      req.user!.userId
    );

    res.json({ success: true, data: reservations });
  } catch (error: any) {
    safeLogger.error('Error fetching my reservations', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/cluster-reservations/recommend-time-slots
 * @desc    Get AI-recommended time slots for a cluster
 * @access  Private (All authenticated users)
 */
router.get(
  '/recommend-time-slots',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { clusterId, duration, preferredStartTime, preferredEndTime } = req.query;

      if (!clusterId || !duration) {
        return res.status(400).json({
          success: false,
          error: 'clusterId and duration are required',
        });
      }

      const recommendations = await clusterReservationService.recommendTimeSlots({
        clusterId: clusterId as string,
        duration: parseInt(duration as string, 10),
        preferredStartTime: preferredStartTime ? new Date(preferredStartTime as string) : undefined,
        preferredEndTime: preferredEndTime ? new Date(preferredEndTime as string) : undefined,
      });

      safeLogger.info('AI time slot recommendations requested', {
        clusterId,
        duration,
        userId: req.user!.userId,
        recommendationCount: recommendations.length,
      });

      res.json({ success: true, data: recommendations });
    } catch (error: any) {
      safeLogger.error('Error generating time slot recommendations', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route   GET /api/cluster-reservations/check-conflicts
 * @desc    Check for time conflicts for a cluster reservation
 * @access  Private (MANAGER+)
 */
router.get(
  '/check-conflicts',
  requireManager,
  async (req: AuthRequest, res: Response) => {
    try {
      const { clusterId, startTime, endTime } = req.query;

      if (!clusterId || !startTime || !endTime) {
        return res.status(400).json({
          success: false,
          error: 'clusterId, startTime, and endTime are required',
        });
      }

      const result = await clusterReservationService.checkConflicts(
        clusterId as string,
        new Date(startTime as string),
        new Date(endTime as string)
      );

      res.json({ success: true, data: result });
    } catch (error: any) {
      safeLogger.error('Error checking conflicts', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route   GET /api/cluster-reservations/pending
 * @desc    Get pending reservations for approval
 * @access  Private (SUPER_ADMIN only)
 */
router.get(
  '/pending',
  requireSuperAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const reservations = await clusterReservationService.getPendingReservations();

      res.json({ success: true, data: reservations });
    } catch (error: any) {
      safeLogger.error('Error fetching pending reservations', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route   GET /api/cluster-reservations/:id
 * @desc    Get reservation by ID
 * @access  Private (MANAGER+)
 */
router.get(
  '/:id',
  requireManager,
  async (req: AuthRequest, res: Response) => {
    try {
      const reservation = await clusterReservationService.getReservationById(
        req.params.id
      );

      if (!reservation) {
        return res
          .status(404)
          .json({ success: false, error: 'Reservation not found' });
      }

      res.json({ success: true, data: reservation });
    } catch (error: any) {
      safeLogger.error('Error fetching reservation', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route   POST /api/cluster-reservations
 * @desc    Create a new cluster reservation
 * @access  Private (MANAGER+)
 */
router.post(
  '/',
  requireManager,
  createReservationValidation,
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { clusterId, startTime, endTime, purpose, teamId } = req.body;

      // Validate time range
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (start >= end) {
        return res.status(400).json({
          success: false,
          error: 'End time must be after start time',
        });
      }

      if (start < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'Start time must be in the future',
        });
      }

      const reservation = await clusterReservationService.createReservation(
        {
          clusterId,
          startTime: start,
          endTime: end,
          purpose,
          teamId,
        },
        req.user!.userId
      );

      safeLogger.info('Cluster reservation created', {
        reservationId: reservation.id,
        clusterId,
        userId: req.user!.userId,
        queuePosition: reservation.queuePosition,
      });

      res.status(201).json({ success: true, data: reservation });
    } catch (error: any) {
      safeLogger.error('Error creating reservation', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route   PUT /api/cluster-reservations/:id/approve
 * @desc    Approve a pending reservation
 * @access  Private (SUPER_ADMIN only)
 */
router.put(
  '/:id/approve',
  requireSuperAdmin,
  approveRejectValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const reservation = await clusterReservationService.approveReservation(
        req.params.id,
        req.user!.userId
      );

      safeLogger.info('Cluster reservation approved', {
        reservationId: req.params.id,
        approver: req.user!.userId,
      });

      res.json({ success: true, data: reservation });
    } catch (error: any) {
      safeLogger.error('Error approving reservation', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route   PUT /api/cluster-reservations/:id/reject
 * @desc    Reject a pending reservation
 * @access  Private (SUPER_ADMIN only)
 */
router.put(
  '/:id/reject',
  requireSuperAdmin,
  approveRejectValidation,
  async (req: AuthRequest, res: Response) => {
    try {
      const { reason } = req.body;

      const reservation = await clusterReservationService.rejectReservation(
        req.params.id,
        req.user!.userId,
        reason
      );

      safeLogger.info('Cluster reservation rejected', {
        reservationId: req.params.id,
        rejecter: req.user!.userId,
        reason,
      });

      res.json({ success: true, data: reservation });
    } catch (error: any) {
      safeLogger.error('Error rejecting reservation', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route   PUT /api/cluster-reservations/:id/cancel
 * @desc    Cancel a reservation (by owner)
 * @access  Private (MANAGER+)
 */
router.put(
  '/:id/cancel',
  requireManager,
  async (req: AuthRequest, res: Response) => {
    try {
      const reservation = await clusterReservationService.cancelReservation(
        req.params.id,
        req.user!.userId
      );

      safeLogger.info('Cluster reservation cancelled', {
        reservationId: req.params.id,
        userId: req.user!.userId,
      });

      res.json({ success: true, data: reservation });
    } catch (error: any) {
      safeLogger.error('Error cancelling reservation', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * @route   PUT /api/cluster-reservations/:id/release
 * @desc    Release cluster resources early
 * @access  Private (MANAGER+)
 */
router.put(
  '/:id/release',
  requireManager,
  async (req: AuthRequest, res: Response) => {
    try {
      const reservation = await clusterReservationService.releaseReservation(
        req.params.id,
        req.user!.userId
      );

      safeLogger.info('Cluster reservation released', {
        reservationId: req.params.id,
        userId: req.user!.userId,
      });

      res.json({ success: true, data: reservation });
    } catch (error: any) {
      safeLogger.error('Error releasing reservation', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

// Import safeLogger
import { safeLogger } from '../middleware/logging.middleware';

export default router;