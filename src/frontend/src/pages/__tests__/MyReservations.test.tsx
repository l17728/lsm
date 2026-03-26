import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MyReservations from '../MyReservations'

vi.mock('../../store/reservationStore', () => ({
  useReservationStore: vi.fn(() => ({
    reservations: [],
    loading: false,
    pagination: { page: 1, limit: 10, total: 0 },
    fetchMyReservations: vi.fn().mockResolvedValue(undefined),
    cancelReservation: vi.fn(),
    releaseReservation: vi.fn(),
  })),
}))

vi.mock('../../components/reservation/ReservationCard', () => ({
  default: () => <div data-testid="reservation-card">ReservationCard</div>,
}))

describe('MyReservations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <MyReservations />
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })
})
