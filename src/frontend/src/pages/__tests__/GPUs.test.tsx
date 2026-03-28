import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GPUs from '../GPUs'

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
}))

// Mock GPU API
vi.mock('../../services/api', () => ({
  gpuApi: {
    getStats: vi.fn().mockResolvedValue({ data: { success: true, data: { total: 10, available: 6, allocated: 4 } } }),
    getMyAllocations: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    allocate: vi.fn(),
    release: vi.fn(),
  },
}))

// Mock WebSocket service
vi.mock('../../services/websocket', () => ({
  wsService: {
    on: vi.fn(),
    off: vi.fn(),
  },
}))

// Mock ExportButton to simplify rendering
vi.mock('../../components/ExportButton', () => ({
  ExportButton: () => <button>Export</button>,
}))

import { gpuApi } from '../../services/api'

describe('GPUs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering Tests', () => {
    it('should render GPU page without crashing', () => {
      const { container } = render(<GPUs />)
      expect(container).toBeTruthy()
    })

    it('should call API on mount', async () => {
      render(<GPUs />)
      
      await waitFor(() => {
        expect(gpuApi.getStats).toHaveBeenCalled()
        expect(gpuApi.getMyAllocations).toHaveBeenCalled()
      }, { timeout: 10000 })
    })
  })

  describe('Interaction Tests', () => {
    it('should render buttons', async () => {
      render(<GPUs />)

      await waitFor(() => {
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Error States', () => {
    it('should not crash when API fails', async () => {
      ;(gpuApi.getStats as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )
      ;(gpuApi.getMyAllocations as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )

      const { container } = render(<GPUs />)

      await waitFor(() => {
        expect(container).toBeTruthy()
      })
    })
  })
})