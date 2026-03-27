/**
 * Cluster Management Routes
 * 
 * All routes require SUPER_ADMIN role.
 * 
 * Endpoints:
 * - GET    /api/clusters           - List all clusters
 * - GET    /api/clusters/:id       - Get cluster details
 * - POST   /api/clusters           - Create cluster
 * - PUT    /api/clusters/:id       - Update cluster
 * - DELETE /api/clusters/:id       - Delete cluster
 * - POST   /api/clusters/:id/servers        - Add server to cluster
 * - DELETE /api/clusters/:id/servers/:serverId - Remove server from cluster
 * - POST   /api/clusters/:id/allocate       - Allocate cluster
 * - POST   /api/clusters/:id/release        - Release cluster
 * - GET    /api/clusters/available-servers  - Get servers not in any cluster
 * - GET    /api/clusters/stats              - Get cluster statistics
 */
import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { clusterService } from '../services/cluster.service';
import { authenticate, requireSuperAdmin, requireSuperAdminOrAdmin, requireManager, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// ==================== Validation ====================

const createClusterValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('code').trim().notEmpty().matches(/^[A-Z0-9_-]+$/).withMessage('Code must be uppercase letters, numbers, underscore or hyphen'),
  body('type').optional().isIn(['COMPUTE', 'TRAINING', 'INFERENCE', 'GENERAL', 'CUSTOM']),
];

const updateClusterValidation = [
  param('id').isUUID(),
  body('name').optional().trim().notEmpty(),
  body('type').optional().isIn(['COMPUTE', 'TRAINING', 'INFERENCE', 'GENERAL', 'CUSTOM']),
  body('status').optional().isIn(['AVAILABLE', 'ALLOCATED', 'RESERVED', 'MAINTENANCE', 'OFFLINE']),
];

const addServerValidation = [
  param('id').isUUID(),
  body('serverId').isUUID(),
  body('priority').optional().isInt({ min: 0 }),
  body('role').optional().isString(),
];

const allocateValidation = [
  param('id').isUUID(),
  body('userId').isUUID(),
  body('teamId').optional().isUUID(),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  body('purpose').optional().isString(),
  body('requestId').optional().isUUID(),
];

// ==================== Routes ====================

/**
 * @route   GET /api/clusters
 * @desc    Get all clusters
 * @access  Private (MANAGER and above can view)
 */
router.get('/', authenticate, requireManager, async (req: AuthRequest, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.type) filters.type = req.query.type;

    const clusters = await clusterService.getAllClusters(filters);
    res.json({ success: true, data: clusters });
  } catch (error: any) {
    console.error(`[ClusterRoutes] Error fetching clusters: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/clusters/stats
 * @desc    Get cluster statistics
 * @access  Private (MANAGER and above can view)
 */
router.get('/stats', authenticate, requireManager, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await clusterService.getClusterStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error(`[ClusterRoutes] Error fetching stats: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/clusters/available-servers
 * @desc    Get servers available for adding to clusters
 * @access  Private (SuperAdmin)
 */
router.get('/available-servers', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const servers = await clusterService.getAvailableServers();
    res.json({ success: true, data: servers });
  } catch (error: any) {
    console.error(`[ClusterRoutes] Error fetching available servers: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/clusters/:id
 * @desc    Get cluster by ID
 * @access  Private (MANAGER and above can view)
 */
router.get('/:id', authenticate, requireManager, async (req: AuthRequest, res: Response) => {
  try {
    const cluster = await clusterService.getClusterById(req.params.id);
    if (!cluster) {
      return res.status(404).json({ success: false, error: 'Cluster not found' });
    }
    res.json({ success: true, data: cluster });
  } catch (error: any) {
    console.error(`[ClusterRoutes] Error fetching cluster: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/clusters
 * @desc    Create a new cluster
 * @access  Private (SuperAdmin)
 */
router.post('/', authenticate, requireSuperAdmin, createClusterValidation, async (req: AuthRequest, res: Response) => {
  try {
    const cluster = await clusterService.createCluster(req.body, req.user!.userId);
    console.log(`[ClusterRoutes] Created cluster: id=${cluster.id}, by=${req.user!.username}`);
    res.status(201).json({ success: true, data: cluster });
  } catch (error: any) {
    console.error(`[ClusterRoutes] Error creating cluster: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   PUT /api/clusters/:id
 * @desc    Update cluster
 * @access  Private (SuperAdmin)
 */
router.put('/:id', authenticate, requireSuperAdmin, updateClusterValidation, async (req: AuthRequest, res: Response) => {
  try {
    const cluster = await clusterService.updateCluster(req.params.id, req.body);
    console.log(`[ClusterRoutes] Updated cluster: id=${cluster.id}, by=${req.user!.username}`);
    res.json({ success: true, data: cluster });
  } catch (error: any) {
    console.error(`[ClusterRoutes] Error updating cluster: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   DELETE /api/clusters/:id
 * @desc    Delete cluster
 * @access  Private (SuperAdmin)
 */
router.delete('/:id', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await clusterService.deleteCluster(req.params.id);
    console.log(`[ClusterRoutes] Deleted cluster: id=${req.params.id}, by=${req.user!.username}`);
    res.json({ success: true, message: 'Cluster deleted' });
  } catch (error: any) {
    console.error(`[ClusterRoutes] Error deleting cluster: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/clusters/:id/servers
 * @desc    Add server to cluster
 * @access  Private (SuperAdmin)
 */
router.post('/:id/servers', authenticate, requireSuperAdmin, addServerValidation, async (req: AuthRequest, res: Response) => {
  try {
    const result = await clusterService.addServer(req.params.id, req.body, req.user!.userId);
    console.log(`[ClusterRoutes] Added server ${req.body.serverId} to cluster ${req.params.id}, by=${req.user!.username}`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error(`[ClusterRoutes] Error adding server: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   DELETE /api/clusters/:id/servers/:serverId
 * @desc    Remove server from cluster
 * @access  Private (SuperAdmin)
 */
router.delete('/:id/servers/:serverId', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await clusterService.removeServer(req.params.id, req.params.serverId);
    console.log(`[ClusterRoutes] Removed server ${req.params.serverId} from cluster ${req.params.id}, by=${req.user!.username}`);
    res.json({ success: true, message: 'Server removed from cluster' });
  } catch (error: any) {
    console.error(`[ClusterRoutes] Error removing server: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/clusters/:id/allocate
 * @desc    Allocate cluster to user
 * @access  Private (SuperAdmin)
 */
router.post('/:id/allocate', authenticate, requireSuperAdmin, allocateValidation, async (req: AuthRequest, res: Response) => {
  try {
    const data = {
      userId: req.body.userId,
      teamId: req.body.teamId,
      startTime: new Date(req.body.startTime),
      endTime: new Date(req.body.endTime),
      purpose: req.body.purpose,
      requestId: req.body.requestId,
    };
    const result = await clusterService.allocateCluster(req.params.id, data);
    console.log(`[ClusterRoutes] Allocated cluster ${req.params.id} to user ${req.body.userId}, by=${req.user!.username}`);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error(`[ClusterRoutes] Error allocating cluster: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/clusters/:id/release
 * @desc    Release cluster allocation
 * @access  Private (SuperAdmin)
 */
router.post('/:id/release', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Find active allocation for this cluster
    const cluster = await clusterService.getClusterById(req.params.id) as any;
    if (!cluster || !cluster.allocations || cluster.allocations.length === 0) {
      return res.status(404).json({ success: false, error: 'No active allocation found' });
    }
    
    const activeAllocation = cluster.allocations.find((a: any) => a.status === 'ACTIVE');
    if (!activeAllocation) {
      return res.status(404).json({ success: false, error: 'No active allocation found' });
    }

    await clusterService.releaseCluster(activeAllocation.id);
    console.log(`[ClusterRoutes] Released cluster ${req.params.id}, by=${req.user!.username}`);
    res.json({ success: true, message: 'Cluster released' });
  } catch (error: any) {
    console.error(`[ClusterRoutes] Error releasing cluster: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;