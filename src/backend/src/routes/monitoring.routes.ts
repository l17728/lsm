import { Router } from 'express';
import { param } from 'express-validator';
import monitoringService from '../services/monitoring.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/monitoring/health
 * @desc    Get health status of all servers
 * @access  Private
 */
router.get('/health', async (req, res) => {
  try {
    const health = await monitoringService.getServerHealth();

    res.json({
      success: true,
      data: health,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/monitoring/cluster-stats
 * @desc    Get aggregated cluster statistics
 * @access  Private
 */
router.get('/cluster-stats', async (req, res) => {
  try {
    const stats = await monitoringService.getClusterStats();

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
 * @route   GET /api/monitoring/alerts
 * @desc    Get current alerts
 * @access  Private
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await monitoringService.getAlerts();

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/monitoring/servers/:id/metrics
 * @desc    Get metrics for a server in a time range
 * @access  Private
 */
router.get(
  '/servers/:id/metrics',
  [param('id').isUUID().withMessage('Valid server ID required')],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { startTime, endTime } = req.query;

      const start = startTime
        ? new Date(startTime as string)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const end = endTime ? new Date(endTime as string) : new Date();

      const metrics = await monitoringService.getMetricsRange(id, start, end);

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

/**
 * @route   POST /api/monitoring/collect
 * @desc    Trigger metrics collection (internal use)
 * @access  Private
 */
router.post('/collect', async (req, res) => {
  try {
    const results = await monitoringService.collectMetrics();

    res.json({
      success: true,
      data: {
        collected: results.length,
        servers: results,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
