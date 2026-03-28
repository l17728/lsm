import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// 🔐 SECURITY: JWT_SECRET 必须通过环境变量配置，不允许使用默认值
// 如果未设置环境变量，应用将在启动时抛出错误
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Generate a secure key with: openssl rand -base64 64'
    );
  }
  if (secret.length < 32) {
    console.warn('[SECURITY WARNING] JWT_SECRET is too short. Recommended: 64+ characters');
  }
  return secret;
};

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // Access token expires in 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // Refresh token expires in 7 days

/**
 * Generate access token
 */
export function generateAccessToken(payload: { userId: string; email: string; role: string }): string {
  // @ts-ignore - JWT types issue
  return jwt.sign(payload, JWT_SECRET, { expiresIn: String(JWT_EXPIRES_IN) });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: { userId: string }): string {
  // @ts-ignore - JWT types issue
  return jwt.sign(payload, JWT_SECRET, { expiresIn: String(REFRESH_TOKEN_EXPIRES_IN) });
}

/**
 * Verify token
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    // Verify refresh token
    const decoded: any = verifyToken(refreshToken);

    // Check if refresh token exists in database
    const session = await prisma.session.findFirst({
      where: {
        token: refreshToken,
        userId: decoded.userId,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      throw new Error('Invalid refresh token');
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Generate new refresh token (rotate)
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    // Update refresh token in database
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  } catch (error: any) {
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

/**
 * Create session for refresh token
 */
export async function createSession(userId: string, token: string): Promise<void> {
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
}

/**
 * Delete session (logout)
 */
export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { token },
  });
}

/**
 * Delete all user sessions (logout from all devices)
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
}
