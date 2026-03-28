import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ReservationForm from '../ReservationForm'

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
    availableServers: [
      { id: 'server-1', name: 'GPU-Server-01', availableGpuCount: 4 },
      { id: 'server-2', name: 'GPU-Server-02', availableGpuCount: 2 },
    ],
    userQuota: {
      maxHoursPerWeek: 40,
      usedHoursThisWeek: 10,
      maxConcurrentReservations: 3,
      currentReservations: 1,
    },
    loading: false,
    fetchAvailableServers: vi.fn().mockResolvedValue(undefined),
    fetchUserQuota: vi.fn().mockResolvedValue(undefined),
    createReservation: vi.fn().mockResolvedValue({ id: 'res-1' }),
    error: null,
    clearError: vi.fn(),
  })),
}))

// Mock auth store
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

  it('contains form elements', async () => {
    const { container } = render(
      <MemoryRouter>
        <ReservationForm />
      </MemoryRouter>
    )
    
    await waitFor(() => {
      const inputs = container.querySelectorAll('input, select, textarea')
      expect(inputs.length).toBeGreaterThan(0)
    })
  })
})