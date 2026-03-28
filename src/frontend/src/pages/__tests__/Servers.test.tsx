import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Servers from '../Servers'

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
}))

// Mock authStore
vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-1', username: 'admin', role: 'ADMIN' },
    token: 'mock-token',
  })),
}))

// Mock Server API
vi.mock('../../services/api', () => ({
  serverApi: {
    getAll: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    getStats: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateStatus: vi.fn(),
    batchDelete: vi.fn(),
    batchUpdateStatus: vi.fn(),
  },
  clusterApi: {
    getAll: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
  },
}))

// Mock WebSocket service
vi.mock('../../services/websocket', () => ({
  wsService: {
    on: vi.fn(),
    off: vi.fn(),
  },
}))

// Mock child components
vi.mock('../../components/ExportButton', () => ({
  default: () => <button>Export</button>,
  ExportButton: () => <button>Export</button>,
}))

vi.mock('../../components/BatchProgressBar', () => ({
  default: () => <div data-testid="batch-progress">Batch Progress</div>,
}))

vi.mock('../../components/ConfirmDialog', () => ({
  default: ({ visible, onConfirm, onCancel }: any) =>
    visible ? (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}))

vi.mock('../../components/ErrorDetails', () => ({
  default: () => <div data-testid="error-details">Error Details</div>,
}))

import { serverApi } from '../../services/api'

// Helper to render with Router
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  )
}

describe('Servers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering Tests', () => {
    it('should render server page without crashing', () => {
      const { container } = renderWithRouter(<Servers />)
      expect(container).toBeTruthy()
    })

    it('should call API on mount', async () => {
      renderWithRouter(<Servers />)
      
      await waitFor(() => {
        expect(serverApi.getAll).toHaveBeenCalled()
      }, { timeout: 10000 })
    })
  })

  describe('Error States', () => {
    it('should not crash when API fails', async () => {
      ;(serverApi.getAll as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )

      const { container } = renderWithRouter(<Servers />)
      expect(container).toBeTruthy()
    })
  })
})