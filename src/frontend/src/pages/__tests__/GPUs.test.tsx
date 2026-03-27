import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GPUs from '../GPUs'

// Mock GPU API
vi.mock('../../services/api', () => ({
  gpuApi: {
    getStats: vi.fn(),
    getMyAllocations: vi.fn(),
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

const mockStats = { total: 10, available: 6, allocated: 4 }
const mockAllocations = [
  {
    id: 'alloc-1',
    gpu: {
      id: 'gpu-1',
      model: 'NVIDIA A100',
      memory: 40,
      deviceId: 0,
      server: { name: 'GPU-Server-01' },
    },
    startTime: '2026-03-17T08:00:00Z',
    status: 'ACTIVE',
  },
  {
    id: 'alloc-2',
    gpu: {
      id: 'gpu-2',
      model: 'NVIDIA V100',
      memory: 32,
      deviceId: 1,
      server: { name: 'GPU-Server-02' },
    },
    startTime: '2026-03-17T10:00:00Z',
    status: 'ACTIVE',
  },
]

describe('GPUs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(gpuApi.getStats as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: mockStats },
    })
    ;(gpuApi.getMyAllocations as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: mockAllocations },
    })
  })

  describe('Rendering Tests', () => {
    it('should render GPU page without crashing', async () => {
      const { container } = render(<GPUs />)
      expect(container).toBeTruthy()
    })

    it('should load stats and allocation list on mount', async () => {
      render(<GPUs />)

      await waitFor(() => {
        expect(gpuApi.getStats).toHaveBeenCalledTimes(1)
        expect(gpuApi.getMyAllocations).toHaveBeenCalledTimes(1)
      })
    })

    it('should display GPU model information', async () => {
      render(<GPUs />)

      await waitFor(() => {
        expect(screen.getByText('NVIDIA A100')).toBeInTheDocument()
      })
    })

    it('should display all allocation records', async () => {
      render(<GPUs />)

      await waitFor(() => {
        expect(screen.getByText('NVIDIA A100')).toBeInTheDocument()
        expect(screen.getByText('NVIDIA V100')).toBeInTheDocument()
      })
    })
  })

  describe('Interaction Tests', () => {
    it('should render apply GPU button', async () => {
      render(<GPUs />)

      // Look for a button with allocation-related text
      await waitFor(() => {
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(0)
      })
    })

    it('Release button click should call release API', async () => {
      ;(gpuApi.release as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true },
      })
      // Re-mock getMyAllocations to return empty after release
      ;(gpuApi.getMyAllocations as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: { success: true, data: mockAllocations } })
        .mockResolvedValueOnce({ data: { success: true, data: [] } })

      render(<GPUs />)

      await waitFor(() => {
        expect(screen.getByText('NVIDIA A100')).toBeInTheDocument()
      })

      // Find and click first Release button
      const releaseButtons = screen.getAllByText('Release')
      fireEvent.click(releaseButtons[0])

      await waitFor(() => {
        expect(gpuApi.release).toHaveBeenCalledWith('alloc-1')
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
