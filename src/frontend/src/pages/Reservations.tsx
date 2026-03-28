import React, { useEffect, useState } from 'react'
import { Button, Space, Card, message, Typography, Segmented, Tooltip } from 'antd'
import { PlusOutlined, CalendarOutlined, UnorderedListOutlined, ClusterOutlined, DesktopOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import CalendarView from '../components/reservation/CalendarView'
import ReservationCard from '../components/reservation/ReservationCard'
import { useReservationStore } from '../store/reservationStore'
import type { Reservation, TimeSlot } from '../services/reservation.service'

const { Title, Text } = Typography

const Reservations: React.FC = () => {
  const { t } = useTranslation()
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
    const start = dayjs(currentDate).startOf(viewMode).toISOString()
    const end = dayjs(currentDate).endOf(viewMode).toISOString()
    
    await fetchReservations({
      startTime: start,
      endTime: end,
      serverId: selectedServerId || undefined,
    })
  }

  const handleSlotClick = (slot: TimeSlot) => {
    navigate('/reservations/new', {
      state: {
        serverId: slot.serverId,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    })
  }

  const handleReservationClick = (reservation: Reservation) => {
    message.info(`View reservation details: ${reservation.purpose || reservation.title || 'No description'}`)
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

  return (
    <div className="reservations-page">
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 16 }}>
          {t('navigation.reservations')}
        </Title>
        
        {/* Control Bar */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            {/* Left: View Type Switch */}
            <Space>
              <Text type="secondary">{t('common.view')}:</Text>
              <Segmented
                value={viewType}
                onChange={(value) => setViewType(value as 'calendar' | 'list')}
                options={[
                  {
                    value: 'calendar',
                    icon: <CalendarOutlined />,
                    label: t('clusterReservation.reservationCalendar'),
                  },
                  {
                    value: 'list',
                    icon: <UnorderedListOutlined />,
                    label: t('common.list'),
                  },
                ]}
              />
            </Space>
            
            {/* Right: Action Buttons */}
            <Space>
              <Tooltip title={t('clusterReservation.serverReservationTooltip')}>
                <Button
                  type="primary"
                  icon={<DesktopOutlined />}
                  onClick={() => navigate('/reservations/new')}
                >
                  {t('clusterReservation.newServerReservation')}
                </Button>
              </Tooltip>
              <Tooltip title={t('clusterReservation.clusterReservationTooltip')}>
                <Button
                  type="primary"
                  icon={<ClusterOutlined />}
                  onClick={() => navigate('/reservations/cluster')}
                >
                  {t('clusterReservation.newClusterReservation')}
                </Button>
              </Tooltip>
              <Button onClick={() => navigate('/reservations/mine')}>
                {t('clusterReservation.myReservations')}
              </Button>
            </Space>
          </div>
        </Card>
      </div>

      {/* Content Area - Server Reservations */}
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
          <div className="list-content">
            {reservations.length > 0 ? (
              (reservations || []).map((reservation) => (
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
                {t('common.noData')}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

export default Reservations