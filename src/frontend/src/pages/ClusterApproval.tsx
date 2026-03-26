import { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Space, Modal, Form, Input, message, Typography, Tabs, Empty, Spin, Descriptions, Avatar, Tooltip } from 'antd'
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined, 
  UserOutlined,
  ClusterOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { clusterReservationApi } from '../services/api'
import { useAuthStore } from '../store/authStore'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface ClusterReservation {
  id: string
  clusterId: string
  userId: string
  startTime: string
  endTime: string
  purpose?: string
  status: string
  queuePosition?: number
  createdAt: string
  cluster?: {
    id: string
    name: string
    code: string
    type: string
    status: string
    totalServers: number
    totalGpus: number
  }
  user?: {
    id: string
    username: string
    email: string
    role: string
  }
}

const statusConfig: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'gold', text: '待审批' },
  APPROVED: { color: 'green', text: '已批准' },
  REJECTED: { color: 'red', text: '已拒绝' },
  ACTIVE: { color: 'blue', text: '使用中' },
  COMPLETED: { color: 'default', text: '已完成' },
  CANCELLED: { color: 'default', text: '已取消' },
}

const ClusterApproval: React.FC = () => {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [reservations, setReservations] = useState<ClusterReservation[]>([])
  const [selectedReservation, setSelectedReservation] = useState<ClusterReservation | null>(null)
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (isSuperAdmin) {
      loadPendingReservations()
    }
  }, [isSuperAdmin])

  const loadPendingReservations = async () => {
    setLoading(true)
    try {
      const response = await clusterReservationApi.getPending()
      setReservations(response.data.data || [])
    } catch (error: any) {
      message.error('加载待审批列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (reservation: ClusterReservation) => {
    setProcessing(true)
    try {
      await clusterReservationApi.approve(reservation.id)
      message.success('预约已批准')
      loadPendingReservations()
    } catch (error: any) {
      message.error(error.response?.data?.error || '审批失败')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedReservation) return
    
    if (!rejectReason.trim()) {
      message.warning('请填写拒绝原因')
      return
    }

    setProcessing(true)
    try {
      await clusterReservationApi.reject(selectedReservation.id, rejectReason)
      message.success('已拒绝该预约')
      setRejectModalVisible(false)
      setRejectReason('')
      setSelectedReservation(null)
      loadPendingReservations()
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败')
    } finally {
      setProcessing(false)
    }
  }

  const openRejectModal = (reservation: ClusterReservation) => {
    setSelectedReservation(reservation)
    setRejectReason('')
    setRejectModalVisible(true)
  }

  const openDetailModal = (reservation: ClusterReservation) => {
    setSelectedReservation(reservation)
    setDetailModalVisible(true)
  }

  const columns = [
    {
      title: '集群',
      dataIndex: ['cluster', 'name'],
      key: 'cluster',
      render: (name: string, record: ClusterReservation) => (
        <Space>
          <ClusterOutlined />
          <div>
            <Text strong>{name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.cluster?.code} · {record.cluster?.type}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '申请人',
      dataIndex: ['user', 'username'],
      key: 'user',
      render: (username: string, record: ClusterReservation) => (
        <Space>
          <Avatar icon={<UserOutlined />} size="small" />
          <div>
            <Text>{username}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.user?.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '预约时间',
      key: 'time',
      render: (_: any, record: ClusterReservation) => (
        <Space direction="vertical" size="small">
          <div>
            <CalendarOutlined style={{ marginRight: 4 }} />
            <Text>
              {dayjs(record.startTime).format('MM-DD HH:mm')} - {dayjs(record.endTime).format('MM-DD HH:mm')}
            </Text>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            时长: {Math.round((new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / 3600000)} 小时
          </Text>
        </Space>
      ),
    },
    {
      title: '用途',
      dataIndex: 'purpose',
      key: 'purpose',
      ellipsis: true,
      render: (purpose: string) => (
        <Tooltip title={purpose}>
          <Text ellipsis style={{ maxWidth: 200 }}>
            {purpose || '-'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '队列位置',
      dataIndex: 'queuePosition',
      key: 'queuePosition',
      render: (pos: number) => pos ? (
        <Tag color="orange">#{pos}</Tag>
      ) : '-',
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: ClusterReservation) => (
        <Space>
          <Tooltip title="查看详情">
            <Button 
              size="small" 
              icon={<FileTextOutlined />}
              onClick={() => openDetailModal(record)}
            />
          </Tooltip>
          <Tooltip title="批准">
            <Button 
              type="primary" 
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApprove(record)}
              loading={processing}
            >
              批准
            </Button>
          </Tooltip>
          <Tooltip title="拒绝">
            <Button 
              danger 
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={() => openRejectModal(record)}
            >
              拒绝
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  if (!isSuperAdmin) {
    return (
      <Card>
        <Empty
          description="无权限访问此页面"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Text type="secondary">
            仅 SUPER_ADMIN 可以审批集群预约
          </Text>
        </Empty>
      </Card>
    )
  }

  return (
    <div className="cluster-approval-page">
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            <span>集群预约审批</span>
          </Space>
        }
        extra={
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadPendingReservations}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        <Spin spinning={loading}>
          {reservations.length > 0 ? (
            <Table
              columns={columns}
              dataSource={reservations}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          ) : (
            <Empty
              description="暂无待审批的预约"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Spin>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="预约详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false)
          setSelectedReservation(null)
        }}
        footer={null}
        width={600}
      >
        {selectedReservation && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="集群" span={2}>
              <Space>
                <ClusterOutlined />
                <Text strong>{selectedReservation.cluster?.name}</Text>
                <Tag>{selectedReservation.cluster?.code}</Tag>
                <Tag color="blue">{selectedReservation.cluster?.type}</Tag>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="申请人">
              <Space>
                <Avatar icon={<UserOutlined />} size="small" />
                {selectedReservation.user?.username}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">
              {selectedReservation.user?.email}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {dayjs(selectedReservation.startTime).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {dayjs(selectedReservation.endTime).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="时长">
              {Math.round((new Date(selectedReservation.endTime).getTime() - new Date(selectedReservation.startTime).getTime()) / 3600000)} 小时
            </Descriptions.Item>
            <Descriptions.Item label="队列位置">
              {selectedReservation.queuePosition ? `#${selectedReservation.queuePosition}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="用途说明" span={2}>
              {selectedReservation.purpose || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="提交时间" span={2}>
              {dayjs(selectedReservation.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="拒绝预约"
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false)
          setRejectReason('')
          setSelectedReservation(null)
        }}
        onOk={handleReject}
        confirmLoading={processing}
        okText="确认拒绝"
        okButtonProps={{ danger: true }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>确定要拒绝该预约申请吗？</Text>
          <TextArea
            rows={4}
            placeholder="请输入拒绝原因（必填）"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={500}
            showCount
          />
        </Space>
      </Modal>
    </div>
  )
}

export default ClusterApproval