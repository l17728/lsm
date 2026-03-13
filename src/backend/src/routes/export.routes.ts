import { Router } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.middleware';
import {
  exportServersToCSV,
  exportTasksToCSV,
  exportGpusToExcel,
  exportUsersToExcel,
  exportMetricsToCSV,
} from '../services/export.service';

const router = Router();

// All export routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/export/servers/csv
 * @desc    Export servers to CSV
 * @access  Private
 */
router.get('/servers/csv', async (req: AuthRequest, res) => {
  try {
    const csv = await exportServersToCSV();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=servers.csv');

    res.send(csv);
  } catch (error: any) {
    console.error('[Export] Servers CSV export failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export servers',
    });
  }
});

/**
 * @route   GET /api/export/tasks/csv
 * @desc    Export tasks to CSV
 * @access  Private
 */
router.get('/tasks/csv', async (req: AuthRequest, res) => {
  try {
    const csv = await exportTasksToCSV();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv');

    res.send(csv);
  } catch (error: any) {
    console.error('[Export] Tasks CSV export failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export tasks',
    });
  }
});

/**
 * @route   GET /api/export/gpus/excel
 * @desc    Export GPUs to Excel
 * @access  Private
 */
router.get('/gpus/excel', async (req: AuthRequest, res) => {
  try {
    const buffer = await exportGpusToExcel();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=gpus.xlsx');

    res.send(buffer);
  } catch (error: any) {
    console.error('[Export] GPUs Excel export failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export GPUs',
    });
  }
});

/**
 * @route   GET /api/export/users/excel
 * @desc    Export users to Excel
 * @access  Private/Admin
 */
router.get('/users/excel', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const buffer = await exportUsersToExcel();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');

    res.send(buffer);
  } catch (error: any) {
    console.error('[Export] Users Excel export failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export users',
    });
  }
});

/**
 * @route   GET /api/export/metrics/csv
 * @desc    Export metrics to CSV
 * @access  Private
 */
router.get('/metrics/csv', async (req: AuthRequest, res) => {
  try {
    const { serverId } = req.query;
    const csv = await exportMetricsToCSV(serverId as string);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=metrics.csv');

    res.send(csv);
  } catch (error: any) {
    console.error('[Export] Metrics CSV export failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export metrics',
    });
  }
});

/**
 * @route   GET /api/export/summary
 * @desc    Export system summary (all data)
 * @access  Private/Admin
 */
router.get('/summary', requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Return summary JSON
    res.json({
      success: true,
      message: 'Export summary available',
      endpoints: {
        servers: '/api/export/servers/csv',
        tasks: '/api/export/tasks/csv',
        gpus: '/api/export/gpus/excel',
        users: '/api/export/users/excel',
        metrics: '/api/export/metrics/csv',
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
