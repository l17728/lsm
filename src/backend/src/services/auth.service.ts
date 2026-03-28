import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/prisma';
import config from '../config';
import { user_role as UserRole } from '@prisma/client';
import { emailService } from './email.service';
import { safeLogger } from '../middleware/logging.middleware';

// Re-export UserRole for use in other modules
export { UserRole };

// Token expiration constants
const ACCESS_TOKEN_EXPIRES = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRES_DAYS = 7; // 7 days

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface TokenPayload {
  userId: string;
  username: string;
  role: UserRole;
  name?: string;
  email?: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterRequest) {
    const { username, email, password, role = UserRole.USER } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: hashedPassword,
        role,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Send welcome email (non-blocking)
    emailService.sendWelcome(email, username).catch((err) => {
      console.error('[Auth] Failed to send welcome email:', err);
    });

    return user;
  }

  /**
   * Login user and return JWT token
   */
  async login(data: LoginRequest) {
    const { username, password } = data;

    safeLogger.debug('Login attempt', { username });

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      safeLogger.warn('Login failed: user not found', { username });
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      safeLogger.warn('Login failed: invalid password', { username, userId: user.id });
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRES as any,
    });

    // Generate refresh token
    const refreshToken = this.generateRefreshToken();
    const refreshExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );

    // Create session with both tokens
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token,
        refreshToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        refreshExpiresAt,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    safeLogger.info('Login successful', { 
      userId: user.id, 
      username: user.username,
      sessionId: session.id,
      refreshExpiresAt: refreshExpiresAt.toISOString()
    });

    return {
      token,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(token: string) {
    safeLogger.debug('Logout attempt');
    
    const result = await prisma.session.updateMany({
      where: { token },
      data: { isRevoked: true },
    });

    if (result.count > 0) {
      safeLogger.info('Session revoked on logout', { sessionsRevoked: result.count });
    } else {
      safeLogger.warn('Logout: no active session found for token');
    }
  }

  /**
   * Verify JWT token and return payload
   */
  verifyToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get current user from token
   */
  async getCurrentUser(token: string) {
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new Error('Invalid or expired session');
    }

    return session.user;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid current password');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers() {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        displayName: true,
        welink: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return users;
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: string, role: UserRole) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      },
    });

    return user;
  }

  /**
   * Update user info (admin only)
   */
  async updateUser(userId: string, data: { displayName?: string; welink?: string; phone?: string; role?: UserRole }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: data.displayName,
        welink: data.welink,
        phone: data.phone,
        role: data.role,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        displayName: true,
        welink: true,
        phone: true,
      },
    });

    return user;
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(userId: string) {
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(): string {
    return uuidv4() + '-' + Date.now().toString(36);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string) {
    safeLogger.debug('Token refresh attempt');

    // Find session with this refresh token
    const session = await prisma.session.findFirst({
      where: {
        refreshToken,
        isRevoked: false,
        refreshExpiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!session) {
      safeLogger.warn('Token refresh failed: invalid or expired refresh token');
      throw new Error('Invalid or expired refresh token');
    }

    safeLogger.debug('Valid session found for refresh', { 
      sessionId: session.id, 
      userId: session.user.id 
    });

    // Generate new access token
    const tokenPayload: TokenPayload = {
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role,
    };

    const newAccessToken = jwt.sign(tokenPayload, config.jwtSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRES as any,
    });

    // Generate new refresh token (rotation for security)
    const newRefreshToken = this.generateRefreshToken();
    const refreshExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
    );

    // Update session with new tokens
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        refreshExpiresAt,
      },
    });

    safeLogger.info('Token refresh successful', {
      userId: session.user.id,
      username: session.user.username,
      sessionId: session.id,
      newRefreshExpiresAt: refreshExpiresAt.toISOString()
    });

    return {
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: session.user,
    };
  }

  /**
   * Revoke refresh token (for logout)
   */
  async revokeRefreshToken(refreshToken: string) {
    safeLogger.debug('Revoking refresh token');
    
    const result = await prisma.session.updateMany({
      where: { refreshToken },
      data: { isRevoked: true },
    });

    if (result.count > 0) {
      safeLogger.info('Refresh token revoked', { sessionsAffected: result.count });
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    safeLogger.debug('Starting expired sessions cleanup');
    
    const result = await prisma.session.deleteMany({
      where: {
        OR: [
          { refreshExpiresAt: { lt: new Date() } },
          { isRevoked: true },
        ],
      },
    });

    if (result.count > 0) {
      safeLogger.info('Expired sessions cleaned up', { deletedCount: result.count });
    }

    return result.count;
  }
}

export const authService = new AuthService();
export default authService;
