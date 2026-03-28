/**
 * Self-Healing Routes
 * v3.1.0 - 故障自愈 API 路由
 */

import { Router, Request, Response } from 'express';
import { selfHealingService, FaultType, FaultLevel, RepairActionType } from '../services/self-healing';

const router = Router();

/**
 * GET /api/self-healing/status
 * 获取故障自愈服务状态
 */
router.get('/status', (req: Request, res: Response) => {
  const status = selfHealingService.getStatus();
  res.json({
    success: true,
    data: status,
  });
});

/**
 * GET /api/self-healing/rules
 * 获取所有故障规则
 */
router.get('/rules', (req: Request, res: Response) => {
  const rules = selfHealingService.getRules();
  res.json({
    success: true,
    data: {
      rules,
      total: rules.length,
    },
  });
});

/**
 * POST /api/self-healing/rules
 * 创建新规则
 */
router.post('/rules', (req: Request, res: Response) => {
  try {
    const rule = selfHealingService.upsertRule(req.body);
    res.status(201).json({
      success: true,
      data: rule,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/self-healing/rules/:id
 * 更新规则
 */
router.put('/rules/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const rule = selfHealingService.upsertRule({ ...req.body, id });
    res.json({
      success: true,
      data: rule,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/self-healing/events
 * 获取故障事件
 */
router.get('/events', (req: Request, res: Response) => {
  const { active } = req.query;
  
  const events = active === 'true' 
    ? selfHealingService.getActiveEvents()
    : selfHealingService.getAllEvents();

  res.json({
    success: true,
    data: {
      events,
      total: events.length,
    },
  });
});

/**
 * GET /api/self-healing/events/:id
 * 获取单个故障事件
 */
router.get('/events/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const event = selfHealingService.getAllEvents().find(e => e.id === id);

  if (!event) {
    return res.status(404).json({
      success: false,
      error: 'Event not found',
    });
  }

  res.json({
    success: true,
    data: event,
  });
});

/**
 * POST /api/self-healing/events/:id/repair
 * 手动触发修复
 */
router.post('/events/:id/repair', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await selfHealingService.manualRepair(id);
    res.json({
      success: true,
      message: 'Repair initiated',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/self-healing/events/:id/ignore
 * 忽略事件
 */
router.post('/events/:id/ignore', (req: Request, res: Response) => {
  const { id } = req.params;
  const ignored = selfHealingService.ignoreEvent(id);

  if (!ignored) {
    return res.status(404).json({
      success: false,
      error: 'Event not found',
    });
  }

  res.json({
    success: true,
    message: 'Event ignored',
  });
});

/**
 * GET /api/self-healing/history
 * 获取修复历史
 */
router.get('/history', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const history = selfHealingService.getRepairHistory(limit);

  res.json({
    success: true,
    data: {
      history,
      total: history.length,
    },
  });
});

/**
 * POST /api/self-healing/start
 * 启动故障检测
 */
router.post('/start', (req: Request, res: Response) => {
  const intervalSeconds = req.body.intervalSeconds || 30;
  selfHealingService.startDetection(intervalSeconds);

  res.json({
    success: true,
    message: `Fault detection started with ${intervalSeconds}s interval`,
  });
});

/**
 * POST /api/self-healing/stop
 * 停止故障检测
 */
router.post('/stop', (req: Request, res: Response) => {
  selfHealingService.stopDetection();

  res.json({
    success: true,
    message: 'Fault detection stopped',
  });
});

/**
 * GET /api/self-healing/fault-types
 * 获取可用的故障类型
 */
router.get('/fault-types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(FaultType),
  });
});

/**
 * GET /api/self-healing/fault-levels
 * 获取可用的故障级别
 */
router.get('/fault-levels', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(FaultLevel),
  });
});

/**
 * GET /api/self-healing/repair-actions
 * 获取可用的修复动作类型
 */
router.get('/repair-actions', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.values(RepairActionType),
  });
});

export default router;