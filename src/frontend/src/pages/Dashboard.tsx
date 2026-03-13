import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Tag, Spin, Alert } from 'antd'
import {
  ApiOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'

// Icon aliases for compatibility
const ServerOutlined = ApiOutlined;
const GpuOutlined = RocketOutlined;
const TaskOutlined = ClockCircleOutlined;
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { serverApi, gpuApi, taskApi, monitoringApi } from '../services/api'
import { wsService } from '../services/websocket'

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [serverStats, setServerStats] = useState<any>(null)
  const [gpuStats, setGpuStats] = useState<any>(null)
  const [taskStats, setTaskStats] = useState<any>(null)
  const [clusterStats, setClusterStats] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [recentTasks, setRecentTasks] = useState<any[]>([])
  const [metricsData, setMetricsData] = useState<any[]>([])

  useEffect(() => {
    loadData()

    // Subscribe to real-time updates
    wsService.on('servers:update', (data) => {
      setClusterStats(data.stats)
    })

    wsService.on('tasks:update', (data) => {
      setTaskStats(data)
    })

    wsService.on('alerts:new', (data) => {
      setAlerts(data)
    })

    return () => {
      wsService.off('servers:update', () => {})
      wsService.off('tasks:update', () => {})
      wsService.off('alerts:new', () => {})
    }
  }, [])

  const loadData = async () => {
    try {
      const [serverRes, gpuRes, taskRes, clusterRes, alertsRes] = await Promise.all([
        serverApi.getStats(),
        gpuApi.getStats(),
        taskApi.getStats(),
        monitoringApi.getClusterStats(),
        monitoringApi.getAlerts(),
      ])

      setServerStats(serverRes.data.data)
      setGpuStats(gpuRes.data.data)
      setTaskStats(taskRes.data.data)
      setClusterStats(clusterRes.data.data)
      setAlerts(alertsRes.data.data)

      // Generate sample metrics data for charts
      generateMetricsData()
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateMetricsData = () => {
    // Sample data for charts - in production, fetch real data
    const data = []
    for (let i = 23; i >= 0; i--) {
      const time = new Date(Date.now() - i * 60 * 60 * 1000)
      data.push({
        time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        cpu: Math.round(Math.random() * 40 + 30),
        memory: Math.round(Math.random() * 30 + 50),
        gpu: Math.round(Math.random() * 60 + 20),
      })
    }
    setMetricsData(data)
  }

  const taskColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          PENDING: 'default',
          RUNNING: 'processing',
          COMPLETED: 'success',
          FAILED: 'error',
          CANCELLED: 'warning',
        }
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>
      },
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
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
      <h1 style={{ marginBottom: 24 }}>Dashboard</h1>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Alert
          message="System Alerts"
          description={
            <ul>
              {alerts.map((alert, idx) => (
                <li key={idx}>
                  <Tag color={alert.type === 'critical' ? 'red' : 'orange'}>{alert.type}</Tag>
                  {alert.serverName}: {alert.message} ({alert.value.toFixed(1)}%)
                </li>
              ))}
            </ul>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Servers"
              value={serverStats?.online || 0}
              suffix={`/ ${serverStats?.total || 0}`}
              prefix={<ServerOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              <Tag color="green">Online: {serverStats?.online || 0}</Tag>
              <Tag color="red">Offline: {serverStats?.offline || 0}</Tag>
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="GPUs"
              value={gpuStats?.available || 0}
              suffix={`/ ${gpuStats?.total || 0}`}
              prefix={<GpuOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              <Tag color="green">Available: {gpuStats?.available || 0}</Tag>
              <Tag color="blue">Allocated: {gpuStats?.allocated || 0}</Tag>
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="Tasks"
              value={taskStats?.running || 0}
              suffix={`/ ${taskStats?.total || 0}`}
              prefix={<TaskOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              <Tag color="processing">Running: {taskStats?.running || 0}</Tag>
              <Tag color="default">Pending: {taskStats?.pending || 0}</Tag>
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="Resource Usage"
              value={clusterStats?.usage?.avgCpuUsage || 0}
              suffix="%"
              prefix={<UserOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              CPU: {clusterStats?.usage?.avgCpuUsage || 0}% | Memory:{' '}
              {clusterStats?.usage?.avgMemoryUsage || 0}%
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="Resource Usage (24h)">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metricsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cpu" stroke="#1890ff" name="CPU %" />
                <Line type="monotone" dataKey="memory" stroke="#52c41a" name="Memory %" />
                <Line type="monotone" dataKey="gpu" stroke="#faad14" name="GPU %" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Task Status Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  { name: 'Pending', value: taskStats?.pending || 0 },
                  { name: 'Running', value: taskStats?.running || 0 },
                  { name: 'Completed', value: taskStats?.completed || 0 },
                  { name: 'Failed', value: taskStats?.failed || 0 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
