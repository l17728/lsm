/**
 * 日志脱敏中间件
 * 
 * 功能：
 * 1. 自动脱敏日志中的敏感信息
 * 2. 防止敏感数据泄露到日志文件
 * 3. 提供安全的日志格式化
 */

/**
 * 敏感字段列表
 * 这些字段在日志中会被自动脱敏
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'jwtSecret',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'privateKey',
  'private_key',
  'smtpPassword',
  'dbPassword',
  'redisPassword',
  'csrfToken',
];

/**
 * 脱敏占位符
 */
const MASK = '***MASKED***';

/**
 * 检查字段名是否为敏感字段
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(sensitive => 
    lowerFieldName === sensitive.toLowerCase() ||
    lowerFieldName.includes(sensitive.toLowerCase())
  );
}

/**
 * 脱敏单个值
 */
function maskValue(value: any, fieldName?: string): any {
  if (value === null || value === undefined) {
    return value;
  }

  // 如果是字符串
  if (typeof value === 'string') {
    // 如果是字段名敏感，完全脱敏
    if (fieldName && isSensitiveField(fieldName)) {
      return MASK;
    }
    // 检查字符串是否包含敏感信息模式
    if (value.length > 20 && (
      value.match(/^[A-Za-z0-9+/=]{20,}$/) || // Base64
      value.match(/^eyJ[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/) // JWT
    )) {
      return MASK;
    }
    return value;
  }

  // 如果是对象，递归处理
  if (typeof value === 'object') {
    return maskObject(value);
  }

  return value;
}

/**
 * 脱敏对象
 */
export function maskObject(obj: any, depth: number = 0): any {
  // 防止循环引用和过深嵌套
  if (depth > 10) {
    return '[MAX_DEPTH_REACHED]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map(item => maskValue(item));
  }

  // 处理日期
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // 处理错误对象
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      // 不记录堆栈信息到日志
      stack: '[STACK_TRACE_MASKED]',
    };
  }

  // 处理普通对象
  if (typeof obj === 'object') {
    const masked: any = {};
    for (const key of Object.keys(obj)) {
      if (isSensitiveField(key)) {
        masked[key] = MASK;
      } else {
        masked[key] = maskValue(obj[key], key);
      }
    }
    return masked;
  }

  return obj;
}

/**
 * 脱敏字符串（用于日志消息）
 */
export function maskString(str: string): string {
  let masked = str;

  // 脱敏 JWT token 模式
  masked = masked.replace(
    /eyJ[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+/g,
    '[JWT_TOKEN_MASKED]'
  );

  // 脱敏密码模式
  masked = masked.replace(
    /"password"\s*:\s*"[^"]+"/gi,
    '"password":"***MASKED***"'
  );
  masked = masked.replace(
    /"passwordHash"\s*:\s*"[^"]+"/gi,
    '"passwordHash":"***MASKED***"'
  );

  // 脱敏 Authorization 头
  masked = masked.replace(
    /Bearer\s+[A-Za-z0-9+/=]+/gi,
    'Bearer [TOKEN_MASKED]'
  );

  // 脱敏数据库连接字符串
  masked = masked.replace(
    /postgresql:\/\/([^:]+):([^@]+)@/gi,
    'postgresql://$1:***@'
  );

  // 脱敏邮箱（部分保留）
  masked = masked.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (match, local, domain) => {
      const maskedLocal = local.length > 2 
        ? local[0] + '***' + local[local.length - 1] 
        : '***';
      return `${maskedLocal}@${domain}`;
    }
  );

  return masked;
}

/**
 * 安全日志格式化器
 */
export class SafeLogger {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const maskedMessage = maskString(message);
    const maskedData = data ? JSON.stringify(maskObject(data)) : '';
    
    let logLine = `[${timestamp}] [${level}] ${this.prefix} ${maskedMessage}`;
    if (maskedData) {
      logLine += ` ${maskedData}`;
    }
    return logLine;
  }

  info(message: string, data?: any): void {
    console.log(this.formatMessage('INFO', message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('WARN', message, data));
  }

  error(message: string, error?: Error | any): void {
    const errorData = error instanceof Error 
      ? { name: error.name, message: error.message }
      : maskObject(error);
    console.error(this.formatMessage('ERROR', message, errorData));
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('DEBUG', message, data));
    }
  }
}

/**
 * 默认安全日志实例
 */
export const safeLogger = new SafeLogger('LSM');

/**
 * 请求数据脱敏中间件
 */
export function sanitizeRequestLog(req: any): any {
  const sanitized: any = {
    method: req.method,
    path: req.path,
    query: maskObject(req.query),
    headers: {},
  };

  // 脱敏请求头
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (isSensitiveField(key)) {
      sanitized.headers[key] = MASK;
    } else {
      sanitized.headers[key] = value;
    }
  }

  // 不记录请求体中的敏感信息
  if (req.body && Object.keys(req.body).length > 0) {
    sanitized.body = maskObject(req.body);
  }

  return sanitized;
}

/**
 * 响应数据脱敏
 */
export function sanitizeResponseLog(data: any): any {
  return maskObject(data);
}

export default SafeLogger;