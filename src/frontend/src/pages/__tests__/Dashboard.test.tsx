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
import { serverApi, gpuApi, taskApi, monitoringApi } from '../../services/api'
import { wsService } from '../../services/websocket'

// ─── Test data ────────────────────────────────────────────────────────────────
const mockServerStats = { total: 10, online: 8, offline: 1, maintenance: 1, error: 0 }
const mockGpuStats = { total: 20, available: 15, allocated: 5 }
const mockTaskStats = { total: 50, running: 5, pending: 10, completed: 30, failed: 5 }
const mockClusterStats = {
  usage: { avgCpuUsage: 65.5, avgMemoryUsage: 72.3, avgGpuUsage: 45.0 },
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
  describe('渲染测试', () => {
    it('挂载时应显示加载中 spinner', () => {
      // Delay resolution so spinner is visible
      vi.mocked(serverApi.getStats).mockReturnValue(new Promise(() => {}))

      const { container } = render(<Dashboard />)

      // Spin renders an element with ant-spin class
      expect(container.querySelector('.ant-spin')).toBeTruthy()
    })

    it('数据加载完成后应隐藏 spinner', async () => {
      const { container } = render(<Dashboard />)

      await waitFor(() => {
        expect(container.querySelector('.ant-spin-spinning')).toBeNull()
      })
    })

    it('应该不崩溃地渲染 Dashboard 组件', async () => {
      const { container } = render(<Dashboard />)
      await waitFor(() => expect(container).toBeTruthy())
    })

    it('应该显示页面标题 "Dashboard"', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
      })
    })

    it('应该显示 Servers 统计卡片', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Servers')).toBeInTheDocument()
      })
    })

    it('应该显示 GPUs 统计卡片', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('GPUs')).toBeInTheDocument()
      })
    })

    it('应该显示 Tasks 统计卡片', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Tasks')).toBeInTheDocument()
      })
    })
  })

  // ─── API calls ──────────────────────────────────────────────────────────────
  describe('API 调用', () => {
    it('挂载时应该调用所有 5 个 API', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(serverApi.getStats).toHaveBeenCalledTimes(1)
        expect(gpuApi.getStats).toHaveBeenCalledTimes(1)
        expect(taskApi.getStats).toHaveBeenCalledTimes(1)
        expect(monitoringApi.getClusterStats).toHaveBeenCalledTimes(1)
        expect(monitoringApi.getAlerts).toHaveBeenCalledTimes(1)
      })
    })

    it('应该只在挂载时调用 API，而不是每次重渲染', async () => {
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
  describe('REGRESSION: Promise.allSettled — 单个 API 失败不影响其他模块', () => {
    it('serverApi 失败时，GPU 数据应仍然正常显示', async () => {
      vi.mocked(serverApi.getStats).mockRejectedValue(new Error('server down'))

      render(<Dashboard />)

      await waitFor(() => {
        // GPU card still renders with available count
        expect(screen.getByText('GPUs')).toBeInTheDocument()
      })
    })

    it('gpuApi 失败时，Servers 数据应仍然正常显示', async () => {
      vi.mocked(gpuApi.getStats).mockRejectedValue(new Error('gpu down'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Servers')).toBeInTheDocument()
      })
    })

    it('taskApi 失败时，Servers 和 GPUs 数据应仍然正常显示', async () => {
      vi.mocked(taskApi.getStats).mockRejectedValue(new Error('task down'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Servers')).toBeInTheDocument()
        expect(screen.getByText('GPUs')).toBeInTheDocument()
      })
    })

    it('monitoringApi.getClusterStats 失败时，其余三块数据应正常显示', async () => {
      vi.mocked(monitoringApi.getClusterStats).mockRejectedValue(new Error('cluster down'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Servers')).toBeInTheDocument()
        expect(screen.getByText('GPUs')).toBeInTheDocument()
        expect(screen.getByText('Tasks')).toBeInTheDocument()
      })
    })

    it('全部 API 失败时组件不应崩溃', async () => {
      vi.mocked(serverApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(gpuApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(taskApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getClusterStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getAlerts).mockRejectedValue(new Error('err'))

      const { container } = render(<Dashboard />)

      await waitFor(() => {
        // Component should still render (no crash)
        expect(container.querySelector('h1')).toBeTruthy()
      })
    })

    it('全部 API 失败后 loading 应被设为 false（不永久 spinning）', async () => {
      vi.mocked(serverApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(gpuApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(taskApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getClusterStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getAlerts).mockRejectedValue(new Error('err'))

      const { container } = render(<Dashboard />)

      await waitFor(() => {
        // Spinner must have stopped – no actively spinning element
        expect(container.querySelector('.ant-spin-spinning')).toBeNull()
      })
    })
  })

  // ─── Error message display ───────────────────────────────────────────────────
  describe('错误提示（message.error）', () => {
    it('serverApi 失败时应调用 message.error 提示服务器统计加载失败', async () => {
      vi.mocked(serverApi.getStats).mockRejectedValue(new Error('server fail'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(mockMessageError).toHaveBeenCalledWith(
          expect.stringContaining('服务器')
        )
      })
    })

    it('gpuApi 失败时应调用 message.error 提示 GPU 统计加载失败', async () => {
      vi.mocked(gpuApi.getStats).mockRejectedValue(new Error('gpu fail'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(mockMessageError).toHaveBeenCalledWith(
          expect.stringContaining('GPU')
        )
      })
    })

    it('taskApi 失败时应调用 message.error 提示任务统计加载失败', async () => {
      vi.mocked(taskApi.getStats).mockRejectedValue(new Error('task fail'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(mockMessageError).toHaveBeenCalledWith(
          expect.stringContaining('任务')
        )
      })
    })

    it('clusterStats 失败时应调用 message.error 提示集群统计加载失败', async () => {
      vi.mocked(monitoringApi.getClusterStats).mockRejectedValue(new Error('cluster fail'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(mockMessageError).toHaveBeenCalledWith(
          expect.stringContaining('集群')
        )
      })
    })

    it('REGRESSION: alerts 失败时不应调用 message.error（alerts 是非关键数据）', async () => {
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
      const errorCalls: string[] = mockMessageError.mock.calls.map((c: [string]) => c[0])
      const alertErrorCalled = errorCalls.some((msg) =>
        msg.toLowerCase().includes('alert') || msg.includes('告警')
      )
      expect(alertErrorCalled).toBe(false)
    })

    it('全部 API 失败时应调用 4 条 message.error（alerts 除外）', async () => {
      vi.mocked(serverApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(gpuApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(taskApi.getStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getClusterStats).mockRejectedValue(new Error('err'))
      vi.mocked(monitoringApi.getAlerts).mockRejectedValue(new Error('err'))

      render(<Dashboard />)

      await waitFor(() => {
        // 4 modules show error: server, gpu, task, cluster (alerts silently ignores)
        expect(mockMessageError).toHaveBeenCalledTimes(4)
      })
    })

    it('所有 API 成功时不应调用 message.error', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('Servers')).toBeInTheDocument()
      })

      expect(mockMessageError).not.toHaveBeenCalled()
    })
  })

  // ─── Alerts 显示 ────────────────────────────────────────────────────────────
  describe('Alerts 区域', () => {
    it('alerts 为空时不应渲染 System Alerts 区域', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.queryByText('System Alerts')).toBeNull()
      })
    })

    it('alerts 失败时应默认为空数组（不渲染告警区域）', async () => {
      vi.mocked(monitoringApi.getAlerts).mockRejectedValue(new Error('alerts fail'))

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.queryByText('System Alerts')).toBeNull()
      })
    })

    it('有告警时应渲染 System Alerts 区域', async () => {
      const alerts = [
        { type: 'critical', serverName: 'srv-1', message: 'CPU高', value: 95.0 },
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

  // ─── WebSocket 生命周期 ──────────────────────────────────────────────────────
  describe('WebSocket 订阅', () => {
    it('应该注册 servers:update 事件监听', () => {
      render(<Dashboard />)

      expect(wsService.on).toHaveBeenCalledWith('servers:update', expect.any(Function))
    })

    it('应该注册 tasks:update 事件监听', () => {
      render(<Dashboard />)

      expect(wsService.on).toHaveBeenCalledWith('tasks:update', expect.any(Function))
    })

    it('应该注册 alerts:new 事件监听', () => {
      render(<Dashboard />)

      expect(wsService.on).toHaveBeenCalledWith('alerts:new', expect.any(Function))
    })

    it('卸载时应取消所有 WebSocket 事件监听', () => {
      const { unmount } = render(<Dashboard />)

      unmount()

      expect(wsService.off).toHaveBeenCalledWith('servers:update', expect.any(Function))
      expect(wsService.off).toHaveBeenCalledWith('tasks:update', expect.any(Function))
      expect(wsService.off).toHaveBeenCalledWith('alerts:new', expect.any(Function))
    })

    it('unsubscribe 时应该传入与 subscribe 相同的函数引用', () => {
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

  // ─── 图表渲染 ────────────────────────────────────────────────────────────────
  describe('图表渲染', () => {
    it('应该渲染折线图（Resource Usage 24h）', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument()
      })
    })

    it('应该渲染柱状图（Task Status Distribution）', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
      })
    })
  })
})
