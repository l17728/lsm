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
});

/**
 * Strict rate limiter for authentication routes
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
    },
  },
  skipSuccessfulRequests: false,
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

  // Apply rate limiting to all routes
  app.use('/api', rateLimiter);

  // Apply strict rate limiting to auth routes
  app.use('/api/auth', authRateLimiter);

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
