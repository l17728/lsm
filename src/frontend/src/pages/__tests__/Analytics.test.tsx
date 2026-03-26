import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AnalyticsDashboard from '../Analytics'

vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  ComposedChart: ({ children }: any) => <div data-testid="composed-chart">{children}</div>,
  Line: () => null,
  Bar: () => null,
  Pie: () => null,
  Area: () => null,
  Scatter: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../../services/api', () => ({
  analyticsApi: {
    getSummary: vi.fn().mockResolvedValue({ data: { data: { totalCost: 100, costTrend: -5, avgUtilization: 75, utilizationTrend: 10, peakResource: { type: 'GPU', value: 95, time: '18:30' }, efficiency: 80, savings: 200 } } }),
    getResourceTrends: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getCostBreakdown: vi.fn().mockResolvedValue({ data: { data: [] } }),
    getServerUtilization: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
  monitoringApi: {
    getClusterStats: vi.fn().mockResolvedValue({ data: { data: { servers: { online: 5, total: 8 }, usage: { avgCpuUsage: 60 } } } }),
    getAlerts: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
  serverApi: {},
  gpuApi: {},
  taskApi: {},
}))

vi.mock('../../services/websocket', () => ({
  wsService: { on: vi.fn(), off: vi.fn() },
}))

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<AnalyticsDashboard />)
    expect(container).toBeTruthy()
  })

  it('renders main heading or container', async () => {
    render(<AnalyticsDashboard />)
    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
    })
  })
})
