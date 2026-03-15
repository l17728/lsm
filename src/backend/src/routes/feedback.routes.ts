/**
 * Feedback Routes - 问题反馈与需求分析 API 路由
 * v3.2.0 - 闭环系统集成
 * 
 * 端点：
 * - GET  /api/feedback/issues      - 问题列表
 * - POST /api/feedback/issues      - 创建问题
 * - GET  /api/feedback/requirements - 需求列表
 * - GET  /api/feedback/reports     - 分析报告
 * - GET  /api/feedback/stats       - 统计信息
 */

import { Router, Response } from 'express';
import { body, query, param } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import {
  feedbackService,
  requirementAnalyzerService,
  scheduledAnalyzerService,
  FeedbackType,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackTag,
  FeedbackSource,
  RequirementStatus,
  RequirementPriority,
} from '../services/feedback';

const router = Router();

// 验证错误处理
const handleValidationErrors = (req: any, res: Response, next: any) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array().map((err: any) => ({
          field: err.param,
          message: err.msg,
        })),
      },
    });
  }
  next();
};

// 所有路由需要认证
router.use(authenticate);

/**
 * @route   GET /api/feedback/issues
 * @desc    获取问题列表（支持分页和筛选）
 * @access  Private
 * @query   { type?, severity?, status?, page?, limit?, keyword? }
 */
router.get(
  '/issues',
  [
    query('type').optional().isIn(Object.values(FeedbackType)),
    query('severity').optional().isIn(Object.values(FeedbackSeverity)),
    query('status').optional().isIn(Object.values(FeedbackStatus)),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('keyword').optional().isString().trim(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { type, severity, status, page = 1, limit = 20, keyword } = req.query;

      const filter: any = {};
      if (type) filter.type = [type as FeedbackType];
      if (severity) filter.severity = [severity as FeedbackSeverity];
      if (status) filter.status = [status as FeedbackStatus];
      if (keyword) filter.keyword = keyword as string;

      const result = await feedbackService.queryFeedbacks(
        Object.keys(filter).length > 0 ? filter : undefined,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result.feedbacks,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: result.total,
          totalPages: Math.ceil(result.total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error('[FeedbackRoutes] Get issues error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get issues',
      });
    }
  }
);

/**
 * @route   POST /api/feedback/issues
 * @desc    创建问题反馈
 * @access  Private
 * @body    { type, title, description, severity?, tags?, serverId?, taskId? }
 */
router.post(
  '/issues',
  [
    body('type').isIn(Object.values(FeedbackType)).withMessage('Invalid feedback type'),
    body('title').isString().trim().isLength({ min: 1, max: 200 }),
    body('description').isString().trim().isLength({ min: 1, max: 5000 }),
    body('severity').optional().isIn(Object.values(FeedbackSeverity)),
    body('tags').optional().isArray(),
    body('serverId').optional().isString(),
    body('taskId').optional().isString(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { type, title, description, severity, tags, serverId, taskId } = req.body;
      const userId = req.user?.userId;
      const userName = req.user?.name;

      const feedback = await feedbackService.createFeedback({
        type: type as FeedbackType,
        title,
        description,
        severity: severity as FeedbackSeverity,
        tags: tags as FeedbackTag[],
        source: FeedbackSource.WEB_FORM,
        userId,
        userName,
        serverId,
        taskId,
      });

      res.status(201).json({
        success: true,
        data: feedback,
        message: 'Feedback created successfully',
      });
    } catch (error) {
      console.error('[FeedbackRoutes] Create issue error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create issue',
      });
    }
  }
);

/**
 * @route   GET /api/feedback/issues/:id
 * @desc    获取问题详情
 * @access  Private
 */
router.get(
  '/issues/:id',
  [param('id').isString().notEmpty()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const feedback = await feedbackService.getFeedback(id);

      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found',
        });
      }

      res.json({ success: true, data: feedback });
    } catch (error) {
      console.error('[FeedbackRoutes] Get issue error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get issue',
      });
    }
  }
);

/**
 * @route   PATCH /api/feedback/issues/:id/status
 * @desc    更新问题状态
 * @access  Private (Manager/Admin)
 * @body    { status, resolution? }
 */
router.patch(
  '/issues/:id/status',
  [
    param('id').isString().notEmpty(),
    body('status').isIn(Object.values(FeedbackStatus)),
    body('resolution').optional().isString().trim(),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, resolution } = req.body;
      const userId = req.user?.userId;

      const feedback = await feedbackService.updateStatus(
        id,
        status as FeedbackStatus,
        userId,
        resolution
      );

      if (!feedback) {
        return res.status(404).json({
          success: false,
          error: 'Feedback not found',
        });
      }

      res.json({
        success: true,
        data: feedback,
        message: 'Status updated successfully',
      });
    } catch (error) {
      console.error('[FeedbackRoutes] Update status error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
      });
    }
  }
);

/**
 * @route   GET /api/feedback/requirements
 * @desc    获取需求列表
 * @access  Private
 * @query   { status?, priority? }
 */
router.get(
  '/requirements',
  [
    query('status').optional().isIn(Object.values(RequirementStatus)),
    query('priority').optional().isIn(Object.values(RequirementPriority)),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, priority } = req.query;

      const statusFilter = status ? [status as RequirementStatus] : undefined;
      const requirements = await requirementAnalyzerService.getRequirements(statusFilter);

      // 按优先级筛选
      let filtered = requirements;
      if (priority) {
        filtered = requirements.filter(r => r.priority === priority);
      }

      res.json({
        success: true,
        data: filtered,
        total: filtered.length,
      });
    } catch (error) {
      console.error('[FeedbackRoutes] Get requirements error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get requirements',
      });
    }
  }
);

/**
 * @route   PATCH /api/feedback/requirements/:id/status
 * @desc    更新需求状态
 * @access  Private (Manager/Admin)
 * @body    { status }
 */
router.patch(
  '/requirements/:id/status',
  [
    param('id').isString().notEmpty(),
    body('status').isIn(Object.values(RequirementStatus)),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user?.userId;

      const requirement = await requirementAnalyzerService.updateRequirementStatus(
        id,
        status as RequirementStatus,
        userId
      );

      if (!requirement) {
        return res.status(404).json({
          success: false,
          error: 'Requirement not found',
        });
      }

      res.json({
        success: true,
        data: requirement,
        message: 'Requirement status updated',
      });
    } catch (error) {
      console.error('[FeedbackRoutes] Update requirement error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update requirement',
      });
    }
  }
);

/**
 * @route   GET /api/feedback/reports
 * @desc    获取分析报告列表
 * @access  Private
 * @query   { limit? }
 */
router.get(
  '/reports',
  [query('limit').optional().isInt({ min: 1, max: 50 })],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt((req.query.limit as string) || '10');
      const reports = scheduledAnalyzerService.getReports(limit);

      res.json({
        success: true,
        data: reports.map(r => ({
          id: r.id,
          generatedAt: r.createdAt,
          summary: r.report.summary,
        })),
      });
    } catch (error) {
      console.error('[FeedbackRoutes] Get reports error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get reports',
      });
    }
  }
);

/**
 * @route   GET /api/feedback/reports/:id
 * @desc    获取报告详情
 * @access  Private
 */
router.get(
  '/reports/:id',
  [param('id').isString().notEmpty()],
  handleValidationErrors,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const report = scheduledAnalyzerService.getReport(id);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report not found',
        });
      }

      res.json({ success: true, data: report });
    } catch (error) {
      console.error('[FeedbackRoutes] Get report error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get report',
      });
    }
  }
);

/**
 * @route   POST /api/feedback/reports/generate
 * @desc    手动生成分析报告
 * @access  Private (Admin)
 */
router.post(
  '/reports/generate',
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
      }

      const report = await scheduledAnalyzerService.triggerReport();

      res.json({
        success: true,
        data: report,
        message: 'Report generated successfully',
      });
    } catch (error) {
      console.error('[FeedbackRoutes] Generate report error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate report',
      });
    }
  }
);

/**
 * @route   GET /api/feedback/stats
 * @desc    获取统计信息
 * @access  Private
 */
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const summary = await scheduledAnalyzerService.getSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    });
  }
});

/**
 * @route   POST /api/feedback/scan
 * @desc    手动触发问题扫描
 * @access  Private (Admin)
 */
router.post('/scan', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    const result = await scheduledAnalyzerService.triggerScan();

    res.json({
      success: true,
      data: result,
      message: 'Scan completed',
    });
  } catch (error) {
    console.error('[FeedbackRoutes] Trigger scan error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger scan',
    });
  }
});

export default router;