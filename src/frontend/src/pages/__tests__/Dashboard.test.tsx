/**
 * Dashboard Page Tests
 *
 * Covers:
 * - Rendering (initial loading spinner, data display after fetch)
 * - Promise.allSettled behaviour: partial failures leave other modules intact
 * - error message display (module-specific)
 * - loading state cleared after all promises settle (including failures)
 * - WebSocket subscription lifecycle
 *
 * REGRESSION tests:
 *   - When ONE api fails the other stats still render (allSettled, not all)
 *   - Alerts failure silently defaults to [] without error message
 *   - loading is set to false even when all requests fail
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

// ─── Hoist mocks so they are accessible before vi.mock() factories ────────────
const mockMessageError = vi.hoisted(() => vi.fn())

// ─── Mock API services ────────────────────────────────────────────────────────
vi.mock('../../services/api', () => ({
  serverApi: {
    getStats: vi.fn(),
  },
  gpuApi: {
    getStats: vi.fn(),
  },
  taskApi: {
    getStats: vi.fn(),
    getAll: vi.fn(),
  },
  monitoringApi: {
    getClusterStats: vi.fn(),
    getAlerts: vi.fn(),
  },
  clusterApi: {
    getStats: vi.fn(),
  },
}))

// ─── Mock WebSocket service ───────────────────────────────────────────────────
vi.mock('../../services/websocket', () => ({
  wsService: {
    on: vi.fn(),
    off: vi.fn(),
  },
}))

// ─── Mock Recharts to avoid canvas/DOM issues in jsdom ───────────────────────
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Legend: () => null,
}))

// ─── Mock antd message to capture error calls ─────────────────────────────────
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  return {
    ...actual,
    message: {
      ...actual.message,
      error: mockMessageError,
      success: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  }
})

import Dashboard from '../Dashboard'

// ─── Import mocked modules ────────────────────────────────────────────────────
import { serverApi, gpuApi, taskApi, monitoringApi, clusterApi } from '../../services/api'
import { wsService } from '../../services/websocket'

// ─── Test data ────────────────────────────────────────────────────────────────
const mockServerStats = { total: 10, online: 8, offline: 1, maintenance: 1, error: 0 }
const mockGpuStats = { total: 20, available: 15, allocated: 5 }
const mockTaskStats = { total: 50, running: 5, pending: 10, completed: 30, failed: 5 }
const mockClusterStats = {
  usage: { avgCpuUsage: 65.5, avgMemoryUsage: 72.3, avgGpuUsage: 45.0 },
}
const mockClusterSummary = {
  total: 5,
  byStatus: { available: 2, allocated: 2, reserved: 1, maintenance: 0 },
  resources: { totalServers: 20, totalGpus: 80, totalCpuCores: 320, totalMemory: 1280 },
}
const mockAlerts: any[] = []

// Helper: set up all mocks to resolve successfully
function mockAllSuccess() {
  vi.mocked(serverApi.getStats).mockResolvedValue({
    data: { success: true, data: mockServerStats },
  } as any)
  vi.mocked(gpuApi.getStats).mockResolvedValue({
    data: { success: true, data: mockGpuStats },
  } as any)
  vi.mocked(taskApi.getStats).mockResolvedValue({
    data: { success: true, data: mockTaskStats },
  } as any)
  vi.mocked(monitoringApi.getClusterStats).mockResolvedValue({
    data: { success: true, data: mockClusterStats },
  } as any)
  vi.mocked(clusterApi.getStats).mockResolvedValue({
    data: { success: true, data: mockClusterSummary },
  } as any)
  vi.mocked(monitoringApi.getAlerts).mockResolvedValue({
    data: { success: true, data: mockAlerts },
  } as any)
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllSuccess()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── Rendering ──────────────────────────────────────────────────────────────
  describe('Rendering Tests', () => {
    it('should show loading spinner on initial mount', () => {
      // Delay resolution so spinner is visible
      vi.mocked(serverApi.getStats).mockReturnValue(new Promise(() => {}))

      const { container } = render(<Dashboard />)

      // Spin renders an element with ant-spin class
      expect(container.querySelector('.ant-spin')).toBeTruthy()
    })

      it('should hide spinner after data is loaded', async () => {
        const { container } = render(<Dashboard />)

        await waitFor(() => {
          expect(container.querySelector('.ant-spin-spinning')).toBeNull()
        })
      })

      it('should render Dashboard component without crashing', async () => {
        const { container } = render(<Dashboard />)
        await waitFor(() => expect(container).toBeTruthy())
      })

      it('should display page title "Dashboard"', async () => {
        render(<Dashboard />)

        await waitFor(() => {
          expect(screen.getByText('Dashboard')).toBeInTheDocument()
        })
      })

      it('should display Servers stats card', async () => {
        render(<Dashboard />)

        await waitFor(() => {
          expect(screen.getByText('Servers')).toBeInTheDocument()
        })
      })

      it('should display GPUs stats card', async () => {
        render(<Dashboard />)

        await waitFor(() => {
          expect(screen.getByText('GPUs')).toBeInTheDocument()
        })
      })

      it('should display Tasks stats card', async () => {
        render(<Dashboard />)

        await waitFor(() => {
          expect(screen.getByText('Tasks')).toBeInTheDocument()
        })
      })

      it('should display Clusters stats card', async () => {
        render(<Dashboard />)

        await waitFor(() => {
          expect(screen.getByText('Clusters')).toBeInTheDocument()
        })
      })
    })

  // ─── API calls ──────────────────────────────────────────────────────────────
  describe('API Calls', () => {
    it('should call all 6 APIs on mount', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(serverApi.getStats).toHaveBeenCalledTimes(1)
        expect(gpuApi.getStats).toHaveBeenCalledTimes(1)
        expect(taskApi.getStats).toHaveBeenCalledTimes(1)
        expect(monitoringApi.getClusterStats).toHaveBeenCalledTimes(1)
        expect(monitoringApi.getAlerts).toHaveBeenCalledTimes(1)
        expect(clusterApi.getStats).toHaveBeenCalledTimes(1)
      })
    })

    it('should call APIs only on mount, not on each re-render', async () => {
      const { rerender } = render(<Dashboard />)

      await waitFor(() => {
        expect(serverApi.getStats).toHaveBeenCalledTimes(1)
      })

      rerender(<Dashboard />)

      // Still called only once (useEffect has [] deps)
      expect(serverApi.getStats).toHaveBeenCalledTimes(1)
    })
  })

  // ─── REGRESSION: Promise.allSettled behaviour ────────────────────────────────
  describe('REGRESSION: Promise.allSettled — Single API Failure Does Not Affect Other Modules', () => {
    it('GPU data should still display normally when serverApi fails', async () => {
      vi.mocked(serverApi.getStats).mockRejectedValue(new Error('server down'))

      render(<Dashboard />)

      await waitFor(() => {
        // GPU card still renders with available count
        expect(screen.getByText('GPUs')).toBeInTheDocument()
      })
    })

    it('Server data should still display normally when gpuApi fails', async () => {
      vi.mocked(gpuApi.getStats).mockRejectedValue(new Error('gpu down'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Servers')).toBeInTheDocument()
      })
    })

    it('Servers and GPUs data should still display normally when taskApi fails', async () => {
      vi.mocked(taskApi.getStats).mockRejectedValue(new Error('task down'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Servers')).toBeInTheDocument()
        expect(screen.getByText('GPUs')).toBeInTheDocument()
      })
    })

    it('The other three modules should display normally when monitoringApi.getClusterStats fails', async () => {
      vi.mocked(monitoringApi.getClusterStats).mockRejectedValue(new Error('cluster down'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Servers')).toBeInTheDocument()
        expect(screen.getByText('GPUs')).toBeInTheDocument()
        expect(screen.getByText('Tasks')).toBeInTheDocument()
      })
    })

    it('Component should not crash when all APIs fail', async () => {
      vi.mocked(serverApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(gpuApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(taskApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getClusterStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getAlerts).mockRejectedValue(new Error('err'))
      vi.mocked(clusterApi.getStats).mockRejectedValue(new Error('err'))

      const { container } = render(<Dashboard />)

      await waitFor(() => {
        // Component should still render (no crash)
        expect(container.querySelector('h1')).toBeTruthy()
      })
    })

    it('Loading should be set to false after all APIs fail (not permanently spinning)', async () => {
      vi.mocked(serverApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(gpuApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(taskApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getClusterStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getAlerts).mockRejectedValue(new Error('err'))
      vi.mocked(clusterApi.getStats).mockRejectedValue(new Error('err'))

      const { container } = render(<Dashboard />)

      await waitFor(() => {
        // Spinner must have stopped – no actively spinning element
        expect(container.querySelector('.ant-spin-spinning')).toBeNull()
      })
    })
  })

  // ─── Error message display ───────────────────────────────────────────────────
  describe('Error Message Display (message.error)', () => {
    it('should call message.error when serverApi fails to load server stats', async () => {
      vi.mocked(serverApi.getStats).mockRejectedValue(new Error('server fail'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(mockMessageError).toHaveBeenCalledWith(
          expect.stringContaining('Server statistics')
        )
      })
    })

    it('should call message.error when gpuApi fails to load GPU stats', async () => {
      vi.mocked(gpuApi.getStats).mockRejectedValue(new Error('gpu fail'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(mockMessageError).toHaveBeenCalledWith(
          expect.stringContaining('GPU statistics')
        )
      })
    })

    it('should call message.error when taskApi fails to load task stats', async () => {
      vi.mocked(taskApi.getStats).mockRejectedValue(new Error('task fail'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(mockMessageError).toHaveBeenCalledWith(
          expect.stringContaining('Task statistics')
        )
      })
    })

    it('should call message.error when clusterStats fails to load cluster stats', async () => {
      vi.mocked(monitoringApi.getClusterStats).mockRejectedValue(new Error('cluster fail'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(mockMessageError).toHaveBeenCalledWith(
          expect.stringContaining('Cluster statistics')
        )
      })
    })

    it('REGRESSION: alerts failure should not call message.error (alerts are non-critical data)', async () => {
      vi.mocked(monitoringApi.getAlerts).mockRejectedValue(new Error('alerts fail'))

      render(<Dashboard />)

      // Wait for all API calls to settle
      await waitFor(() => {
        expect(monitoringApi.getAlerts).toHaveBeenCalled()
      })

      // Small delay to let the promises settle
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50))
      })

      // message.error should NOT have been called for alerts
      const errorCalls: string[] = mockMessageError.mock.calls.map((c) => c[0] as string)
      const alertErrorCalled = errorCalls.some((msg) =>
        msg.toLowerCase().includes('alert') || msg.includes('alarm')
      )
      expect(alertErrorCalled).toBe(false)
    })

    it('should call 4 message.error when all APIs fail (except alerts and clusterSummary)', async () => {
      vi.mocked(serverApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(gpuApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(taskApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getClusterStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getAlerts).mockRejectedValue(new Error('err'))
      vi.mocked(clusterApi.getStats).mockRejectedValue(new Error('err'))

      render(<Dashboard />)

      await waitFor(() => {
        // 4 modules show error: server, gpu, task, monitoring cluster stats
        // (alerts and clusterSummary silently ignore errors)
        expect(mockMessageError).toHaveBeenCalledTimes(4)
      })
    })

    it('should not call message.error when all APIs succeed', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Servers')).toBeInTheDocument()
      })

      expect(mockMessageError).not.toHaveBeenCalled()
    })
  })

  // ─── Alerts display ────────────────────────────────────────────────────────────
  describe('Alerts Section', () => {
    it('should not render System Alerts section when alerts is empty', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.queryByText('System Alerts')).toBeNull()
      })
    })

    it('should default to empty array when alerts fails (no alerts section rendered)', async () => {
      vi.mocked(monitoringApi.getAlerts).mockRejectedValue(new Error('alerts fail'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.queryByText('System Alerts')).toBeNull()
      })
    })

    it('should render System Alerts section when there are alerts', async () => {
      const alerts = [
        { type: 'critical', serverName: 'srv-1', message: 'CPU high', value: 95.0 },
      ]
      vi.mocked(monitoringApi.getAlerts).mockResolvedValue({
        data: { success: true, data: alerts },
      } as any)

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('System Alerts')).toBeInTheDocument()
      })
    })
  })

  // ─── WebSocket lifecycle ──────────────────────────────────────────────────────
  describe('WebSocket Subscription', () => {
    it('should register servers:update event listener', () => {
      render(<Dashboard />)

      expect(wsService.on).toHaveBeenCalledWith('servers:update', expect.any(Function))
    })

    it('should register tasks:update event listener', () => {
      render(<Dashboard />)

      expect(wsService.on).toHaveBeenCalledWith('tasks:update', expect.any(Function))
    })

    it('should register alerts:new event listener', () => {
      render(<Dashboard />)

      expect(wsService.on).toHaveBeenCalledWith('alerts:new', expect.any(Function))
    })

    it('should cancel all WebSocket event listeners on unmount', () => {
      const { unmount } = render(<Dashboard />)

      unmount()

      expect(wsService.off).toHaveBeenCalledWith('servers:update', expect.any(Function))
      expect(wsService.off).toHaveBeenCalledWith('tasks:update', expect.any(Function))
      expect(wsService.off).toHaveBeenCalledWith('alerts:new', expect.any(Function))
    })

    it('unsubscribe should pass the same handler function reference as subscribe', () => {
      const { unmount } = render(<Dashboard />)

      const onCalls = vi.mocked(wsService.on).mock.calls
      const offCalls: Array<[string, Function]> = []

      unmount()

      vi.mocked(wsService.off).mock.calls.forEach((c) => {
        offCalls.push(c as [string, Function])
      })

      // For each subscribed event, the same handler function should be passed to off()
      for (const [event, handler] of onCalls) {
        const matchingOff = offCalls.find(([e, h]) => e === event && h === handler)
        expect(matchingOff).toBeDefined()
      }
    })
  })

  // ─── Chart rendering ──────────────────────────────────────────────────────────
  describe('Chart Rendering', () => {
    it('should render line chart (Resource Usage 24h)', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      })
    })

    it('should render bar chart (Task Status Distribution)', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
      })
    })
  })
})
