import { Router } from 'express';
import { body, param } from 'express-validator';
import serverService from '../services/server.service';
import { authenticate, requireAdmin, requireManager, AuthRequest } from '../middleware/auth.middleware';
import { ServerStatus } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/servers
 * @desc    Get all servers
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const servers = await serverService.getAllServers();

    res.json({
      success: true,
      data: servers,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/servers/stats
 * @desc    Get server statistics
 * @access  Private
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await serverService.getServerStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/servers/available
 * @desc    Get available servers (online with available GPUs)
 * @access  Private
 */
router.get('/available', async (req, res) => {
  try {
    const servers = await serverService.getAvailableServers();

    res.json({
      success: true,
      data: servers,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/servers/:id
 * @desc    Get server by ID
 * @access  Private
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Valid server ID required')],
  async (req, res) => {
    try {
      const { id } = req.params;

      const server = await serverService.getServerById(id);

      if (!server) {
        return res.status(404).json({
          success: false,
          error: 'Server not found',
        });
      }

      res.json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route   POST /api/servers
 * @desc    Create a new server
 * @access  Private/Admin
 */
router.post(
  '/',
  requireAdmin,
  [
    body('name').notEmpty().withMessage('Server name required'),
    body('hostname').notEmpty().withMessage('Hostname required'),
    body('ipAddress').isIP().withMessage('Valid IP address required'),
    body('cpuCores').isInt({ min: 1 }).withMessage('CPU cores must be at least 1'),
    body('totalMemory').isInt({ min: 1 }).withMessage('Total memory must be at least 1 GB'),
  ],
  async (req, res) => {
    try {
      const { name, hostname, ipAddress, cpuCores, totalMemory, gpuCount, gpus } = req.body;

      const server = await serverService.createServer({
        name,
        hostname,
        ipAddress,
        cpuCores,
        totalMemory,
        gpuCount,
        gpus,
      });

      res.status(201).json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route   PUT /api/servers/:id
 * @desc    Update server
 * @access  Private/Manager
 */
router.put(
  '/:id',
  requireManager,
  [param('id').isUUID().withMessage('Valid server ID required')],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, hostname, ipAddress, cpuCores, totalMemory, status } = req.body;

      const server = await serverService.updateServer(id, {
        name,
        hostname,
        ipAddress,
        cpuCores,
        totalMemory,
        status,
      });

      res.json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route   PATCH /api/servers/:id/status
 * @desc    Update server status
 * @access  Private/Manager
 */
router.patch(
  '/:id/status',
  requireManager,
  [
    param('id').isUUID().withMessage('Valid server ID required'),
    body('status').isIn(['ONLINE', 'OFFLINE', 'MAINTENANCE', 'ERROR']).withMessage('Invalid status'),
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const server = await serverService.updateServerStatus(id, status as ServerStatus);

      res.json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route   DELETE /api/servers/:id
 * @desc    Delete server
 * @access  Private/Admin
 */
router.delete(
  '/:id',
  requireAdmin,
  [param('id').isUUID().withMessage('Valid server ID required')],
  async (req, res) => {
    try {
      const { id } = req.params;

      await serverService.deleteServer(id);

      res.json({
        success: true,
        message: 'Server deleted successfully',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route   GET /api/servers/:id/metrics
 * @desc    Get server metrics for a time range
 * @access  Private
 */
router.get(
  '/:id/metrics',
  [
    param('id').isUUID().withMessage('Valid server ID required'),
    body('startTime').optional().isISO8601().withMessage('Valid start time required'),
    body('endTime').optional().isISO8601().withMessage('Valid end time required'),
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { startTime, endTime } = req.query;

      const start = startTime ? new Date(startTime as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = endTime ? new Date(endTime as string) : new Date();

      const metrics = await serverService.getServerMetrics(id, start, end);

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

export default router;
