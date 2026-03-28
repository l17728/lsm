/**
 * Safe Data Access Utilities
 *
 * Purpose: Provide null-safe data access functions to prevent
 * "Cannot read properties of undefined" errors.
 *
 * Usage: Import and use these functions instead of direct property access
 * when dealing with API response data that may have missing fields.
 */

/**
 * Safely get a string value, returning empty string if undefined/null
 */
export function safeString(value: string | undefined | null): string {
  return value ?? '';
}

/**
 * Safely get an array, returning empty array if undefined/null
 */
export function safeArray<T>(value: T[] | undefined | null): T[] {
  return value ?? [];
}

/**
 * Safely join array elements, handling undefined/null arrays
 */
export function safeJoin(value: string[] | undefined | null, separator: string = ', '): string {
  return (value ?? []).join(separator);
}

/**
 * Safely slice a string, handling undefined/null strings
 */
export function safeSlice(value: string | undefined | null, start: number, end?: number): string {
  return (value ?? '').slice(start, end);
}

/**
 * Safely get nested object property
 */
export function safeGet<T>(obj: unknown, path: string, defaultValue: T): T {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current === undefined || current === null ? defaultValue : (current as T);
}

/**
 * Safely format a date string
 */
export function safeFormatDate(value: string | Date | undefined | null, format: string = 'YYYY-MM-DD'): string {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Safely get user display name
 */
export function safeUserName(userName: string | undefined | null): string {
  return userName || 'Unknown User';
}

/**
 * Safely get server display name
 */
export function safeServerName(serverName: string | undefined | null): string {
  return serverName || 'Unknown Server';
}

/**
 * Safely get reservation purpose with truncation
 */
export function safePurpose(purpose: string | undefined | null, maxLength: number = 50): string {
  const safeValue = purpose ?? '';
  if (safeValue.length <= maxLength) return safeValue;
  return safeValue.slice(0, maxLength) + '...';
}

/**
 * Safely get GPU IDs as display string
 */
export function safeGpuIds(gpuIds: string[] | undefined | null): string {
  return (gpuIds ?? []).join(', ') || 'No GPUs';
}