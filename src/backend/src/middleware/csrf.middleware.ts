import { Request, Response, NextFunction } from 'express';
import config from '../config';

/**
 * CSRF 保护中间件
 * 
 * 由于本系统使用 Bearer Token 认证，CSRF 风险已降低。
 * 但为了额外的安全保护，我们实现了以下措施：
 * 
 * 1. Origin/Referer 头验证 - 确保请求来自允许的域名
 * 2. 关键操作需要额外的 CSRF token 验证（可选）
 * 
 * 安全说明：
 * - Bearer Token 存储在 localStorage 中，不通过 Cookie 发送
 * - 攻击者无法读取 localStorage 中的 token
 * - 但仍建议为关键操作添加额外保护
 */

/**
 * 允许的源列表
 */
const allowedOrigins = config.corsOrigins;

/**
 * 验证 Origin 或 Referer 头
 * 保护状态变更操作免受 CSRF 攻击
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void | Response {
  const method = req.method.toUpperCase();
  
  // 只保护状态变更操作 (POST, PUT, DELETE, PATCH)
  const protectedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  if (!protectedMethods.includes(method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // 检查 Origin 头
  if (origin) {
    if (isOriginAllowed(origin)) {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_INVALID_ORIGIN',
        message: 'Request origin not allowed',
      },
    });
    return;
  }

  // 如果没有 Origin，检查 Referer 头
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = refererUrl.origin;
      
      if (isOriginAllowed(refererOrigin)) {
        next();
        return;
      }
      
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_INVALID_REFERER',
          message: 'Request referer not allowed',
        },
      });
      return;
    } catch {
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_INVALID_REFERER',
          message: 'Invalid referer header',
        },
      });
      return;
    }
  }

  // 对于没有 Origin 和 Referer 的请求
  // 在生产环境中，这通常是一个可疑请求
  // 但某些合法场景（如直接 API 调用）可能没有这些头
  const nodeEnv = config.nodeEnv;
  
  if (nodeEnv === 'production') {
    // 生产环境：拒绝没有 Origin/Referer 的状态变更请求
    // 例外：允许健康检查和 webhooks
    const exemptPaths = ['/health', '/api/webhooks', '/api/prometheus'];
    if (exemptPaths.some(path => req.path.startsWith(path))) {
      next();
      return;
    }
    
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_MISSING_ORIGIN',
        message: 'Origin or Referer header required for this request',
      },
    });
    return;
  }

  // 开发环境：允许通过，但记录警告
  console.warn(
    `[CSRF WARNING] ${method} ${req.path} - No Origin/Referer header present`
  );
  next();
}

/**
 * 检查源是否被允许
 */
function isOriginAllowed(origin: string): boolean {
  try {
    const originUrl = new URL(origin);
    const originWithPort = originUrl.origin;
    const originWithoutPort = `${originUrl.protocol}//${originUrl.hostname}`;
    
    return allowedOrigins.some(allowed => {
      // 完全匹配
      if (allowed === originWithPort) return true;
      // 匹配不带端口的
      if (allowed === originWithoutPort) return true;
      // 通配符匹配
      if (allowed.startsWith('*.') && originUrl.hostname.endsWith(allowed.slice(1))) return true;
      return false;
    });
  } catch {
    return false;
  }
}

/**
 * 生成 CSRF Token（可选功能）
 * 用于需要额外保护的关键操作
 */
export function generateCsrfToken(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * CSRF Token 验证中间件（可选）
 * 用于关键操作如密码修改、删除账户等
 * 
 * 使用方法：
 * 1. 客户端通过 GET /api/csrf-token 获取 token
 * 2. 在关键操作的请求中添加 X-CSRF-Token 头
 */
export function csrfTokenVerification(req: Request, res: Response, next: NextFunction): void | Response {
  const csrfToken = req.headers['x-csrf-token'] as string;
  const sessionToken = (req as any).session?.csrfToken;

  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_MISMATCH',
        message: 'Invalid CSRF token',
      },
    });
  }

  next();
}

export default csrfProtection;