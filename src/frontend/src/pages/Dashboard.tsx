import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Tag, Spin, Alert, message } from 'antd'
import {
  ApiOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  UserOutlined,
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
  const [metricsData, setMetricsData] = useState<any[]>([])

  useEffect(() => {
    loadData()

    // Subscribe to real-time updates
    const onServersUpdate = (data: any) => { setClusterStats(data.stats) }
    const onTasksUpdate = (data: any) => { setTaskStats(data) }
    const onAlertsNew = (data: any) => { setAlerts(data) }

    wsService.on('servers:update', onServersUpdate)
    wsService.on('tasks:update', onTasksUpdate)
    wsService.on('alerts:new', onAlertsNew)

    return () => {
      wsService.off('servers:update', onServersUpdate)
      wsService.off('tasks:update', onTasksUpdate)
      wsService.off('alerts:new', onAlertsNew)
    }
  }, [])

  /**
   * Load dashboard data using Promise.allSettled so that each request is
   * independent. Previously Promise.all was used: if any single request failed,
   * ALL data was lost. Now each module degrades independently.
   *
   * Fix: replaced Promise.all (all-or-nothing) with Promise.allSettled
   * (each request succeeds or fails independently).
   */
  const loadData = async () => {
    setLoading(true)
    try {
      const [serverRes, gpuRes, taskRes, clusterRes, alertsRes] = await Promise.allSettled([
        serverApi.getStats(),
        gpuApi.getStats(),
        taskApi.getStats(),
        monitoringApi.getClusterStats(),
        monitoringApi.getAlerts(),
      ])

      if (serverRes.status === 'fulfilled') {
        setServerStats(serverRes.value.data.data)
      } else {
        console.error('[Dashboard] Failed to load server stats:', serverRes.reason)
        message.error('服务器统计数据加载失败，请刷新重试')
      }

      if (gpuRes.status === 'fulfilled') {
        setGpuStats(gpuRes.value.data.data)
      } else {
        console.error('[Dashboard] Failed to load GPU stats:', gpuRes.reason)
        message.error('GPU 统计数据加载失败，请刷新重试')
      }

      if (taskRes.status === 'fulfilled') {
        setTaskStats(taskRes.value.data.data)
      } else {
        console.error('[Dashboard] Failed to load task stats:', taskRes.reason)
        message.error('任务统计数据加载失败，请刷新重试')
      }

      if (clusterRes.status === 'fulfilled') {
        setClusterStats(clusterRes.value.data.data)
      } else {
        console.error('[Dashboard] Failed to load cluster stats:', clusterRes.reason)
        message.error('集群统计数据加载失败，请刷新重试')
      }

      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value.data.data)
      } else {
        console.error('[Dashboard] Failed to load alerts:', alertsRes.reason)
        // Alerts failure is non-critical; silently default to empty
        setAlerts([])
      }

      // Generate sample metrics data for charts
      generateMetricsData()
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
