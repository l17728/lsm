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
    // Redirect to new reservation page with pre-filled time
    navigate('/reservations/new', {
      state: {
        serverId: slot.serverId,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    })
  }

  const handleReservationClick = (reservation: Reservation) => {
    // Can open details drawer or navigate to details page
      message.info(`View reservation details: ${reservation.purpose}`)
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

  return (
    <div className="reservations-page">
      <div className="page-header">
        <h1>Server Reservation Calendar</h1>
        <Space>
          <Button
            type={viewType === 'calendar' ? 'primary' : 'default'}
            icon={<CalendarOutlined />}
            onClick={() => setViewType('calendar')}
          >
            Calendar View
          </Button>
          <Button
            type={viewType === 'list' ? 'primary' : 'default'}
            icon={<UnorderedListOutlined />}
            onClick={() => setViewType('list')}
          >
            List View
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/reservations/new')}
          >
            Create Reservation
          </Button>
          <Button onClick={() => navigate('/reservations/mine')}>
            My Reservations
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
              <span>              Status Filter:</span>
                // Can add filters here
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
                    No reservation data available
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

export default Reservations