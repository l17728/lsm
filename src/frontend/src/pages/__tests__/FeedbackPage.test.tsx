import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import FeedbackPage from '../FeedbackPage'

// FeedbackPage uses only inline mock data — no external API calls to mock.

describe('FeedbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', { timeout: 15000 }, () => {
    const { container } = render(<FeedbackPage />)
    expect(container).toBeTruthy()
  })

  it('renders feedback content', async () => {
    render(<FeedbackPage />)
    await waitFor(() => {
      expect(screen.getByText('Feedback Management')).toBeInTheDocument()
    }, { timeout: 15000 })
  })
})
