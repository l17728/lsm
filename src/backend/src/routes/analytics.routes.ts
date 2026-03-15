import { Router } from 'express';
import { query } from 'express-validator';
import analyticsService from '../services/analytics.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/analytics/summary
 * @desc    Get analytics summary for dashboard
 * @access  Private
 */
router.get(
  '/summary',
  [
    query('startTime').optional().isISO8601().withMessage('Valid start time required'),
    query('endTime').optional().isISO8601().withMessage('Valid end time required'),
  ],
  async (req, res) => {
    try {
      const { startTime, endTime } = req.query;
      
      const summary = await analyticsService.getSummary(
        startTime ? new Date(startTime as string) : undefined,
        endTime ? new Date(endTime as string) : undefined
      );

      res.json({
        success: true,
        data: summary,
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
 * @route   GET /api/analytics/resource-trends
 * @desc    Get resource usage trends over time
 * @access  Private
 */
router.get(
  '/resource-trends',
  [
    query('startTime').optional().isISO8601().withMessage('Valid start time required'),
    query('endTime').optional().isISO8601().withMessage('Valid end time required'),
  ],
  async (req, res) => {
    try {
      const { startTime, endTime } = req.query;
      
      const trends = await analyticsService.getResourceTrends(
        startTime ? new Date(startTime as string) : undefined,
        endTime ? new Date(endTime as string) : undefined
      );

      res.json({
        success: true,
        data: trends,
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
 * @route   GET /api/analytics/cost-breakdown
 * @desc    Get cost breakdown by category
 * @access  Private
 */
router.get(
  '/cost-breakdown',
  [
    query('startTime').optional().isISO8601().withMessage('Valid start time required'),
    query('endTime').optional().isISO8601().withMessage('Valid end time required'),
  ],
  async (req, res) => {
    try {
      const { startTime, endTime } = req.query;
      
      const breakdown = await analyticsService.getCostBreakdown(
        startTime ? new Date(startTime as string) : undefined,
        endTime ? new Date(endTime as string) : undefined
      );

      res.json({
        success: true,
        data: breakdown,
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
 * @route   GET /api/analytics/server-utilization
 * @desc    Get server utilization details
 * @access  Private
 */
router.get('/server-utilization', async (req, res) => {
  try {
    const utilization = await analyticsService.getServerUtilization();

    res.json({
      success: true,
      data: utilization,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/analytics/efficiency-report
 * @desc    Get efficiency report with recommendations
 * @access  Private
 */
router.get('/efficiency-report', async (req, res) => {
  try {
    const report = await analyticsService.getEfficiencyReport();

    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/analytics/export
 * @desc    Export analytics report
 * @access  Private
 */
router.get(
  '/export',
  [
    query('startTime').optional().isISO8601().withMessage('Valid start time required'),
    query('endTime').optional().isISO8601().withMessage('Valid end time required'),
    query('format').optional().isIn(['json', 'csv']).withMessage('Format must be json or csv'),
  ],
  async (req, res) => {
    try {
      const { startTime, endTime, format = 'json' } = req.query;
      
      const [summary, trends, costBreakdown, utilization, efficiency] = await Promise.all([
        analyticsService.getSummary(
          startTime ? new Date(startTime as string) : undefined,
          endTime ? new Date(endTime as string) : undefined
        ),
        analyticsService.getResourceTrends(
          startTime ? new Date(startTime as string) : undefined,
          endTime ? new Date(endTime as string) : undefined
        ),
        analyticsService.getCostBreakdown(
          startTime ? new Date(startTime as string) : undefined,
          endTime ? new Date(endTime as string) : undefined
        ),
        analyticsService.getServerUtilization(),
        analyticsService.getEfficiencyReport(),
      ]);

      const report = {
        generatedAt: new Date().toISOString(),
        timeRange: {
          start: startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: endTime || new Date().toISOString(),
        },
        summary,
        resourceTrends: trends,
        costBreakdown,
        serverUtilization: utilization,
        efficiencyReport: efficiency,
      };

      if (format === 'csv') {
        // Convert to CSV format
        const csvLines = [
          'LSM Analytics Report',
          `Generated: ${report.generatedAt}`,
          '',
          'Summary',
          `Total Cost,${summary.totalCost}`,
          `Avg Utilization,${summary.avgUtilization}%`,
          `Efficiency,${summary.efficiency}%`,
          '',
          'Cost Breakdown',
          'Category,Amount,Percentage,Trend',
          ...costBreakdown.map(c => `${c.category},${c.amount},${c.percentage}%,${c.trend}%`),
          '',
          'Server Utilization',
          'Server,CPU Cores,Memory (GB),CPU Usage,Memory Usage,GPU Count,GPU Usage,Utilization,Cost,Efficiency',
          ...utilization.map(u => 
            `${u.serverName},${u.cpuCores},${u.totalMemory},${u.cpuUsage}%,${u.memoryUsage}%,${u.gpuCount},${u.gpuUsage || 'N/A'},${u.utilization}%,${u.cost},${u.efficiency}%`
          ),
        ];

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.csv"`);
        res.send(csvLines.join('\n'));
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.json"`);
        res.json({
          success: true,
          data: report,
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

export default router;