import { Router, Request, Response } from 'express';
import { alertRulesService } from '../services/alert-rules.service';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/alert-rules
 * Get all alert rules
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rules = alertRulesService.getRules();
    res.json({
      success: true,
      data: rules,
    });
  } catch (error: any) {
    console.error('[AlertRules API] Get rules error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get alert rules',
    });
  }
});

/**
 * GET /api/alert-rules/:id
 * Get a specific alert rule
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = alertRulesService.getRule(id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
      });
    }

    res.json({
      success: true,
      data: rule,
    });
  } catch (error: any) {
    console.error('[AlertRules API] Get rule error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get rule',
    });
  }
});

/**
 * POST /api/alert-rules
 * Create a new alert rule
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, type, severity, condition, threshold, recipients, escalationPolicy } = req.body;

    const rule = alertRulesService.upsertRule({
      name,
      type,
      severity,
      condition,
      threshold,
      recipients,
      escalationPolicy,
    });

    res.status(201).json({
      success: true,
      message: 'Alert rule created successfully',
      data: rule,
    });
  } catch (error: any) {
    console.error('[AlertRules API] Create rule error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create alert rule',
    });
  }
});

/**
 * PUT /api/alert-rules/:id
 * Update an alert rule
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const rule = alertRulesService.upsertRule({
      id,
      ...updates,
    });

    res.json({
      success: true,
      message: 'Alert rule updated successfully',
      data: rule,
    });
  } catch (error: any) {
    console.error('[AlertRules API] Update rule error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update alert rule',
    });
  }
});

/**
 * DELETE /api/alert-rules/:id
 * Delete an alert rule
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = alertRulesService.deleteRule(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
      });
    }

    res.json({
      success: true,
      message: 'Alert rule deleted successfully',
    });
  } catch (error: any) {
    console.error('[AlertRules API] Delete rule error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete alert rule',
    });
  }
});

/**
 * POST /api/alert-rules/:id/toggle
 * Enable/disable an alert rule
 */
router.post('/:id/toggle', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Enabled must be a boolean',
      });
    }

    const rule = alertRulesService.toggleRule(id, enabled);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
      });
    }

    res.json({
      success: true,
      message: `Rule ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: rule,
    });
  } catch (error: any) {
    console.error('[AlertRules API] Toggle rule error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to toggle rule',
    });
  }
});

/**
 * GET /api/alert-rules/metrics
 * Get alert metrics
 */
router.get('/metrics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const metrics = await alertRulesService.getMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('[AlertRules API] Get metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get metrics',
    });
  }
});

/**
 * POST /api/alert-rules/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/:id/acknowledge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    await alertRulesService.acknowledgeAlert(id, userId);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
    });
  } catch (error: any) {
    console.error('[AlertRules API] Acknowledge alert error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to acknowledge alert',
    });
  }
});

/**
 * POST /api/alert-rules/:id/resolve
 * Resolve an alert
 */
router.post('/:id/resolve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await alertRulesService.resolveAlert(id);

    res.json({
      success: true,
      message: 'Alert resolved successfully',
    });
  } catch (error: any) {
    console.error('[AlertRules API] Resolve alert error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resolve alert',
    });
  }
});

export { router as alertRulesRoutes };
export default router;
