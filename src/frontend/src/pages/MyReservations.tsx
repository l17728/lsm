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
  { key: 'all', label: '全部', icon: <CalendarOutlined /> },
  { key: 'pending', label: '待审批', icon: <ClockCircleOutlined />, color: 'warning' },
  { key: 'approved', label: '已批准', icon: <CheckCircleOutlined />, color: 'processing' },
  { key: 'active', label: '进行中', icon: <PlayCircleOutlined />, color: 'success' },
  { key: 'completed', label: '已完成', icon: <CheckCircleOutlined /> },
  { key: 'cancelled', label: '已取消', icon: <CloseCircleOutlined />, color: 'error' },
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
      message.success('预约已取消')
      loadData()
    } catch (error) {
      message.error('取消预约失败')
    }
  }

  const handleRelease = async (id: string) => {
    try {
      await releaseReservation(id)
      message.success('预约已释放')
      loadData()
    } catch (error) {
      message.error('释放预约失败')
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

  // 统计各状态数量
  const getStatusCount = (status: string) => {
    if (status === 'all') return reservations.length
    return reservations.filter((r) => r.status === status).length
  }

  // 渲染标签页标题
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

  // 渲染空状态
  const renderEmpty = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        activeTab === 'all'
          ? '暂无预约记录'
          : `暂无${STATUS_TABS.find((t) => t.key === activeTab)?.label}的预约`
      }
    >
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => navigate('/reservations/new')}
      >
        新建预约
      </Button>
    </Empty>
  )

  // 渲染详情模态框
  const renderDetailModal = () => (
    <Modal
      title="预约详情"
      open={detailVisible}
      onCancel={() => setDetailVisible(false)}
      footer={[
        <Button key="close" onClick={() => setDetailVisible(false)}>
          关闭
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
        <Title level={4}>我的预约</Title>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/reservations/new')}
          >
            新建预约
          </Button>
          <Button onClick={() => navigate('/reservations')}>
            日历视图
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
                      showTotal={(total) => `共 ${total} 条记录`}
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