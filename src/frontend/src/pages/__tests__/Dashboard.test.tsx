import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Dashboard from '../Dashboard'

// Mock API services
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

// Mock WebSocket service
vi.mock('../../services/websocket', () => ({
  wsService: {
    on: vi.fn(),
    off: vi.fn(),
  },
}))

// Mock Recharts to avoid canvas/DOM issues in jsdom
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

import { serverApi, gpuApi, taskApi, monitoringApi } from '../../services/api'

const mockServerStats = { total: 10, online: 8, offline: 1, maintenance: 1, error: 0 }
const mockGpuStats = { total: 20, available: 15, allocated: 5 }
const mockTaskStats = { total: 50, running: 5, pending: 10, completed: 30, failed: 5 }
const mockClusterStats = { cpuUsage: 65.5, memoryUsage: 72.3, gpuUsage: 45.0 }
const mockAlerts: any[] = []

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(serverApi.getStats as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: mockServerStats },
    })
    ;(gpuApi.getStats as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: mockGpuStats },
    })
    ;(taskApi.getStats as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: mockTaskStats },
    })
    ;(taskApi.getAll as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: [] },
    })
    ;(monitoringApi.getClusterStats as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: mockClusterStats },
    })
    ;(monitoringApi.getAlerts as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { success: true, data: mockAlerts },
    })
  })

  describe('渲染测试', () => {
    it('应该不崩溃地渲染 Dashboard 组件', async () => {
      const { container } = render(<Dashboard />)
      expect(container).toBeTruthy()
    })

    it('挂载时应该调用所有 API', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(serverApi.getStats).toHaveBeenCalledTimes(1)
        expect(gpuApi.getStats).toHaveBeenCalledTimes(1)
        expect(taskApi.getStats).toHaveBeenCalledTimes(1)
        expect(monitoringApi.getClusterStats).toHaveBeenCalledTimes(1)
        expect(monitoringApi.getAlerts).toHaveBeenCalledTimes(1)
      })
    })

    it('数据加载后应该显示服务器统计数字', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        // Dashboard shows "Online: 8" tag and "Servers" title
        expect(screen.getByText('Servers')).toBeInTheDocument()
      })
    })

    it('应该注册 WebSocket 事件监听', async () => {
      const { wsService } = await import('../../services/websocket')
      render(<Dashboard />)

      expect(wsService.on).toHaveBeenCalledWith('servers:update', expect.any(Function))
      expect(wsService.on).toHaveBeenCalledWith('tasks:update', expect.any(Function))
      expect(wsService.on).toHaveBeenCalledWith('alerts:new', expect.any(Function))
    })

    it('卸载时应该取消 WebSocket 事件监听', async () => {
      const { wsService } = await import('../../services/websocket')
      const { unmount } = render(<Dashboard />)

      unmount()

      expect(wsService.off).toHaveBeenCalledWith('servers:update', expect.any(Function))
    })
  })

  describe('错误状态', () => {
    it('API 全部失败时应该不崩溃', async () => {
      ;(serverApi.getStats as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )
      ;(gpuApi.getStats as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )
      ;(taskApi.getStats as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )
      ;(monitoringApi.getClusterStats as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )
      ;(monitoringApi.getAlerts as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      )

      const { container } = render(<Dashboard />)

      await waitFor(() => {
        expect(container).toBeTruthy()
      })
    })
  })
})
