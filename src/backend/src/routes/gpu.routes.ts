import { Router } from 'express';
import { body, param } from 'express-validator';
import gpuService from '../services/gpu.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/gpu/stats
 * @desc    Get GPU statistics
 * @access  Private
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await gpuService.getGpuStats();

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
 * @route   POST /api/gpu/allocate
 * @desc    Allocate a GPU
 * @access  Private
 */
router.post(
  '/allocate',
  [
    body('gpuModel').optional().isString(),
    body('minMemory').optional().isInt({ min: 1 }),
  ],
  async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const { gpuModel, minMemory } = req.body;

      const allocation = await gpuService.allocateGpu({
        userId,
        gpuModel,
        minMemory,
      });

      res.status(201).json({
        success: true,
        data: allocation,
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
 * @route   POST /api/gpu/release/:id
 * @desc    Release a GPU allocation
 * @access  Private
 */
router.post('/release/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await gpuService.releaseGpu(id, userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/gpu/my-allocations
 * @desc    Get user's active GPU allocations
 * @access  Private
 */
router.get('/my-allocations', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const allocations = await gpuService.getUserAllocations(userId);

    res.json({
      success: true,
      data: allocations,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/gpu/allocations
 * @desc    Get all active allocations (admin)
 * @access  Private
 */
router.get('/allocations', async (req: AuthRequest, res) => {
  try {
    const allocations = await gpuService.getAllActiveAllocations();

    res.json({
      success: true,
      data: allocations,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/gpu/allocations/:id
 * @desc    Get allocation details
 * @access  Private
 */
router.get('/allocations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const allocation = await gpuService.getAllocation(id);

    if (!allocation) {
      return res.status(404).json({
        success: false,
        error: 'Allocation not found',
      });
    }

    res.json({
      success: true,
      data: allocation,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/gpu/history
 * @desc    Get user's allocation history
 * @access  Private
 */
router.get('/history', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;

    const allocations = await gpuService.getAllocationHistory(userId, limit);

    res.json({
      success: true,
      data: allocations,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/gpu/allocations/:id/terminate
 * @desc    Force terminate an allocation (admin)
 * @access  Private/Admin
 */
router.post('/allocations/:id/terminate', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if user is admin (simplified check)
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    const result = await gpuService.forceTerminate(id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
