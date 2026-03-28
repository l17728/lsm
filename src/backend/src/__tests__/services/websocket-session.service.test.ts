import { WebSocketSessionService } from '../../services/websocket-session.service';

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/**
 * Helper: create a fake Socket.IO server and directly exercise
 * the session service's internal Maps (which are the core logic).
 * We bypass setupEventHandlers (which wires socket events) and
 * instead call the public API methods directly.
 */
const makeFakeIo = () => {
  const mockEmit = jest.fn();
  const mockSockets = { sockets: new Map() };
  return {
    on: jest.fn(),
    emit: mockEmit,
    sockets: mockSockets,
    mockEmit,
  } as any;
};

/** Directly inject a session into service internals for test purposes */
const injectSession = (
  service: WebSocketSessionService,
  socketId: string,
  userId: string,
  username: string,
  lastActivity?: Date
) => {
  const sessions: Map<string, any> = (service as any).sessions;
  const userSessions: Map<string, Set<string>> = (service as any).userSessions;

  const now = new Date();
  sessions.set(socketId, {
    socketId,
    userId,
    username,
    connectedAt: now,
    lastActivity: lastActivity || now,
    userAgent: 'test-agent',
    ip: '127.0.0.1',
  });

  if (!userSessions.has(userId)) {
    userSessions.set(userId, new Set());
  }
  userSessions.get(userId)!.add(socketId);
};

describe('WebSocketSessionService', () => {
  let service: WebSocketSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebSocketSessionService();
  });

  it('should initialize with an empty session list', () => {
    expect(service.getOnlineCount()).toBe(0);
    expect(service.getOnlineUsers()).toHaveLength(0);
    expect(service.getAllSessions()).toHaveLength(0);
  });

  it('should track a registered session and report the user as online', () => {
    injectSession(service, 'socket-1', 'user-1', 'alice');

    expect(service.getOnlineCount()).toBe(1);

    const users = service.getOnlineUsers();
    expect(users).toHaveLength(1);
    expect(users[0].userId).toBe('user-1');
    expect(users[0].username).toBe('alice');
    expect(users[0].sessionCount).toBe(1);
  });

  it('should count multiple sockets for the same user as one online user', () => {
    injectSession(service, 'socket-1', 'user-1', 'alice');
    injectSession(service, 'socket-2', 'user-1', 'alice');

    expect(service.getOnlineCount()).toBe(1); // 1 unique user
    const users = service.getOnlineUsers();
    expect(users[0].sessionCount).toBe(2);
  });

  it('should correctly count separate online users', () => {
    injectSession(service, 'socket-1', 'user-1', 'alice');
    injectSession(service, 'socket-2', 'user-2', 'bob');

    expect(service.getOnlineCount()).toBe(2);
    expect(service.getOnlineUsers()).toHaveLength(2);
  });

  it('should retrieve session info by socket ID', () => {
    injectSession(service, 'socket-1', 'user-1', 'alice');

    const session = service.getSession('socket-1');
    expect(session).toBeDefined();
    expect(session!.userId).toBe('user-1');
    expect(session!.username).toBe('alice');
  });

  it('should return undefined for unknown socket ID', () => {
    expect(service.getSession('unknown-socket')).toBeUndefined();
  });

  it('should return all sessions for a given user', () => {
    injectSession(service, 'socket-1', 'user-1', 'alice');
    injectSession(service, 'socket-2', 'user-1', 'alice');

    const sessions = service.getUserSessions('user-1');
    expect(sessions).toHaveLength(2);
    expect(sessions.map(s => s.socketId)).toEqual(expect.arrayContaining(['socket-1', 'socket-2']));
  });

  it('should remove sessions and update online count after cleanup', () => {
    // Inject an old session (31 minutes ago)
    const oldDate = new Date(Date.now() - 31 * 60 * 1000);
    injectSession(service, 'socket-old', 'user-1', 'alice', oldDate);
    // Inject a fresh session
    injectSession(service, 'socket-new', 'user-2', 'bob');

    expect(service.getOnlineCount()).toBe(2);

    service.cleanupInactiveSessions(30 * 60 * 1000);

    // Old session should be gone; fresh session remains
    expect(service.getSession('socket-old')).toBeUndefined();
    expect(service.getSession('socket-new')).toBeDefined();
    expect(service.getOnlineCount()).toBe(1);
  });

  it('should initialize with Socket.IO server without throwing', () => {
    const fakeIo = makeFakeIo();
    expect(() => service.initialize(fakeIo)).not.toThrow();
  });
});
