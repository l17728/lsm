import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Monitoring from '../Monitoring'

vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Line: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../../services/api', () => ({
  monitoringApi: {
    getHealth: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getAlerts: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getClusterStats: vi.fn().mockResolvedValue({
      data: {
        data: {
          servers: { online: 5, total: 8 },
          usage: { avgCpuUsage: 55, avgMemoryUsage: 60, avgGpuUsage: 40 },
        },
      },
    }),
  },
  serverApi: {},
}))

vi.mock('../../services/websocket', () => ({
  wsService: { on: vi.fn(), off: vi.fn() },
}))

describe('Monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<Monitoring />)
    expect(container).toBeTruthy()
  })

  it('renders monitoring elements', async () => {
    render(<Monitoring />)
    await waitFor(() => {
      expect(screen.getByText('Monitoring')).toBeInTheDocument()
    })
  })
})
