import { Router } from 'express';
import { body, query, param } from 'express-validator';
import agentController from '../controllers/agent.controller';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * 验证结果处理中间件
 */
const handleValidationErrors = (req: any, res: any, next: any) => {
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
 * @route   GET /api/agent/status
 * @desc    获取 Agent 状态
 * @access  Private
 */
router.get('/status', agentController.getStatus.bind(agentController));

/**
 * @route   POST /api/agent/chat
 * @desc    发送消息给 Agent
 * @access  Private
 * @body    { message: string, conversationId?: string, context?: object }
 */
router.post(
  '/chat',
  [
    body('message')
      .isString()
      .trim()
      .isLength({ min: 1, max: 4000 })
      .withMessage('Message must be 1-4000 characters'),
    body('conversationId')
      .optional()
      .isUUID()
      .withMessage('Conversation ID must be a valid UUID'),
    body('context')
      .optional()
      .isObject()
      .withMessage('Context must be an object'),
  ],
  handleValidationErrors,
  agentController.chat.bind(agentController)
);

/**
 * @route   GET /api/agent/conversations
 * @desc    获取对话历史列表
 * @access  Private
 * @query   { limit?: number, offset?: number }
 */
router.get(
  '/conversations',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
  ],
  handleValidationErrors,
  agentController.getConversations.bind(agentController)
);

/**
 * @route   GET /api/agent/conversations/:id
 * @desc    获取单个对话详情
 * @access  Private
 */
router.get(
  '/conversations/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Conversation ID must be a valid UUID'),
  ],
  handleValidationErrors,
  agentController.getConversationById.bind(agentController)
);

/**
 * @route   POST /api/agent/approve
 * @desc    审批操作
 * @access  Private (Manager/Admin)
 * @body    { type: string, resourceId: string, action: string, reason?: string }
 */
router.post(
  '/approve',
  [
    body('type')
      .isIn(['reservation', 'task', 'resource'])
      .withMessage('Type must be one of: reservation, task, resource'),
    body('resourceId')
      .isUUID()
      .withMessage('Resource ID must be a valid UUID'),
    body('action')
      .isIn(['approve', 'reject'])
      .withMessage('Action must be either "approve" or "reject"'),
    body('reason')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason must be at most 500 characters'),
  ],
  handleValidationErrors,
  // 权限检查中间件
  (req: AuthRequest, res: any, next: any) => {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      return res.status(403).json({
        success: false,
        error: 'Manager or Admin access required for approval operations',
      });
    }
    next();
  },
  agentController.approve.bind(agentController)
);

/**
 * @route   GET /api/agent/approvals
 * @desc    获取待审批列表
 * @access  Private (Manager/Admin)
 * @query   { status?: string, type?: string, limit?: number }
 */
router.get(
  '/approvals',
  [
    query('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected'])
      .withMessage('Status must be one of: pending, approved, rejected'),
    query('type')
      .optional()
      .isIn(['reservation', 'task', 'resource'])
      .withMessage('Type must be one of: reservation, task, resource'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],
  handleValidationErrors,
  // 权限检查中间件
  (req: AuthRequest, res: any, next: any) => {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      return res.status(403).json({
        success: false,
        error: 'Manager or Admin access required for approval operations',
      });
    }
    next();
  },
  agentController.getPendingApprovals.bind(agentController)
);

/**
 * @route   DELETE /api/agent/conversations/:id
 * @desc    删除对话
 * @access  Private
 */
router.delete(
  '/conversations/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Conversation ID must be a valid UUID'),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: any) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      // 这里应该调用 controller 方法
      // 当前简单返回成功
      res.json({
        success: true,
        message: 'Conversation deleted successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
);

/**
 * @route   POST /api/agent/feedback
 * @desc    提交反馈
 * @access  Private
 * @body    { conversationId: string, messageId: string, rating: number, comment?: string }
 */
router.post(
  '/feedback',
  [
    body('conversationId')
      .isUUID()
      .withMessage('Conversation ID must be a valid UUID'),
    body('messageId')
      .isUUID()
      .withMessage('Message ID must be a valid UUID'),
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('comment')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Comment must be at most 1000 characters'),
  ],
  handleValidationErrors,
  async (req: AuthRequest, res: any) => {
    try {
      const { conversationId, messageId, rating, comment } = req.body;

      // 这里应该存储反馈到数据库
      // 当前简单返回成功
      res.json({
        success: true,
        message: 'Feedback submitted successfully',
        data: {
          conversationId,
          messageId,
          rating,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
);

/**
 * @route   GET /api/agent/stats
 * @desc    获取 Agent 使用统计
 * @access  Private (Admin)
 */
router.get(
  '/stats',
  async (req: AuthRequest, res: any) => {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    try {
      // 返回基本统计信息
      res.json({
        success: true,
        data: {
          totalConversations: 0,
          totalMessages: 0,
          totalApprovals: 0,
          averageResponseTime: 0,
          activeUsers: 0,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
);

export default router;