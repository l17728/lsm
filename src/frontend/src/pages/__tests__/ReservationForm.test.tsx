import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ReservationForm from '../ReservationForm'

vi.mock('../../store/reservationStore', () => ({
  useReservationStore: vi.fn(() => ({
    availableServers: [],
    userQuota: null,
    loading: false,
    fetchAvailableServers: vi.fn().mockResolvedValue(undefined),
    fetchUserQuota: vi.fn().mockResolvedValue(undefined),
    createReservation: vi.fn(),
    error: null,
    clearError: vi.fn(),
  })),
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-1', username: 'testuser', role: 'USER' },
    isAuthenticated: true,
  })),
}))

describe('ReservationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <ReservationForm />
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })

  it('renders form elements visible', () => {
    const { container } = render(
      <MemoryRouter>
        <ReservationForm />
      </MemoryRouter>
    )
    expect(container.querySelector('.reservation-form-page')).toBeTruthy()
    // Form is rendered inside a Card with a Title
    expect(container.querySelector('form')).toBeTruthy()
  })
})
