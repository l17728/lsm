/**
 * Server Reservation Approval Page
 *
 * Features:
 * - View pending server reservations
 * - Approve or reject reservations
 * - View reservation details
 * - Support i18n (Chinese/English)
 */
import { useEffect, useState } from 'react'
import { Card, Table, Tag, Button, Space, Modal, Descriptions, message, Typography, Spin, Empty, Avatar, Tooltip } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  DesktopOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { reservationApi } from '../services/reservation.service'
import { useAuthStore } from '../store/authStore'

const { Title, Text, Paragraph } = Typography

interface PendingReservation {
  id: string
  serverId: string
  serverName: string
  userId: string
  userName: string
  userEmail: string
  title: string
  description?: string
  startTime: string
  endTime: string
  priority: number
  gpuCount: number
  status: string
  createdAt: string
}

const statusConfig: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'gold', text: 'Pending Approval' },
  APPROVED: { color: 'green', text: 'Approved' },
  REJECTED: { color: 'red', text: 'Rejected' },
  ACTIVE: { color: 'blue', text: 'In Use' },
  COMPLETED: { color: 'default', text: 'Completed' },
  CANCELLED: { color: 'default', text: 'Cancelled' },
}

const priorityConfig: Record<number, { color: string; text: string }> = {
  1: { color: 'default', text: 'Low' },
  3: { color: 'blue', text: 'Normal' },
  5: { color: 'orange', text: 'Medium' },
  7: { color: 'red', text: 'High' },
  10: { color: 'magenta', text: 'Critical' },
}

const ServerApproval: React.FC = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [reservations, setReservations] = useState<PendingReservation[]>([])
  const [selectedReservation, setSelectedReservation] = useState<PendingReservation | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isAdmin = user?.role === 'ADMIN'
  const canApprove = isSuperAdmin || isAdmin

  useEffect(() => {
    if (canApprove) {
      loadPendingReservations()
    }
  }, [canApprove])

  const loadPendingReservations = async () => {
    setLoading(true)
    try {
      const response = await reservationApi.getPending()
      setReservations(response.data.data || [])
    } catch (error: any) {
      message.error(t('messages.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (reservation: PendingReservation) => {
    setProcessing(true)
    try {
      await reservationApi.approve(reservation.id)
      message.success(t('serverApproval.approveSuccess'))
      // Remove the approved reservation from local state
      setReservations(prev => prev.filter(r => r.id !== reservation.id))
    } catch (error: any) {
      message.error(error.response?.data?.error || t('serverApproval.approveFailed'))
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedReservation) return
    if (!rejectReason.trim()) {
      message.warning(t('serverApproval.rejectReasonRequired'))
      return
    }

    setProcessing(true)
    try {
      await reservationApi.reject(selectedReservation.id, rejectReason)
      message.success(t('serverApproval.rejectSuccess'))
      setRejectModalVisible(false)
      setRejectReason('')
      // Remove the rejected reservation from local state
      setReservations(prev => prev.filter(r => r.id !== selectedReservation.id))
      setSelectedReservation(null)
    } catch (error: any) {
      message.error(error.response?.data?.error || t('serverApproval.rejectFailed'))
    } finally {
      setProcessing(false)
    }
  }

  const handleViewDetail = (reservation: PendingReservation) => {
    setSelectedReservation(reservation)
    setDetailModalVisible(true)
  }

  const handleOpenRejectModal = (reservation: PendingReservation) => {
    setSelectedReservation(reservation)
    setRejectReason('')
    setRejectModalVisible(true)
  }

  const getDuration = (startTime: string, endTime: string) => {
    const start = dayjs(startTime)
    const end = dayjs(endTime)
    const totalMinutes = Math.floor(end.diff(start) / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    
    if (hours === 0) {
      return `${minutes} ${t('reservation.minutes')}`
    } else if (minutes === 0) {
      return `${hours} ${t('reservation.hours')}`
    }
    return `${hours} ${t('reservation.hours')} ${minutes} ${t('reservation.minutes')}`
  }

  const columns = [
    {
      title: t('serverApproval.server'),
      dataIndex: 'serverName',
      key: 'serverName',
      render: (name: string) => (
        <Space>
          <DesktopOutlined />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: t('serverApproval.applicant'),
      key: 'applicant',
      render: (_: any, record: PendingReservation) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <Text strong>{record.userName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.userEmail}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: t('serverApproval.reservationTime'),
      key: 'time',
      render: (_: any, record: PendingReservation) => (
        <div>
          <div>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {dayjs(record.startTime).format('MM-DD HH:mm')} - {dayjs(record.endTime).format('MM-DD HH:mm')}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('serverApproval.duration')}: {getDuration(record.startTime, record.endTime)}
          </Text>
        </div>
      ),
    },
    {
      title: t('serverApproval.title'),
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => (
        <Tooltip title={title}>
          <Text style={{ maxWidth: 150 }} ellipsis>{title}</Text>
        </Tooltip>
      ),
    },
    {
      title: t('serverApproval.gpus'),
      dataIndex: 'gpuCount',
      key: 'gpuCount',
      render: (count: number) => <Tag color="blue">{count} GPUs</Tag>,
    },
    {
      title: t('serverApproval.priority'),
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: number) => {
        const config = priorityConfig[priority] || { color: 'default', text: `P${priority}` }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: t('serverApproval.submittedAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('MM-DD HH:mm'),
    },
    {
      title: t('serverApproval.actions'),
      key: 'actions',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, record: PendingReservation) => (
        <Space size="small">
          <Tooltip title={t('serverApproval.viewDetails')}>
            <Button
              type="text"
              icon={<FileTextOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => handleApprove(record)}
            loading={processing}
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
          >
            {t('serverApproval.approve')}
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={() => handleOpenRejectModal(record)}
            loading={processing}
          >
            {t('serverApproval.reject')}
          </Button>
        </Space>
      ),
    },
  ]

  if (!canApprove) {
    return (
      <Card>
        <Empty
          description={t('serverApproval.noPermission')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    )
  }

  return (
    <div className="server-approval-page">
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <ClockCircleOutlined style={{ marginRight: 8 }} />
            {t('serverApproval.title')}
          </Title>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadPendingReservations}
            loading={loading}
          >
            {t('common.refresh')}
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={reservations}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => t('serverApproval.totalItems', { count: total }),
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('serverApproval.noPending')}
              />
            ),
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={t('serverApproval.detailTitle')}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false)
          setSelectedReservation(null)
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setDetailModalVisible(false)
            setSelectedReservation(null)
          }}>
            {t('common.close')}
          </Button>,
          <Button
            key="reject"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => {
              setDetailModalVisible(false)
              if (selectedReservation) {
                handleOpenRejectModal(selectedReservation)
              }
            }}
          >
            {t('serverApproval.reject')}
          </Button>,
          <Button
            key="approve"
            type="primary"
            icon={<CheckCircleOutlined />}
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            onClick={() => {
              if (selectedReservation) {
                handleApprove(selectedReservation)
                setDetailModalVisible(false)
              }
            }}
          >
            {t('serverApproval.approve')}
          </Button>,
        ]}
        width={700}
      >
        {selectedReservation && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label={t('serverApproval.server')} span={2}>
              <Space>
                <DesktopOutlined />
                <Text strong>{selectedReservation.serverName}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label={t('serverApproval.applicant')} span={2}>
              <Space>
                <Avatar size="small" icon={<UserOutlined />} />
                <div>
                  <Text strong>{selectedReservation.userName}</Text>
                  <br />
                  <Text type="secondary">{selectedReservation.userEmail}</Text>
                </div>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label={t('serverApproval.startTime')}>
              {dayjs(selectedReservation.startTime).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label={t('serverApproval.endTime')}>
              {dayjs(selectedReservation.endTime).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label={t('serverApproval.duration')} span={2}>
              {getDuration(selectedReservation.startTime, selectedReservation.endTime)}
            </Descriptions.Item>
            <Descriptions.Item label={t('serverApproval.gpus')}>
              {selectedReservation.gpuCount} GPUs
            </Descriptions.Item>
            <Descriptions.Item label={t('serverApproval.priority')}>
              <Tag color={priorityConfig[selectedReservation.priority]?.color || 'default'}>
                {priorityConfig[selectedReservation.priority]?.text || `P${selectedReservation.priority}`}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('serverApproval.title')} span={2}>
              {selectedReservation.title}
            </Descriptions.Item>
            <Descriptions.Item label={t('serverApproval.description')} span={2}>
              <Paragraph style={{ margin: 0 }}>
                {selectedReservation.description || '-'}
              </Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label={t('serverApproval.submittedAt')} span={2}>
              {dayjs(selectedReservation.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        title={t('serverApproval.rejectTitle')}
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false)
          setRejectReason('')
          setSelectedReservation(null)
        }}
        onOk={handleReject}
        confirmLoading={processing}
        okText={t('serverApproval.confirmReject')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
      >
        <Paragraph>
          {t('serverApproval.rejectReasonLabel')}
        </Paragraph>
        <textarea
          style={{
            width: '100%',
            minHeight: 100,
            padding: 8,
            borderRadius: 4,
            border: '1px solid #d9d9d9',
            boxSizing: 'border-box',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
          }}
          placeholder={t('serverApproval.rejectReasonPlaceholder')}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  )
}

export default ServerApproval