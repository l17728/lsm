/**
 * Unit Tests — Safe Data Access Utilities
 *
 * Purpose: Verify null-safe data access functions work correctly
 */
import { describe, it, expect } from 'vitest';
import {
  safeString,
  safeArray,
  safeJoin,
  safeSlice,
  safeGet,
  safeFormatDate,
  safeUserName,
  safeServerName,
  safePurpose,
  safeGpuIds,
} from '../safeAccess';

describe('Safe Data Access Utilities', () => {
  describe('safeString', () => {
    it('should return empty string for undefined', () => {
      expect(safeString(undefined)).toBe('');
    });

    it('should return empty string for null', () => {
      expect(safeString(null)).toBe('');
    });

    it('should return the value for valid string', () => {
      expect(safeString('test')).toBe('test');
    });

    it('should return empty string for empty string', () => {
      expect(safeString('')).toBe('');
    });
  });

  describe('safeArray', () => {
    it('should return empty array for undefined', () => {
      expect(safeArray(undefined)).toEqual([]);
    });

    it('should return empty array for null', () => {
      expect(safeArray(null)).toEqual([]);
    });

    it('should return the array for valid array', () => {
      expect(safeArray([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('should return empty array for empty array', () => {
      expect(safeArray([])).toEqual([]);
    });
  });

  describe('safeJoin', () => {
    it('should return empty string for undefined array', () => {
      expect(safeJoin(undefined)).toBe('');
    });

    it('should return empty string for null array', () => {
      expect(safeJoin(null)).toBe('');
    });

    it('should join array elements with default separator', () => {
      expect(safeJoin(['a', 'b', 'c'])).toBe('a, b, c');
    });

    it('should join array elements with custom separator', () => {
      expect(safeJoin(['a', 'b', 'c'], '-')).toBe('a-b-c');
    });

    it('should return empty string for empty array', () => {
      expect(safeJoin([])).toBe('');
    });
  });

  describe('safeSlice', () => {
    it('should return empty string for undefined', () => {
      expect(safeSlice(undefined, 0, 10)).toBe('');
    });

    it('should return empty string for null', () => {
      expect(safeSlice(null, 0, 10)).toBe('');
    });

    it('should slice valid string', () => {
      expect(safeSlice('hello world', 0, 5)).toBe('hello');
    });

    it('should handle slice beyond string length', () => {
      expect(safeSlice('short', 0, 100)).toBe('short');
    });
  });

  describe('safeGet', () => {
    it('should return default for null object', () => {
      expect(safeGet(null, 'a.b', 'default')).toBe('default');
    });

    it('should return default for undefined object', () => {
      expect(safeGet(undefined, 'a.b', 'default')).toBe('default');
    });

    it('should return default for missing path', () => {
      expect(safeGet({}, 'a.b.c', 'default')).toBe('default');
    });

    it('should return value for existing path', () => {
      expect(safeGet({ a: { b: { c: 'value' } } }, 'a.b.c', 'default')).toBe('value');
    });

    it('should return default for null intermediate value', () => {
      expect(safeGet({ a: null }, 'a.b', 'default')).toBe('default');
    });
  });

  describe('safeFormatDate', () => {
    it('should return empty string for undefined', () => {
      expect(safeFormatDate(undefined)).toBe('');
    });

    it('should return empty string for null', () => {
      expect(safeFormatDate(null)).toBe('');
    });

    it('should format valid date string', () => {
      expect(safeFormatDate('2026-03-28T10:00:00Z')).toBe('2026-03-28');
    });

    it('should format Date object', () => {
      expect(safeFormatDate(new Date('2026-03-28'))).toBe('2026-03-28');
    });

    it('should return empty string for invalid date', () => {
      expect(safeFormatDate('invalid')).toBe('');
    });
  });

  describe('safeUserName', () => {
    it('should return Unknown User for undefined', () => {
      expect(safeUserName(undefined)).toBe('Unknown User');
    });

    it('should return Unknown User for null', () => {
      expect(safeUserName(null)).toBe('Unknown User');
    });

    it('should return Unknown User for empty string', () => {
      expect(safeUserName('')).toBe('Unknown User');
    });

    it('should return the user name for valid string', () => {
      expect(safeUserName('John Doe')).toBe('John Doe');
    });
  });

  describe('safeServerName', () => {
    it('should return Unknown Server for undefined', () => {
      expect(safeServerName(undefined)).toBe('Unknown Server');
    });

    it('should return Unknown Server for null', () => {
      expect(safeServerName(null)).toBe('Unknown Server');
    });

    it('should return Unknown Server for empty string', () => {
      expect(safeServerName('')).toBe('Unknown Server');
    });

    it('should return the server name for valid string', () => {
      expect(safeServerName('GPU-Server-01')).toBe('GPU-Server-01');
    });
  });

  describe('safePurpose', () => {
    it('should return empty string for undefined', () => {
      expect(safePurpose(undefined)).toBe('');
    });

    it('should return empty string for null', () => {
      expect(safePurpose(null)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(safePurpose('')).toBe('');
    });

    it('should return short purpose unchanged', () => {
      expect(safePurpose('Short text')).toBe('Short text');
    });

    it('should truncate long purpose', () => {
      const longText = 'a'.repeat(100);
      const result = safePurpose(longText, 50);
      expect(result.length).toBe(53); // 50 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should use default max length', () => {
      const longText = 'a'.repeat(100);
      const result = safePurpose(longText);
      expect(result.length).toBe(53); // Default 50 + '...'
    });
  });

  describe('safeGpuIds', () => {
    it('should return No GPUs for undefined', () => {
      expect(safeGpuIds(undefined)).toBe('No GPUs');
    });

    it('should return No GPUs for null', () => {
      expect(safeGpuIds(null)).toBe('No GPUs');
    });

    it('should return No GPUs for empty array', () => {
      expect(safeGpuIds([])).toBe('No GPUs');
    });

    it('should join GPU IDs for valid array', () => {
      expect(safeGpuIds(['gpu-1', 'gpu-2'])).toBe('gpu-1, gpu-2');
    });
  });
});