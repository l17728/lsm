import { Server as SocketIOServer, Socket } from 'socket.io';

interface SessionInfo {
  socketId: string;
  userId: string;
  username: string;
  connectedAt: Date;
  lastActivity: Date;
  userAgent?: string;
  ip?: string;
}

interface OnlineUser {
  userId: string;
  username: string;
  sessionCount: number;
  firstConnectedAt: Date;
  lastActivityAt: Date;
}

/**
 * WebSocket Session Management Service
 * Tracks online users and their sessions
 */
export class WebSocketSessionService {
  private io: SocketIOServer | null = null;
  private sessions: Map<string, SessionInfo> = new Map(); // socketId -> SessionInfo
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  /**
   * Initialize with Socket.IO server
   */
  initialize(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
    console.log('[WebSocketSession] Service initialized');
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      // Extract user info from handshake
      const userId = (socket.handshake.auth as any).userId;
      const username = (socket.handshake.auth as any).username;
      const userAgent = socket.handshake.headers['user-agent'];
      const ip = socket.handshake.address;

      if (userId) {
        // Create session
        const sessionInfo: SessionInfo = {
          socketId: socket.id,
          userId,
          username: username || 'Unknown',
          connectedAt: new Date(),
          lastActivity: new Date(),
          userAgent,
          ip,
        };

        // Store session
        this.sessions.set(socket.id, sessionInfo);

        // Track user sessions
        if (!this.userSessions.has(userId)) {
          this.userSessions.set(userId, new Set());
        }
        this.userSessions.get(userId)!.add(socket.id);

        console.log(`[WebSocketSession] User ${username} (${userId}) connected: ${socket.id}`);

        // Broadcast online users update
        this.broadcastOnlineUsers();

        // Update activity on message
        socket.on('ping', () => {
          this.updateActivity(socket.id);
        });
      }

      // Handle disconnection
      socket.on('disconnect', () => {
        this.removeSession(socket.id);
      });
    });
  }

  /**
   * Remove session
   */
  private removeSession(socketId: string) {
    const session = this.sessions.get(socketId);
    if (session) {
      const userId = session.userId;
      this.sessions.delete(socketId);

      // Remove from user sessions
      const userSockets = this.userSessions.get(userId);
      if (userSockets) {
        userSockets.delete(socketId);
        if (userSockets.size === 0) {
          this.userSessions.delete(userId);
        }
      }

      console.log(`[WebSocketSession] User ${session.username} disconnected: ${socketId}`);

      // Broadcast online users update
      this.broadcastOnlineUsers();
    }
  }

  /**
   * Update last activity time
   */
  private updateActivity(socketId: string) {
    const session = this.sessions.get(socketId);
    if (session) {
      session.lastActivity = new Date();
      this.sessions.set(socketId, session);
    }
  }

  /**
   * Broadcast online users list to all connected clients
   */
  private broadcastOnlineUsers() {
    if (!this.io) return;

    const onlineUsers = this.getOnlineUsers();
    this.io.emit('users:online', onlineUsers);
  }

  /**
   * Get list of online users
   */
  getOnlineUsers(): OnlineUser[] {
    const userMap = new Map<string, OnlineUser>();

    this.sessions.forEach((session) => {
      if (!userMap.has(session.userId)) {
        userMap.set(session.userId, {
          userId: session.userId,
          username: session.username,
          sessionCount: 0,
          firstConnectedAt: session.connectedAt,
          lastActivityAt: session.lastActivity,
        });
      }

      const user = userMap.get(session.userId)!;
      user.sessionCount++;
      if (session.lastActivity > user.lastActivityAt) {
        user.lastActivityAt = session.lastActivity;
      }
    });

    return Array.from(userMap.values()).sort(
      (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime()
    );
  }

  /**
   * Get online users count
   */
  getOnlineCount(): number {
    return this.userSessions.size;
  }

  /**
   * Get session info for a socket
   */
  getSession(socketId: string): SessionInfo | undefined {
    return this.sessions.get(socketId);
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): SessionInfo[] {
    const socketIds = this.userSessions.get(userId) || new Set();
    return Array.from(socketIds)
      .map((id) => this.sessions.get(id))
      .filter((s): s is SessionInfo => !!s);
  }

  /**
   * Kick a user (all sessions)
   */
  kickUser(userId: string, reason?: string) {
    if (!this.io) return;

    const socketIds = this.userSessions.get(userId) || new Set();
    socketIds.forEach((socketId) => {
      const socket = this.io?.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('kicked', { reason });
        socket.disconnect(true);
      }
    });

    console.log(`[WebSocketSession] User ${userId} kicked: ${reason}`);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Cleanup inactive sessions (no activity for > 30 minutes)
   */
  cleanupInactiveSessions(timeoutMs = 30 * 60 * 1000) {
    const now = new Date();
    const toRemove: string[] = [];

    this.sessions.forEach((session, socketId) => {
      if (now.getTime() - session.lastActivity.getTime() > timeoutMs) {
        toRemove.push(socketId);
      }
    });

    toRemove.forEach((socketId) => {
      this.removeSession(socketId);
    });

    if (toRemove.length > 0) {
      console.log(`[WebSocketSession] Cleaned up ${toRemove.length} inactive sessions`);
    }
  }
}

// Export singleton instance
export const websocketSessionService = new WebSocketSessionService();
export default websocketSessionService;
