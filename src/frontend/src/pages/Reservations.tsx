import React, { useEffect, useState } from 'react'
import { Button, Space, Card, message, Typography } from 'antd'
import { PlusOutlined, CalendarOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import CalendarView from '../components/reservation/CalendarView'
import ReservationCard from '../components/reservation/ReservationCard'
import { useReservationStore } from '../store/reservationStore'
import type { Reservation, TimeSlot } from '../services/reservation.service'

const { Title } = Typography

const Reservations: React.FC = () => {
  const navigate = useNavigate()
  const [viewType, setViewType] = useState<'calendar' | 'list'>('calendar')
  
  const {
    currentDate,
    viewMode,
    selectedServerId,
    reservations,
    loading,
    availableServers,
    setCurrentDate,
    setViewMode,
    setSelectedServerId,
    fetchReservations,
    fetchAvailableServers,
    cancelReservation,
    releaseReservation,
  } = useReservationStore()

  useEffect(() => {
    loadData()
    fetchAvailableServers()
  }, [currentDate, viewMode, selectedServerId])

  const loadData = async () => {
    const start = dayjs(currentDate).startOf(viewMode).format('YYYY-MM-DD')
    const end = dayjs(currentDate).endOf(viewMode).format('YYYY-MM-DD')
    
    await fetchReservations({
      startDate: start,
      endDate: end,
      serverId: selectedServerId || undefined,
    })
  }

  const handleSlotClick = (slot: TimeSlot) => {
    // 跳转到新建预约页面，带上预填时间
    navigate('/reservations/new', {
      state: {
        serverId: slot.serverId,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    })
  }

  const handleReservationClick = (reservation: Reservation) => {
    // 可以打开详情抽屉或跳转到详情页
    message.info(`查看预约详情: ${reservation.purpose}`)
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

  return (
    <div className="reservations-page">
      <div className="page-header">
        <Title level={4}>服务器预约日历</Title>
        <Space>
          <Button
            type={viewType === 'calendar' ? 'primary' : 'default'}
            icon={<CalendarOutlined />}
            onClick={() => setViewType('calendar')}
          >
            日历视图
          </Button>
          <Button
            type={viewType === 'list' ? 'primary' : 'default'}
            icon={<UnorderedListOutlined />}
            onClick={() => setViewType('list')}
          >
            列表视图
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/reservations/new')}
          >
            新建预约
          </Button>
          <Button onClick={() => navigate('/reservations/mine')}>
            我的预约
          </Button>
        </Space>
      </div>

      {viewType === 'calendar' ? (
        <CalendarView
          viewMode={viewMode}
          currentDate={currentDate}
          reservations={reservations}
          serverId={selectedServerId || undefined}
          servers={availableServers}
          onSlotClick={handleSlotClick}
          onReservationClick={handleReservationClick}
          onDateChange={setCurrentDate}
          onViewModeChange={setViewMode}
          onServerChange={setSelectedServerId}
          loading={loading}
        />
      ) : (
        <Card className="reservations-list">
          <div className="list-header">
            <Space>
              <span>状态筛选:</span>
              {/* 可以添加筛选器 */}
            </Space>
          </div>
          <div className="list-content">
            {reservations.length > 0 ? (
              reservations.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  mode="list"
                  onClick={() => handleReservationClick(reservation)}
                  onCancel={handleCancel}
                  onRelease={handleRelease}
                />
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无预约数据
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

export default Reservations