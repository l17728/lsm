import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RequirementsPage from '../RequirementsPage'

// RequirementsPage uses inline mock data with no external API calls or stores

describe('RequirementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <RequirementsPage />
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })

  it('renders requirements content', () => {
    render(
      <MemoryRouter>
        <RequirementsPage />
      </MemoryRouter>
    )
    expect(screen.getByText('需求管理')).toBeInTheDocument()
  })
})
