/**
 * Export Routes Integration Tests
 */

import request from 'supertest';
import express from 'express';
import exportRoutes from '../../routes/export.routes';
import {
  exportServersToCSV,
  exportTasksToCSV,
  exportGpusToExcel,
  exportUsersToExcel,
  exportMetricsToCSV,
} from '../../services/export.service';
import { enhancedExportService } from '../../services/enhanced-export.service';

jest.mock('../../services/export.service', () => ({
  exportServersToCSV: jest.fn(),
  exportTasksToCSV: jest.fn(),
  exportGpusToExcel: jest.fn(),
  exportUsersToExcel: jest.fn(),
  exportMetricsToCSV: jest.fn(),
}));

jest.mock('../../services/enhanced-export.service', () => ({
  enhancedExportService: {
    exportServers: jest.fn(),
    exportGpus: jest.fn(),
    exportTasks: jest.fn(),
    getExportHistory: jest.fn(),
    downloadFile: jest.fn(),
  },
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.user?.role === 'ADMIN') {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Admin access required' });
    }
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

jest.mock('@prisma/client', () => ({
  user_role: { ADMIN: 'ADMIN', MANAGER: 'MANAGER', USER: 'USER' },
}));

jest.mock('express-rate-limit', () =>
  () => (_req: any, _res: any, next: any) => next()
);

// Default user app
const app = express();
app.use(express.json());
app.use('/api/export', exportRoutes);

// Admin app
const adminApp = express();
adminApp.use(express.json());
adminApp.use((req: any, _res: any, next: any) => {
  req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
  next();
});
adminApp.use('/api/export', exportRoutes);

describe('Export Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /servers/csv ====================

  describe('GET /api/export/servers/csv', () => {
    it('should export servers to CSV', async () => {
      (exportServersToCSV as jest.Mock).mockResolvedValue('id,name,status\n1,server1,ONLINE');

      const response = await request(app).get('/api/export/servers/csv');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('servers.csv');
    });

    it('should return 500 on service error', async () => {
      (exportServersToCSV as jest.Mock).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/export/servers/csv');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /tasks/csv ====================

  describe('GET /api/export/tasks/csv', () => {
    it('should export tasks to CSV', async () => {
      (exportTasksToCSV as jest.Mock).mockResolvedValue('id,name,status\n1,task1,COMPLETED');

      const response = await request(app).get('/api/export/tasks/csv');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('tasks.csv');
    });

    it('should return 500 on service error', async () => {
      (exportTasksToCSV as jest.Mock).mockRejectedValue(new Error('Export failed'));

      const response = await request(app).get('/api/export/tasks/csv');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /gpus/excel ====================

  describe('GET /api/export/gpus/excel', () => {
    it('should export GPUs to Excel', async () => {
      (exportGpusToExcel as jest.Mock).mockResolvedValue(Buffer.from('excel-data'));

      const response = await request(app).get('/api/export/gpus/excel');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('gpus.xlsx');
    });

    it('should return 500 on service error', async () => {
      (exportGpusToExcel as jest.Mock).mockRejectedValue(new Error('Excel generation failed'));

      const response = await request(app).get('/api/export/gpus/excel');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /users/excel (admin only) ====================

  describe('GET /api/export/users/excel', () => {
    it('should allow admin to export users to Excel', async () => {
      (exportUsersToExcel as jest.Mock).mockResolvedValue(Buffer.from('excel-data'));

      const response = await request(adminApp).get('/api/export/users/excel');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('users.xlsx');
    });

    it('should deny non-admin from exporting users', async () => {
      const response = await request(app).get('/api/export/users/excel');

      expect(response.status).toBe(403);
    });
  });

  // ==================== GET /metrics/csv ====================

  describe('GET /api/export/metrics/csv', () => {
    it('should export metrics to CSV', async () => {
      (exportMetricsToCSV as jest.Mock).mockResolvedValue('timestamp,cpu\n1234,80');

      const response = await request(app).get('/api/export/metrics/csv');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should return 500 on service error', async () => {
      (exportMetricsToCSV as jest.Mock).mockRejectedValue(new Error('Metrics error'));

      const response = await request(app).get('/api/export/metrics/csv');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /summary (admin only) ====================

  describe('GET /api/export/summary', () => {
    it('should return export summary for admin', async () => {
      const response = await request(adminApp).get('/api/export/summary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.endpoints).toBeDefined();
    });

    it('should deny non-admin from accessing summary', async () => {
      const response = await request(app).get('/api/export/summary');

      expect(response.status).toBe(403);
    });
  });

  // ==================== POST /enhanced/servers ====================

  describe('POST /api/export/enhanced/servers', () => {
    it('should export servers with enhanced service', async () => {
      const mockResult = {
        id: 'export-1',
        filename: 'servers.csv',
        data: Buffer.from('csv-data'),
      };
      (enhancedExportService.exportServers as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/export/enhanced/servers')
        .send({ format: 'CSV', filters: {} });

      expect(response.status).toBe(200);
      expect(response.headers['x-export-id']).toBe('export-1');
    });

    it('should return 500 on enhanced export error', async () => {
      (enhancedExportService.exportServers as jest.Mock).mockRejectedValue(
        new Error('Enhanced export failed')
      );

      const response = await request(app)
        .post('/api/export/enhanced/servers')
        .send({ format: 'CSV' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ==================== GET /history ====================

  describe('GET /api/export/history', () => {
    it('should return export history', async () => {
      (enhancedExportService.getExportHistory as jest.Mock).mockResolvedValue({
        records: [{ id: 'e-1', type: 'servers', createdAt: new Date() }],
        total: 1,
      });

      const response = await request(app).get('/api/export/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.records).toHaveLength(1);
    });

    it('should return 500 on service error', async () => {
      (enhancedExportService.getExportHistory as jest.Mock).mockRejectedValue(
        new Error('History error')
      );

      const response = await request(app).get('/api/export/history');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
