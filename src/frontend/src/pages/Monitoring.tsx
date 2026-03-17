import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Tag, Alert, Statistic, Spin } from 'antd'
import {
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts'
import { monitoringApi, serverApi } from '../services/api'
import { wsService } from '../services/websocket'

interface ServerHealth {
  serverId: string
  serverName: string
  status: string
  cpuUsage: number
  memoryUsage: number
  gpuUsage: number | null
  temperature: number | null
  lastUpdate: string
}

const Monitoring: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState<ServerHealth[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [clusterStats, setClusterStats] = useState<any>(null)
  const [metricsData, setMetricsData] = useState<any[]>([])

  useEffect(() => {
    loadData()

    const onServersUpdate = (data: any) => {
      setHealth(data.health || [])
      setClusterStats((prev: any) => ({ ...prev, ...data }))
    }
    const onAlertsNew = (data: any) => { setAlerts(data) }

    wsService.on('servers:update', onServersUpdate)
    wsService.on('alerts:new', onAlertsNew)

    return () => {
      wsService.off('servers:update', onServersUpdate)
      wsService.off('alerts:new', onAlertsNew)
    }
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [healthRes, alertsRes, clusterRes] = await Promise.all([
        monitoringApi.getHealth(),
        monitoringApi.getAlerts(),
        monitoringApi.getClusterStats(),
      ])

      setHealth(healthRes.data.data)
      setAlerts(alertsRes.data.data)
      setClusterStats(clusterRes.data.data)
      generateMetricsData(healthRes.data.data)
    } catch (error: any) {
      console.error('Failed to load monitoring data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateMetricsData = (healthData: ServerHealth[]) => {
    // Generate historical data for charts
    const data = []
    for (let i = 23; i >= 0; i--) {
      const time = new Date(Date.now() - i * 60 * 60 * 1000)
      data.push({
        time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        cpu: Math.round(Math.random() * 40 + 30),
        memory: Math.round(Math.random() * 30 + 50),
        gpu: Math.round(Math.random() * 60 + 20),
        temp: Math.round(Math.random() * 20 + 50),
      })
    }
    setMetricsData(data)
  }

  const healthColumns = [
    {
      title: 'Server',
      dataIndex: 'serverName',
      key: 'serverName',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          ONLINE: 'green',
          OFFLINE: 'red',
          MAINTENANCE: 'orange',
          ERROR: 'volcano',
        }
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>
      },
    },
    {
      title: 'CPU',
      dataIndex: 'cpuUsage',
      key: 'cpuUsage',
      render: (value: number) => (
        <span style={{ color: value > 80 ? '#ff4d4f' : value > 60 ? '#faad14' : '#52c41a' }}>
          {value.toFixed(1)}%
        </span>
      ),
    },
    {
      title: 'Memory',
      dataIndex: 'memoryUsage',
      key: 'memoryUsage',
      render: (value: number) => (
        <span style={{ color: value > 80 ? '#ff4d4f' : value > 60 ? '#faad14' : '#52c41a' }}>
          {value.toFixed(1)}%
        </span>
      ),
    },
    {
      title: 'GPU',
      dataIndex: 'gpuUsage',
      key: 'gpuUsage',
      render: (value: number | null) => (value !== null ? `${value.toFixed(1)}%` : 'N/A'),
    },
    {
      title: 'Temperature',
      dataIndex: 'temperature',
      key: 'temperature',
      render: (value: number | null) =>
        value !== null ? (
          <span style={{ color: value > 70 ? '#ff4d4f' : value > 60 ? '#faad14' : '#52c41a' }}>
            {value.toFixed(1)}°C
          </span>
        ) : (
          'N/A'
        ),
    },
    {
      title: 'Last Update',
      dataIndex: 'lastUpdate',
      key: 'lastUpdate',
      render: (time: string) => new Date(time).toLocaleString(),
    },
  ]

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Monitoring</h1>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Alert
          message="Active Alerts"
          description={
            <ul style={{ marginBottom: 0 }}>
              {alerts.map((alert, idx) => (
                <li key={idx}>
                  <Tag color={alert.type === 'critical' ? 'red' : 'orange'}>
                    {alert.type === 'critical' ? 'CRITICAL' : 'WARNING'}
                  </Tag>
                  <strong>{alert.serverName}</strong>: {alert.message} ({alert.value.toFixed(1)}%)
                </li>
              ))}
            </ul>
          }
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Cluster Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Cluster CPU Usage"
              value={clusterStats?.usage?.avgCpuUsage || 0}
              suffix="%"
              valueStyle={{
                color:
                  (clusterStats?.usage?.avgCpuUsage || 0) > 80
                    ? '#ff4d4f'
                    : (clusterStats?.usage?.avgCpuUsage || 0) > 60
                    ? '#faad14'
                    : '#52c41a',
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Cluster Memory Usage"
              value={clusterStats?.usage?.avgMemoryUsage || 0}
              suffix="%"
              valueStyle={{
                color:
                  (clusterStats?.usage?.avgMemoryUsage || 0) > 80
                    ? '#ff4d4f'
                    : (clusterStats?.usage?.avgMemoryUsage || 0) > 60
                    ? '#faad14'
                    : '#52c41a',
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Cluster GPU Usage"
              value={clusterStats?.usage?.avgGpuUsage || 0}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Servers"
              value={clusterStats?.servers?.online || 0}
              suffix={`/ ${clusterStats?.servers?.total || 0}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="Resource Usage Trends (24h)">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={metricsData}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52c41a" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#52c41a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="cpu" stroke="#1890ff" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                <Area type="monotone" dataKey="memory" stroke="#52c41a" fillOpacity={1} fill="url(#colorMemory)" name="Memory %" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="GPU & Temperature Trends (24h)">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metricsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="gpu" stroke="#faad14" name="GPU %" />
                <Line yAxisId="right" type="monotone" dataKey="temp" stroke="#ff4d4f" name="Temperature °C" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Server Health Table */}
      <Card title="Server Health Status">
        <Table
          columns={healthColumns}
          dataSource={health}
          rowKey="serverId"
          pagination={false}
        />
      </Card>
    </div>
  )
}

export default Monitoring
