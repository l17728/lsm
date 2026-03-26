/**
 * Preferences Routes Integration Tests
 *
 * Tests for user preferences API endpoints
 */

import request from 'supertest';
import express from 'express';
import preferencesRoutes from '../../routes/preferences.routes';

// Mock preferences service
jest.mock('../../services/preferences.service', () => ({
  preferencesService: {
    getUserPreferences: jest.fn(),
    updateUserPreferences: jest.fn(),
    updateTheme: jest.fn(),
    updateLanguage: jest.fn(),
    updateNotifications: jest.fn(),
    updatePagination: jest.fn(),
    toggleDarkMode: jest.fn(),
  },
  UserPreferences: {},
}));

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) {
      req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    }
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!req.user) {
      req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    }
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.user?.role === 'ADMIN') next();
    else res.status(403).json({ success: false, error: 'Admin access required' });
  },
  requireManager: (req: any, res: any, next: any) => {
    if (['ADMIN', 'MANAGER'].includes(req.user?.role)) next();
    else res.status(403).json({ success: false, error: 'Manager access required' });
  },
  AuthRequest: {},
}));

// Mock logging middleware
jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// App with USER role (default)
const app = express();
app.use(express.json());
app.use('/api/preferences', preferencesRoutes);

// Import the mocked service for assertions
import { preferencesService } from '../../services/preferences.service';

describe('Preferences Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET / ====================

  describe('GET /api/preferences', () => {
    it('should return user preferences', async () => {
      const mockPrefs = {
        theme: { mode: 'light', primaryColor: '#1890ff' },
        language: { locale: 'en-US' },
        notifications: { email: true, inApp: true },
        pagination: { defaultPageSize: 20 },
      };
      (preferencesService.getUserPreferences as jest.Mock).mockResolvedValue(mockPrefs);

      const response = await request(app).get('/api/preferences');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPrefs);
      expect(preferencesService.getUserPreferences as jest.Mock).toHaveBeenCalledWith('user-1');
    });

    it('should return 500 on service error', async () => {
      (preferencesService.getUserPreferences as jest.Mock).mockRejectedValue(
        new Error('User not found')
      );

      const response = await request(app).get('/api/preferences');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });
  });

  // ==================== PUT / ====================

  describe('PUT /api/preferences', () => {
    it('should update user preferences successfully', async () => {
      const mockPrefs = {
        theme: { mode: 'dark' },
        language: { locale: 'zh-CN' },
      };
      (preferencesService.updateUserPreferences as jest.Mock).mockResolvedValue(mockPrefs);

      const response = await request(app)
        .put('/api/preferences')
        .send({ theme: { mode: 'dark' }, language: { locale: 'zh-CN' } });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPrefs);
      expect(response.body.message).toBe('Preferences updated successfully');
    });
  });

  // ==================== PUT /theme ====================

  describe('PUT /api/preferences/theme', () => {
    it('should update theme preferences successfully', async () => {
      const mockPrefs = { theme: { mode: 'dark' } };
      (preferencesService.updateTheme as jest.Mock).mockResolvedValue(mockPrefs);

      const response = await request(app)
        .put('/api/preferences/theme')
        .send({ mode: 'dark' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ theme: { mode: 'dark' } });
      expect(response.body.message).toBe('Theme preferences updated');
      expect(preferencesService.updateTheme as jest.Mock).toHaveBeenCalledWith(
        'user-1',
        { mode: 'dark' }
      );
    });
  });

  // ==================== PUT /language ====================

  describe('PUT /api/preferences/language', () => {
    it('should update language preferences successfully', async () => {
      const mockPrefs = { language: { locale: 'zh-CN' } };
      (preferencesService.updateLanguage as jest.Mock).mockResolvedValue(mockPrefs);

      const response = await request(app)
        .put('/api/preferences/language')
        .send({ locale: 'zh-CN' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ language: { locale: 'zh-CN' } });
      expect(response.body.message).toBe('Language preferences updated');
    });
  });

  // ==================== POST /toggle-dark-mode ====================

  describe('POST /api/preferences/toggle-dark-mode', () => {
    it('should toggle dark mode successfully', async () => {
      const mockPrefs = { theme: { mode: 'dark', isDark: true } };
      (preferencesService.toggleDarkMode as jest.Mock).mockResolvedValue(mockPrefs);

      const response = await request(app).post('/api/preferences/toggle-dark-mode');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ theme: { mode: 'dark', isDark: true } });
      expect(response.body.message).toBe('Dark mode toggled');
      expect(preferencesService.toggleDarkMode as jest.Mock).toHaveBeenCalledWith('user-1');
    });
  });
});
