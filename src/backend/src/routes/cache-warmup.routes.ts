import { Router, Request, Response } from 'express';
import { cacheWarmupService } from '../services/cache-warmup.service';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/cache-warmup/trigger
 * Manually trigger cache warmup
 */
router.post('/trigger', authMiddleware, async (req: Request, res: Response) => {
  try {
    await cacheWarmupService.performWarmup();
    
    res.json({
      success: true,
      message: 'Cache warmup triggered successfully',
      data: cacheWarmupService.getStats(),
    });
  } catch (error: any) {
    console.error('[CacheWarmup API] Trigger warmup error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to trigger cache warmup',
    });
  }
});

/**
 * GET /api/cache-warmup/stats
 * Get cache warmup statistics
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = cacheWarmupService.getStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[CacheWarmup API] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get stats',
    });
  }
});

/**
 * GET /api/cache-warmup/config
 * Get cache warmup configuration
 */
router.get('/config', authMiddleware, async (req: Request, res: Response) => {
  try {
    const config = cacheWarmupService.getConfig();
    res.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    console.error('[CacheWarmup API] Get config error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get config',
    });
  }
});

/**
 * PUT /api/cache-warmup/config
 * Update cache warmup configuration
 */
router.put('/config', authMiddleware, async (req: Request, res: Response) => {
  try {
    const config = req.body;
    cacheWarmupService.updateConfig(config);
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: cacheWarmupService.getConfig(),
    });
  } catch (error: any) {
    console.error('[CacheWarmup API] Update config error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update config',
    });
  }
});

/**
 * GET /api/cache-warmup/hot-data
 * Get identified hot data
 */
router.get('/hot-data', authMiddleware, async (req: Request, res: Response) => {
  try {
    const hotData = cacheWarmupService.identifyHotData();
    res.json({
      success: true,
      data: { hotData },
    });
  } catch (error: any) {
    console.error('[CacheWarmup API] Get hot data error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get hot data',
    });
  }
});

/**
 * POST /api/cache-warmup/items
 * Add a warmup item
 */
router.post('/items', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { key, type, filter, ttl, priority } = req.body;

    if (!key || !type) {
      return res.status(400).json({
        success: false,
        error: 'Key and type are required',
      });
    }

    cacheWarmupService.addWarmupItem({
      key,
      type,
      filter,
      ttl,
      priority: priority || 5,
    });

    res.status(201).json({
      success: true,
      message: 'Warmup item added successfully',
    });
  } catch (error: any) {
    console.error('[CacheWarmup API] Add item error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add warmup item',
    });
  }
});

/**
 * DELETE /api/cache-warmup/items/:key
 * Remove a warmup item
 */
router.delete('/items/:key', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const removed = cacheWarmupService.removeWarmupItem(key);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Warmup item not found',
      });
    }

    res.json({
      success: true,
      message: 'Warmup item removed successfully',
    });
  } catch (error: any) {
    console.error('[CacheWarmup API] Remove item error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove warmup item',
    });
  }
});

export { router as cacheWarmupRoutes };
export default router;
