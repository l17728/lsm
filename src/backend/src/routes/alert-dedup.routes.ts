/**
 * Alert Deduplication Routes
 * v3.1.0 - 智能告警降噪 API 路由
 */

import { Router, Request, Response } from 'express';
import { alertDeduplicationService } from '../services/alert-dedup';
import { AlertType, AlertSeverity } from '../services/notification.service';

const router = Router();

/**
 * GET /api/alert-dedup/status
 * 获取告警降噪服务状态
 */
router.get('/status', (req: Request, res: Response) => {
  const status = alertDeduplicationService.getStatus();
  res.json({
    success: true,
    data: status,
  });
});

/**
 * GET /api/alert-dedup/statistics
 * 获取告警统计信息
 */
router.get('/statistics', (req: Request, res: Response) => {
  const stats = alertDeduplicationService.getStatistics();
  res.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/alert-dedup/alerts
 * 获取告警列表
 */
router.get('/alerts', (req: Request, res: Response) => {
  const { active } = req.query;
  
  const alerts = active === 'true' 
    ? alertDeduplicationService.getActiveAlerts()
    : alertDeduplicationService.getAllAlerts();

  res.json({
    success: true,
    data: {
      alerts,
      total: alerts.length,
    },
  });
});

/**
 * GET /api/alert-dedup/alerts/:id
 * 获取单个告警详情
 */
router.get('/alerts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const alert = alertDeduplicationService.getAllAlerts().find(a => a.id === id);

  if (!alert) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found',
    });
  }

  res.json({
    success: true,
    data: alert,
  });
});

/**
 * POST /api/alert-dedup/alerts
 * 创建新告警（测试用）
 */
router.post('/alerts', async (req: Request, res: Response) => {
  try {
    const alert = {
      id: `alert_${Date.now()}`,
      timestamp: new Date(),
      source: 'api',
      ...req.body,
    };

    const aggregated = await alertDeduplicationService.processAlert(alert);
    
    res.status(201).json({
      success: true,
      data: aggregated,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/alert-dedup/alerts/:id/acknowledge
 * 确认告警
 */
router.post('/alerts/:id/acknowledge', (req: Request, res: Response) => {
  const { id } = req.params;
  const acknowledged = alertDeduplicationService.acknowledgeAlert(id);

  if (!acknowledged) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found',
    });
  }

  res.json({
    success: true,
    message: 'Alert acknowledged',
  });
});

/**
 * POST /api/alert-dedup/alerts/:id/resolve
 * 解决告警
 */
router.post('/alerts/:id/resolve', (req: Request, res: Response) => {
  const { id } = req.params;
  const resolved = alertDeduplicationService.resolveAlert(id);

  if (!resolved) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found',
    });
  }

  res.json({
    success: true,
    message: 'Alert resolved',
  });
});

/**
 * GET /api/alert-dedup/groups
 * 获取告警分组
 */
router.get('/groups', (req: Request, res: Response) => {
  const groups = alertDeduplicationService.getAlertGroups();
  res.json({
    success: true,
    data: {
      groups,
      total: groups.length,
    },
  });
});

/**
 * GET /api/alert-dedup/silences
 * 获取静默规则列表
 */
router.get('/silences', (req: Request, res: Response) => {
  const silences = alertDeduplicationService.getSilenceRules();
  res.json({
    success: true,
    data: {
      silences,
      total: silences.length,
    },
  });
});

/**
 * POST /api/alert-dedup/silences
 * 创建静默规则
 */
router.post('/silences', (req: Request, res: Response) => {
  try {
    const silence = alertDeduplicationService.createSilenceRule(req.body);
    res.status(201).json({
      success: true,
      data: silence,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/alert-dedup/silences/:id
 * 删除静默规则
 */
router.delete('/silences/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = alertDeduplicationService.deleteSilenceRule(id);

  if (!deleted) {
    return res.status(404).json({
      success: false,
      error: 'Silence rule not found',
    });
  }

  res.json({
    success: true,
    message: 'Silence rule deleted',
  });
});

/**
 * POST /api/alert-dedup/start
 * 启动告警降噪服务
 */
router.post('/start', (req: Request, res: Response) => {
  alertDeduplicationService.start();
  res.json({
    success: true,
    message: 'Alert deduplication service started',
  });
});

/**
 * POST /api/alert-dedup/stop
 * 停止告警降噪服务
 */
router.post('/stop', (req: Request, res: Response) => {
  alertDeduplicationService.stop();
  res.json({
    success: true,
    message: 'Alert deduplication service stopped',
  });
});

/**
 * PUT /api/alert-dedup/config
 * 更新配置
 */
router.put('/config', (req: Request, res: Response) => {
  alertDeduplicationService.updateConfig(req.body);
  res.json({
    success: true,
    message: 'Config updated',
    data: alertDeduplicationService.getStatus().config,
  });
});

export default router;