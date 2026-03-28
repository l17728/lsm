import React, { useEffect, useState } from 'react'
import {
  Card,
  Tabs,
  Button,
  Space,
  Typography,
  Empty,
  Spin,
  Tag,
  Modal,
  message,
  Pagination,
  Descriptions,
  Divider,
} from 'antd'
import {
  PlusOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CalendarOutlined,
  DesktopOutlined,
  ClusterOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import ReservationCard from '../components/reservation/ReservationCard'
import { useReservationStore } from '../store/reservationStore'
import { clusterReservationApi } from '../services/api'
import type { Reservation } from '../services/reservation.service'

const { Title, Text } = Typography

interface ClusterReservation {
  id: string
  clusterId: string
  cluster: {
    id: string
    name: string
    code: string
    type: string
    status: string
  }
  startTime: string
  endTime: string
  purpose: string
  status: string
  queuePosition: number | null
  createdAt: string
  updatedAt: string
}

const MyReservations: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('server')
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [selectedClusterReservation, setSelectedClusterReservation] = useState<ClusterReservation | null>(null)
  
  // Cluster reservations state
  const [clusterReservations, setClusterReservations] = useState<ClusterReservation[]>([])
  const [clusterLoading, setClusterLoading] = useState(false)

  const {
    reservations,
    loading,
    pagination,
    fetchMyReservations,
    cancelReservation,
    releaseReservation,
  } = useReservationStore()

  useEffect(() => {
    if (activeTab === 'server') {
      loadData()
    } else {
      loadClusterReservations()
    }
  }, [activeTab, pagination.page])

  const loadData = (page = 1) => {
    fetchMyReservations({
      page,
      limit: 10,
    })
  }

  const loadClusterReservations = async () => {
    setClusterLoading(true)
    try {
      const response = await clusterReservationApi.getMy()
      setClusterReservations(response.data.data || [])
    } catch (error) {
      console.error('Failed to load cluster reservations:', error)
      message.error(t('messages.operationFailed'))
    } finally {
      setClusterLoading(false)
    }
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
  }

  const handleCancel = async (id: string) => {
    try {
      await cancelReservation(id)
      message.success(t('messages.operationSuccess'))
      loadData()
    } catch (error) {
      message.error(t('messages.operationFailed'))
    }
  }

  const handleRelease = async (id: string) => {
    try {
      await releaseReservation(id)
      message.success(t('messages.operationSuccess'))
      loadData()
    } catch (error) {
      message.error(t('messages.operationFailed'))
    }
  }

  const handleCancelCluster = async (id: string) => {
    try {
      await clusterReservationApi.cancel(id)
      message.success(t('messages.operationSuccess'))
      loadClusterReservations()
    } catch (error) {
      message.error(t('messages.operationFailed'))
    }
  }

  const handleReleaseCluster = async (id: string) => {
    try {
      await clusterReservationApi.release(id)
      message.success(t('messages.operationSuccess'))
      loadClusterReservations()
    } catch (error) {
      message.error(t('messages.operationFailed'))
    }
  }

  const handleViewDetail = (id: string) => {
    const reservation = reservations.find((r) => r.id === id)
    if (reservation) {
      setSelectedReservation(reservation)
      setSelectedClusterReservation(null)
      setDetailVisible(true)
    }
  }

  const handleViewClusterDetail = (id: string) => {
    const reservation = clusterReservations.find((r) => r.id === id)
    if (reservation) {
      setSelectedClusterReservation(reservation)
      setSelectedReservation(null)
      setDetailVisible(true)
    }
  }

  const handlePageChange = (page: number) => {
    loadData(page)
  }

  // Get status config
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; text: string }> = {
      PENDING: { color: 'orange', text: t('clusterReservation.pendingApproval') },
      APPROVED: { color: 'blue', text: t('clusterReservation.approved') },
      REJECTED: { color: 'red', text: t('clusterReservation.rejected') },
      ACTIVE: { color: 'green', text: t('clusterReservation.active') },
      COMPLETED: { color: 'default', text: t('clusterReservation.completed') },
      CANCELLED: { color: 'default', text: t('clusterReservation.cancelled') },
    }
    return configs[status] || { color: 'default', text: status }
  }

  // Render server reservation detail
  const renderServerDetail = () => {
    if (!selectedReservation) return null
    return (
      <ReservationCard
        reservation={selectedReservation}
        mode="detail"
        showActions={false}
      />
    )
  }

  // Render cluster reservation detail
  const renderClusterDetail = () => {
    if (!selectedClusterReservation) return null
    const statusConfig = getStatusConfig(selectedClusterReservation.status)
    return (
      <div>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label={t('clusterReservation.title')} span={2}>
            <Space>
              <ClusterOutlined />
              <Text strong>{selectedClusterReservation.cluster.name}</Text>
              <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label={t('clusterReservation.startTime')}>
            {dayjs(selectedClusterReservation.startTime).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label={t('clusterReservation.endTime')}>
            {dayjs(selectedClusterReservation.endTime).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label={t('clusterReservation.duration')} span={2}>
            {dayjs(selectedClusterReservation.endTime).diff(dayjs(selectedClusterReservation.startTime), 'hour', true).toFixed(1)} {t('clusterReservation.hours')}
          </Descriptions.Item>
          <Descriptions.Item label={t('clusterReservation.purpose')} span={2}>
            {selectedClusterReservation.purpose || '-'}
          </Descriptions.Item>
          {selectedClusterReservation.queuePosition && (
            <Descriptions.Item label={t('clusterReservation.queuePosition')} span={2}>
              <Tag color="orange">#{selectedClusterReservation.queuePosition}</Tag>
            </Descriptions.Item>
          )}
          <Descriptions.Item label={t('common.createdAt')}>
            {dayjs(selectedClusterReservation.createdAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.updatedAt')}>
            {dayjs(selectedClusterReservation.updatedAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
        </Descriptions>
        
        <Divider />
        
        <Space>
          {['PENDING', 'APPROVED'].includes(selectedClusterReservation.status) && (
            <Button danger onClick={() => {
              handleCancelCluster(selectedClusterReservation.id)
              setDetailVisible(false)
            }}>
              {t('common.cancel')}
            </Button>
          )}
          {['APPROVED', 'ACTIVE'].includes(selectedClusterReservation.status) && (
            <Button type="primary" onClick={() => {
              handleReleaseCluster(selectedClusterReservation.id)
              setDetailVisible(false)
            }}>
              {t('gpu.release')}
            </Button>
          )}
        </Space>
      </div>
    )
  }

  // Render cluster reservation card
  const renderClusterReservationCard = (reservation: ClusterReservation) => {
    const statusConfig = getStatusConfig(reservation.status)
    return (
      <Card
        key={reservation.id}
        size="small"
        style={{ marginBottom: 16 }}
        hoverable
        onClick={() => handleViewClusterDetail(reservation.id)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Space direction="vertical" size="small">
            <Space>
              <ClusterOutlined />
              <Text strong>{reservation.cluster.name}</Text>
              <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
              {reservation.queuePosition && (
                <Tag color="orange">#{reservation.queuePosition}</Tag>
              )}
            </Space>
            <Space>
              <ClockCircleOutlined style={{ color: '#999' }} />
              <Text type="secondary">
                {dayjs(reservation.startTime).format('MM-DD HH:mm')} - {dayjs(reservation.endTime).format('MM-DD HH:mm')}
              </Text>
            </Space>
            <Text type="secondary" ellipsis style={{ maxWidth: 400 }}>
              {reservation.purpose}
            </Text>
          </Space>
          <Space>
            {['PENDING', 'APPROVED'].includes(reservation.status) && (
              <Button 
                size="small" 
                danger 
                onClick={(e) => {
                  e.stopPropagation()
                  handleCancelCluster(reservation.id)
                }}
              >
                {t('common.cancel')}
              </Button>
            )}
            {['APPROVED', 'ACTIVE'].includes(reservation.status) && (
              <Button 
                size="small" 
                type="primary"
                onClick={(e) => {
                  e.stopPropagation()
                  handleReleaseCluster(reservation.id)
                }}
              >
                {t('gpu.release')}
              </Button>
            )}
          </Space>
        </div>
      </Card>
    )
  }

  return (
    <div className="my-reservations-page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Title level={3}>{t('clusterReservation.myReservations')}</Title>
        <Space>
          <Button
            type="primary"
            icon={<DesktopOutlined />}
            onClick={() => navigate('/reservations/new')}
          >
            {t('clusterReservation.newServerReservation')}
          </Button>
          <Button
            type="primary"
            icon={<ClusterOutlined />}
            onClick={() => navigate('/reservations/cluster')}
          >
            {t('clusterReservation.newClusterReservation')}
          </Button>
          <Button icon={<CalendarOutlined />} onClick={() => navigate('/reservations')}>
            {t('clusterReservation.reservationCalendar')}
          </Button>
        </Space>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            {
              key: 'server',
              label: (
                <span>
                  <DesktopOutlined />
                  {t('clusterReservation.serverReservation')}
                  {reservations.length > 0 && (
                    <Tag color="blue" style={{ marginLeft: 8, borderRadius: 10 }}>
                      {reservations.length}
                    </Tag>
                  )}
                </span>
              ),
            },
            {
              key: 'cluster',
              label: (
                <span>
                  <ClusterOutlined />
                  {t('clusterReservation.clusterReservation')}
                  {clusterReservations.length > 0 && (
                    <Tag color="green" style={{ marginLeft: 8, borderRadius: 10 }}>
                      {clusterReservations.length}
                    </Tag>
                  )}
                </span>
              ),
            },
          ]}
        />

        <Spin spinning={loading || clusterLoading}>
          {activeTab === 'server' ? (
            // Server Reservations
            <div className="reservations-list">
              {reservations.length > 0 ? (
                <>
                  {(reservations || []).map((reservation) => (
                    <ReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      mode="list"
                      onView={handleViewDetail}
                      onCancel={handleCancel}
                      onRelease={handleRelease}
                    />
                  ))}

                  {pagination.total > pagination.limit && (
                    <div style={{ marginTop: 16, textAlign: 'center' }}>
                      <Pagination
                        current={pagination.page}
                        pageSize={pagination.limit}
                        total={pagination.total}
                        onChange={handlePageChange}
                        showSizeChanger={false}
                        showTotal={(total) => t('pagination.total', { total })}
                      />
                    </div>
                  )}
                </>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('common.noData')}
                >
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/reservations/new')}
                  >
                    {t('clusterReservation.newServerReservation')}
                  </Button>
                </Empty>
              )}
            </div>
          ) : (
            // Cluster Reservations
            <div className="cluster-reservations-list">
              {clusterReservations.length > 0 ? (
                (clusterReservations || []).map((reservation) => 
                  renderClusterReservationCard(reservation)
                )
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('common.noData')}
                >
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/reservations/cluster')}
                  >
                    {t('clusterReservation.newClusterReservation')}
                  </Button>
                </Empty>
              )}
            </div>
          )}
        </Spin>
      </Card>

      {/* Detail Modal */}
      <Modal
        title={activeTab === 'server' ? t('reservation.reservationDetails') : t('clusterReservation.title')}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            {t('common.close')}
          </Button>,
        ]}
        width={600}
      >
        {activeTab === 'server' ? renderServerDetail() : renderClusterDetail()}
      </Modal>
    </div>
  )
}

export default MyReservations