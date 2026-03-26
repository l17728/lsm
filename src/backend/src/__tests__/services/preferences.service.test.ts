import { PreferencesService } from '../../services/preferences.service';

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// preferences.service.ts creates its own `new PrismaClient()`, so we mock
// @prisma/client directly. We capture the mock fns via closures that are
// initialised before the class is constructed.
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        // These reference the outer-scope vars but jest.fn() placeholders; however
        // due to hoisting we must assign inside the factory differently.
        // We return plain objects referencing captured fns via a wrapper so
        // the hoisting order doesn't matter.
        findUnique: (...args: any[]) => mockFindUnique(...args),
        update: (...args: any[]) => mockUpdate(...args),
      },
    })),
  };
});

// Mock ioredis so cache methods are silent no-ops
jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
    })),
  };
});

const storedPrefs = {
  theme: { enabled: true, mode: 'dark', accentColor: '#ff0000' },
  language: { code: 'en-US', timezone: 'UTC', dateFormat: 'MM/DD/YYYY', timeFormat: '12h' },
  notifications: {
    email: false,
    websocket: true,
    desktop: false,
    sound: false,
    quietHours: { enabled: true, start: '23:00', end: '07:00' },
  },
  pagination: { pageSize: 10, defaultSort: 'name', defaultOrder: 'asc' },
  display: { compactMode: true, showAnimations: false, autoRefresh: false, refreshInterval: 60 },
};

const mockUserWithPrefs = {
  id: 'user-1',
  metadata: { preferences: storedPrefs },
};

describe('PreferencesService', () => {
  let service: PreferencesService;

  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    service = new PreferencesService();
  });

  it('should return stored preferences when user exists', async () => {
    mockFindUnique.mockResolvedValue(mockUserWithPrefs);

    const result = await service.getUserPreferences('user-1');

    expect(result.theme.mode).toBe('dark');
    expect(result.theme.enabled).toBe(true);
    expect(result.language.code).toBe('en-US');
    expect(result.notifications.email).toBe(false);
    expect(result.pagination.pageSize).toBe(10);
    expect(result.display.compactMode).toBe(true);
  });

  it('should return default preferences when user is not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await service.getUserPreferences('missing-user');

    expect(result.theme.enabled).toBe(false);
    expect(result.theme.mode).toBe('system');
    expect(result.language.code).toBe('zh-CN');
    expect(result.pagination.pageSize).toBe(20);
    expect(result.display.autoRefresh).toBe(true);
  });

  it('should update user preferences and return merged result', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'user-1',
      metadata: {
        preferences: {
          theme: { enabled: false, mode: 'system', accentColor: '#667eea' },
        },
      },
    });
    mockUpdate.mockResolvedValue({});

    const result = await service.updateUserPreferences('user-1', {
      theme: { enabled: true, mode: 'dark', accentColor: '#667eea' },
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } })
    );
    expect(result.theme.enabled).toBe(true);
    expect(result.theme.mode).toBe('dark');
  });

  it('should toggle dark mode (enabled: false -> true)', async () => {
    // getUserPreferences called first (enabled: false), then updateUserPreferences calls findUnique again
    mockFindUnique
      .mockResolvedValueOnce({
        id: 'user-1',
        metadata: { preferences: { theme: { enabled: false, mode: 'system', accentColor: '#667eea' } } },
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        metadata: { preferences: { theme: { enabled: false, mode: 'system', accentColor: '#667eea' } } },
      });
    mockUpdate.mockResolvedValue({});

    await service.toggleDarkMode('user-1');

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.metadata.preferences.theme.enabled).toBe(true);
  });

  it('should throw when updating preferences for non-existent user', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(
      service.updateUserPreferences('ghost-user', { display: { compactMode: true } })
    ).rejects.toThrow('User not found');
  });
});
