import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Users from '../Users'

vi.mock('../../services/api', () => ({
  authApi: {
    getUsers: vi.fn().mockResolvedValue({ data: { data: [] } }),
    updateUserRole: vi.fn(),
    deleteUser: vi.fn(),
  },
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'admin-1', username: 'admin', role: 'ADMIN' },
    isAuthenticated: true,
  })),
}))

vi.mock('../../components/ExportButton', () => ({
  ExportButton: () => <button data-testid="export-button">Export</button>,
}))

describe('Users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Users />
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })

  it('renders users heading or table', () => {
    render(
      <MemoryRouter>
        <Users />
      </MemoryRouter>
    )
    expect(screen.getByText('User Management')).toBeInTheDocument()
  })
})
