import { Request, Response, NextFunction } from 'express';
import authService, { TokenPayload, UserRole } from '../services/auth.service';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = authService.verifyToken(token);

    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware to check if user has required role
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/**
 * Convenience middleware for admin-only routes
 */
export const requireAdmin = authorize(UserRole.ADMIN);

/**
 * Convenience middleware for manager and admin routes
 */
export const requireManager = authorize(UserRole.MANAGER, UserRole.ADMIN);
