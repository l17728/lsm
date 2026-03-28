/**
 * Cache Warmup Routes Integration Tests
 */

import request from 'supertest';
import express from 'express';
import cacheWarmupRoutes from '../../routes/cache-warmup.routes';
import { cacheWarmupService } from '../../services/cache-warmup.service';

jest.mock('../../services/cache-warmup.service', () => ({
  cacheWarmupService: {
    performWarmup: jest.fn(),
    getStats: jest.fn(),
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
    identifyHotData: jest.fn(),
    addWarmupItem: jest.fn(),
    removeWarmupItem: jest.fn(),
  },
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  AuthRequest: {},
}));

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use('/api/cache-warmup', cacheWarmupRoutes);

describe('Cache Warmup Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== POST /trigger ====================

  describe('POST /api/cache-warmup/trigger', () => {
    it('should trigger cache warmup successfully', async () => {
      const mockStats = { totalItems: 10, successCount: 10, failureCount: 0, lastRunAt: null };
      (cacheWarmupService.performWarmup as jest.Mock).mockResolvedValue(undefined);
      (cacheWarmupService.getStats as jest.Mock).mockReturnValue(mockStats);

      const response = await request(app).post('/api/cache-warmup/trigger');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Cache warmup triggered successfully');
      expect(response.body.data).toEqual(mockStats);
    });

    it('should return 500 on warmup error', async () => {
      (cacheWarmupService.performWarmup as jest.Mock).mockRejectedValue(
        new Error('Redis connection failed')
      );

      const response = await request(app).post('/api/cache-warmup/trigger');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Redis connection failed');
    });
  });

  // ==================== GET /stats ====================

  describe('GET /api/cache-warmup/stats', () => {
    it('should return cache warmup statistics', async () => {
      const mockStats = {
        totalItems: 15,
        successCount: 14,
        failureCount: 1,
        lastRunAt: new Date().toISOString(),
      };
      (cacheWarmupService.getStats as jest.Mock).mockReturnValue(mockStats);

      const response = await request(app).get('/api/cache-warmup/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });

    it('should return 500 on stats error', async () => {
      (cacheWarmupService.getStats as jest.Mock).mockImplementation(() => {
        throw new Error('Stats unavailable');
      });

      const response = await request(app).get('/api/cache-warmup/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /config ====================

  describe('GET /api/cache-warmup/config', () => {
    it('should return cache warmup configuration', async () => {
      const mockConfig = { enabled: true, intervalMs: 300000, maxConcurrency: 5 };
      (cacheWarmupService.getConfig as jest.Mock).mockReturnValue(mockConfig);

      const response = await request(app).get('/api/cache-warmup/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockConfig);
    });

    it('should return 500 on config error', async () => {
      (cacheWarmupService.getConfig as jest.Mock).mockImplementation(() => {
        throw new Error('Config error');
      });

      const response = await request(app).get('/api/cache-warmup/config');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== PUT /config ====================

  describe('PUT /api/cache-warmup/config', () => {
    it('should update cache warmup configuration', async () => {
      const newConfig = { enabled: false, intervalMs: 600000 };
      const updatedConfig = { enabled: false, intervalMs: 600000, maxConcurrency: 5 };
      (cacheWarmupService.updateConfig as jest.Mock).mockReturnValue(undefined);
      (cacheWarmupService.getConfig as jest.Mock).mockReturnValue(updatedConfig);

      const response = await request(app)
        .put('/api/cache-warmup/config')
        .send(newConfig);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Configuration updated successfully');
      expect(response.body.data).toEqual(updatedConfig);
    });

    it('should return 500 on update error', async () => {
      (cacheWarmupService.updateConfig as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid config');
      });

      const response = await request(app)
        .put('/api/cache-warmup/config')
        .send({ enabled: 'not-a-boolean' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /hot-data ====================

  describe('GET /api/cache-warmup/hot-data', () => {
    it('should return identified hot data', async () => {
      const mockHotData = [
        { key: 'servers:list', accessCount: 100, lastAccessed: new Date().toISOString() },
        { key: 'gpu:stats', accessCount: 80, lastAccessed: new Date().toISOString() },
      ];
      (cacheWarmupService.identifyHotData as jest.Mock).mockReturnValue(mockHotData);

      const response = await request(app).get('/api/cache-warmup/hot-data');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hotData).toHaveLength(2);
    });

    it('should return 500 on hot data error', async () => {
      (cacheWarmupService.identifyHotData as jest.Mock).mockImplementation(() => {
        throw new Error('Analysis error');
      });

      const response = await request(app).get('/api/cache-warmup/hot-data');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== POST /items ====================

  describe('POST /api/cache-warmup/items', () => {
    it('should add a new warmup item', async () => {
      (cacheWarmupService.addWarmupItem as jest.Mock).mockReturnValue(undefined);

      const response = await request(app)
        .post('/api/cache-warmup/items')
        .send({ key: 'servers:list', type: 'SERVER', priority: 8 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Warmup item added successfully');
    });

    it('should return 400 when key and type are missing', async () => {
      const response = await request(app)
        .post('/api/cache-warmup/items')
        .send({ priority: 5 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Key and type are required');
    });

    it('should return 500 on service error', async () => {
      (cacheWarmupService.addWarmupItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const response = await request(app)
        .post('/api/cache-warmup/items')
        .send({ key: 'test:key', type: 'SERVER' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== DELETE /items/:key ====================

  describe('DELETE /api/cache-warmup/items/:key', () => {
    it('should remove a warmup item', async () => {
      (cacheWarmupService.removeWarmupItem as jest.Mock).mockReturnValue(true);

      const response = await request(app).delete('/api/cache-warmup/items/servers%3Alist');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Warmup item removed successfully');
    });

    it('should return 404 when warmup item not found', async () => {
      (cacheWarmupService.removeWarmupItem as jest.Mock).mockReturnValue(false);

      const response = await request(app).delete('/api/cache-warmup/items/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Warmup item not found');
    });
  });
});
