import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Express, NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

/**
 * Security configuration for the application
 */

/**
 * Generate a nonce for CSP
 * Used to allow specific inline scripts/styles instead of 'unsafe-inline'
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Extend Express Request type to include nonce
 */
declare global {
  namespace Express {
    interface Request {
      nonce?: string;
    }
  }
}

/**
 * Rate limiting configuration
 * Prevents brute-force attacks and DDoS
 * 
 * SECURITY NOTE: Rate limiting is DISABLED by default in development mode.
 * For production deployment, set RATE_LIMIT_ENABLED=true in environment variables.
 * See DEPLOYMENT.md for details.
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: () => process.env.RATE_LIMIT_ENABLED !== 'true', // Disabled by default, enable in production
});

/**
 * Strict rate limiter for authentication routes
 * 
 * SECURITY NOTE: Auth rate limiting is DISABLED by default in development mode.
 * For production deployment, set AUTH_RATE_LIMIT_ENABLED=true in environment variables.
 * See DEPLOYMENT.md for details.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
    },
  },
  skipSuccessfulRequests: false,
  skip: () => process.env.AUTH_RATE_LIMIT_ENABLED !== 'true', // Disabled by default, enable in production
});

/**
 * Nonce middleware - generates and attaches nonce to request
 */
export function nonceMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.nonce = generateNonce();
  res.locals.nonce = req.nonce;
  next();
}

/**
 * Helmet security headers configuration
 * 
 * SECURITY FIX: Removed 'unsafe-inline' from styleSrc
 * Using nonce-based CSP instead for better security
 */
export function applyHelmet(app: Express) {
  app.use(nonceMiddleware);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // SECURITY: Removed 'unsafe-inline', use nonce for inline styles
          styleSrc: ["'self'", 'https://cdn.jsdelivr.net', (req: Request) => `'nonce-${req.nonce}'`],
          scriptSrc: ["'self'", (req: Request) => `'nonce-${req.nonce}'`],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          // Additional security directives
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: 'same-site' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    })
  );
}

/**
 * Apply security middleware to the application
 */
export function applySecurity(app: Express) {
  // Apply Helmet security headers
  applyHelmet(app);

  // Rate limiting configuration
  const isRateLimitEnabled = process.env.RATE_LIMIT_ENABLED === 'true';
  const isAuthRateLimitEnabled = process.env.AUTH_RATE_LIMIT_ENABLED === 'true';

  // Apply rate limiting to all routes (only if enabled)
  if (isRateLimitEnabled) {
    app.use('/api', rateLimiter);
    console.log('[Security] API rate limiting enabled (100 requests per 15 minutes)');
  } else {
    console.log('[Security] API rate limiting DISABLED (development mode)');
  }

  // Apply strict rate limiting to auth routes (only if enabled)
  if (isAuthRateLimitEnabled) {
    app.use('/api/auth', authRateLimiter);
    console.log('[Security] Auth rate limiting enabled (20 requests per 15 minutes)');
  } else {
    console.log('[Security] Auth rate limiting DISABLED (development mode)');
  }

  // Trust proxy (for correct IP detection behind reverse proxy)
  app.set('trust proxy', 1);

  // Disable X-Powered-By header
  app.disable('x-powered-by');

  console.log('[Security] Security middleware applied');
}

/**
 * CORS configuration
 */
export const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
