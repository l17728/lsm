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
import { clusterApi, clusterReservationApi } from '../services/api'
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
  servers?: Array<{
    server: {
      id: string
      name: string
      hostname: string
      ipAddress: string
      gpuCount: number
      gpus: any[]
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
  AVAILABLE: { color: 'green', icon: <CheckCircleOutlined />, text: '空闲' },
  ALLOCATED: { color: 'blue', icon: <PlayCircleOutlined />, text: '使用中' },
  RESERVED: { color: 'orange', icon: <ClockCircleOutlined />, text: '已预约' },
  MAINTENANCE: { color: 'red', icon: <CloseCircleOutlined />, text: '维护中' },
  OFFLINE: { color: 'default', icon: <CloseCircleOutlined />, text: '离线' },
}

const reservationStatusConfig: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'gold', text: '待审批' },
  APPROVED: { color: 'green', text: '已批准' },
  REJECTED: { color: 'red', text: '已拒绝' },
  ACTIVE: { color: 'blue', text: '使用中' },
  COMPLETED: { color: 'default', text: '已完成' },
  CANCELLED: { color: 'default', text: '已取消' },
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

  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER'

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [clustersRes, statsRes, reservationsRes] = await Promise.all([
        clusterApi.getAll(),
        clusterApi.getStats(),
        clusterReservationApi.getMy().catch(() => ({ data: { data: [] } })),
      ])
      
      setClusters(clustersRes.data.data || [])
      setStats(statsRes.data.data)
      setMyReservations(reservationsRes.data.data || [])
    } catch (error: any) {
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  // Check if user has reservation for a cluster
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
      
      message.success('预约申请已提交，等待审批')
      setReserveVisible(false)
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error || '预约失败')
    }
  }

  // Release reservation
  const handleRelease = async (reservationId: string) => {
    try {
      await clusterReservationApi.release(reservationId)
      message.success('资源已释放')
      loadData()
    } catch (error: any) {
      message.error('释放失败')
    }
  }

  // Cancel reservation
  const handleCancel = async (reservationId: string) => {
    try {
      await clusterReservationApi.cancel(reservationId)
      message.success('预约已取消')
      loadData()
    } catch (error: any) {
      message.error('取消失败')
    }
  }

  // View cluster detail with servers
  const handleViewDetail = async (cluster: Cluster) => {
    try {
      const response = await clusterApi.getById(cluster.id)
      setSelectedCluster(response.data.data)
      setDetailVisible(true)
    } catch (error: any) {
      message.error('加载详情失败')
    }
  }

  // View servers in cluster (drill down)
  const handleViewServers = async (cluster: Cluster) => {
    try {
      const response = await clusterApi.getById(cluster.id)
      setSelectedCluster(response.data.data)
      setServersVisible(true)
    } catch (error: any) {
      message.error('加载服务器列表失败')
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
    })
    setCreateModalVisible(true)
  }

  // Delete cluster
  const handleDelete = async (id: string) => {
    try {
      await clusterApi.delete(id)
      message.success('集群已删除')
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败')
    }
  }

  // Submit create/edit
  const handleSubmit = async (values: any) => {
    try {
      if (editingCluster) {
        await clusterApi.update(editingCluster.id, values)
        message.success('集群已更新')
      } else {
        await clusterApi.create(values)
        message.success('集群已创建')
      }
      setCreateModalVisible(false)
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败')
    }
  }

  // Render cluster card
  const renderClusterCard = (cluster: Cluster) => {
    const myReservation = getMyReservationForCluster(cluster.id)
    const statusInfo = statusConfig[cluster.status] || statusConfig.OFFLINE
    const isAvailable = cluster.status === 'AVAILABLE'
    const isReservedByMe = myReservation && myReservation.status === 'APPROVED'

    const actions = [
      <Tooltip title="查看详情" key="detail">
        <EyeOutlined onClick={() => handleViewDetail(cluster)} />
      </Tooltip>,
      <Tooltip title="查看服务器" key="servers">
        <DesktopOutlined onClick={() => handleViewServers(cluster)} />
      </Tooltip>,
    ]

    // Add reservation action based on status
    if (isAvailable) {
      actions.push(
        <Tooltip title="申请预约" key="reserve">
          <FormOutlined onClick={() => handleReserve(cluster)} />
        </Tooltip>
      )
    } else if (isReservedByMe) {
      actions.push(
        <Tooltip title="释放资源" key="release">
          <CloseCircleOutlined onClick={() => handleRelease(myReservation!.id)} />
        </Tooltip>
      )
    } else if (myReservation?.status === 'PENDING') {
      actions.push(
        <Tooltip title="取消预约" key="cancel">
          <CloseCircleOutlined onClick={() => handleCancel(myReservation!.id)} />
        </Tooltip>
      )
    } else {
      actions.push(
        <Tooltip title="不可预约" key="unavailable">
          <ClockCircleOutlined style={{ color: '#999' }} />
        </Tooltip>
      )
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
                  <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
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
                <Text type="secondary">{cluster.assignee.username}</Text>
              </div>
            )}
            
            {/* Time info */}
            {cluster.assignmentEnd && (
              <div>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  至 {dayjs(cluster.assignmentEnd).format('MM-DD HH:mm')}
                </Text>
              </div>
            )}
            
            {/* My reservation queue info */}
            {myReservation && myReservation.queuePosition && (
              <div>
                <HourglassOutlined style={{ marginRight: 4, color: '#faad14' }} />
                <Text type="warning" style={{ fontSize: 12 }}>
                  队列位置: #{myReservation.queuePosition}
                </Text>
              </div>
            )}
            
            {/* Resources */}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
              <Space split={<Text type="secondary">|</Text>}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <DesktopOutlined /> {cluster.totalServers} 台
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
        集群管理
      </Title>

      {/* Stats Cards */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="集群总数" value={stats.total} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic 
                title="空闲" 
                value={stats.byStatus.available} 
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic 
                title="使用中" 
                value={stats.byStatus.allocated}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="服务器总数" value={stats.resources.totalServers} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="GPU 总数" value={stats.resources.totalGpus} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="CPU 核心" value={stats.resources.totalCpuCores} />
            </Card>
          </Col>
        </Row>
      )}

      {/* Toolbar */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          {isSuperAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              创建集群
            </Button>
          )}
          <Button icon={<SyncOutlined />} onClick={loadData}>
            刷新
          </Button>
          <Button 
            icon={<CalendarOutlined />} 
            onClick={() => navigate('/reservations')}
          >
            查看日历
          </Button>
        </Space>
      </div>

      {/* Cluster Cards */}
      <Spin spinning={loading}>
        {clusters.length > 0 ? (
          <Row gutter={[16, 16]}>
            {clusters.map(renderClusterCard)}
          </Row>
        ) : (
          <Empty description="暂无集群数据" />
        )}
      </Spin>

      {/* Reservation Modal */}
      <Modal
        title={`预约集群: ${selectedCluster?.name}`}
        open={reserveVisible}
        onCancel={() => setReserveVisible(false)}
        onOk={() => reserveForm.submit()}
        okText="提交申请"
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
                <span>AI 智能推荐</span>
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
                    { value: 60, label: '1 小时' },
                    { value: 120, label: '2 小时' },
                    { value: 240, label: '4 小时' },
                    { value: 480, label: '8 小时' },
                  ]}
                />
                <Button 
                  size="small" 
                  icon={<ThunderboltOutlined />}
                  loading={loadingRecommendations}
                  onClick={() => fetchAiRecommendations(selectedDuration)}
                >
                  获取推荐
                </Button>
              </Space>
            }
          >
            {loadingRecommendations ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin tip="AI 正在分析最佳时间..." />
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
                          {index === 0 ? '最佳' : `推荐 ${index + 1}`}
                        </Tag>
                        <Text strong>
                          {dayjs(rec.startTime).format('MM-DD HH:mm')} - {dayjs(rec.endTime).format('HH:mm')}
                        </Text>
                      </Space>
                      <Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          置信度: {(rec.confidence * 100).toFixed(0)}%
                        </Text>
                        <Tag color="green">{rec.score}分</Tag>
                      </Space>
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      {rec.reasons.slice(0, 2).map((reason, i) => (
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
                点击"获取推荐"按钮，AI 将为您分析最佳预约时段
              </div>
            )}
          </Card>

          <Form.Item
            name="timeRange"
            label="使用时间"
            rules={[{ required: true, message: '请选择使用时间' }]}
          >
            <RangePicker
              showTime
              style={{ width: '100%' }}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
          <Form.Item
            name="purpose"
            label="用途说明"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="请简要描述使用目的..."
              maxLength={500}
              showCount
            />
          </Form.Item>
          <div style={{ color: '#faad14', fontSize: 12 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            预约需要 SUPER_ADMIN 审批，如时间冲突将进入等待队列
          </div>
        </Form>
      </Modal>

      {/* Cluster Detail Modal */}
      <Modal
        title={selectedCluster?.name || '集群详情'}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedCluster && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="编码">{selectedCluster.code}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={typeColors[selectedCluster.type]}>{selectedCluster.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusConfig[selectedCluster.status]?.color}>
                  {statusConfig[selectedCluster.status]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建者">
                {selectedCluster.creator?.username || '-'}
              </Descriptions.Item>
              {selectedCluster.assignee && (
                <>
                  <Descriptions.Item label="使用者">
                    <UserOutlined style={{ marginRight: 4 }} />
                    {selectedCluster.assignee.username}
                  </Descriptions.Item>
                  <Descriptions.Item label="结束时间">
                    {selectedCluster.assignmentEnd && 
                      dayjs(selectedCluster.assignmentEnd).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="描述" span={2}>
                {selectedCluster.description || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
              资源配置
            </Title>
            <Row gutter={8}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="服务器" value={selectedCluster.totalServers} suffix="台" />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="GPU" value={selectedCluster.totalGpus} suffix="块" />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="CPU" value={selectedCluster.totalCpuCores} suffix="核" />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="内存" value={selectedCluster.totalMemory} suffix="GB" />
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
            <span>服务器列表</span>
            <Text type="secondary">({selectedCluster?.name})</Text>
          </Space>
        }
        open={serversVisible}
        onCancel={() => setServersVisible(false)}
        footer={
          <Button onClick={() => setServersVisible(false)}>关闭</Button>
        }
        width={800}
      >
        {selectedCluster?.servers && selectedCluster.servers.length > 0 ? (
          <Row gutter={[12, 12]}>
            {selectedCluster.servers.map((s) => (
              <Col key={s.server.id} span={8}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => handleServerClick(s.server.id)}
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text strong>{s.server.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {s.server.hostname || s.server.ipAddress}
                    </Text>
                    <Space>
                      <Tag>GPU: {s.server.gpuCount}</Tag>
                      {s.role && <Tag color="blue">{s.role}</Tag>}
                    </Space>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="该集群暂无服务器" />
        )}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button 
            icon={<UpOutlined />} 
            onClick={() => setServersVisible(false)}
          >
            返回集群列表
          </Button>
        </div>
      </Modal>

      {/* Create/Edit Cluster Modal */}
      <Modal
        title={editingCluster ? '编辑集群' : '创建集群'}
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {!editingCluster && (
            <Form.Item
              name="code"
              label="集群编码"
              rules={[
                { required: true, message: '请输入集群编码' },
                { pattern: /^[A-Z0-9_-]+$/, message: '编码只能包含大写字母、数字、下划线或连字符' },
              ]}
            >
              <Input placeholder="例如: CLUSTER_01" />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label="集群名称"
            rules={[{ required: true, message: '请输入集群名称' }]}
          >
            <Input placeholder="例如: 训练集群A" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} placeholder="集群描述..." />
          </Form.Item>
          <Form.Item
            name="type"
            label="集群类型"
            rules={[{ required: true, message: '请选择集群类型' }]}
          >
            <Select placeholder="选择类型">
              <Select.Option value="COMPUTE">计算</Select.Option>
              <Select.Option value="TRAINING">训练</Select.Option>
              <Select.Option value="INFERENCE">推理</Select.Option>
              <Select.Option value="GENERAL">通用</Select.Option>
              <Select.Option value="CUSTOM">自定义</Select.Option>
            </Select>
          </Form.Item>
        </Form>
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