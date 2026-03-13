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
import WebSocketHandler, { initializeWebSocket } from './utils/websocket';
import monitoringService from './services/monitoring.service';
import { cacheWarmupService } from './services/cache-warmup.service';
import prisma from './utils/prisma';

// Import generated Swagger docs (will be created by build)
// @ts-ignore - Will be generated
import swaggerDocument from '../swagger-output.json';

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket
const wsHandler = initializeWebSocket(httpServer);

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
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
});

export default app;
