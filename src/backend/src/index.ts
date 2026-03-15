import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import swaggerUi from 'swagger-ui-express';
import config from './config';
import authRoutes from './routes/auth.routes';
import serverRoutes from './routes/server.routes';
import gpuRoutes from './routes/gpu.routes';
import taskRoutes from './routes/task.routes';
import monitoringRoutes from './routes/monitoring.routes';
import exportRoutes from './routes/export.routes';
import prometheusRoutes from './routes/prometheus.routes';
import notificationRoutes from './routes/notification.routes';
import alertRulesRoutes from './routes/alert-rules.routes';
import cacheWarmupRoutes from './routes/cache-warmup.routes';
import websocketRoutes from './routes/websocket.routes';
import preferencesRoutes from './routes/preferences.routes';
import notificationHistoryRoutes from './routes/notification-history.routes';
import analyticsRoutes from './routes/analytics.routes';
import reservationRoutes from './routes/reservation.routes';
import aiSchedulerRoutes from './services/ai-scheduler/ai-scheduler.routes';
import mcpRoutes from './routes/mcp.routes';
import docsRoutes from './routes/docs.routes';
import feedbackRoutes from './routes/feedback.routes';
import agentRoutes from './routes/agent.routes';
import openclawRoutes from './routes/openclaw.routes';
import WebSocketHandler, { initializeWebSocket } from './utils/websocket';
import monitoringService from './services/monitoring.service';
import { cacheWarmupService } from './services/cache-warmup.service';
import { scheduledAnalyzerService } from './services/feedback';
import prisma from './utils/prisma';
import { csrfProtection } from './middleware/csrf.middleware';
import { applySecurity, rateLimiter, authRateLimiter } from './middleware/security.middleware';

// Import generated Swagger docs (will be created by build)
// @ts-ignore - Will be generated
import swaggerDocument from '../swagger-output.json';

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket
const wsHandler = initializeWebSocket(httpServer);

// ============================================
// Security Middleware
// ============================================

// Apply Helmet security headers with nonce-based CSP
applySecurity(app);

// CORS configuration
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CSRF Protection for state-changing operations
app.use(csrfProtection);

// ============================================
// Request Logging (with sensitive data masking)
// ============================================
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Mask sensitive paths
    const maskedPath = req.path.replace(/\/(password|token|secret|key)/gi, '/***');
    console.log(`${req.method} ${maskedPath} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// API Documentation
if (swaggerDocument) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/gpu', gpuRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/prometheus', prometheusRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/alert-rules', alertRulesRoutes);
app.use('/api/cache-warmup', cacheWarmupRoutes);
app.use('/api/websocket', websocketRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/notification-history', notificationHistoryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/ai-scheduler', aiSchedulerRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/openclaw', openclawRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // 停止定时分析服务
  scheduledAnalyzerService.stop();
  console.log('Feedback analyzer service stopped');

  wsHandler.stop();
  cacheWarmupService.destroy();

  httpServer.close(async () => {
    console.log('HTTP server closed');

    await prisma.$disconnect();
    console.log('Database connections closed');

    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
httpServer.listen(config.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   Laboratory Server Management System                     ║
║   Backend API Server                                      ║
║                                                           ║
║   🚀 Server running on: http://localhost:${config.port}     ║
║   📚 API Docs: http://localhost:${config.port}/api-docs     ║
║   🔌 WebSocket: ws://localhost:${config.port}               ║
║                                                           ║
║   Environment: ${config.nodeEnv.padEnd(39)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Start monitoring if enabled
  if (config.monitoring.enabled) {
    wsHandler.startMonitoring(config.monitoring.collectIntervalMs);
    wsHandler.startTaskMonitoring(config.scheduler.checkIntervalMs);

    // Initial metrics collection
    monitoringService.collectMetrics().catch(console.error);
  }

  // Initialize cache warmup service
  cacheWarmupService.initialize().catch(console.error);

  // 🔧 启动问题反馈定时分析服务
  scheduledAnalyzerService.start();
  console.log('📊 Feedback analyzer service started');
});

export default app;
