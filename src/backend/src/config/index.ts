import dotenv from 'dotenv';

dotenv.config();

/**
 * 获取 JWT 密钥，生产环境强制要求设置
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const nodeEnv = process.env.NODE_ENV || 'development';

  // 生产环境必须设置 JWT_SECRET
  if (nodeEnv === 'production') {
    if (!secret) {
      throw new Error(
        '[SECURITY ERROR] JWT_SECRET must be set in production environment. ' +
        'Please set a strong secret (at least 32 characters) in your environment variables.'
      );
    }
    if (secret.length < 32) {
      throw new Error(
        '[SECURITY ERROR] JWT_SECRET must be at least 32 characters in production. ' +
        `Current length: ${secret.length}`
      );
    }
    return secret;
  }

  // 开发环境使用警告但仍可运行
  if (!secret) {
    console.warn(
      '[SECURITY WARNING] JWT_SECRET not set. Using development-only secret. ' +
      'DO NOT use this in production!'
    );
    return 'dev-only-secret-DO-NOT-USE-IN-PRODUCTION';
  }

  return secret;
}

/**
 * 验证生产环境必需的环境变量
 */
function validateProductionConfig(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'production') {
    const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
    const missing: string[] = [];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `[SECURITY ERROR] Missing required environment variables in production: ${missing.join(', ')}`
      );
    }
  }
}

// 启动时验证配置
validateProductionConfig();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  jwtSecret: getJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || ['http://localhost:3000'],
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
