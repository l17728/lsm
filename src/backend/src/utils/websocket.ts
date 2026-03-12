import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import monitoringService from '../services/monitoring.service';
import taskService from '../services/task.service';
import gpuService from '../services/gpu.service';
import { TaskStatus } from '@prisma/client';

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

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    this.io.use((socket: Socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Token validation would happen here in production
      // For now, we'll accept all tokens
      next();
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Join user-specific room
      socket.on('join:user', (userId: string) => {
        socket.join(`user:${userId}`);
        console.log(`Client ${socket.id} joined user room: user:${userId}`);
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
}

export default WebSocketHandler;
