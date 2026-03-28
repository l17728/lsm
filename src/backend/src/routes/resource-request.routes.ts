/**
 * Resource Request Routes
 * 
 * Endpoints:
 * - GET    /api/requests              - List all requests (admin view)
 * - GET    /api/requests/my            - Get my requests
 * - GET    /api/requests/pending       - Get pending requests (for approval)
 * - GET    /api/requests/stats         - Get request statistics
 * - GET    /api/requests/:id           - Get request details
 * - POST   /api/requests               - Create request
 * - PUT    /api/requests/:id           - Update request (draft only)
 * - POST   /api/requests/:id/submit    - Submit for approval
 * - POST   /api/requests/:id/approve   - Approve request (SuperAdmin)
 * - POST   /api/requests/:id/reject    - Reject request (SuperAdmin)
 * - POST   /api/requests/:id/allocate  - Allocate cluster to request (SuperAdmin)
 * - DELETE /api/requests/:id           - Cancel request
 */
import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { resourceRequestService } from '../services/resource-request.service';
import { authenticate, requireSuperAdmin, requireSuperAdminOrAdmin, requireResourceManager, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// ==================== Validation ====================

const createRequestValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').isISO8601().withMessage('Valid end time is required'),
  body('minServers').optional().isInt({ min: 0 }),
  body('maxServers').optional().isInt({ min: 0 }),
  body('minGpus').optional().isInt({ min: 0 }),
  body('maxGpus').optional().isInt({ min: 0 }),
  body('minCpuCores').optional().isInt({ min: 0 }),
  body('minMemory').optional().isInt({ min: 0 }),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'CRITICAL', 'URGENT']),
];

const updateRequestValidation = [
  param('id').isUUID(),
  body('title').optional().trim().notEmpty(),
  body('startTime').optional().isISO8601(),
  body('endTime').optional().isISO8601(),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'CRITICAL', 'URGENT']),
];

const approveRequestValidation = [
  param('id').isUUID(),
  body('comment').optional().isString(),
];

const rejectRequestValidation = [
  param('id').isUUID(),
  body('reason').trim().notEmpty().withMessage('Rejection reason is required'),
];

const allocateRequestValidation = [
  param('id').isUUID(),
  body('clusterId').isUUID(),
  body('optimizationResult').optional().isObject(),
  body('optimizationMode').optional().isIn(['MANUAL', 'AUTO', 'HYBRID']),
];

// ==================== Routes ====================

/**
 * @route   GET /api/requests/stats
 * @desc    Get request statistics
 * @access  Private (SuperAdmin or Admin)
 */
router.get('/stats', authenticate, requireSuperAdminOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await resourceRequestService.getRequestStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error fetching stats: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/requests/my
 * @desc    Get my requests
 * @access  Private
 */
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await resourceRequestService.getMyRequests(req.user!.userId);
    res.json({ success: true, data: requests });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error fetching my requests: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/requests/pending
 * @desc    Get pending requests for approval
 * @access  Private (SuperAdmin or Admin)
 */
router.get('/pending', authenticate, requireSuperAdminOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await resourceRequestService.getPendingRequests();
    res.json({ success: true, data: requests });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error fetching pending requests: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/requests
 * @desc    Get all requests (admin view)
 * @access  Private (SuperAdmin or Admin)
 */
router.get('/', authenticate, requireSuperAdminOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.requesterId) filters.requesterId = req.query.requesterId;
    if (req.query.teamId) filters.teamId = req.query.teamId;

    const requests = await resourceRequestService.getAllRequests(filters);
    res.json({ success: true, data: requests });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error fetching requests: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/requests/:id
 * @desc    Get request by ID
 * @access  Private
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const request = await resourceRequestService.getRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    
    // Check if user can view this request
    const isOwner = request.requesterId === req.user!.userId;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role);
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    res.json({ success: true, data: request });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error fetching request: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/requests
 * @desc    Create a new resource request
 * @access  Private (Manager, Admin, SuperAdmin)
 */
router.post('/', authenticate, requireResourceManager, createRequestValidation, async (req: AuthRequest, res: Response) => {
  try {
    const data = {
      ...req.body,
      startTime: new Date(req.body.startTime),
      endTime: new Date(req.body.endTime),
    };
    
    const teamId = req.body.teamId || undefined;
    const request = await resourceRequestService.createRequest(data, req.user!.userId, teamId);
    
    console.log(`[RequestRoutes] Created request: id=${request.id}, code=${request.requestCode}, by=${req.user!.username}`);
    res.status(201).json({ success: true, data: request });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error creating request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   PUT /api/requests/:id
 * @desc    Update request (draft only)
 * @access  Private (Owner only)
 */
router.put('/:id', authenticate, updateRequestValidation, async (req: AuthRequest, res: Response) => {
  try {
    // Check ownership
    const existing = await resourceRequestService.getRequestById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    
    if (existing.requesterId !== req.user!.userId) {
      return res.status(403).json({ success: false, error: 'Only the requester can update this request' });
    }
    
    const updateData: any = { ...req.body };
    if (req.body.startTime) updateData.startTime = new Date(req.body.startTime);
    if (req.body.endTime) updateData.endTime = new Date(req.body.endTime);
    
    const request = await resourceRequestService.updateRequest(req.params.id, updateData);
    console.log(`[RequestRoutes] Updated request: id=${request.id}, by=${req.user!.username}`);
    res.json({ success: true, data: request });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error updating request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/requests/:id/submit
 * @desc    Submit request for approval
 * @access  Private (Owner only)
 */
router.post('/:id/submit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Check ownership
    const existing = await resourceRequestService.getRequestById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    
    if (existing.requesterId !== req.user!.userId) {
      return res.status(403).json({ success: false, error: 'Only the requester can submit this request' });
    }
    
    const request = await resourceRequestService.submitRequest(req.params.id);
    console.log(`[RequestRoutes] Submitted request: id=${request.id}, by=${req.user!.username}`);
    res.json({ success: true, data: request, message: 'Request submitted for approval' });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error submitting request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/requests/:id/approve
 * @desc    Approve request
 * @access  Private (SuperAdmin)
 */
router.post('/:id/approve', authenticate, requireSuperAdmin, approveRequestValidation, async (req: AuthRequest, res: Response) => {
  try {
    const request = await resourceRequestService.approveRequest(req.params.id, req.user!.userId, req.body);
    console.log(`[RequestRoutes] Approved request: id=${request.id}, by=${req.user!.username}`);
    res.json({ success: true, data: request, message: 'Request approved' });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error approving request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/requests/:id/reject
 * @desc    Reject request
 * @access  Private (SuperAdmin)
 */
router.post('/:id/reject', authenticate, requireSuperAdmin, rejectRequestValidation, async (req: AuthRequest, res: Response) => {
  try {
    const request = await resourceRequestService.rejectRequest(req.params.id, req.user!.userId, req.body);
    console.log(`[RequestRoutes] Rejected request: id=${request.id}, by=${req.user!.username}`);
    res.json({ success: true, data: request, message: 'Request rejected' });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error rejecting request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/requests/:id/allocate
 * @desc    Allocate cluster to request
 * @access  Private (SuperAdmin)
 */
router.post('/:id/allocate', authenticate, requireSuperAdmin, allocateRequestValidation, async (req: AuthRequest, res: Response) => {
  try {
    const result = await resourceRequestService.allocateToRequest(req.params.id, {
      clusterId: req.body.clusterId,
      optimizationResult: req.body.optimizationResult,
      optimizationMode: req.body.optimizationMode,
    });
    console.log(`[RequestRoutes] Allocated cluster to request: id=${req.params.id}, clusterId=${req.body.clusterId}, by=${req.user!.username}`);
    res.json({ success: true, data: result, message: 'Cluster allocated successfully' });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error allocating cluster: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   DELETE /api/requests/:id
 * @desc    Cancel request
 * @access  Private (Owner or SuperAdmin)
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Check ownership or admin
    const existing = await resourceRequestService.getRequestById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }
    
    const isOwner = existing.requesterId === req.user!.userId;
    const isSuperAdmin = req.user!.role === 'SUPER_ADMIN';
    
    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({ success: false, error: 'Only the requester or SuperAdmin can cancel this request' });
    }
    
    const request = await resourceRequestService.cancelRequest(req.params.id);
    console.log(`[RequestRoutes] Cancelled request: id=${request.id}, by=${req.user!.username}`);
    res.json({ success: true, data: request, message: 'Request cancelled' });
  } catch (error: any) {
    console.error(`[RequestRoutes] Error cancelling request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;