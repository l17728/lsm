/**
 * Auto-Scaling Routes
 * v3.1.0 - 自动扩缩容 API 路由
 */

import { Router, Request, Response } from 'express';
import { autoScalingService, ScalingStrategyType, ScalingMetricType } from '../services/autoscaling';

const router = Router();

/**
 * GET /api/autoscaling/status
 * 获取自动扩缩容服务状态
 */
router.get('/status', (req: Request, res: Response) => {
  const status = autoScalingService.getStatus();
  res.json({
    success: true,
    data: status,
  });
});

/**
 * GET /api/autoscaling/policies
 * 获取所有扩缩容策略
 */
router.get('/policies', (req: Request, res: Response) => {
  const policies = autoScalingService.getPolicies();
  const states = policies.map(p => ({
    ...p,
    state: autoScalingService.getPolicyState(p.id),
  }));

  res.json({
    success: true,
    data: {
      policies: states,
      total: policies.length,
    },
  });
});

/**
 * GET /api/autoscaling/policies/:id
 * 获取单个策略详情
 */
router.get('/policies/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const policy = autoScalingService.getPolicies().find(p => p.id === id);

  if (!policy) {
    return res.status(404).json({
      success: false,
      error: 'Policy not found',
    });
  }

  res.json({
    success: true,
    data: {
      ...policy,
      state: autoScalingService.getPolicyState(id),
    },
  });
});

/**
 * POST /api/autoscaling/policies
 * 创建新策略
 */
router.post('/policies', (req: Request, res: Response) => {
  try {
    const policy = autoScalingService.upsertPolicy(req.body);
    res.status(201).json({
      success: true,
      data: policy,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/autoscaling/policies/:id
 * 更新策略
 */
router.put('/policies/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const policy = autoScalingService.upsertPolicy({ ...req.body, id });
    res.json({
      success: true,
      data: policy,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/autoscaling/policies/:id
 * 删除策略
 */
router.delete('/policies/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = autoScalingService.deletePolicy(id);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: 'Policy not found',
    });
  }

  res.json({
    success: true,
    message: 'Policy deleted',
  });
});

/**
 * POST /api/autoscaling/policies/:id/toggle
 * 启用/禁用策略
 */
router.post('/policies/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled } = req.body;

  const policy = autoScalingService.togglePolicy(id, enabled);

  if (!policy) {
    return res.status(404).json({
      success: false,
      error: 'Policy not found',
    });
  }

  res.json({
    success: true,
    data: policy,
  });
});

/**
 * POST /api/autoscaling/manual-scale
 * 手动触发扩缩容
 */
router.post('/manual-scale', async (req: Request, res: Response) => {
  const { policyId, targetInstances } = req.body;

  if (!policyId || targetInstances === undefined) {
    return res.status(400).json({
      success: false,
      error: 'policyId and targetInstances are required',
    });
  }

  try {
    const event = await autoScalingService.manualScale(policyId, targetInstances);
    res.json({
      success: true,
      data: event,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/autoscaling/events
 * 获取扩缩容历史事件
 */
router.get('/events', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const events = autoScalingService.getEvents(limit);

  res.json({
    success: true,
    data: {
      events,
      total: events.length,
    },
  });
});

/**
 * POST /api/autoscaling/start
 * 启动自动评估
 */
router.post('/start', (req: Request, res: Response) => {
  const intervalSeconds = req.body.intervalSeconds || 60;
  autoScalingService.startAutoEvaluation(intervalSeconds);

  res.json({
    success: true,
    message: `Auto-evaluation started with ${intervalSeconds}s interval`,
  });
});

/**
 * POST /api/autoscaling/stop
 * 停止自动评估
 */
router.post('/stop', (req: Request, res: Response) => {
  autoScalingService.stopAutoEvaluation();

  res.json({
    success: true,
    message: 'Auto-evaluation stopped',
  });
});

/**
 * GET /api/autoscaling/strategy-types
 * 获取可用的策略类型
 */
router.get('/strategy-types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(ScalingStrategyType),
  });
});

/**
 * GET /api/autoscaling/metric-types
 * 获取可用的指标类型
 */
router.get('/metric-types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(ScalingMetricType),
  });
});

export default router;