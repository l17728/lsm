import { Router } from 'express';
import { body, param } from 'express-validator';
import taskService from '../services/task.service';
import { authenticate, requireAdmin, requireManager, AuthRequest } from '../middleware/auth.middleware';
import { task_status as TaskStatus } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/tasks/stats
 * @desc    Get task statistics
 * @access  Private
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await taskService.getTaskStats();

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
 * @route   GET /api/tasks
 * @desc    Get user's tasks
 * @access  Private
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const status = req.query.status as TaskStatus | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const tasks = await taskService.getUserTasks(userId, status, limit);

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/tasks/all
 * @desc    Get all tasks (admin)
 * @access  Private/Admin
 */
router.get('/all', async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    const status = req.query.status as TaskStatus | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    const tasks = await taskService.getAllTasks(status, limit);

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/tasks/pending
 * @desc    Get pending tasks (for scheduler)
 * @access  Private
 */
router.get('/pending', async (req, res) => {
  try {
    const tasks = await taskService.getPendingTasks();

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/tasks/:id
 * @desc    Get task by ID
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const task = await taskService.getTask(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 */
router.post(
  '/',
  [
    body('name').isLength({ min: 1, max: 100 }).withMessage('Task name must be 1-100 characters'),
    body('description').optional().isString(),
    body('priority').optional().isInt({ min: 0, max: 10 }),
    body('scheduledAt').optional().isISO8601(),
  ],
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { name, description, priority } = req.body;

      const task = await taskService.createTask({
        name,
        description,
        userId,
        priority,
      });

      res.status(201).json({
        success: true,
        data: task,
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
 * @route   PUT /api/tasks/:id
 * @desc    Update task
 * @access  Private
 */
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Valid task ID required'),
    body('name').optional().isLength({ min: 1, max: 100 }),
    body('description').optional().isString(),
    body('priority').optional().isInt({ min: 0, max: 10 }),
  ],
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const { name, description, priority } = req.body;

      const task = await taskService.updateTask(id, {
        name,
        description,
        priority,
      }, userId);

      res.json({
        success: true,
        data: task,
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
 * @route   DELETE /api/tasks/batch
 * @desc    Batch delete tasks
 * @access  Private
 */
router.delete(
  '/batch',
  [
    body('ids').isArray({ min: 1 }).withMessage('Task IDs must be an array with at least one ID'),
    body('ids.*').isUUID().withMessage('Each task ID must be a valid UUID'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { ids } = req.body;
      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ id: string; error: string }>,
      };

      for (const id of ids) {
        try {
          await taskService.deleteTask(id, userId);
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({ id, error: error.message });
        }
      }

      res.json({
        success: true,
        data: results,
        message: `Batch delete completed: ${results.success} succeeded, ${results.failed} failed`,
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
 * @route   POST /api/tasks/batch/cancel
 * @desc    Batch cancel tasks
 * @access  Private
 */
router.post(
  '/batch/cancel',
  [
    body('ids').isArray({ min: 1 }).withMessage('Task IDs must be an array with at least one ID'),
    body('ids.*').isUUID().withMessage('Each task ID must be a valid UUID'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { ids } = req.body;
      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ id: string; error: string }>,
      };

      for (const id of ids) {
        try {
          await taskService.cancelTask(id, userId);
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({ id, error: error.message });
        }
      }

      res.json({
        success: true,
        data: results,
        message: `Batch cancel completed: ${results.success} succeeded, ${results.failed} failed`,
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
 * @route   POST /api/tasks/:id/cancel
 * @desc    Cancel a task
 * @access  Private
 */
router.post('/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const task = await taskService.cancelTask(id, userId);

    res.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    await taskService.deleteTask(id, userId);

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/tasks/:id/complete
 * @desc    Mark task as complete (internal/scheduler use)
 * @access  Private
 */
router.post(
  '/:id/complete',
  [body('result').optional().isString()],
  async (req: AuthRequest, res) => {
    try {
      // In production, this would be restricted to scheduler service
      const { id } = req.params;
      const { result } = req.body;

      const task = await taskService.completeTask(id);

      res.json({
        success: true,
        data: task,
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
 * @route   POST /api/tasks/:id/fail
 * @desc    Mark task as failed (internal/scheduler use)
 * @access  Private
 */
router.post(
  '/:id/fail',
  [body('error').optional().isString()],
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { error } = req.body;

      const task = await taskService.failTask(id, error);

      res.json({
        success: true,
        data: task,
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
 * @route   PATCH /api/tasks/batch/status
 * @desc    Batch update task status
 * @access  Private/Manager
 */
router.patch(
  '/batch/status',
  requireManager,
  [
    body('ids').isArray({ min: 1 }).withMessage('Task IDs must be an array with at least one ID'),
    body('ids.*').isUUID().withMessage('Each task ID must be a valid UUID'),
    body('status').isIn(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).withMessage('Invalid status'),
  ],
  async (req, res) => {
    try {
      const { ids, status } = req.body;
      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ id: string; error: string }>,
      };

      for (const id of ids) {
        try {
          await taskService.updateTask(id, { status: status as TaskStatus }, req.user!.userId);
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({ id, error: error.message });
        }
      }

      res.json({
        success: true,
        data: results,
        message: `Batch status update completed: ${results.success} succeeded, ${results.failed} failed`,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

export default router;
