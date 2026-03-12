import { Request, Response, NextFunction } from 'express';

/**
 * Application error class
 */
export class AppError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    status: number = 500,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error types
 */
export enum ErrorTypes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

/**
 * Global error handling middleware
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  console.error(`[Error] ${new Date().toISOString()}`, {
    message: err.message,
    code: (err as AppError).code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Handle AppError
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details:
          process.env.NODE_ENV === 'development' ? err.details : undefined,
        timestamp: new Date().toISOString(),
      },
    };

    res.status(err.status).json(response);
    return;
  }

  // Handle validation errors
  if (err.name === 'ZodError') {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: ErrorTypes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.errors,
        timestamp: new Date().toISOString(),
      },
    };

    res.status(400).json(response);
    return;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        details:
          process.env.NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString(),
      },
    };

    res.status(500).json(response);
    return;
  }

  // Handle generic errors
  const isProd = process.env.NODE_ENV === 'production';
  const response: ErrorResponse = {
    success: false,
    error: {
      code: ErrorTypes.INTERNAL_ERROR,
      message: isProd ? 'Internal server error' : err.message,
      details: isProd
        ? undefined
        : {
            stack: err.stack,
            name: err.name,
          },
      timestamp: new Date().toISOString(),
    },
  };

  res.status(500).json(response);
}

/**
 * Async handler wrapper to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create specific error types
 */
export const createError = {
  validation: (message: string, details?: any) =>
    new AppError(message, ErrorTypes.VALIDATION_ERROR, 400, details),

  authentication: (message: string = 'Authentication required') =>
    new AppError(message, ErrorTypes.AUTHENTICATION_ERROR, 401),

  authorization: (message: string = 'Not authorized') =>
    new AppError(message, ErrorTypes.AUTHORIZATION_ERROR, 403),

  notFound: (resource: string) =>
    new AppError(
      `${resource} not found`,
      ErrorTypes.NOT_FOUND_ERROR,
      404
    ),

  conflict: (message: string) =>
    new AppError(message, ErrorTypes.CONFLICT_ERROR, 409),

  internal: (message: string, details?: any) =>
    new AppError(message, ErrorTypes.INTERNAL_ERROR, 500, details),

  service: (message: string, details?: any) =>
    new AppError(message, ErrorTypes.SERVICE_ERROR, 503, details),
};
