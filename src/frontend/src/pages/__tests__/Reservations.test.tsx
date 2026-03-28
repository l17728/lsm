import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Reservations from '../Reservations'

vi.mock('../../store/reservationStore', () => ({
  useReservationStore: vi.fn(() => ({
    currentDate: new Date('2026-03-17'),
    viewMode: 'month',
    selectedServerId: null,
    reservations: [],
    loading: false,
    availableServers: [],
    setCurrentDate: vi.fn(),
    setViewMode: vi.fn(),
    setSelectedServerId: vi.fn(),
    fetchReservations: vi.fn().mockResolvedValue(undefined),
    fetchAvailableServers: vi.fn().mockResolvedValue(undefined),
    cancelReservation: vi.fn(),
    releaseReservation: vi.fn(),
  })),
}))

vi.mock('../../components/reservation/CalendarView', () => ({
  default: () => <div data-testid="calendar-view">CalendarView</div>,
}))

vi.mock('../../components/reservation/ReservationCard', () => ({
  default: () => <div data-testid="reservation-card">ReservationCard</div>,
}))

describe('Reservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Reservations />
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })

  it('renders main container', () => {
    const { container } = render(
      <MemoryRouter>
        <Reservations />
      </MemoryRouter>
    )
    expect(container.querySelector('.reservations-page')).toBeTruthy()
  })
})
