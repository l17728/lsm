import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MyReservations from '../MyReservations'

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
}))

// Mock reservation store
vi.mock('../../store/reservationStore', () => ({
  useReservationStore: vi.fn(() => ({
    reservations: [],
    loading: false,
    pagination: { page: 1, limit: 10, total: 0 },
    fetchMyReservations: vi.fn().mockResolvedValue(undefined),
    cancelReservation: vi.fn().mockResolvedValue(undefined),
    releaseReservation: vi.fn().mockResolvedValue(undefined),
  })),
}))

// Mock ReservationCard component
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

  it('contains buttons for navigation', async () => {
    const { container } = render(
      <MemoryRouter>
        <MyReservations />
      </MemoryRouter>
    )
    
    await waitFor(() => {
      const buttons = container.querySelectorAll('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })
})