import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Settings from '../Settings'

// Mock Ant Design TimePicker which requires dayjs.isValid
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd')
  return {
    ...actual,
    TimePicker: () => null,
  }
})

// Settings uses fetch directly — provide a minimal mock
const mockFetch = vi.fn().mockResolvedValue({
  json: vi.fn().mockResolvedValue({ success: false }),
})

vi.stubGlobal('fetch', mockFetch)

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue({ success: false }),
    })
  })

  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })

  it('renders settings form', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.getByText('系统设置')).toBeInTheDocument()
  })
})
