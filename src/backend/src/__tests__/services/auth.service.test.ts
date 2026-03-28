import bcrypt from 'bcryptjs';

// Mock prisma first with proper implementation
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  session: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
};

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// Mock @prisma/client for UserRole enum
jest.mock('@prisma/client', () => ({
  user_role: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    USER: 'USER',
  },
  PrismaClient: jest.fn(),
}));

// Mock emailService
jest.mock('../../services/email.service', () => ({
  emailService: {
    sendWelcome: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock config
jest.mock('../../config', () => ({
  jwtSecret: 'test-secret-key-for-jwt-signing',
  jwtExpiresIn: '15m',
}));

// Import after mocks are set up
import { AuthService } from '../../services/auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create user successfully', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'USER',
        createdAt: new Date(),
      };

      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result).toBeDefined();
      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: '1',
        username: 'existing',
        email: 'existing@example.com',
      });

      await expect(
        authService.register({
          username: 'existing',
          email: 'new@example.com',
          password: 'Password123',
        })
      ).rejects.toThrow('Username or email already exists');
    });
  });

  describe('login', () => {
    it('should return tokens on successful login', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'USER',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.create.mockResolvedValue({
        id: 'session-1',
        token: 'mock-token',
        refreshToken: 'mock-refresh-token',
      });
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await authService.login({
        username: 'testuser',
        password: 'password123',
      });

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
    });

    it('should throw error on invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          username: 'notfound',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens with valid refresh token', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'USER',
      };

      const mockSession = {
        id: 'session-1',
        userId: '1',
        refreshToken: 'valid-refresh-token',
        refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
        user: mockUser,
      };

      mockPrisma.session.findFirst.mockResolvedValue(mockSession);
      mockPrisma.session.update.mockResolvedValue({
        ...mockSession,
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const result = await authService.refreshToken('valid-refresh-token');

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toEqual(mockUser);
    });

    it('should throw error with invalid refresh token', async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);

      await expect(
        authService.refreshToken('invalid-refresh-token')
      ).rejects.toThrow('Invalid or expired refresh token');
    });
  });
});
