import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/prisma';
import config from '../config';
import { user_role as UserRole } from '@prisma/client';
import { emailService } from './email.service';

// Re-export UserRole for use in other modules
export { UserRole };

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

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as any,
    });

    // Create session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return {
      token,
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
    await prisma.session.deleteMany({
      where: { token },
    });
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
   * Delete user (admin only)
   */
  async deleteUser(userId: string) {
    await prisma.user.delete({
      where: { id: userId },
    });
  }
}

export const authService = new AuthService();
export default authService;
