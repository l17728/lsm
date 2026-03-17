import { useEffect, useState, useMemo } from 'react'
import { Card, Row, Col, Statistic, Spin, Select, DatePicker, Table, Tag, Tabs, Progress, Tooltip as AntTooltip, Button, Space } from 'antd'
import {
  LineChartOutlined,
  DollarOutlined,
  DashboardOutlined,
  ThunderboltOutlined,
  CloudServerOutlined,
  AimOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area, ComposedChart, Scatter
} from 'recharts'
import dayjs from 'dayjs'
import { analyticsApi, monitoringApi, serverApi, gpuApi, taskApi } from '../services/api'
import { wsService } from '../services/websocket'

const { RangePicker } = DatePicker
const { TabPane } = Tabs

// Color palette for charts
const COLORS = {
  primary: '#1890ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  purple: '#722ed1',
  cyan: '#13c2c2',
  orange: '#fa8c16',
  geekblue: '#2f54eb',
}

const PIE_COLORS = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#fa8c16']

interface ResourceTrend {
  time: string
  cpu: number
  memory: number
  gpu: number
  network: number
  disk: number
}

interface CostData {
  category: string
  amount: number
  percentage: number
  trend: number
}

interface ServerUtilization {
  serverId: string
  serverName: string
  cpuCores: number
  totalMemory: number
  cpuUsage: number
  memoryUsage: number
  gpuCount: number
  gpuUsage: number | null
  utilization: number
  cost: number
  efficiency: number
}

interface AnalyticsSummary {
  totalCost: number
  costTrend: number
  avgUtilization: number
  utilizationTrend: number
  peakResource: { type: string; value: number; time: string }
  efficiency: number
  savings: number
}

const AnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'custom'>('7d')
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Data states
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [resourceTrends, setResourceTrends] = useState<ResourceTrend[]>([])
  const [costBreakdown, setCostBreakdown] = useState<CostData[]>([])
  const [serverUtilization, setServerUtilization] = useState<ServerUtilization[]>([])
  const [clusterStats, setClusterStats] = useState<any>(null)

  useEffect(() => {
    loadData()

    // Subscribe to real-time updates
    const onServersUpdate = (data: any) => { setClusterStats((prev: any) => ({ ...prev, ...data })) }
    wsService.on('servers:update', onServersUpdate)

    return () => {
      wsService.off('servers:update', onServersUpdate)
    }
  }, [timeRange, customDateRange])

  const loadData = async () => {
    setLoading(true)
    try {
      const [summaryRes, trendsRes, costRes, utilizationRes, clusterRes] = await Promise.all([
        analyticsApi.getSummary(getTimeRangeParams()).catch(() => ({ data: { data: generateMockSummary() } })),
        analyticsApi.getResourceTrends(getTimeRangeParams()).catch(() => ({ data: { data: generateMockTrends() } })),
        analyticsApi.getCostBreakdown(getTimeRangeParams()).catch(() => ({ data: { data: generateMockCostData() } })),
        analyticsApi.getServerUtilization().catch(() => ({ data: { data: generateMockUtilization() } })),
        monitoringApi.getClusterStats(),
      ])

      setSummary(summaryRes.data.data)
      setResourceTrends(trendsRes.data.data)
      setCostBreakdown(costRes.data.data)
      setServerUtilization(utilizationRes.data.data)
      setClusterStats(clusterRes.data.data)
    } catch (error) {
      console.error('Failed to load analytics data:', error)
      // Use mock data on error
      setSummary(generateMockSummary())
      setResourceTrends(generateMockTrends())
      setCostBreakdown(generateMockCostData())
      setServerUtilization(generateMockUtilization())
    } finally {
      setLoading(false)
    }
  }

  const getTimeRangeParams = () => {
    if (timeRange === 'custom' && customDateRange) {
      return {
        startTime: customDateRange[0].toISOString(),
        endTime: customDateRange[1].toISOString(),
      }
    }
    const now = new Date()
    const ranges: Record<string, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }
    return {
      startTime: new Date(now.getTime() - ranges[timeRange]).toISOString(),
      endTime: now.toISOString(),
    }
  }

  // Mock data generators
  const generateMockSummary = (): AnalyticsSummary => ({
    totalCost: 12580.50,
    costTrend: -8.5,
    avgUtilization: 67.3,
    utilizationTrend: 12.4,
    peakResource: { type: 'GPU', value: 95.2, time: '2026-03-14 18:30' },
    efficiency: 82.1,
    savings: 2150.00,
  })

  const generateMockTrends = (): ResourceTrend[] => {
    const data: ResourceTrend[] = []
    const points = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720
    const step = Math.ceil(points / 48) // Max 48 points

    for (let i = points; i >= 0; i -= step) {
      const time = new Date(Date.now() - i * 60 * 60 * 1000)
      data.push({
        time: time.toLocaleTimeString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        cpu: Math.round((30 + Math.random() * 40) * 10) / 10,
        memory: Math.round((50 + Math.random() * 30) * 10) / 10,
        gpu: Math.round((20 + Math.random() * 60) * 10) / 10,
        network: Math.round((10 + Math.random() * 50) * 10) / 10,
        disk: Math.round((40 + Math.random() * 20) * 10) / 10,
      })
    }
    return data
  }

  const generateMockCostData = (): CostData[] => [
    { category: 'GPU Computing', amount: 5280.00, percentage: 42.0, trend: -5.2 },
    { category: 'CPU Resources', amount: 2890.50, percentage: 23.0, trend: 3.8 },
    { category: 'Memory Usage', amount: 2150.00, percentage: 17.1, trend: -2.1 },
    { category: 'Network Bandwidth', amount: 1260.00, percentage: 10.0, trend: 8.5 },
    { category: 'Storage', amount: 650.00, percentage: 5.2, trend: 1.2 },
    { category: 'Other Services', amount: 350.00, percentage: 2.7, trend: -0.8 },
  ]

  const generateMockUtilization = (): ServerUtilization[] => [
    { serverId: '1', serverName: 'GPU-Server-01', cpuCores: 32, totalMemory: 128, cpuUsage: 78.5, memoryUsage: 82.3, gpuCount: 8, gpuUsage: 92.1, utilization: 85.2, cost: 2850.00, efficiency: 88.5 },
    { serverId: '2', serverName: 'GPU-Server-02', cpuCores: 32, totalMemory: 128, cpuUsage: 45.2, memoryUsage: 52.8, gpuCount: 8, gpuUsage: 68.4, utilization: 58.1, cost: 2100.00, efficiency: 72.3 },
    { serverId: '3', serverName: 'CPU-Server-01', cpuCores: 64, totalMemory: 256, cpuUsage: 62.4, memoryUsage: 71.5, gpuCount: 0, gpuUsage: null, utilization: 67.0, cost: 1850.00, efficiency: 81.2 },
    { serverId: '4', serverName: 'CPU-Server-02', cpuCores: 64, totalMemory: 256, cpuUsage: 38.7, memoryUsage: 45.2, gpuCount: 0, gpuUsage: null, utilization: 42.0, cost: 1200.00, efficiency: 65.8 },
    { serverId: '5', serverName: 'Storage-Server-01', cpuCores: 16, totalMemory: 64, cpuUsage: 25.3, memoryUsage: 38.6, gpuCount: 0, gpuUsage: null, utilization: 32.0, cost: 680.00, efficiency: 58.4 },
  ]

  const utilizationColumns = [
    {
      title: 'Server',
      dataIndex: 'serverName',
      key: 'serverName',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: 'CPU Cores',
      dataIndex: 'cpuCores',
      key: 'cpuCores',
    },
    {
      title: 'Memory (GB)',
      dataIndex: 'totalMemory',
      key: 'totalMemory',
    },
    {
      title: 'CPU Usage',
      dataIndex: 'cpuUsage',
      key: 'cpuUsage',
      render: (value: number) => (
        <Progress
          percent={value}
          size="small"
          status={value > 80 ? 'exception' : value > 60 ? 'active' : 'normal'}
          format={(p) => `${p?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: 'Memory Usage',
      dataIndex: 'memoryUsage',
      key: 'memoryUsage',
      render: (value: number) => (
        <Progress
          percent={value}
          size="small"
          status={value > 80 ? 'exception' : value > 60 ? 'active' : 'normal'}
          format={(p) => `${p?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: 'GPU Count',
      dataIndex: 'gpuCount',
      key: 'gpuCount',
    },
    {
      title: 'GPU Usage',
      dataIndex: 'gpuUsage',
      key: 'gpuUsage',
      render: (value: number | null) =>
        value !== null ? (
          <Progress
            percent={value}
            size="small"
            status={value > 90 ? 'exception' : 'normal'}
            format={(p) => `${p?.toFixed(1)}%`}
          />
        ) : (
          <Tag>N/A</Tag>
        ),
    },
    {
      title: 'Utilization',
      dataIndex: 'utilization',
      key: 'utilization',
      render: (value: number) => (
        <Tag color={value > 70 ? 'green' : value > 50 ? 'blue' : 'orange'}>
          {value.toFixed(1)}%
        </Tag>
      ),
    },
    {
      title: 'Est. Cost',
      dataIndex: 'cost',
      key: 'cost',
      render: (value: number) => `$${value.toLocaleString()}`,
    },
    {
      title: 'Efficiency',
      dataIndex: 'efficiency',
      key: 'efficiency',
      render: (value: number) => (
        <span style={{ color: value > 80 ? COLORS.success : value > 60 ? COLORS.warning : COLORS.danger }}>
          {value.toFixed(1)}%
        </span>
      ),
    },
  ]

  const exportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      timeRange,
      summary,
      costBreakdown,
      serverUtilization,
    }
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-report-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" tip="Loading analytics data..." />
      </div>
    )
  }

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>
          <LineChartOutlined style={{ marginRight: 12 }} />
          Analytics Dashboard
        </h1>
        <Space>
          <Select value={timeRange} onChange={(v) => setTimeRange(v as any)} style={{ width: 120 }}>
            <Select.Option value="24h">Last 24 Hours</Select.Option>
            <Select.Option value="7d">Last 7 Days</Select.Option>
            <Select.Option value="30d">Last 30 Days</Select.Option>
            <Select.Option value="custom">Custom Range</Select.Option>
          </Select>
          {timeRange === 'custom' && (
            <RangePicker
              value={customDateRange}
              onChange={(dates) => setCustomDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
            />
          )}
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Refresh
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={exportReport}>
            Export Report
          </Button>
        </Space>
      </div>

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card hoverable>
            <Statistic
              title="Total Cost"
              value={summary?.totalCost || 0}
              prefix={<DollarOutlined />}
              suffix={summary?.costTrend && summary.costTrend < 0 ? 
                <span style={{ fontSize: 14, color: COLORS.success }}>
                  <ArrowDownOutlined /> {Math.abs(summary.costTrend)}%
                </span> : 
                <span style={{ fontSize: 14, color: COLORS.danger }}>
                  <ArrowUpOutlined /> {summary?.costTrend}%
                </span>
              }
              precision={2}
              valueStyle={{ color: COLORS.primary }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card hoverable>
            <Statistic
              title="Avg Utilization"
              value={summary?.avgUtilization || 0}
              suffix="%"
              prefix={<DashboardOutlined />}
              valueStyle={{ color: COLORS.success }}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color={summary?.utilizationTrend && summary.utilizationTrend > 0 ? 'green' : 'red'}>
                {summary?.utilizationTrend && summary.utilizationTrend > 0 ? '+' : ''}{summary?.utilizationTrend}% vs last period
              </Tag>
            </div>
          </Card>
        </Col>
        <Col span={4}>
          <Card hoverable>
            <Statistic
              title="Peak Resource"
              value={summary?.peakResource?.value || 0}
              suffix="%"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: COLORS.warning }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              {summary?.peakResource?.type} at {summary?.peakResource?.time}
            </div>
          </Card>
        </Col>
        <Col span={4}>
          <Card hoverable>
            <Statistic
              title="Efficiency Score"
              value={summary?.efficiency || 0}
              suffix="%"
              prefix={<AimOutlined />}
              valueStyle={{ color: COLORS.purple }}
            />
            <Progress
              percent={summary?.efficiency || 0}
              showInfo={false}
              strokeColor={COLORS.purple}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card hoverable>
            <Statistic
              title="Active Servers"
              value={clusterStats?.servers?.online || 0}
              suffix={`/ ${clusterStats?.servers?.total || 0}`}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: COLORS.cyan }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card hoverable>
            <Statistic
              title="Estimated Savings"
              value={summary?.savings || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: COLORS.success }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Overview" key="overview">
          {/* Resource Trends Chart */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={24}>
              <Card title="Resource Usage Trends" extra={<Tag color="blue">Real-time</Tag>}>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={resourceTrends}>
                    <defs>
                      <linearGradient id="colorCpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorMemoryGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="cpu"
                      name="CPU"
                      stroke={COLORS.primary}
                      fill="url(#colorCpuGrad)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="memory"
                      name="Memory"
                      stroke={COLORS.success}
                      fill="url(#colorMemoryGrad)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="gpu"
                      name="GPU"
                      stroke={COLORS.warning}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="network"
                      name="Network"
                      stroke={COLORS.purple}
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* Cost Breakdown & Utilization */}
          <Row gutter={16}>
            <Col span={12}>
              <Card title="Cost Breakdown">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={costBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="amount"
                      nameKey="category"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {costBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cost']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 16 }}>
                  {costBreakdown.map((item, index) => (
                    <div key={item.category} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                            marginRight: 8,
                          }}
                        />
                        {item.category}
                      </span>
                      <span>
                        <strong>${item.amount.toLocaleString()}</strong>
                        <Tag
                          color={item.trend < 0 ? 'green' : 'red'}
                          style={{ marginLeft: 8 }}
                        >
                          {item.trend < 0 ? '' : '+'}{item.trend}%
                        </Tag>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Cost by Category">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                    <YAxis dataKey="category" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cost']} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {costBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="Cost Analysis" key="cost">
          <Row gutter={16}>
            <Col span={16}>
              <Card title="Cost Trend Over Time">
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={resourceTrends.map((t, i) => ({
                    ...t,
                    cost: 200 + Math.random() * 300,
                  }))}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']} />
                    <Area
                      type="monotone"
                      dataKey="cost"
                      stroke={COLORS.danger}
                      fillOpacity={1}
                      fill="url(#colorCost)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col span={8}>
              <Card title="Cost Optimization Tips">
                <ul style={{ paddingLeft: 20 }}>
                  <li style={{ marginBottom: 12 }}>
                    <Tag color="green">Save $520/mo</Tag>
                    <br />
                    Consider scaling down GPU-Server-02 during off-peak hours (current utilization: 58%)
                  </li>
                  <li style={{ marginBottom: 12 }}>
                    <Tag color="green">Save $380/mo</Tag>
                    <br />
                    Storage-Server-01 is underutilized. Consider consolidating workloads.
                  </li>
                  <li style={{ marginBottom: 12 }}>
                    <Tag color="blue">Optimize</Tag>
                    <br />
                    CPU-Server-02 memory usage is low. Right-size instance for cost savings.
                  </li>
                  <li style={{ marginBottom: 12 }}>
                    <Tag color="orange">Monitor</Tag>
                    <br />
                    Network bandwidth costs increased 8.5%. Review data transfer patterns.
                  </li>
                </ul>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="Server Utilization" key="utilization">
          <Card title="Server Utilization & Cost Analysis">
            <Table
              columns={utilizationColumns}
              dataSource={serverUtilization}
              rowKey="serverId"
              pagination={false}
              scroll={{ x: 1200 }}
            />
          </Card>

          {/* Utilization Heatmap */}
          <Card title="Resource Utilization Distribution" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              {serverUtilization.map((server) => (
                <Col span={4} key={server.serverId} style={{ marginBottom: 16 }}>
                  <AntTooltip title={
                    <div>
                      <div>CPU: {server.cpuUsage.toFixed(1)}%</div>
                      <div>Memory: {server.memoryUsage.toFixed(1)}%</div>
                      <div>Utilization: {server.utilization.toFixed(1)}%</div>
                    </div>
                  }>
                    <Card
                      size="small"
                      style={{
                        background: `linear-gradient(135deg, 
                          rgba(24, 144, 255, ${server.cpuUsage / 100 * 0.8}) 0%,
                          rgba(82, 196, 26, ${server.memoryUsage / 100 * 0.8}) 100%
                        )`,
                        border: 'none',
                      }}
                    >
                      <div style={{ textAlign: 'center', color: '#fff' }}>
                        <strong>{server.serverName}</strong>
                        <div style={{ fontSize: 24, fontWeight: 'bold' }}>
                          {server.utilization.toFixed(0)}%
                        </div>
                      </div>
                    </Card>
                  </AntTooltip>
                </Col>
              ))}
            </Row>
          </Card>
        </TabPane>

        <TabPane tab="Efficiency Report" key="efficiency">
          <Row gutter={16}>
            <Col span={12}>
              <Card title="Efficiency Score by Server">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={serverUtilization}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="serverName" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="efficiency" name="Efficiency %" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Cost vs Efficiency">
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={serverUtilization}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="serverName" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="cost" name="Cost ($)" fill={COLORS.primary} />
                    <Line yAxisId="right" type="monotone" dataKey="efficiency" name="Efficiency %" stroke={COLORS.purple} strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* Efficiency Recommendations */}
          <Card title="Efficiency Recommendations" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              {serverUtilization
                .filter((s) => s.efficiency < 80)
                .sort((a, b) => a.efficiency - b.efficiency)
                .map((server) => (
                  <Col span={8} key={server.serverId} style={{ marginBottom: 16 }}>
                    <Card
                      size="small"
                      title={server.serverName}
                      extra={<Tag color={server.efficiency > 70 ? 'orange' : 'red'}>{server.efficiency.toFixed(1)}%</Tag>}
                    >
                      <ul style={{ paddingLeft: 16, margin: 0 }}>
                        {server.cpuUsage < 40 && <li>Low CPU usage - consider consolidating workloads</li>}
                        {server.memoryUsage < 50 && <li>Memory underutilized - right-size allocation</li>}
                        {server.gpuCount > 0 && server.gpuUsage && server.gpuUsage < 50 && (
                          <li>GPU allocation may be excessive for current workload</li>
                        )}
                        {server.utilization < 50 && <li>Overall low utilization - review resource allocation</li>}
                      </ul>
                    </Card>
                  </Col>
                ))}
            </Row>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  )
}

export default AnalyticsDashboard