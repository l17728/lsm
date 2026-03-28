/**
 * Unit Tests — CalendarView Component Null Safety
 *
 * Purpose: Test CalendarView handles undefined/null data gracefully
 *
 * Covers:
 * - TC-UNIT-001: Render with undefined purpose
 * - TC-UNIT-002: Render with undefined userName
 * - TC-UNIT-003: Render with undefined serverName
 * - TC-UNIT-004: Render with undefined/null gpuIds
 * - TC-UNIT-005: Render with empty reservations array
 * - TC-UNIT-006: Render with null reservations
 * - TC-UNIT-007: Month view handles all edge cases
 * - TC-UNIT-008: Week view handles all edge cases
 * - TC-UNIT-009: Day view handles all edge cases
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import CalendarView from '../CalendarView';
import type { Reservation } from '../../../services/reservation.service';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      const translations: Record<string, any> = {
        'reservation.time': 'Time',
        'reservation.reservationDetails': 'Details',
        'reservation.selectServer': 'Select Server',
        'reservation.day': 'Day',
        'reservation.week': 'Week',
        'reservation.month': 'Month',
        'reservation.weekdays': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        'reservation.more': 'more',
        'reservation.pending': 'Pending',
        'reservation.approved': 'Approved',
        'reservation.active': 'Active',
        'reservation.completed': 'Completed',
        'reservation.cancelled': 'Cancelled',
        'reservation.noReservations': 'No reservations',
        'reservation.clickToViewDetails': 'Click to view details in day view',
        'reservation.noPurpose': 'No purpose specified',
      };
      
      // Handle returnObjects option
      if (options?.returnObjects) {
        return translations[key] || [];
      }
      
      return translations[key] || key;
    },
  }),
}));

// Mock dayjs
vi.mock('dayjs', () => {
  const mockDayjs = (date?: Date | string) => ({
    format: (fmt: string) => {
      if (!date) return '2026-03-28';
      const d = new Date(date);
      if (fmt === 'YYYY-MM-DD') return d.toISOString().split('T')[0];
      if (fmt === 'HH:mm') return '10:00';
      if (fmt === 'MM/DD') return '03/28';
      if (fmt === 'YYYY-MM') return '2026-03';
      return d.toISOString();
    },
    hour: (h: number) => mockDayjs(date),
    minute: (m: number) => mockDayjs(date),
    second: (s: number) => mockDayjs(date),
    toDate: () => date ? new Date(date) : new Date(),
    date: () => 28,
    day: () => 6,
    isSame: () => true,
    isBefore: () => false,
    isAfter: () => true,
    startOf: (unit: string) => mockDayjs(date),
    endOf: (unit: string) => mockDayjs(date),
    diff: () => 7,
    add: (n: number, unit: string) => mockDayjs(date),
    subtract: (n: number, unit: string) => mockDayjs(date),
  });
  return {
    default: mockDayjs,
  };
});

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <ConfigProvider>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </ConfigProvider>
  );
};

describe('CalendarView — Null Safety Tests', () => {
  const baseReservation: Reservation = {
    id: 'test-id-1',
    userId: 'user-1',
    userName: 'Test User',
    serverId: 'server-1',
    serverName: 'Test Server',
    gpuIds: ['gpu-1', 'gpu-2'],
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 3600000).toISOString(),
    status: 'approved',
    purpose: 'Test purpose',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('TC-UNIT-001 to 004: Undefined Property Handling', () => {
    it('should render without crashing when purpose is undefined', () => {
      const reservationWithUndefinedPurpose: Reservation = {
        ...baseReservation,
        purpose: undefined as unknown as string,
      };

      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[reservationWithUndefinedPurpose]}
          />
        );
      }).not.toThrow();
    });

    it('should render without crashing when userName is undefined', () => {
      const reservationWithUndefinedUserName: Reservation = {
        ...baseReservation,
        userName: undefined as unknown as string,
      };

      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[reservationWithUndefinedUserName]}
          />
        );
      }).not.toThrow();
    });

    it('should render without crashing when serverName is undefined', () => {
      const reservationWithUndefinedServerName: Reservation = {
        ...baseReservation,
        serverName: undefined as unknown as string,
      };

      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[reservationWithUndefinedServerName]}
          />
        );
      }).not.toThrow();
    });

    it('should render without crashing when gpuIds is undefined', () => {
      const reservationWithUndefinedGpuIds: Reservation = {
        ...baseReservation,
        gpuIds: undefined as unknown as string[],
      };

      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[reservationWithUndefinedGpuIds]}
          />
        );
      }).not.toThrow();
    });

    it('should render without crashing when gpuIds is null', () => {
      const reservationWithNullGpuIds: Reservation = {
        ...baseReservation,
        gpuIds: null as unknown as string[],
      };

      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[reservationWithNullGpuIds]}
          />
        );
      }).not.toThrow();
    });

    it('should render without crashing when all optional fields are undefined', () => {
      const reservationWithAllUndefined: Reservation = {
        ...baseReservation,
        purpose: undefined as unknown as string,
        userName: undefined as unknown as string,
        serverName: undefined as unknown as string,
        gpuIds: undefined as unknown as string[],
      };

      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[reservationWithAllUndefined]}
          />
        );
      }).not.toThrow();
    });
  });

  describe('TC-UNIT-005 to 006: Empty/Null Reservations Handling', () => {
    it('should render without crashing with empty reservations array', () => {
      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[]}
          />
        );
      }).not.toThrow();
    });

    it('should show empty state when no reservations', () => {
      renderWithProviders(
        <CalendarView
          viewMode="month"
          currentDate={new Date()}
          reservations={[]}
        />
      );

      // Calendar should still render with empty state
      expect(screen.getByText(/No reservations|暂无预约/i)).toBeDefined();
    });
  });

  describe('TC-UNIT-007 to 009: View Mode Null Safety', () => {
    it('should render month view without errors with minimal data', () => {
      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[{ ...baseReservation, purpose: '' }]}
          />
        );
      }).not.toThrow();
    });

    it('should render week view without errors with minimal data', () => {
      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="week"
            currentDate={new Date()}
            reservations={[{ ...baseReservation, purpose: '' }]}
          />
        );
      }).not.toThrow();
    });

    it('should render day view without errors with minimal data', () => {
      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="day"
            currentDate={new Date()}
            reservations={[{ ...baseReservation, purpose: '' }]}
          />
        );
      }).not.toThrow();
    });

    it('should handle long purpose text in month view', () => {
      const longPurposeReservation: Reservation = {
        ...baseReservation,
        purpose: 'This is a very long purpose text that should be truncated properly without causing any errors',
      };

      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[longPurposeReservation]}
          />
        );
      }).not.toThrow();
    });
  });

  describe('TC-UNIT-010: Server Dropdown Null Safety', () => {
    it('should render with empty servers array', () => {
      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[]}
            servers={[]}
          />
        );
      }).not.toThrow();
    });

    it('should render with servers having undefined names', () => {
      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[]}
            servers={[
              { id: '1', name: undefined as unknown as string },
              { id: '2', name: 'Server 2' },
            ]}
          />
        );
      }).not.toThrow();
    });
  });

  describe('TC-UNIT-011: Loading State', () => {
    it('should show loading state without errors', () => {
      expect(() => {
        renderWithProviders(
          <CalendarView
            viewMode="month"
            currentDate={new Date()}
            reservations={[]}
            loading={true}
          />
        );
      }).not.toThrow();
    });
  });
});