import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import FeedbackPage from '../FeedbackPage'

// FeedbackPage uses only inline mock data — no external API calls to mock.

describe('FeedbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<FeedbackPage />)
    expect(container).toBeTruthy()
  })

  it('renders feedback content', async () => {
    render(<FeedbackPage />)
    await waitFor(() => {
      expect(screen.getByText('问题反馈管理')).toBeInTheDocument()
    })
  })
})
