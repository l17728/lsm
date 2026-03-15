import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import authService from '../services/auth.service';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { user_role as UserRole } from '@prisma/client';
import { validate, userSchemas } from '../middleware/validation.middleware';

const router = Router();

/**
 * 验证结果处理中间件
 */
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array().map(err => ({
          field: (err as any).param || (err as any).path,
          message: err.msg,
        })),
      },
    });
  }
  next();
};

/**
 * 密码复杂度验证规则
 * 要求：至少 8 字符，包含大小写字母和数字
 */
const passwordValidationRules = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
];

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  [
    body('username')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3-30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email').isEmail().withMessage('Valid email required'),
    ...passwordValidationRules,
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { username, email, password } = req.body;

      const user = await authService.register({
        username,
        email,
        password,
      });

      res.status(201).json({
        success: true,
        data: user,
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
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res) => {
    try {
      const { username, password } = req.body;

      const result = await authService.login({ username, password });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    const token = req.headers.authorization!.substring(7);

    await authService.logout(token);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const token = req.headers.authorization!.substring(7);
    const user = await authService.getCurrentUser(token);

    res.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 新密码复杂度验证规则
 * 要求：至少 8 字符，包含大小写字母和数字
 */
const newPasswordValidationRules = [
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('New password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('New password must contain at least one number'),
];

/**
 * @route   PUT /api/auth/password
 * @desc    Change password
 * @access  Private
 */
router.put(
  '/password',
  authenticate,
  [
    body('oldPassword').notEmpty().withMessage('Current password required'),
    ...newPasswordValidationRules,
  ],
  handleValidationErrors,
  async (req: AuthRequest, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user!.userId;

      await authService.changePassword(userId, oldPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully',
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
 * @route   GET /api/auth/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get('/users', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    const users = await authService.getAllUsers();

    res.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/auth/users/:id/role
 * @desc    Update user role (admin only)
 * @access  Private/Admin
 */
router.put(
  '/users/:id/role',
  authenticate,
  [body('role').isIn(['ADMIN', 'MANAGER', 'USER']).withMessage('Invalid role')],
  async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== UserRole.ADMIN) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
      }

      const { id } = req.params;
      const { role } = req.body;

      const user = await authService.updateUserRole(id, role as UserRole);

      res.json({
        success: true,
        data: user,
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
 * @route   DELETE /api/auth/users/:id
 * @desc    Delete user (admin only)
 * @access  Private/Admin
 */
router.delete('/users/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { id } = req.params;

    await authService.deleteUser(id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
