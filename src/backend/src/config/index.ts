import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  jwtSecret: process.env.JWT_SECRET || 'lsm-dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  db: {
    url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  },
  scheduler: {
    enabled: process.env.SCHEDULER_ENABLED !== 'false',
    checkIntervalMs: parseInt(process.env.SCHEDULER_INTERVAL_MS || '5000', 10),
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    collectIntervalMs: parseInt(process.env.MONITORING_INTERVAL_MS || '10000', 10),
  },
};

export default config;
