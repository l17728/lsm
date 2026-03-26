import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../Login'

vi.mock('../../services/api', () => ({
  authApi: { login: vi.fn() },
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ login: vi.fn(), isAuthenticated: false })),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

vi.mock('../../services/websocket', () => ({
  wsService: { connect: vi.fn(), disconnect: vi.fn() },
}))

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })

  it('shows username and password fields', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
  })
})
