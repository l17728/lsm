import { Router, Response } from 'express';
import { z } from 'zod';
import { body, param, query, validationResult } from 'express-validator';
import { authenticate, requireManager, requireSuperAdmin, requireSuperAdminOrAdmin, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { user_role as UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== Zod Validation Schemas ====================

/**
 * Reservation status enum (matching Prisma schema)
 */
const ReservationStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
]);

/**
 * Create reservation schema
 */
const createReservationSchema = z.object({
  serverId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  startTime: z.string().datetime({ message: 'Invalid start time format' }),
  endTime: z.string().datetime({ message: 'Invalid end time format' }),
  priority: z.number().int().min(1).max(10).default(1),
  gpuCount: z.number().int().min(1).max(100).default(1),
  minMemory: z.number().int().min(0).default(0),
  notes: z.string().max(1000).optional(),
});

/**
 * Update reservation schema
 */
const updateReservationSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  gpuCount: z.number().int().min(1).max(100).optional(),
  minMemory: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * Reservation query params schema
 */
const reservationQuerySchema = z.object({
  status: ReservationStatusSchema.optional(),
  serverId: z.string().uuid().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sort: z.enum(['startTime', 'createdAt', 'priority']).default('startTime'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Availability query schema
 */
const availabilityQuerySchema = z.object({
  startTime: z.string().datetime({ message: 'Invalid start time format' }).optional(),
  endTime: z.string().datetime({ message: 'Invalid end time format' }).optional(),
  gpuCount: z.number().int().min(1).default(1),
  minMemory: z.number().int().min(0).default(0),
  gpuModel: z.string().optional(),
});

/**
 * Calendar query schema
 */
const calendarQuerySchema = z.object({
  serverId: z.string().uuid().optional(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  view: z.enum(['month', 'week', 'day']).default('month'),
});

/**
 * Statistics query schema
 */
const statisticsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year']).default('month'),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  serverId: z.string().uuid().optional(),
});

/**
 * Approval request schema
 */
const approvalSchema = z.object({
  notes: z.string().max(500).optional(),
});

/**
 * Rejection request schema
 */
const rejectionSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(500),
});

// ==================== Helper Functions ====================

/**
 * Validation error handler middleware
 */
const handleValidationErrors = (req: AuthRequest, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VAL_001',
        message: 'Parameter validation failed',
        details: errors.array().map(err => ({
          field: 'path' in err ? err.path : 'unknown',
          message: err.msg,
        })),
      },
    });
  }
  next();
};

/**
 * Check if user has manager or admin role
 */
const isManagerOrAdmin = (role: UserRole): boolean => {
  return role === UserRole.MANAGER || role === UserRole.ADMIN;
};

/**
 * Generate mock reservation data for development
 * @param dateStr - Optional date string (YYYY-MM-DD) to generate reservation for that date
 */
const generateMockReservation = (id: string, userId: string, userName: string, status: string = 'PENDING', dateStr?: string) => {
  // Use provided date or default to tomorrow
  const baseDate = dateStr || new Date(Date.now() + 86400000).toISOString().split('T')[0];
  return {
    id,
    serverId: '660e8400-e29b-41d4-a716-446655440001',
    serverName: 'GPU-Server-01',
    userId,
    userName,
    title: 'Model Training Task',
    description: 'ResNet50 model training, estimated 24 hours',
    startTime: new Date(`${baseDate}T09:00:00.000Z`).toISOString(),
    endTime: new Date(`${baseDate}T18:00:00.000Z`).toISOString(),
    priority: 5,
    gpuCount: 2,
    allocatedGpus: [
      { id: 'gpu-001', model: 'NVIDIA A100', memory: 40, status: 'ALLOCATED' },
      { id: 'gpu-002', model: 'NVIDIA A100', memory: 40, status: 'ALLOCATED' },
    ],
    status,
    requiresApproval: true,
    notes: 'Requires A100 GPU',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Generate mock available servers
 */
const generateMockAvailability = () => ({
  available: true,
  servers: [
    {
      id: '660e8400-e29b-41d4-a716-446655440001',
      name: 'GPU-Server-01',
      hostname: 'gpu01.lab.local',
      status: 'ONLINE',
      availableGpus: [
        { id: 'gpu-001', model: 'NVIDIA A100', memory: 40, status: 'AVAILABLE' },
        { id: 'gpu-002', model: 'NVIDIA A100', memory: 40, status: 'AVAILABLE' },
        { id: 'gpu-003', model: 'NVIDIA A100', memory: 40, status: 'AVAILABLE' },
      ],
      availableGpuCount: 3,
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440002',
      name: 'GPU-Server-02',
      hostname: 'gpu02.lab.local',
      status: 'ONLINE',
      availableGpus: [
        { id: 'gpu-004', model: 'NVIDIA V100', memory: 32, status: 'AVAILABLE' },
      ],
      availableGpuCount: 1,
    },
  ],
  totalAvailableGpus: 4,
  sufficient: true,
});

// ==================== API Routes ====================

/**
 * @route   POST /api/reservations
 * @desc    Create a new reservation
 * @access  Private
 */
router.post(
  '/',
  async (req: AuthRequest, res: Response) => {
    try {
      // Validate request body
      const validatedData = validate(createReservationSchema, req.body);
      const { startTime, endTime, title, serverId, description, priority, gpuCount, minMemory, notes } = validatedData;

      // Validate time range
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (start >= end) {
        return res.status(400).json({
          success: false,
          error: 'Start time must be before end time',
          code: 'RES_004',
        });
      }

      // Check minimum reservation duration (30 minutes)
      const durationMs = end.getTime() - start.getTime();
      const minDurationMs = 30 * 60 * 1000;
      if (durationMs < minDurationMs) {
        return res.status(400).json({
          success: false,
          error: 'Minimum reservation duration is 30 minutes',
          code: 'RES_005',
        });
      }

      // Check maximum reservation duration (7 days)
      const maxDurationMs = 7 * 24 * 60 * 60 * 1000;
      if (durationMs > maxDurationMs) {
        return res.status(400).json({
          success: false,
          error: 'Maximum reservation duration is 7 days',
          code: 'RES_005',
        });
      }

      // Create reservation (mock implementation)
      const reservationId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = req.user!.userId;
      const userName = req.user!.username || 'user';

      // Determine if approval is needed
      const requiresApproval = 
        durationMs > 48 * 60 * 60 * 1000 || // More than 48 hours
        gpuCount > 4 || // More than 4 GPUs
        priority === 10; // High priority

      const reservation = {
        id: reservationId,
        serverId: serverId || '660e8400-e29b-41d4-a716-446655440001',
        serverName: 'GPU-Server-01',
        userId,
        userName,
        title,
        description,
        startTime,
        endTime,
        priority: priority || 1,
        gpuCount: gpuCount || 1,
        allocatedGpus: [
          { id: 'gpu-001', model: 'NVIDIA A100', memory: 40 },
          { id: 'gpu-002', model: 'NVIDIA A100', memory: 40 },
        ],
        status: requiresApproval ? 'PENDING' : 'APPROVED',
        requiresApproval,
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      res.status(201).json({
        success: true,
        data: reservation,
      });
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create reservation';
      const isValidationError = errorMessage.includes('Validation');
      
      res.status(isValidationError ? 400 : 500).json({
        success: false,
        error: errorMessage,
        code: isValidationError ? 'VAL_001' : 'SYS_001',
      });
    }
  }
);

/**
 * @route   GET /api/reservations
 * @desc    Get all reservations with pagination and filters
 * @access  Private
 */
router.get(
  '/',
  async (req: AuthRequest, res: Response) => {
    try {
      console.log(`[ReservationRoutes] GET /api/reservations query:`, JSON.stringify(req.query));
      
      // Validate query parameters
      const validatedQuery = validate(reservationQuerySchema, {
        ...req.query,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        priority: req.query.priority ? Number(req.query.priority) : undefined,
      });

      const { status, serverId, startTime, endTime, page, limit, sort, order } = validatedQuery;
      
      console.log(`[ReservationRoutes] Validated params: startTime=${startTime}, endTime=${endTime}`);

      // Build filter conditions
      const where: any = {};
      
      // Non-admin users can only see their own reservations
      if (req.user!.role === UserRole.USER) {
        where.userId = req.user!.userId;
      }

      if (status) where.status = status;
      if (serverId) where.serverId = serverId;
      if (startTime || endTime) {
        where.startTime = {};
        if (startTime) where.startTime.gte = new Date(startTime);
        if (endTime) where.startTime.lte = new Date(endTime);
      }

      // Mock data for development - generate reservations relative to requested date range
      const userId = req.user!.userId;
      const userName = req.user!.username || 'user';
      const now = Date.now();
      
      // Use filter time range or default to today
      const requestStart = startTime ? new Date(startTime).getTime() : now;
      const requestDate = new Date(requestStart);
      const dateStr = requestDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Generate reservations that fall within or near the requested date range
      const mockReservations = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          serverId: '660e8400-e29b-41d4-a716-446655440001',
          serverName: 'GPU-Server-01',
          userId,
          userName,
          title: 'Model Training Task',
          // Start at 9:00 AM on the requested date
          startTime: new Date(`${dateStr}T09:00:00.000Z`).toISOString(),
          endTime: new Date(`${dateStr}T18:00:00.000Z`).toISOString(),
          priority: 5,
          gpuCount: 2,
          status: 'APPROVED',
          purpose: 'ResNet50 training',
          createdAt: new Date().toISOString(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          serverId: '660e8400-e29b-41d4-a716-446655440002',
          serverName: 'GPU-Server-02',
          userId,
          userName,
          title: 'Inference Service',
          // Start at 14:00 on the requested date
          startTime: new Date(`${dateStr}T14:00:00.000Z`).toISOString(),
          endTime: new Date(`${dateStr}T17:00:00.000Z`).toISOString(),
          priority: 3,
          gpuCount: 1,
          status: 'PENDING',
          purpose: 'Batch inference',
          createdAt: new Date().toISOString(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          serverId: '660e8400-e29b-41d4-a716-446655440001',
          serverName: 'GPU-Server-01',
          userId,
          userName,
          title: 'Quick Test',
          // Start at 10:00 on the requested date
          startTime: new Date(`${dateStr}T10:00:00.000Z`).toISOString(),
          endTime: new Date(`${dateStr}T12:00:00.000Z`).toISOString(),
          priority: 8,
          gpuCount: 1,
          status: 'APPROVED',
          purpose: 'Quick model test',
          createdAt: new Date().toISOString(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          serverId: '660e8400-e29b-41d4-a716-446655440003',
          serverName: 'GPU-Server-03',
          userId,
          userName,
          title: 'Long Training',
          // Multi-day reservation starting on requested date
          startTime: new Date(`${dateStr}T08:00:00.000Z`).toISOString(),
          endTime: new Date(new Date(`${dateStr}T20:00:00.000Z`).getTime() + 86400000).toISOString(),
          priority: 7,
          gpuCount: 4,
          status: 'APPROVED',
          purpose: 'Large model training',
          createdAt: new Date().toISOString(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440004',
          serverId: '660e8400-e29b-41d4-a716-446655440002',
          serverName: 'GPU-Server-02',
          userId,
          userName,
          title: 'Data Processing',
          // Start at 19:00 on the requested date
          startTime: new Date(`${dateStr}T19:00:00.000Z`).toISOString(),
          endTime: new Date(`${dateStr}T23:00:00.000Z`).toISOString(),
          priority: 4,
          gpuCount: 2,
          status: 'PENDING',
          purpose: 'Data preprocessing pipeline',
          createdAt: new Date().toISOString(),
        },
      ];
      
      console.log(`[ReservationRoutes] Generated mock reservations for date: ${dateStr}`);

      // Apply filters to mock data
      let filteredReservations = mockReservations;
      
      // Filter by status
      if (status) {
        filteredReservations = filteredReservations.filter(r => r.status === status);
      }
      
      // Filter by time range
      if (startTime || endTime) {
        console.log(`[ReservationRoutes] Filtering by time range: ${startTime} to ${endTime}`);
        filteredReservations = filteredReservations.filter(r => {
          const reservationStart = new Date(r.startTime);
          const reservationEnd = new Date(r.endTime);
          const filterStart = startTime ? new Date(startTime) : null;
          const filterEnd = endTime ? new Date(endTime) : null;
          
          console.log(`[ReservationRoutes] Reservation: ${r.title}, start=${r.startTime}, end=${r.endTime}`);
          
          // Check if reservation overlaps with the filter range
          // Reservation overlaps if: reservationStart < filterEnd AND reservationEnd > filterStart
          if (filterStart && filterEnd) {
            const overlaps = reservationStart < filterEnd && reservationEnd > filterStart;
            console.log(`[ReservationRoutes] Overlap check: resStart < filterEnd (${reservationStart < filterEnd}), resEnd > filterStart (${reservationEnd > filterStart}), result=${overlaps}`);
            return overlaps;
          } else if (filterStart) {
            return reservationEnd > filterStart;
          } else if (filterEnd) {
            return reservationStart < filterEnd;
          }
          return true;
        });
      }
      
      // Filter by serverId
      if (serverId) {
        filteredReservations = filteredReservations.filter(r => r.serverId === serverId);
      }
      
      console.log(`[ReservationRoutes] Filtered ${filteredReservations.length} reservations from ${mockReservations.length} total`);

      // Calculate pagination
      const total = filteredReservations.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedReservations = filteredReservations.slice(offset, offset + limit);

      res.json({
        success: true,
        data: paginatedReservations,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'VAL_001',
      });
    }
  }
);

/**
 * @route   GET /api/reservations/availability
 * @desc    Query available resources
 * @access  Private
 */
router.get(
  '/availability',
  async (req: AuthRequest, res: Response) => {
    try {
      // Validate query parameters
      const validatedQuery = validate(availabilityQuerySchema, {
        ...req.query,
        gpuCount: req.query.gpuCount ? Number(req.query.gpuCount) : 1,
        minMemory: req.query.minMemory ? Number(req.query.minMemory) : 0,
      });

      const { startTime, endTime, gpuCount, minMemory, gpuModel } = validatedQuery;

      // Set default time range if not provided (now to 7 days later)
      const start = startTime ? new Date(startTime) : new Date();
      const end = endTime ? new Date(endTime) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      if (start >= end) {
        return res.status(400).json({
          success: false,
          error: 'Start time must be before end time',
          code: 'RES_004',
        });
      }

      // Get availability data (mock implementation)
      const availability = generateMockAvailability();

      // Filter by GPU requirements
      if (gpuModel) {
        availability.servers = availability.servers.filter(server =>
          server.availableGpus.some(gpu => gpu.model.includes(gpuModel))
        );
        availability.totalAvailableGpus = availability.servers.reduce(
          (sum, server) => sum + server.availableGpuCount, 0
        );
      }

      // Check if resources are sufficient
      availability.sufficient = availability.totalAvailableGpus >= gpuCount;
      availability.available = availability.servers.length > 0;

      res.json({
        success: true,
        data: availability,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'VAL_001',
      });
    }
  }
);

/**
 * @route   GET /api/reservations/calendar
 * @desc    Get calendar data
 * @access  Private
 */
router.get(
  '/calendar',
  async (req: AuthRequest, res: Response) => {
    try {
      // Validate query parameters
      const validatedQuery = validate(calendarQuerySchema, req.query);
      const { serverId, start, end, view } = validatedQuery;

      // Use requested date range for mock data
      const startDate = start || new Date().toISOString().split('T')[0];
      
      // Mock calendar data with reservations on requested dates
      const calendarData = {
        serverId: serverId || '660e8400-e29b-41d4-a716-446655440001',
        serverName: 'GPU-Server-01',
        range: { start, end },
        reservations: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            title: 'Model Training Task',
            startTime: new Date(`${startDate}T09:00:00.000Z`).toISOString(),
            endTime: new Date(`${startDate}T18:00:00.000Z`).toISOString(),
            status: 'APPROVED',
            gpuCount: 2,
            userId: req.user!.userId,
            userName: req.user!.username || 'user',
            purpose: 'ResNet50 training',
            color: '#4CAF50',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440003',
            title: 'Inference Service',
            startTime: new Date(`${startDate}T14:00:00.000Z`).toISOString(),
            endTime: new Date(`${startDate}T17:00:00.000Z`).toISOString(),
            status: 'APPROVED',
            gpuCount: 1,
            userId: '770e8400-e29b-41d4-a716-446655440004',
            userName: 'user2',
            purpose: 'Batch inference',
            color: '#2196F3',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440004',
            title: 'Quick Test',
            startTime: new Date(`${startDate}T10:00:00.000Z`).toISOString(),
            endTime: new Date(`${startDate}T12:00:00.000Z`).toISOString(),
            status: 'PENDING',
            gpuCount: 1,
            userId: req.user!.userId,
            userName: req.user!.username || 'user',
            purpose: 'Quick model validation',
            color: '#faad14',
          },
        ],
        utilization: {
          totalHours: 744,
          reservedHours: 28,
          utilizationRate: 3.76,
        },
      };

      console.log(`[ReservationRoutes] Calendar data for range: ${start} to ${end}`);

      res.json({
        success: true,
        data: calendarData,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'VAL_001',
      });
    }
  }
);

/**
 * @route   GET /api/reservations/quota
 * @desc    Get user quota
 * @access  Private
 */
router.get(
  '/quota',
  async (req: AuthRequest, res: Response) => {
    try {
      // Mock quota data
      const quota = {
        maxHoursPerWeek: 40,
        usedHoursThisWeek: 10,
        maxConcurrentReservations: 3,
        currentReservations: 1,
      };

      res.json({
        success: true,
        data: quota,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'SYS_001',
      });
    }
  }
);

/**
 * @route   GET /api/reservations/pending
 * @desc    Get pending reservations for approval (SUPER_ADMIN and ADMIN)
 * @access  Private (SUPER_ADMIN and ADMIN)
 */
router.get(
  '/pending',
  requireSuperAdminOrAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      console.log(`[ReservationRoutes] Fetching pending reservations by=${req.user!.username}`);

      // Mock pending reservations data - use near-future dates for pending approvals
      const now = Date.now();
      const today = new Date().toISOString().split('T')[0];
      
      const pendingReservations = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          serverId: '550e8400-e29b-41d4-a716-446655440000',
          serverName: 'GPU-Server-01',
          userId: '770e8400-e29b-41d4-a716-446655440002',
          userName: 'manager',
          userEmail: 'manager@lsm.local',
          title: 'Deep Learning Training',
          description: 'Training a large language model',
          startTime: new Date(`${today}T09:00:00.000Z`).toISOString(),
          endTime: new Date(new Date(`${today}T18:00:00.000Z`).getTime() + 2 * 86400000).toISOString(),
          priority: 5,
          gpuCount: 4,
          status: 'PENDING',
          purpose: 'Training a large language model',
          createdAt: new Date().toISOString(),
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          serverId: '550e8400-e29b-41d4-a716-446655440001',
          serverName: 'GPU-Server-02',
          userId: '880e8400-e29b-41d4-a716-446655440003',
          userName: 'user1',
          userEmail: 'user1@test.com',
          title: 'Model Inference',
          description: 'Running batch inference jobs',
          startTime: new Date(`${today}T14:00:00.000Z`).toISOString(),
          endTime: new Date(`${today}T17:00:00.000Z`).toISOString(),
          priority: 3,
          gpuCount: 2,
          status: 'PENDING',
          purpose: 'Running batch inference jobs',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ];

      console.log(`[ReservationRoutes] Found ${pendingReservations.length} pending reservations`);

      res.json({
        success: true,
        data: pendingReservations,
        total: pendingReservations.length,
      });
    } catch (error: any) {
      console.error(`[ReservationRoutes] Error fetching pending reservations: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'SYS_001',
      });
    }
  }
);

/**
 * @route   GET /api/reservations/statistics
 * @desc    Get usage statistics
 * @access  Private (Manager/Admin only)
 */
router.get(
  '/statistics',
  requireManager,
  async (req: AuthRequest, res: Response) => {
    try {
      // Validate query parameters
      const validatedQuery = validate(statisticsQuerySchema, req.query);
      const { period, start, end, serverId } = validatedQuery;

      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;

      if (start && end) {
        startDate = new Date(start);
        endDate = new Date(end);
      } else {
        switch (period) {
          case 'day':
            startDate = new Date(now.setDate(now.getDate() - 1));
            break;
          case 'week':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case 'month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
          case 'year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
          default:
            startDate = new Date(now.setMonth(now.getMonth() - 1));
        }
      }

      // Mock statistics data
      const statistics = {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
        summary: {
          totalReservations: 156,
          approvedReservations: 142,
          rejectedReservations: 8,
          cancelledReservations: 6,
          totalHours: 1872,
          avgDuration: 12,
          peakUtilization: 85.5,
          avgUtilization: 62.3,
        },
        byStatus: {
          PENDING: 5,
          APPROVED: 20,
          ACTIVE: 3,
          COMPLETED: 122,
          CANCELLED: 4,
          REJECTED: 2,
        },
        byServer: [
          {
            serverId: '660e8400-e29b-41d4-a716-446655440001',
            serverName: 'GPU-Server-01',
            totalReservations: 45,
            totalHours: 540,
            utilizationRate: 75.2,
          },
          {
            serverId: '660e8400-e29b-41d4-a716-446655440002',
            serverName: 'GPU-Server-02',
            totalReservations: 38,
            totalHours: 456,
            utilizationRate: 63.5,
          },
        ],
        byUser: [
          {
            userId: req.user!.userId,
            userName: req.user!.username || 'user',
            totalReservations: 25,
            totalHours: 300,
          },
        ],
        byGpuModel: [
          { model: 'NVIDIA A100', totalReservations: 98, totalHours: 1176 },
          { model: 'NVIDIA V100', totalReservations: 58, totalHours: 696 },
        ],
        trend: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(now.getTime() - i * 86400000).toISOString().split('T')[0],
          reservations: Math.floor(Math.random() * 10) + 5,
          hours: Math.floor(Math.random() * 100) + 50,
        })),
      };

      // Filter by serverId if provided
      if (serverId) {
        statistics.byServer = statistics.byServer.filter(s => s.serverId === serverId);
      }

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'VAL_001',
      });
    }
  }
);

/**
 * @route   GET /api/reservations/my
 * @desc    Get current user's reservations
 * @access  Private
 */
router.get(
  '/my',
  async (req: AuthRequest, res: Response) => {
    try {
      // Validate query parameters
      const validatedQuery = validate(reservationQuerySchema, {
        ...req.query,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
      });

      const { status, page, limit } = validatedQuery;

      // Mock data for current user
      const userId = req.user!.userId;
      const userName = req.user!.username || 'user';

      const mockReservations = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          serverId: '660e8400-e29b-41d4-a716-446655440001',
          serverName: 'GPU-Server-01',
          userId,
          userName,
          title: 'Model Training Task',
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 2 * 86400000).toISOString(),
          priority: 5,
          gpuCount: 2,
          status: 'APPROVED',
          createdAt: new Date().toISOString(),
        },
      ];

      // Apply status filter
      let filteredReservations = mockReservations;
      if (status) {
        filteredReservations = mockReservations.filter(r => r.status === status);
      }

      const total = filteredReservations.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedReservations = filteredReservations.slice(offset, offset + limit);

      res.json({
        success: true,
        data: paginatedReservations,
        total,
        page,
        limit,
        totalPages,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'VAL_001',
      });
    }
  }
);

/**
 * @route   GET /api/reservations/:id
 * @desc    Get reservation by ID
 * @access  Private
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Valid reservation ID required')],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Mock reservation detail
      const reservation = {
        id,
        serverId: '660e8400-e29b-41d4-a716-446655440001',
        server: {
          id: '660e8400-e29b-41d4-a716-446655440001',
          name: 'GPU-Server-01',
          hostname: 'gpu01.lab.local',
          ipAddress: '192.168.1.100',
          status: 'ONLINE',
        },
        userId: req.user!.userId,
        user: {
          id: req.user!.userId,
          username: req.user!.username || 'user',
        },
        title: 'Model Training Task',
        description: 'ResNet50 model training, estimated 24 hours',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 2 * 86400000).toISOString(),
        priority: 5,
        gpuCount: 2,
        allocatedGpus: [
          { id: 'gpu-001', model: 'NVIDIA A100', memory: 40, status: 'ALLOCATED' },
          { id: 'gpu-002', model: 'NVIDIA A100', memory: 40, status: 'ALLOCATED' },
        ],
        status: 'APPROVED',
        requiresApproval: false,
        approvalInfo: null,
        notes: 'Requires A100 GPU',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Check if user has access to this reservation
      if (req.user!.role === UserRole.USER && reservation.userId !== req.user!.userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'AUTH_004',
        });
      }

      res.json({
        success: true,
        data: reservation,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'SYS_001',
      });
    }
  }
);

/**
 * @route   PUT /api/reservations/:id
 * @desc    Update reservation
 * @access  Private
 */
router.put(
  '/:id',
  [param('id').isUUID().withMessage('Valid reservation ID required')],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Validate request body
      const validatedData = validate(updateReservationSchema, req.body);

      // Mock check if reservation exists and user has access
      const existingReservation = generateMockReservation(id, req.user!.userId, req.user!.username || 'user');
      
      // Check ownership
      if (req.user!.role === UserRole.USER && existingReservation.userId !== req.user!.userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'AUTH_004',
        });
      }

      // Check if reservation can be updated (not ACTIVE, COMPLETED, or CANCELLED)
      const nonUpdatableStatuses = ['ACTIVE', 'COMPLETED', 'CANCELLED'];
      if (nonUpdatableStatuses.includes(existingReservation.status)) {
        return res.status(400).json({
          success: false,
          error: `Cannot update reservation with status ${existingReservation.status}`,
          code: 'RES_007',
        });
      }

      // Validate time range if provided
      if (validatedData.startTime && validatedData.endTime) {
        const start = new Date(validatedData.startTime);
        const end = new Date(validatedData.endTime);
        
        if (start >= end) {
          return res.status(400).json({
            success: false,
            error: 'Start time must be before end time',
            code: 'RES_004',
          });
        }
      }

      // Update reservation (mock)
      const updatedReservation = {
        ...existingReservation,
        ...validatedData,
        updatedAt: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: updatedReservation,
      });
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update reservation';
      const isValidationError = errorMessage.includes('Validation');
      
      res.status(isValidationError ? 400 : 500).json({
        success: false,
        error: errorMessage,
        code: isValidationError ? 'VAL_001' : 'SYS_001',
      });
    }
  }
);

/**
 * @route   DELETE /api/reservations/:id
 * @desc    Cancel reservation
 * @access  Private
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Valid reservation ID required')],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.query;

      // Mock check if reservation exists
      const existingReservation = generateMockReservation(id, req.user!.userId, req.user!.username || 'user');

      // Check ownership
      if (req.user!.role === UserRole.USER && existingReservation.userId !== req.user!.userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'AUTH_004',
        });
      }

      // Check if reservation can be cancelled
      if (existingReservation.status === 'COMPLETED') {
        return res.status(400).json({
          success: false,
          error: 'Reservation already completed',
          code: 'RES_008',
        });
      }

      if (existingReservation.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          error: 'Reservation already cancelled',
          code: 'RES_009',
        });
      }

      // Check if ACTIVE reservation cancellation requires admin
      if (existingReservation.status === 'ACTIVE' && req.user!.role === UserRole.USER) {
        return res.status(403).json({
          success: false,
          error: 'Active reservations require admin permission to cancel',
          code: 'AUTH_005',
        });
      }

      // Cancel reservation (mock)
      const cancelledReservation = {
        id,
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        cancelledBy: req.user!.userId,
        cancelReason: reason || 'User requested cancellation',
      };

      res.json({
        success: true,
        data: cancelledReservation,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'SYS_001',
      });
    }
  }
);

/**
 * @route   POST /api/reservations/:id/approve
 * @desc    Approve reservation
 * @access  Private (Manager/Admin only)
 */
router.post(
  '/:id/approve',
  requireManager,
  [param('id').isUUID().withMessage('Valid reservation ID required')],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Validate request body
      const validatedData = validate(approvalSchema, req.body || {});

      console.log(`[ReservationRoutes] Approving reservation: id=${id}, by=${req.user!.username}`);

      // Mock check if reservation exists and is in PENDING status
      const existingReservation = generateMockReservation(id, req.user!.userId, req.user!.username || 'user');
      
      if (existingReservation.status !== 'PENDING') {
        console.warn(`[ReservationRoutes] Cannot approve reservation ${id}: status is ${existingReservation.status}`);
        return res.status(400).json({
          success: false,
          error: 'Only PENDING reservations can be approved',
          code: 'RES_010',
        });
      }

      // Approve reservation (mock)
      const approvedReservation = {
        id,
        status: 'APPROVED',
        approvalInfo: {
          approvedBy: req.user!.userId,
          approverName: req.user!.username || 'admin',
          approvedAt: new Date().toISOString(),
          notes: validatedData.notes,
        },
        updatedAt: new Date().toISOString(),
      };

      console.log(`[ReservationRoutes] Reservation approved: id=${id}, by=${req.user!.username}`);

      res.json({
        success: true,
        data: approvedReservation,
      });
    } catch (error: any) {
      console.error(`[ReservationRoutes] Error approving reservation: ${error.message}`);
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'VAL_001',
      });
    }
  }
);

/**
 * @route   POST /api/reservations/:id/reject
 * @desc    Reject reservation
 * @access  Private (Manager/Admin only)
 */
router.post(
  '/:id/reject',
  requireManager,
  [param('id').isUUID().withMessage('Valid reservation ID required')],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Validate request body
      const validatedData = validate(rejectionSchema, req.body);

      console.log(`[ReservationRoutes] Rejecting reservation: id=${id}, by=${req.user!.username}`);

      // Mock check if reservation exists and is in PENDING status
      const existingReservation = generateMockReservation(id, req.user!.userId, req.user!.username || 'user');
      
      if (existingReservation.status !== 'PENDING') {
        console.warn(`[ReservationRoutes] Cannot reject reservation ${id}: status is ${existingReservation.status}`);
        return res.status(400).json({
          success: false,
          error: 'Only PENDING reservations can be rejected',
          code: 'RES_010',
        });
      }

      // Reject reservation (mock)
      const rejectedReservation = {
        id,
        status: 'REJECTED',
        rejectionInfo: {
          rejectedBy: req.user!.userId,
          rejecterName: req.user!.username || 'admin',
          rejectedAt: new Date().toISOString(),
          reason: validatedData.reason,
        },
        updatedAt: new Date().toISOString(),
      };

      console.log(`[ReservationRoutes] Reservation rejected: id=${id}, by=${req.user!.username}, reason=${validatedData.reason || 'N/A'}`);

      res.json({
        success: true,
        data: rejectedReservation,
      });
    } catch (error: any) {
      console.error(`[ReservationRoutes] Error rejecting reservation: ${error.message}`);
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'VAL_001',
      });
    }
  }
);

export default router;