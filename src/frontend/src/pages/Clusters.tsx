import { useEffect, useState } from 'react'
import { Card, Row, Col, Tag, Button, Space, Modal, Form, Input, DatePicker, Select, message, Statistic, Descriptions, Tooltip, Badge, Typography, Tabs, Empty, Spin } from 'antd'
import { 
  ClusterOutlined, 
  SyncOutlined, 
  UserOutlined, 
  ClockCircleOutlined, 
  DesktopOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HourglassOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  FormOutlined,
  UpOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BulbOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { clusterApi, clusterReservationApi, authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface Cluster {
  id: string
  name: string
  code: string
  description?: string
  type: string
  status: string
  tags: string[]
  totalServers: number
  totalGpus: number
  totalCpuCores: number
  totalMemory: number
  // Environment info fields
  envName?: string
  envAlias?: string
  subEnvAlias?: string
  prometheusAddress?: string
  deviceInfo?: string
  loginIp?: string
  usageScenario?: string
  // Owners
  testOwnerId?: string
  teamOwnerId?: string
  userId?: string
  testOwner?: {
    id: string
    username: string
    displayName?: string
    email: string
  }
  teamOwner?: {
    id: string
    username: string
    displayName?: string
    email: string
  }
  user?: {
    id: string
    username: string
    displayName?: string
    email: string
  }
  servers?: Array<{
    server: {
      id: string
      name: string
      hostname: string
      ipAddress: string
      status?: string
      cpuCores?: number
      totalMemory?: number
      gpuCount: number
      location?: string
      description?: string
      gpus: Array<{
        id: string
        model: string
        memory: number
        allocated: boolean
      }>
    }
    priority: number
    role?: string
  }>
  creator?: {
    id: string
    username: string
    email: string
  }
  assignee?: {
    id: string
    username: string
    email: string
  }
  assignedAt?: string
  assignmentEnd?: string
  createdAt: string
  updatedAt: string
}

interface ClusterReservation {
  id: string
  clusterId: string
  userId: string
  startTime: string
  endTime: string
  purpose?: string
  status: string
  queuePosition?: number
  cluster?: {
    id: string
    name: string
    code: string
  }
  user?: {
    id: string
    username: string
    email: string
  }
  createdAt: string
}

interface TimeSlotRecommendation {
  startTime: string
  endTime: string
  score: number
  confidence: number
  reasons: string[]
  queuePosition: number | null
}

interface ClusterStats {
  total: number
  byStatus: {
    available: number
    allocated: number
    reserved: number
    maintenance: number
  }
  resources: {
    totalServers: number
    totalGpus: number
    totalCpuCores: number
    totalMemory: number
  }
}

const statusConfig: Record<string, { color: string; icon: any; text: string }> = {
  AVAILABLE: { color: 'green', icon: <CheckCircleOutlined />, text: 'Available' },
  ALLOCATED: { color: 'blue', icon: <PlayCircleOutlined />, text: 'In Use' },
  RESERVED: { color: 'orange', icon: <ClockCircleOutlined />, text: 'Reserved' },
  MAINTENANCE: { color: 'red', icon: <CloseCircleOutlined />, text: 'Maintenance' },
  OFFLINE: { color: 'default', icon: <CloseCircleOutlined />, text: 'Offline' },
}

const reservationStatusConfig: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'gold', text: 'Pending Approval' },
  APPROVED: { color: 'green', text: 'Approved' },
  REJECTED: { color: 'red', text: 'Rejected' },
  ACTIVE: { color: 'blue', text: 'Active' },
  COMPLETED: { color: 'default', text: 'Completed' },
  CANCELLED: { color: 'default', text: 'Cancelled' },
}

const typeColors: Record<string, string> = {
  COMPUTE: 'blue',
  TRAINING: 'purple',
  INFERENCE: 'cyan',
  GENERAL: 'default',
  CUSTOM: 'gold',
}

const Clusters: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [stats, setStats] = useState<ClusterStats | null>(null)
  const [myReservations, setMyReservations] = useState<ClusterReservation[]>([])
  
  // Modals
  const [detailVisible, setDetailVisible] = useState(false)
  const [reserveVisible, setReserveVisible] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [serversVisible, setServersVisible] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null)
  
  // AI Recommendations
  const [aiRecommendations, setAiRecommendations] = useState<TimeSlotRecommendation[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState<number>(120) // default 2 hours
  
  const [form] = Form.useForm()
  const [reserveForm] = Form.useForm()
  const [serverForm] = Form.useForm()

  // 只有 SUPER_ADMIN 才有完全的集群管理权限
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  // 只有 SUPER_ADMIN 可以修改集群状态（手动覆盖）
  const canModifyStatus = isSuperAdmin
  // MANAGER, ADMIN, SUPER_ADMIN 可以查看集群列表（用于预约）
  const canViewClusters = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER'

  // 服务器管理 Modal
  const [manageServersVisible, setManageServersVisible] = useState(false)
  const [availableServers, setAvailableServers] = useState<any[]>([])
  const [loadingServers, setLoadingServers] = useState(false)
  
  // 用户列表（用于责任人选择）
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [clustersRes, statsRes, reservationsRes, usersRes] = await Promise.all([
        clusterApi.getAll(),
        clusterApi.getStats(),
        clusterReservationApi.getMy().catch(() => ({ data: { data: [] } })),
        authApi.getUsers().catch(() => ({ data: { data: [] } })),
      ])
      
      setClusters(clustersRes.data.data || [])
      setStats(statsRes.data.data)
      setMyReservations(reservationsRes.data.data || [])
      setUsers(usersRes.data.data || [])
    } catch (error: any) {
      message.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  // Cluster status options
  const clusterStatusOptions = [
    { value: 'AVAILABLE', label: 'Available' },
    { value: 'ALLOCATED', label: 'Allocated' },
    { value: 'RESERVED', label: 'Reserved' },
    { value: 'MAINTENANCE', label: 'Maintenance' },
    { value: 'OFFLINE', label: 'Offline' },
  ]

  // Handle cluster status update
  const handleStatusUpdate = async (clusterId: string, newStatus: string) => {
    try {
      await clusterApi.update(clusterId, { status: newStatus })
      message.success('Cluster status updated')
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to update cluster status')
    }
  }
  const getMyReservationForCluster = (clusterId: string): ClusterReservation | undefined => {
    return myReservations.find(r => 
      r.clusterId === clusterId && 
      ['PENDING', 'APPROVED', 'ACTIVE'].includes(r.status)
    )
  }

  // Open reservation modal
  const handleReserve = (cluster: Cluster) => {
    setSelectedCluster(cluster)
    reserveForm.resetFields()
    setAiRecommendations([])
    setSelectedDuration(120)
    setReserveVisible(true)
  }

  // Fetch AI time slot recommendations
  const fetchAiRecommendations = async (duration: number) => {
    if (!selectedCluster) return
    
    setLoadingRecommendations(true)
    try {
      const response = await clusterReservationApi.recommendTimeSlots({
        clusterId: selectedCluster.id,
        duration,
      })
      setAiRecommendations(response.data.data || [])
    } catch (error: any) {
      console.error('Failed to fetch AI recommendations:', error)
    } finally {
      setLoadingRecommendations(false)
    }
  }

  // Apply AI recommended time slot
  const applyRecommendation = (recommendation: TimeSlotRecommendation) => {
    reserveForm.setFieldsValue({
      timeRange: [dayjs(recommendation.startTime), dayjs(recommendation.endTime)],
    })
  }

  // Submit reservation
  const handleReserveSubmit = async (values: any) => {
    if (!selectedCluster) return
    
    try {
      const [startTime, endTime] = values.timeRange
      
      await clusterReservationApi.create({
        clusterId: selectedCluster.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        purpose: values.purpose,
      })
      
      message.success('Reservation request submitted, pending approval')
      setReserveVisible(false)
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Reservation failed')
    }
  }

  // Release reservation
  const handleRelease = async (reservationId: string) => {
    try {
      await clusterReservationApi.release(reservationId)
      message.success('Resource released')
      loadData()
    } catch (error: any) {
      message.error('Release failed')
    }
  }

  // Cancel reservation
  const handleCancel = async (reservationId: string) => {
    try {
      await clusterReservationApi.cancel(reservationId)
      message.success('Reservation cancelled')
      loadData()
    } catch (error: any) {
      message.error('Cancellation failed')
    }
  }

  // View cluster detail with servers
  const handleViewDetail = async (cluster: Cluster) => {
    try {
      const response = await clusterApi.getById(cluster.id)
      setSelectedCluster(response.data.data)
      setDetailVisible(true)
    } catch (error: any) {
      message.error('Failed to load details')
    }
  }

  // View servers in cluster (drill down)
  const handleViewServers = async (cluster: Cluster) => {
    try {
      const response = await clusterApi.getById(cluster.id)
      setSelectedCluster(response.data.data)
      setServersVisible(true)
    } catch (error: any) {
      message.error('Failed to load server list')
    }
  }

  // Navigate to server detail
  const handleServerClick = (serverId: string) => {
    navigate(`/servers?highlight=${serverId}`)
  }

  // Create cluster (SUPER_ADMIN only)
  const handleCreate = () => {
    setEditingCluster(null)
    form.resetFields()
    setCreateModalVisible(true)
  }

  // Edit cluster
  const handleEdit = (cluster: Cluster) => {
    setEditingCluster(cluster)
    form.setFieldsValue({
      name: cluster.name,
      description: cluster.description,
      type: cluster.type,
      envName: cluster.envName,
      envAlias: cluster.envAlias,
      subEnvAlias: cluster.subEnvAlias,
      prometheusAddress: cluster.prometheusAddress,
      deviceInfo: cluster.deviceInfo,
      loginIp: cluster.loginIp,
      usageScenario: cluster.usageScenario,
      testOwnerId: cluster.testOwnerId,
      teamOwnerId: cluster.teamOwnerId,
      userId: cluster.userId,
    })
    setCreateModalVisible(true)
  }

  // Delete cluster
  const handleDelete = async (id: string) => {
    try {
      await clusterApi.delete(id)
      message.success('Cluster deleted')
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Delete failed')
    }
  }

  // Submit create/edit
  const handleSubmit = async (values: any) => {
    try {
      if (editingCluster) {
        await clusterApi.update(editingCluster.id, values)
        message.success('Cluster updated')
      } else {
        await clusterApi.create(values)
        message.success('Cluster created')
      }
      setCreateModalVisible(false)
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Operation failed')
    }
  }

  // Open manage servers modal (SUPER_ADMIN only)
  const handleManageServers = async (cluster: Cluster) => {
    setSelectedCluster(cluster)
    setLoadingServers(true)
    setManageServersVisible(true)
    serverForm.resetFields()
    
    try {
      const response = await clusterApi.getAvailableServers()
      setAvailableServers(response.data.data || [])
    } catch (error: any) {
      message.error('Failed to load available servers')
    } finally {
      setLoadingServers(false)
    }
  }

  // Add server to cluster
  const handleAddServer = async (values: any) => {
    if (!selectedCluster) return
    
    try {
      await clusterApi.addServer(selectedCluster.id, {
        serverId: values.serverId,
        priority: values.priority || 1,
        role: values.role,
      })
      message.success('Server added')
      
      // Refresh cluster data
      const response = await clusterApi.getById(selectedCluster.id)
      setSelectedCluster(response.data.data)
      
      // Refresh available servers
      const serversRes = await clusterApi.getAvailableServers()
      setAvailableServers(serversRes.data.data || [])
      
      serverForm.resetFields()
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to add server')
    }
  }

  // Remove server from cluster
  const handleRemoveServer = async (serverId: string) => {
    if (!selectedCluster) return
    
    try {
      await clusterApi.removeServer(selectedCluster.id, serverId)
      message.success('Server removed')
      
      // Refresh cluster data
      const response = await clusterApi.getById(selectedCluster.id)
      setSelectedCluster(response.data.data)
      
      // Refresh available servers
      const serversRes = await clusterApi.getAvailableServers()
      setAvailableServers(serversRes.data.data || [])
      
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to remove server')
    }
  }

  // Render cluster card
  const renderClusterCard = (cluster: Cluster) => {
    const myReservation = getMyReservationForCluster(cluster.id)
    // Use effectiveStatus if available, fallback to status
    const displayStatus = (cluster as any).effectiveStatus || cluster.status
    const statusInfo = statusConfig[displayStatus] || statusConfig.OFFLINE
    const isAvailable = displayStatus === 'AVAILABLE'
    const isReservedByMe = myReservation && myReservation.status === 'APPROVED'
    const isStatusOverridden = (cluster as any).isStatusOverridden

    // Actions for all users
    const actions = [
      <Tooltip title="View Details" key="detail">
        <EyeOutlined onClick={() => handleViewDetail(cluster)} />
      </Tooltip>,
      <Tooltip title="View Servers" key="servers">
        <DesktopOutlined onClick={() => handleViewServers(cluster)} />
      </Tooltip>,
    ]

    // SUPER_ADMIN: manage servers, edit, delete
    if (isSuperAdmin) {
      actions.push(
        <Tooltip title="Manage Servers" key="manage">
          <EditOutlined onClick={() => handleManageServers(cluster)} />
        </Tooltip>
      )
    } else {
      // Regular users: reservation actions
      if (isAvailable) {
        actions.push(
          <Tooltip title="Request Reservation" key="reserve">
            <FormOutlined onClick={() => handleReserve(cluster)} />
          </Tooltip>
        )
      } else if (isReservedByMe) {
        actions.push(
          <Tooltip title="Release Resource" key="release">
            <CloseCircleOutlined onClick={() => handleRelease(myReservation!.id)} />
          </Tooltip>
        )
      } else if (myReservation?.status === 'PENDING') {
        actions.push(
          <Tooltip title="Cancel Reservation" key="cancel">
            <CloseCircleOutlined onClick={() => handleCancel(myReservation!.id)} />
          </Tooltip>
        )
      } else {
        actions.push(
          <Tooltip title="Not Available" key="unavailable">
            <ClockCircleOutlined style={{ color: '#999' }} />
          </Tooltip>
        )
      }
    }

    return (
      <Col key={cluster.id} xs={24} sm={12} md={8} lg={6}>
        <Card
          hoverable
          className="cluster-card"
          style={{ height: '100%' }}
          cover={
            <div 
              style={{ 
                padding: '16px', 
                background: statusInfo.color === 'green' ? '#f6ffed' : 
                            statusInfo.color === 'blue' ? '#e6f7ff' : 
                            statusInfo.color === 'orange' ? '#fff7e6' : '#fff',
                borderBottom: '1px solid #f0f0f0'
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Badge status={statusInfo.color as any} />
                  <Text strong style={{ fontSize: 16 }}>{cluster.name}</Text>
                </Space>
                <Space>
                  {canModifyStatus ? (
                    <Space size="small">
                      <Select
                        value={cluster.status}
                        style={{ width: 130 }}
                        size="small"
                        onChange={(value) => handleStatusUpdate(cluster.id, value)}
                        options={clusterStatusOptions}
                      />
                      {isStatusOverridden && (
                        <Tooltip title={`实际状态: ${statusInfo.text} (基于当前预约)`}>
                          <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                        </Tooltip>
                      )}
                    </Space>
                  ) : (
                    <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                  )}
                  <Tag color={typeColors[cluster.type] || 'default'}>{cluster.type}</Tag>
                </Space>
              </Space>
            </div>
          }
          actions={actions}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {/* User info if allocated */}
            {cluster.assignee && (
              <div>
                <UserOutlined style={{ marginRight: 4 }} />
                <Text type="secondary">{cluster.assignee?.username || '-'}</Text>
              </div>
            )}
            
            {/* Time info */}
            {cluster.assignmentEnd && (
              <div>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Until {dayjs(cluster.assignmentEnd).format('MM-DD HH:mm')}
                </Text>
              </div>
            )}
            
            {/* My reservation queue info */}
            {myReservation && myReservation.queuePosition && (
              <div>
                <HourglassOutlined style={{ marginRight: 4, color: '#faad14' }} />
                <Text type="warning" style={{ fontSize: 12 }}>
                  Queue Position: #{myReservation.queuePosition}
                </Text>
              </div>
            )}
            
            {/* Resources */}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
              <Space split={<Text type="secondary">|</Text>}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <DesktopOutlined /> {cluster.totalServers} Servers
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  GPU: {cluster.totalGpus}
                </Text>
              </Space>
            </div>
          </Space>
        </Card>
      </Col>
    )
  }

  return (
    <div className="clusters-page">
      <Title level={3} style={{ marginBottom: 24 }}>
        <ClusterOutlined style={{ marginRight: 8 }} />
        Cluster Management
      </Title>

      {/* Stats Cards */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="Total Clusters" value={stats.total} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic 
                title="Available" 
                value={stats.byStatus.available} 
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic 
                title="In Use" 
                value={stats.byStatus.allocated}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="Total Servers" value={stats.resources.totalServers} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="Total GPUs" value={stats.resources.totalGpus} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="CPU Cores" value={stats.resources.totalCpuCores} />
            </Card>
          </Col>
        </Row>
      )}

      {/* Toolbar */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          {isSuperAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              Create Cluster
            </Button>
          )}
          <Button icon={<SyncOutlined />} onClick={loadData}>
            Refresh
          </Button>
          <Button 
            icon={<CalendarOutlined />} 
            onClick={() => navigate('/reservations')}
          >
            View Calendar
          </Button>
        </Space>
      </div>

      {/* Cluster Cards */}
      <Spin spinning={loading}>
        {clusters.length > 0 ? (
          <Row gutter={[16, 16]}>
            {(clusters || []).map(renderClusterCard)}
          </Row>
        ) : (
          <Empty description="No clusters available" />
        )}
      </Spin>

      {/* Reservation Modal */}
      <Modal
        title={`Reserve Cluster: ${selectedCluster?.name}`}
        open={reserveVisible}
        onCancel={() => setReserveVisible(false)}
        onOk={() => reserveForm.submit()}
        okText="Submit Request"
        width={700}
      >
        <Form
          form={reserveForm}
          layout="vertical"
          onFinish={handleReserveSubmit}
        >
          {/* AI Recommendations Section */}
          <Card 
            size="small" 
            style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}
            title={
              <Space>
                <BulbOutlined style={{ color: '#52c41a' }} />
                <span>AI Smart Recommendations</span>
              </Space>
            }
            extra={
              <Space>
                <Select
                  size="small"
                  value={selectedDuration}
                  onChange={(val) => {
                    setSelectedDuration(val)
                    fetchAiRecommendations(val)
                  }}
                  style={{ width: 120 }}
                  options={[
                    { value: 60, label: '1 Hour' },
                    { value: 120, label: '2 Hours' },
                    { value: 240, label: '4 Hours' },
                    { value: 480, label: '8 Hours' },
                  ]}
                />
                <Button 
                  size="small" 
                  icon={<ThunderboltOutlined />}
                  loading={loadingRecommendations}
                  onClick={() => fetchAiRecommendations(selectedDuration)}
                >
                  Get Recommendations
                </Button>
              </Space>
            }
          >
            {loadingRecommendations ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin tip="AI is analyzing optimal time slots..." />
              </div>
            ) : aiRecommendations.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {aiRecommendations.map((rec, index) => (
                  <div
                    key={index}
                    onClick={() => applyRecommendation(rec)}
                    style={{
                      padding: '8px 12px',
                      background: index === 0 ? '#e6f7ff' : '#fff',
                      border: `1px solid ${index === 0 ? '#1890ff' : '#d9d9d9'}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                    }}
                  >
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Tag color={index === 0 ? 'blue' : 'default'}>
                          {index === 0 ? 'Best' : `Option ${index + 1}`}
                        </Tag>
                        <Text strong>
                          {dayjs(rec.startTime).format('MM-DD HH:mm')} - {dayjs(rec.endTime).format('HH:mm')}
                        </Text>
                      </Space>
                      <Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Confidence: {(rec.confidence * 100).toFixed(0)}%
                        </Text>
                        <Tag color="green">{rec.score} pts</Tag>
                      </Space>
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      {(rec.reasons || []).slice(0, 2).map((reason, i) => (
                        <Tag key={i} color="geekblue" style={{ fontSize: 11, marginBottom: 2 }}>
                          {reason}
                        </Tag>
                      ))}
                    </div>
                  </div>
                ))}
              </Space>
            ) : (
              <div style={{ color: '#8c8c8c', fontSize: 12, textAlign: 'center', padding: 10 }}>
                Click "Get Recommendations" for AI-powered optimal time slot analysis
              </div>
            )}
          </Card>

          <Form.Item
            name="timeRange"
            label="Time Range"
            rules={[{ required: true, message: 'Please select time range' }]}
          >
            <RangePicker
              showTime
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
          <Form.Item
            name="purpose"
            label="Purpose"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="Brief description of your purpose..."
              maxLength={500}
              showCount
            />
          </Form.Item>
          <div style={{ color: '#faad14', fontSize: 12 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            Reservations require SUPER_ADMIN approval. Time conflicts will be queued.
          </div>
        </Form>
      </Modal>

      {/* Cluster Detail Modal */}
      <Modal
        title={selectedCluster?.name || 'Cluster Details'}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedCluster && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Code">{selectedCluster.code}</Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color={typeColors[selectedCluster.type]}>{selectedCluster.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusConfig[selectedCluster.status]?.color}>
                  {statusConfig[selectedCluster.status]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Creator">
                {selectedCluster.creator?.username || '-'}
              </Descriptions.Item>
              {selectedCluster.assignee && (
                <>
                  <Descriptions.Item label="User">
                    <UserOutlined style={{ marginRight: 4 }} />
                    {selectedCluster.assignee?.username || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="End Time">
                    {selectedCluster.assignmentEnd && 
                      dayjs(selectedCluster.assignmentEnd).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="Description" span={2}>
                {selectedCluster.description || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
              Resource Configuration
            </Title>
            <Row gutter={8}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="Servers" value={selectedCluster.totalServers} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="GPUs" value={selectedCluster.totalGpus} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="CPU Cores" value={selectedCluster.totalCpuCores} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="Memory (GB)" value={selectedCluster.totalMemory} />
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* Servers in Cluster Modal (Drill Down) */}
      <Modal
        title={
          <Space>
            <span>Server List</span>
            <Text type="secondary">({selectedCluster?.name})</Text>
          </Space>
        }
        open={serversVisible}
        onCancel={() => setServersVisible(false)}
        footer={
          <Button onClick={() => setServersVisible(false)}>Close</Button>
        }
        width={900}
      >
        {selectedCluster?.servers && selectedCluster.servers.length > 0 ? (
          <Row gutter={[12, 12]}>
            {selectedCluster.servers.map((s) => {
              // Server status config
              const serverStatusConfig: Record<string, { color: string; text: string }> = {
                ONLINE: { color: 'green', text: 'Online' },
                OFFLINE: { color: 'default', text: 'Offline' },
                MAINTENANCE: { color: 'orange', text: 'Maintenance' },
              }
              const serverStatus = serverStatusConfig[s.server.status || 'ONLINE'] || serverStatusConfig.ONLINE
              
              // Get unique GPU models
              const gpuModels = s.server?.gpus 
                ? [...new Set(s.server.gpus.map(g => g.model))].join(', ')
                : 'N/A'
              
              return (
                <Col key={s.server.id} span={8}>
                  <Card
                    hoverable
                    size="small"
                    onClick={() => handleServerClick(s.server.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      {/* Header: Name + Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: 14 }}>{s.server.name}</Text>
                        <Badge status={serverStatus.color as any} text={serverStatus.text} />
                      </div>
                      
                      {/* IP Address */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>IP:</Text>
                        <Text code style={{ fontSize: 12 }}>{s.server.ipAddress || 'N/A'}</Text>
                      </div>
                      
                      {/* Hostname */}
                      {s.server.hostname && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {s.server.hostname}
                        </Text>
                      )}
                      
                      {/* Configuration */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <Tag color="blue" style={{ margin: 0 }}>
                          CPU: {s.server.cpuCores || 'N/A'} cores
                        </Tag>
                        <Tag color="purple" style={{ margin: 0 }}>
                          RAM: {s.server.totalMemory || 'N/A'} GB
                        </Tag>
                      </div>
                      
                      {/* GPU Info */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <Tag color="cyan" style={{ margin: 0 }}>
                          GPU: {s.server.gpuCount}
                        </Tag>
                        {s.role && <Tag color="gold" style={{ margin: 0 }}>{s.role}</Tag>}
                      </div>
                      
                      {/* GPU Models (if available) */}
                      {gpuModels && gpuModels !== 'N/A' && (
                        <Tooltip title="GPU Models">
                          <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                            {gpuModels}
                          </Text>
                        </Tooltip>
                      )}
                      
                      {/* Location */}
                      {s.server.location && (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          📍 {s.server.location}
                        </Text>
                      )}
                    </Space>
                  </Card>
                </Col>
              )
            })}
          </Row>
        ) : (
          <Empty description="No servers in this cluster" />
        )}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button 
            icon={<UpOutlined />} 
            onClick={() => setServersVisible(false)}
          >
            Back to Cluster List
          </Button>
        </div>
      </Modal>

      {/* Create/Edit Cluster Modal */}
      <Modal
        title={editingCluster ? 'Edit Cluster' : 'Create Cluster'}
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {/* Basic Info */}
          <Title level={5}>Basic Information</Title>
          <Row gutter={16}>
            <Col span={12}>
              {!editingCluster && (
                <Form.Item
                  name="code"
                  label="Cluster Code"
                  rules={[
                    { required: true, message: 'Please enter cluster code' },
                    { pattern: /^[A-Z0-9_-]+$/, message: 'Code must contain only uppercase letters, numbers, underscores or hyphens' },
                  ]}
                >
                  <Input placeholder="e.g. CLUSTER_01" />
                </Form.Item>
              )}
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Cluster Name"
                rules={[{ required: true, message: 'Please enter cluster name' }]}
              >
                <Input placeholder="e.g. Training Cluster A" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="Cluster Type"
                rules={[{ required: true, message: 'Please select cluster type' }]}
              >
                <Select placeholder="Select type">
                  <Select.Option value="COMPUTE">Compute</Select.Option>
                  <Select.Option value="TRAINING">Training</Select.Option>
                  <Select.Option value="INFERENCE">Inference</Select.Option>
                  <Select.Option value="GENERAL">General</Select.Option>
                  <Select.Option value="CUSTOM">Custom</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="description" label="Description">
                <Input placeholder="Cluster description..." />
              </Form.Item>
            </Col>
          </Row>

          {/* Environment Info */}
          <Title level={5} style={{ marginTop: 16 }}>Environment Information</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="envName" label="Environment Name">
                <Input placeholder="e.g. Production" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="envAlias" label="Environment Alias">
                <Input placeholder="e.g. PROD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="subEnvAlias" label="Sub Environment Alias">
                <Input placeholder="e.g. PROD-A" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="prometheusAddress" label="Prometheus Address">
                <Input placeholder="e.g. 192.168.1.100" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="loginIp" label="Login IP">
                <Input placeholder="e.g. 10.0.0.1" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="usageScenario" label="Usage Scenario">
                <Input placeholder="e.g. Model Training" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="deviceInfo" label="Device Information">
                <Input.TextArea rows={2} placeholder="Device details..." />
              </Form.Item>
            </Col>
          </Row>

          {/* Responsibility Info */}
          <Title level={5} style={{ marginTop: 16 }}>Responsibility</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="testOwnerId" label="Test Owner">
                <Select placeholder="Select test owner" allowClear showSearch optionFilterProp="children">
                  {users.map(u => (
                    <Select.Option key={u.id} value={u.id}>
                      {u.displayName || u.username} ({u.email})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="teamOwnerId" label="Team Owner">
                <Select placeholder="Select team owner" allowClear showSearch optionFilterProp="children">
                  {users.map(u => (
                    <Select.Option key={u.id} value={u.id}>
                      {u.displayName || u.username} ({u.email})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="userId" label="User">
                <Select placeholder="Select user" allowClear showSearch optionFilterProp="children">
                  {users.map(u => (
                    <Select.Option key={u.id} value={u.id}>
                      {u.displayName || u.username} ({u.email})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Manage Servers Modal (SUPER_ADMIN only) */}
      <Modal
        title={
          <Space>
            <span>Manage Servers</span>
            <Text type="secondary">({selectedCluster?.name})</Text>
          </Space>
        }
        open={manageServersVisible}
        onCancel={() => setManageServersVisible(false)}
        footer={null}
        width={900}
      >
        <Spin spinning={loadingServers}>
          {/* Current Servers */}
          <div style={{ marginBottom: 24 }}>
            <Title level={5}>Current Servers ({selectedCluster?.servers?.length || 0})</Title>
            {selectedCluster?.servers && selectedCluster.servers.length > 0 ? (
              <Row gutter={[12, 12]}>
                {selectedCluster.servers.map((s) => {
                  const serverStatusConfig: Record<string, { color: string; text: string }> = {
                    ONLINE: { color: 'green', text: 'Online' },
                    OFFLINE: { color: 'default', text: 'Offline' },
                    MAINTENANCE: { color: 'orange', text: 'Maintenance' },
                  }
              const serverStatus = serverStatusConfig[s.server?.status || 'ONLINE'] || serverStatusConfig.ONLINE
                  const gpuModels = s.server?.gpus 
                    ? [...new Set(s.server.gpus.map(g => g.model))].join(', ')
                    : 'N/A'
                  
                  return (
                    <Col key={s.server.id} span={8}>
                      <Card
                        size="small"
                        actions={[
                          <Tooltip title="Remove" key="remove">
                            <DeleteOutlined 
                              style={{ color: '#ff4d4f' }}
                              onClick={() => handleRemoveServer(s.server.id)}
                            />
                          </Tooltip>,
                        ]}
                      >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          {/* Header: Name + Status */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ fontSize: 14 }}>{s.server.name}</Text>
                            <Badge status={serverStatus.color as any} text={serverStatus.text} />
                          </div>
                          
                          {/* IP Address */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>IP:</Text>
                            <Text code style={{ fontSize: 12 }}>{s.server.ipAddress || 'N/A'}</Text>
                          </div>
                          
                          {/* Configuration */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            <Tag color="blue" style={{ margin: 0 }}>
                              CPU: {s.server.cpuCores || 'N/A'}
                            </Tag>
                            <Tag color="purple" style={{ margin: 0 }}>
                              RAM: {s.server.totalMemory || 'N/A'}GB
                            </Tag>
                          </div>
                          
                          {/* GPU Info */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            <Tag color="cyan" style={{ margin: 0 }}>
                              GPU: {s.server.gpuCount}
                            </Tag>
                            {s.role && <Tag color="gold" style={{ margin: 0 }}>{s.role}</Tag>}
                            <Tag color="green" style={{ margin: 0 }}>P{s.priority}</Tag>
                          </div>
                          
                          {/* GPU Models */}
                          {gpuModels && gpuModels !== 'N/A' && (
                            <Text type="secondary" style={{ fontSize: 11 }} ellipsis>
                              {gpuModels}
                            </Text>
                          )}
                        </Space>
                      </Card>
                    </Col>
                  )
                })}
              </Row>
            ) : (
              <Empty description="No servers" />
            )}
          </div>

          {/* Add Server Form */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <Title level={5}>Add Server</Title>
            <Form
              form={serverForm}
              layout="inline"
              onFinish={handleAddServer}
              style={{ gap: 12 }}
            >
              <Form.Item
                name="serverId"
                rules={[{ required: true, message: 'Please select a server' }]}
                style={{ marginBottom: 0, flex: 2 }}
              >
                <Select
                  placeholder="Select server"
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {availableServers.map((s) => (
                    <Select.Option key={s.id} value={s.id}>
                      {s.name} ({s.hostname || s.ipAddress}) - GPU: {s.gpuCount}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="priority"
                initialValue={1}
                style={{ marginBottom: 0, width: 100 }}
              >
                <Input type="number" min={1} max={100} placeholder="Priority" />
              </Form.Item>
              <Form.Item
                name="role"
                style={{ marginBottom: 0, width: 120 }}
              >
                <Select placeholder="Role" allowClear>
                  <Select.Option value="MASTER">Master</Select.Option>
                  <Select.Option value="WORKER">Worker</Select.Option>
                  <Select.Option value="STORAGE">Storage</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit">
                  Add
                </Button>
              </Form.Item>
            </Form>
            {availableServers.length === 0 && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                No available servers. Please create servers in Server Management first.
              </Text>
            )}
          </div>
        </Spin>
      </Modal>

      <style>{`
        .cluster-card .ant-card-actions {
          background: #fafafa;
        }
        .cluster-card .ant-card-actions > li {
          margin: 12px 0;
        }
      `}</style>
    </div>
  )
}

export default Clusters