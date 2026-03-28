import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import monitoringService from '../services/monitoring.service';
import taskService from '../services/task.service';
import gpuService from '../services/gpu.service';
import { task_status as TaskStatus } from '@prisma/client';
import { websocketSessionService } from '../services/websocket-session.service';
import { mcpTools } from '../routes/mcp.routes';
import openClawService from '../services/openclaw.service';

// Chat session storage (in-memory for simplicity)
const chatSessions = new Map<string, { id: string; userId: string; messages: any[]; createdAt: Date }>();

export class WebSocketHandler {
  private io: SocketIOServer;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private taskCheckInterval: NodeJS.Timeout | null = null;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
      },
    });

    // Initialize session service
    websocketSessionService.initialize(this.io);

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    this.io.use((socket: Socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Extract userId from JWT token
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        (socket as any).userId = payload.userId;
      } catch {
        (socket as any).userId = 'anonymous';
      }
      next();
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;
      console.log(`Client connected: ${socket.id}, userId: ${userId}`);

      // Join user-specific room
      socket.on('join:user', (uid: string) => {
        socket.join(`user:${uid}`);
        console.log(`Client ${socket.id} joined user room: user:${uid}`);
      });

      // Subscribe to server updates
      socket.on('subscribe:servers', () => {
        socket.join('servers');
        console.log(`Client ${socket.id} subscribed to server updates`);
      });

      // Subscribe to GPU updates
      socket.on('subscribe:gpus', () => {
        socket.join('gpus');
        console.log(`Client ${socket.id} subscribed to GPU updates`);
      });

      // Subscribe to task updates
      socket.on('subscribe:tasks', () => {
        socket.join('tasks');
        console.log(`Client ${socket.id} subscribed to task updates`);
      });

      // ===== Chat Events =====
      socket.on('create:session', () => {
        const sessionId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        chatSessions.set(sessionId, { id: sessionId, userId, messages: [], createdAt: new Date() });
        socket.join(`session:${sessionId}`);
        socket.emit('chat:session', { sessionId });
        console.log(`[Chat] Created session: ${sessionId}`);
      });

      socket.on('join:chat', (data: { sessionId: string }) => {
        const session = chatSessions.get(data.sessionId);
        if (session) {
          socket.join(`session:${data.sessionId}`);
          socket.emit('chat:history', { messages: session.messages });
        } else {
          socket.emit('chat:error', { message: 'Session not found' });
        }
      });

      socket.on('chat:message', async (data: { type: string; content: string; sessionId: string }) => {
        const session = chatSessions.get(data.sessionId);
        if (!session) {
          return socket.emit('chat:error', { message: 'Session not found' });
        }

        // Add user message
        const userMsg = { id: `msg-${Date.now()}`, role: 'user', content: data.content, timestamp: new Date().toISOString() };
        session.messages.push(userMsg);

        // Show typing indicator
        socket.emit('chat:typing', { typing: true });
        
        try {
          // Call OpenClaw service
          const response = await openClawService.chat(data.content, {
            userId,
            sessionId: data.sessionId
          });

          const aiMsg = {
            id: `msg-${Date.now()}-ai`,
            role: 'assistant',
            content: response.message || response.error || '抱歉，我暂时无法处理您的请求。',
            timestamp: new Date().toISOString()
          };
          session.messages.push(aiMsg);
          socket.emit('chat:message', { type: 'message', payload: aiMsg });
        } catch (error: any) {
          console.error('[Chat] Error:', error.message);
          const errorMsg = {
            id: `msg-${Date.now()}-error`,
            role: 'system',
            content: '服务暂时不可用，请稍后重试。',
            timestamp: new Date().toISOString()
          };
          socket.emit('chat:message', { type: 'message', payload: errorMsg });
        } finally {
          socket.emit('chat:typing', { typing: false });
        }
      });

      socket.on('chat:clear', (data: { sessionId: string }) => {
        const session = chatSessions.get(data.sessionId);
        if (session) {
          session.messages = [];
        }
      });

      socket.on('leave:chat', (data: { sessionId: string }) => {
        socket.leave(`session:${data.sessionId}`);
      });

      // MCP WebSocket Bridge
      socket.on('mcp:invoke', async (data: { tool: string; params?: any; requestId?: string }) => {
        try {
          const handler = mcpTools[data.tool as keyof typeof mcpTools];
          if (!handler) {
            return socket.emit('mcp:error', { requestId: data.requestId, error: `Unknown tool: ${data.tool}` });
          }
          const result = await handler(data.params || {});
          socket.emit('mcp:result', { requestId: data.requestId, tool: data.tool, result });
        } catch (err: any) {
          socket.emit('mcp:error', { requestId: data.requestId, error: err.message || 'Internal error' });
        }
      });

      socket.on('mcp:tools', () => {
        socket.emit('mcp:tools:list', { tools: Object.keys(mcpTools) });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        console.error(`Socket error: ${error.message}`);
      });
    });
  }

  /**
   * Start real-time monitoring broadcasts
   */
  startMonitoring(intervalMs = 10000) {
    // Broadcast server metrics
    this.monitoringInterval = setInterval(async () => {
      try {
        const health = await monitoringService.getServerHealth();
        const stats = await monitoringService.getClusterStats();
        const alerts = await monitoringService.getAlerts();

        // Broadcast to all subscribed clients
        this.io.to('servers').emit('servers:update', {
          health,
          stats: stats.servers,
          usage: stats.usage,
        });

        if (alerts.length > 0) {
          this.io.to('servers').emit('alerts:new', alerts);
        }
      } catch (error) {
        console.error('Monitoring broadcast error:', error);
      }
    }, intervalMs);

    console.log(`Monitoring started with interval ${intervalMs}ms`);
  }

  /**
   * Start task status polling
   */
  startTaskMonitoring(intervalMs = 5000) {
    this.taskCheckInterval = setInterval(async () => {
      try {
        const stats = await taskService.getTaskStats();

        this.io.to('tasks').emit('tasks:update', stats);
      } catch (error) {
        console.error('Task monitoring error:', error);
      }
    }, intervalMs);

    console.log(`Task monitoring started with interval ${intervalMs}ms`);
  }

  /**
   * Broadcast GPU allocation update
   */
  broadcastGpuUpdate(userId: string, allocation: any) {
    this.io.to(`user:${userId}`).emit('gpu:allocated', allocation);
    this.io.to('gpus').emit('gpus:update', { type: 'allocation', data: allocation });
  }

  /**
   * Broadcast GPU release update
   */
  broadcastGpuRelease(userId: string, gpuId: string) {
    this.io.to(`user:${userId}`).emit('gpu:released', { gpuId });
    this.io.to('gpus').emit('gpus:update', { type: 'release', gpuId });
  }

  /**
   * Broadcast task status update
   */
  broadcastTaskUpdate(taskId: string, status: TaskStatus, userId?: string) {
    const data = { taskId, status, timestamp: new Date() };

    if (userId) {
      this.io.to(`user:${userId}`).emit('task:update', data);
    }

    this.io.to('tasks').emit('task:update', data);
  }

  /**
   * Send alert to specific user
   */
  sendUserAlert(userId: string, alert: { type: string; message: string }) {
    this.io.to(`user:${userId}`).emit('alert', alert);
  }

  /**
   * Stop all monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.taskCheckInterval) {
      clearInterval(this.taskCheckInterval);
      this.taskCheckInterval = null;
    }

    console.log('Monitoring stopped');
  }

  /**
   * Get Socket.IO instance
   */
  getIO() {
    return this.io;
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: any) {
    this.io.emit('message', message);
  }

  /**
   * Broadcast alert to all clients
   */
  broadcastAlert(alert: {
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    timestamp: string;
    metadata?: any;
  }) {
    this.io.emit('alert', alert);
    this.io.to('servers').emit('alerts:new', [alert]);
  }
}

// Export singleton instance for global access
let websocketInstance: WebSocketHandler | null = null;

export function initializeWebSocket(httpServer: HttpServer): WebSocketHandler {
  websocketInstance = new WebSocketHandler(httpServer);
  (global as any).websocketServer = websocketInstance;
  return websocketInstance;
}

export default WebSocketHandler;
