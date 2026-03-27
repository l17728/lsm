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
} from 'antd'
import {
  PlusOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ReservationCard from '../components/reservation/ReservationCard'
import { useReservationStore } from '../store/reservationStore'
import type { Reservation } from '../services/reservation.service'

const { Title, Text } = Typography

const STATUS_TABS = [
  { key: 'all', label: 'All', icon: <CalendarOutlined /> },
  { key: 'pending', label: 'Pending Approval', icon: <ClockCircleOutlined />, color: 'warning' },
  { key: 'approved', label: 'Approved', icon: <CheckCircleOutlined />, color: 'processing' },
  { key: 'active', label: 'Active', icon: <PlayCircleOutlined />, color: 'success' },
  { key: 'completed', label: 'Completed', icon: <CheckCircleOutlined /> },
  { key: 'cancelled', label: 'Cancelled', icon: <CloseCircleOutlined />, color: 'error' },
]

const MyReservations: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)

  const {
    reservations,
    loading,
    pagination,
    fetchMyReservations,
    cancelReservation,
    releaseReservation,
  } = useReservationStore()

  useEffect(() => {
    loadData()
  }, [activeTab, pagination.page])

  const loadData = (page = 1) => {
    fetchMyReservations({
      status: activeTab === 'all' ? undefined : activeTab,
      page,
      limit: 10,
    })
  }

  const handleTabChange = (key: string) => {
    setActiveTab(key)
  }

  const handleCancel = async (id: string) => {
    try {
      await cancelReservation(id)
      message.success('Reservation cancelled')
      loadData()
    } catch (error) {
      message.error('Failed to cancel reservation')
    }
  }

  const handleRelease = async (id: string) => {
    try {
      await releaseReservation(id)
      message.success('Reservation released')
      loadData()
    } catch (error) {
      message.error('Failed to release reservation')
    }
  }

  const handleViewDetail = (id: string) => {
    const reservation = reservations.find((r) => r.id === id)
    if (reservation) {
      setSelectedReservation(reservation)
      setDetailVisible(true)
    }
  }

  const handlePageChange = (page: number) => {
    loadData(page)
  }

  // Count reservations by status
  const getStatusCount = (status: string) => {
    if (status === 'all') return reservations.length
    return reservations.filter((r) => r.status === status).length
  }

  // Render tab title
  const renderTabTitle = (tab: typeof STATUS_TABS[0]) => {
    const count = getStatusCount(tab.key)
    return (
      <span>
        {tab.icon} {tab.label}
        {count > 0 && (
          <Tag
            color={tab.color || 'default'}
            style={{ marginLeft: 8, borderRadius: 10 }}
          >
            {count}
          </Tag>
        )}
      </span>
    )
  }

  // Render empty state
  const renderEmpty = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        activeTab === 'all'
          ? 'No reservation records'
          : `No ${STATUS_TABS.find((t) => t.key === activeTab)?.label} reservations`
      }
    >
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => navigate('/reservations/new')}
      >
        New Reservation
      </Button>
    </Empty>
  )

  // Render detail modal
  const renderDetailModal = () => (
    <Modal
      title="Reservation Details"
      open={detailVisible}
      onCancel={() => setDetailVisible(false)}
      footer={[
        <Button key="close" onClick={() => setDetailVisible(false)}>
          Close
        </Button>,
      ]}
      width={600}
    >
      {selectedReservation && (
        <ReservationCard
          reservation={selectedReservation}
          mode="detail"
          showActions={false}
        />
      )}
    </Modal>
  )

  return (
    <div className="my-reservations-page">
      <div className="page-header">
        <Title level={4}>My Reservations</Title>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/reservations/new')}
          >
            New Reservation
          </Button>
          <Button onClick={() => navigate('/reservations')}>
            Calendar View
          </Button>
        </Space>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={STATUS_TABS.map((tab) => ({
            key: tab.key,
            label: renderTabTitle(tab),
          }))}
        />

        <Spin spinning={loading}>
          <div className="reservations-list">
            {reservations.length > 0 ? (
              <>
                {reservations.map((reservation) => (
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
                  <div className="pagination-wrapper">
                    <Pagination
                      current={pagination.page}
                      pageSize={pagination.limit}
                      total={pagination.total}
                      onChange={handlePageChange}
                      showSizeChanger={false}
                       showTotal={(total) => `Total: ${total} records`}
                    />
                  </div>
                )}
              </>
            ) : (
              renderEmpty()
            )}
          </div>
        </Spin>
      </Card>

      {renderDetailModal()}
    </div>
  )
}

export default MyReservations