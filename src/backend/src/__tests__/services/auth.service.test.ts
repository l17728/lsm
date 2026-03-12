import { AuthService } from '../services/auth.service';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Mock Prisma
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      session: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    })),
  };
});

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    authService = new AuthService(mockPrisma);
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

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toBeDefined();
      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        username: 'existing',
        email: 'existing@example.com',
      });

      await expect(
        authService.register({
          username: 'existing',
          email: 'new@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('User already exists');
    });
  });

  describe('login', () => {
    it('should return token on successful login', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'USER',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.create.mockResolvedValue({ token: 'mock-token' });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toBeDefined();
      expect(result.token).toBe('mock-token');
      expect(result.user).toBeDefined();
    });

    it('should throw error on invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'notfound@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });
});
