/**
 * API Error Types
 * 
 * Shared error types for API error handling across the application.
 * Used by both api.ts and legacy apiClient.ts
 */

/**
 * API error type enumeration
 */
export enum ApiErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * API error interface
 */
export interface ApiError {
  type: ApiErrorType;
  message: string;
  code?: string;
  details?: any;
  status?: number;
}

/**
 * Create a standardized API error object
 */
export function createApiError(
  type: ApiErrorType,
  message: string,
  options?: { code?: string; details?: any; status?: number }
): ApiError {
  return {
    type,
    message,
    ...options,
  };
}