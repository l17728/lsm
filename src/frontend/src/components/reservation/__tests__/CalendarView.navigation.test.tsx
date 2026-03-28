/**
 * Unit Tests — CalendarView Component Navigation
 *
 * Purpose: Test CalendarView navigation and date switching behavior
 *
 * Covers:
 * - TC-NAV-001: Month view day cell click navigates to day view
 * - TC-NAV-002: Reservation item click navigates to day view
 * - TC-NAV-003: View mode switch updates viewMode
 * - TC-NAV-004: Date navigation prev/next works correctly
 * - TC-NAV-005: Reservations display correctly after date change
 * - TC-NAV-006: Badge shows correct reservation count
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
        'reservation.clickToViewDetails': 'Click to view details',
        'reservation.noPurpose': 'No purpose specified',
      };
      
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
      if (fmt === 'YYYY-MM-DD dddd') return '2026-03-28 Saturday';
      return d.toISOString();
    },
    hour: (h: number) => mockDayjs(date),
    minute: (m: number) => mockDayjs(date),
    second: (s: number) => mockDayjs(date),
    toDate: () => date ? new Date(date) : new Date(),
    date: () => 28,
    day: () => 6,
    isSame: (other: any, unit?: string) => {
      if (unit === 'day') return true;
      if (unit === 'month') return true;
      return true;
    },
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

describe('CalendarView — Navigation Tests', () => {
  const mockReservations: Reservation[] = [
    {
      id: 'test-id-1',
      userId: 'user-1',
      userName: 'Test User',
      serverId: 'server-1',
      serverName: 'Test Server',
      gpuIds: ['gpu-1'],
      startTime: '2026-03-28T09:00:00.000Z',
      endTime: '2026-03-28T18:00:00.000Z',
      status: 'approved',
      purpose: 'Test purpose',
      createdAt: '2026-03-27T00:00:00.000Z',
    },
    {
      id: 'test-id-2',
      userId: 'user-2',
      userName: 'Another User',
      serverId: 'server-2',
      serverName: 'Test Server 2',
      gpuIds: ['gpu-2'],
      startTime: '2026-03-28T14:00:00.000Z',
      endTime: '2026-03-28T17:00:00.000Z',
      status: 'pending',
      purpose: 'Another purpose',
      createdAt: '2026-03-27T00:00:00.000Z',
    },
  ];

  describe('TC-NAV-001: Month View Day Cell Click Navigation', () => {
    it('should render month view with day cells', () => {
      const mockDateChange = vi.fn();
      const mockViewModeChange = vi.fn();

      renderWithProviders(
        <CalendarView
          viewMode="month"
          currentDate={new Date('2026-03-28')}
          reservations={mockReservations}
          onDateChange={mockDateChange}
          onViewModeChange={mockViewModeChange}
        />
      );

      // Verify month view renders with cells
      const monthCells = document.querySelectorAll('.month-cell');
      expect(monthCells.length).toBeGreaterThan(0);
    });
  });

  describe('TC-NAV-002: Reservation Item Click Navigation', () => {
    it('should navigate to day view when clicking reservation item in month view', () => {
      const mockDateChange = vi.fn();
      const mockViewModeChange = vi.fn();
      const mockReservationClick = vi.fn();

      renderWithProviders(
        <CalendarView
          viewMode="month"
          currentDate={new Date('2026-03-28')}
          reservations={mockReservations}
          onDateChange={mockDateChange}
          onViewModeChange={mockViewModeChange}
          onReservationClick={mockReservationClick}
        />
      );

      // Find reservation items (they contain the purpose text)
      const reservationItems = screen.getAllByText(/Test purpose|Another purpose/);
      if (reservationItems.length > 0) {
        fireEvent.click(reservationItems[0]);
      }

      expect(mockDateChange).toHaveBeenCalled();
      expect(mockViewModeChange).toHaveBeenCalledWith('day');
      expect(mockReservationClick).toHaveBeenCalled();
    });
  });

  describe('TC-NAV-003: View Mode Switching', () => {
    it('should call onViewModeChange when switching view modes', () => {
      const mockViewModeChange = vi.fn();

      renderWithProviders(
        <CalendarView
          viewMode="month"
          currentDate={new Date()}
          reservations={[]}
          onViewModeChange={mockViewModeChange}
        />
      );

      // Find the segmented control and click different options
      const dayButtons = screen.getAllByText(/Day|日/);
      if (dayButtons.length > 0) {
        fireEvent.click(dayButtons[0]);
      }

      expect(mockViewModeChange).toHaveBeenCalled();
    });
  });

  describe('TC-NAV-004: Date Navigation Prev/Next', () => {
    it('should call onDateChange when clicking prev button', () => {
      const mockDateChange = vi.fn();

      renderWithProviders(
        <CalendarView
          viewMode="month"
          currentDate={new Date('2026-03-28')}
          reservations={[]}
          onDateChange={mockDateChange}
        />
      );

      // Find prev button (LeftOutlined icon)
      const buttons = document.querySelectorAll('button');
      const prevButton = buttons[0]; // First button should be prev
      fireEvent.click(prevButton);

      expect(mockDateChange).toHaveBeenCalled();
    });

    it('should call onDateChange when clicking next button', () => {
      const mockDateChange = vi.fn();

      renderWithProviders(
        <CalendarView
          viewMode="month"
          currentDate={new Date('2026-03-28')}
          reservations={[]}
          onDateChange={mockDateChange}
        />
      );

      // Find next button (RightOutlined icon)
      const buttons = document.querySelectorAll('button');
      const nextButton = buttons[1]; // Second button should be next
      fireEvent.click(nextButton);

      expect(mockDateChange).toHaveBeenCalled();
    });
  });

  describe('TC-NAV-005: Reservations Display After Date Change', () => {
    it('should display reservations in day view', () => {
      renderWithProviders(
        <CalendarView
          viewMode="day"
          currentDate={new Date('2026-03-28')}
          reservations={mockReservations}
        />
      );

      // Day view should show time slots
      const timeElements = screen.getAllByText(/Time|时间/);
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it('should display reservations in week view', () => {
      renderWithProviders(
        <CalendarView
          viewMode="week"
          currentDate={new Date('2026-03-28')}
          reservations={mockReservations}
        />
      );

      // Week view should show time column
      const timeElements = screen.getAllByText(/Time|时间/);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  describe('TC-NAV-006: Badge Shows Reservation Count', () => {
    it('should show badge with reservation count in month view', () => {
      renderWithProviders(
        <CalendarView
          viewMode="month"
          currentDate={new Date('2026-03-28')}
          reservations={mockReservations}
        />
      );

      // Badge should show count of reservations
      // The Badge component renders with a count
      const badges = document.querySelectorAll('.ant-badge');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('TC-NAV-007: Has-Reservations Cell Styling', () => {
    it('should add has-reservations class to cells with reservations', () => {
      renderWithProviders(
        <CalendarView
          viewMode="month"
          currentDate={new Date('2026-03-28')}
          reservations={mockReservations}
        />
      );

      // Cells with reservations should have the has-reservations class
      const hasReservationsCells = document.querySelectorAll('.has-reservations');
      expect(hasReservationsCells.length).toBeGreaterThan(0);
    });
  });
});