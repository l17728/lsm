import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocsPage from '../DocsPage'

vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        documents: [
          { id: 'user-manual', title: 'User Manual', filename: 'user-manual.md' },
        ],
        content: '# User Manual\n\nWelcome.',
      },
    }),
  },
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: any) => <div data-testid="markdown-content">{children}</div>,
}))

vi.mock('remark-gfm', () => ({
  default: vi.fn(),
}))

describe('DocsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<DocsPage />)
    expect(container).toBeTruthy()
  })

  it('renders documentation area', async () => {
    const { container } = render(<DocsPage />)
    // The page renders a Card with a title — confirm the container has content
    expect(container.firstChild).toBeTruthy()
    // The loading spinner or the docs card should be present
    const spinner = container.querySelector('.ant-spin')
    const card = container.querySelector('.ant-card')
    expect(spinner || card).toBeTruthy()
  })
})
