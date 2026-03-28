import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { preferencesService, UserPreferences } from '../services/preferences.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/preferences
 * @desc    Get current user's preferences
 * @access  Private
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const preferences = await preferencesService.getUserPreferences(userId);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error('[Preferences] Get preferences failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get preferences',
    });
  }
});

/**
 * @route   PUT /api/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const updates = req.body;

    const preferences = await preferencesService.updateUserPreferences(userId, updates);

    res.json({
      success: true,
      data: preferences,
      message: 'Preferences updated successfully',
    });
  } catch (error: any) {
    console.error('[Preferences] Update preferences failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update preferences',
    });
  }
});

/**
 * @route   PUT /api/preferences/theme
 * @desc    Update theme preferences
 * @access  Private
 */
router.put('/theme', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const theme = req.body;

    const preferences = await preferencesService.updateTheme(userId, theme);

    res.json({
      success: true,
      data: { theme: preferences.theme },
      message: 'Theme preferences updated',
    });
  } catch (error: any) {
    console.error('[Preferences] Update theme failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update theme',
    });
  }
});

/**
 * @route   PUT /api/preferences/language
 * @desc    Update language preferences
 * @access  Private
 */
router.put('/language', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const language = req.body;

    const preferences = await preferencesService.updateLanguage(userId, language);

    res.json({
      success: true,
      data: { language: preferences.language },
      message: 'Language preferences updated',
    });
  } catch (error: any) {
    console.error('[Preferences] Update language failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update language',
    });
  }
});

/**
 * @route   PUT /api/preferences/notifications
 * @desc    Update notification preferences
 * @access  Private
 */
router.put('/notifications', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const notifications = req.body;

    const preferences = await preferencesService.updateNotifications(userId, notifications);

    res.json({
      success: true,
      data: { notifications: preferences.notifications },
      message: 'Notification preferences updated',
    });
  } catch (error: any) {
    console.error('[Preferences] Update notifications failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update notifications',
    });
  }
});

/**
 * @route   PUT /api/preferences/pagination
 * @desc    Update pagination preferences
 * @access  Private
 */
router.put('/pagination', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const pagination = req.body;

    const preferences = await preferencesService.updatePagination(userId, pagination);

    res.json({
      success: true,
      data: { pagination: preferences.pagination },
      message: 'Pagination preferences updated',
    });
  } catch (error: any) {
    console.error('[Preferences] Update pagination failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update pagination',
    });
  }
});

/**
 * @route   POST /api/preferences/toggle-dark-mode
 * @desc    Toggle dark mode
 * @access  Private
 */
router.post('/toggle-dark-mode', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const preferences = await preferencesService.toggleDarkMode(userId);

    res.json({
      success: true,
      data: { theme: preferences.theme },
      message: 'Dark mode toggled',
    });
  } catch (error: any) {
    console.error('[Preferences] Toggle dark mode failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to toggle dark mode',
    });
  }
});

export default router;
