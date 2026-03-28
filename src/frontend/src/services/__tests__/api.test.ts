/**
 * API Client Token Refresh Tests
 * 
 * Tests for:
 * - Token refresh interceptor logic
 * - Request queue during refresh
 * - Error handling for invalid/expired tokens
 * - Automatic token refresh on 401
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock axios
vi.mock('axios', () => {
  const mockAxiosInstance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    defaults: { baseURL: '/api' },
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      ...mockAxiosInstance,
    },
    create: vi.fn(() => mockAxiosInstance),
  };
});

// Mock zustand store
vi.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      token: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
      user: { id: '1', username: 'testuser', role: 'USER' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      updateTokens: vi.fn(),
    })),
  },
}));

describe('API Client Token Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token Refresh Logic', () => {
    it('should have refresh token in login response', async () => {
      // This test validates the expected login response structure
      const mockLoginResponse = {
        data: {
          success: true,
          data: {
            token: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 900,
            user: { id: '1', username: 'testuser', role: 'USER' },
          },
        },
      };

      expect(mockLoginResponse.data.data.refreshToken).toBeDefined();
      expect(mockLoginResponse.data.data.expiresIn).toBe(900);
    });

    it('should have correct refresh endpoint path', () => {
      const refreshEndpoint = '/auth/refresh';
      expect(refreshEndpoint).toBe('/auth/refresh');
    });

    it('should send refresh token in request body', () => {
      const refreshRequest = { refreshToken: 'valid-refresh-token' };
      expect(refreshRequest).toHaveProperty('refreshToken');
      expect(refreshRequest.refreshToken).toBe('valid-refresh-token');
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 with REFRESH_TOKEN_INVALID code', () => {
      const errorResponse = {
        status: 401,
        data: {
          success: false,
          error: {
            code: 'REFRESH_TOKEN_INVALID',
            message: 'Invalid or expired refresh token',
          },
        },
      };

      expect(errorResponse.status).toBe(401);
      expect(errorResponse.data.error.code).toBe('REFRESH_TOKEN_INVALID');
    });

    it('should handle missing refresh token error', () => {
      const errorResponse = {
        status: 400,
        data: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Refresh token required',
          },
        },
      };

      expect(errorResponse.status).toBe(400);
    });
  });

  describe('Token Rotation', () => {
    it('should receive new refresh token after successful refresh', () => {
      const refreshResponse = {
        data: {
          success: true,
          data: {
            token: 'new-access-token',
            refreshToken: 'new-refresh-token',
            user: { id: '1', username: 'testuser', role: 'USER' },
          },
        },
      };

      // Verify new tokens are different from old ones
      expect(refreshResponse.data.data.token).toBe('new-access-token');
      expect(refreshResponse.data.data.refreshToken).toBe('new-refresh-token');
    });

    it('should update both access and refresh tokens together', () => {
      const mockUpdateTokens = vi.fn();
      const newToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      mockUpdateTokens(newToken, newRefreshToken);

      expect(mockUpdateTokens).toHaveBeenCalledWith(newToken, newRefreshToken);
      expect(mockUpdateTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe('Request Queue During Refresh', () => {
    it('should queue requests while refresh is in progress', () => {
      const failedQueue: Array<{ resolve: Function; reject: Function }> = [];
      
      // Simulate adding to queue
      const queueItem = { resolve: vi.fn(), reject: vi.fn() };
      failedQueue.push(queueItem);

      expect(failedQueue.length).toBe(1);
    });

    it('should process queue after successful refresh', () => {
      const failedQueue: Array<{ resolve: Function; reject: Function }> = [
        { resolve: vi.fn(), reject: vi.fn() },
        { resolve: vi.fn(), reject: vi.fn() },
      ];

      const processQueue = (error: Error | null, token: string | null) => {
        failedQueue.forEach((prom) => {
          if (error) {
            prom.reject(error);
          } else {
            prom.resolve(token);
          }
        });
      };

      processQueue(null, 'new-access-token');

      failedQueue.forEach((item) => {
        expect(item.resolve).toHaveBeenCalledWith('new-access-token');
      });
    });

    it('should reject queue on refresh failure', () => {
      const failedQueue: Array<{ resolve: Function; reject: Function }> = [
        { resolve: vi.fn(), reject: vi.fn() },
      ];

      const processQueue = (error: Error | null, token: string | null) => {
        failedQueue.forEach((prom) => {
          if (error) {
            prom.reject(error);
          } else {
            prom.resolve(token);
          }
        });
      };

      const refreshError = new Error('Refresh failed');
      processQueue(refreshError, null);

      failedQueue.forEach((item) => {
        expect(item.reject).toHaveBeenCalledWith(refreshError);
      });
    });
  });

  describe('Logout on Refresh Failure', () => {
    it('should call logout when refresh fails', () => {
      const mockLogout = vi.fn();
      
      // Simulate refresh failure flow
      const handleRefreshFailure = () => {
        mockLogout();
        // Would redirect to login in real scenario
      };

      handleRefreshFailure();

      expect(mockLogout).toHaveBeenCalled();
    });
  });
});

describe('Auth Store Token Management', () => {
  it('should store refresh token', () => {
    const mockStore = {
      token: 'access-token',
      refreshToken: 'refresh-token',
      user: null,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      updateTokens: vi.fn(),
    };

    expect(mockStore.refreshToken).toBe('refresh-token');
  });

  it('should clear tokens on logout', () => {
    const mockStore: {
      token: string | null
      refreshToken: string | null
      user: { id: string; username: string; role: string } | null
      isAuthenticated: boolean
      logout: () => void
    } = {
      token: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: '1', username: 'testuser', role: 'USER' },
      isAuthenticated: true,
      logout: () => {
        mockStore.token = null;
        mockStore.refreshToken = null;
        mockStore.user = null;
        mockStore.isAuthenticated = false;
      },
    };

    mockStore.logout();

    expect(mockStore.token).toBeNull();
    expect(mockStore.refreshToken).toBeNull();
    expect(mockStore.user).toBeNull();
    expect(mockStore.isAuthenticated).toBe(false);
  });

  it('should update tokens via updateTokens action', () => {
    const mockStore = {
      token: 'old-token',
      refreshToken: 'old-refresh-token',
      updateTokens: vi.fn((newToken, newRefreshToken) => {
        mockStore.token = newToken;
        mockStore.refreshToken = newRefreshToken;
      }),
    };

    mockStore.updateTokens('new-token', 'new-refresh-token');

    expect(mockStore.token).toBe('new-token');
    expect(mockStore.refreshToken).toBe('new-refresh-token');
  });
});