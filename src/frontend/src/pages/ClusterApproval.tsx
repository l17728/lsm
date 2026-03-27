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
  PENDING: { color: 'gold', text: 'Pending Approval' },
  APPROVED: { color: 'green', text: 'Approved' },
  REJECTED: { color: 'red', text: 'Rejected' },
  ACTIVE: { color: 'blue', text: 'In Use' },
  COMPLETED: { color: 'default', text: 'Completed' },
  CANCELLED: { color: 'default', text: 'Cancelled' },
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
      message.error('Failed to load pending approval list')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (reservation: ClusterReservation) => {
    setProcessing(true)
    try {
      await clusterReservationApi.approve(reservation.id)
      message.success('Reservation approved')
      loadPendingReservations()
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Approval failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedReservation) return
    
    if (!rejectReason.trim()) {
      message.warning('Please enter rejection reason')
      return
    }

    setProcessing(true)
    try {
      await clusterReservationApi.reject(selectedReservation.id, rejectReason)
      message.success('Reservation rejected')
      setRejectModalVisible(false)
      setRejectReason('')
      setSelectedReservation(null)
      loadPendingReservations()
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Operation failed')
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
      title: 'Cluster',
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
      title: 'Applicant',
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
      title: 'Reservation Time',
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
            Duration: {Math.round((new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / 3600000)} hours
          </Text>
        </Space>
      ),
    },
    {
      title: 'Purpose',
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
      title: 'Queue Position',
      dataIndex: 'queuePosition',
      key: 'queuePosition',
      render: (pos: number) => pos ? (
        <Tag color="orange">#{pos}</Tag>
      ) : '-',
    },
    {
      title: 'Submitted At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ClusterReservation) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              size="small" 
              icon={<FileTextOutlined />}
              onClick={() => openDetailModal(record)}
            />
          </Tooltip>
          <Tooltip title="Approve">
            <Button 
              type="primary" 
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApprove(record)}
              loading={processing}
            >
              Approve
            </Button>
          </Tooltip>
          <Tooltip title="Reject">
            <Button 
              danger 
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={() => openRejectModal(record)}
            >
              Reject
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
              description="Access denied"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Text type="secondary">
                Only SUPER_ADMIN can approve cluster reservations
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
          <span>Cluster Reservation Approval</span>
        </Space>
        }
        extra={
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadPendingReservations}
            loading={loading}
          >
            Refresh
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
          description="No pending reservations to approve"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
          )}
        </Spin>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Reservation Details"
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
            <Descriptions.Item label="Cluster" span={2}>
              <Space>
                <ClusterOutlined />
                <Text strong>{selectedReservation.cluster?.name}</Text>
                <Tag>{selectedReservation.cluster?.code}</Tag>
                <Tag color="blue">{selectedReservation.cluster?.type}</Tag>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Applicant">
              <Space>
                <Avatar icon={<UserOutlined />} size="small" />
                {selectedReservation.user?.username}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {selectedReservation.user?.email}
            </Descriptions.Item>
            <Descriptions.Item label="Start Time">
              {dayjs(selectedReservation.startTime).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="End Time">
              {dayjs(selectedReservation.endTime).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="Duration">
              {Math.round((new Date(selectedReservation.endTime).getTime() - new Date(selectedReservation.startTime).getTime()) / 3600000)} hours
            </Descriptions.Item>
            <Descriptions.Item label="Queue Position">
              {selectedReservation.queuePosition ? `#${selectedReservation.queuePosition}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Purpose" span={2}>
              {selectedReservation.purpose || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Submitted At" span={2}>
              {dayjs(selectedReservation.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="Reject Reservation"
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false)
          setRejectReason('')
          setSelectedReservation(null)
        }}
        onOk={handleReject}
        confirmLoading={processing}
        okText="Confirm Rejection"
        okButtonProps={{ danger: true }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Are you sure you want to reject this reservation request?</Text>
            <TextArea
              rows={4}
              placeholder="Please enter rejection reason (required)"
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