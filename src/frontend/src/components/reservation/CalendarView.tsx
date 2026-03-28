import React, { useMemo, useState } from 'react'
import { Card, Tooltip, Spin, Empty, Segmented, Select, Button, Tag, Badge } from 'antd'
import { LeftOutlined, RightOutlined, ClockCircleOutlined, CalendarOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { useTranslation } from 'react-i18next'
import type { Reservation, TimeSlot } from '../../services/reservation.service'
import './CalendarView.css'

interface CalendarViewProps {
  viewMode: 'day' | 'week' | 'month'
  currentDate: Date
  reservations: Reservation[]
  serverId?: string
  servers?: { id: string; name: string }[]
  onSlotClick?: (slot: TimeSlot) => void
  onReservationClick?: (reservation: Reservation) => void
  onDateChange?: (date: Date) => void
  onViewModeChange?: (mode: 'day' | 'week' | 'month') => void
  onServerChange?: (serverId: string | null) => void
  loading?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  available: '#52c41a',
  reserved: '#faad14',
  occupied: '#1890ff',
  maintenance: '#8c8c8c',
}

const RESERVATION_STATUS_COLORS: Record<string, string> = {
  pending: '#faad14',
  approved: '#1890ff',
  active: '#52c41a',
  completed: '#8c8c8c',
  cancelled: '#ff4d4f',
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

const CalendarView: React.FC<CalendarViewProps> = ({
  viewMode,
  currentDate,
  reservations,
  serverId,
  servers = [],
  onSlotClick,
  onReservationClick,
  onDateChange,
  onViewModeChange,
  onServerChange,
  loading = false,
}) => {
  const { t } = useTranslation()
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null)

  // 计算日期范围
  const dateRange = useMemo(() => {
    const current = dayjs(currentDate)
    switch (viewMode) {
      case 'day':
        return [current]
      case 'week':
        const weekStart = current.startOf('week')
        return Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))
      case 'month':
        const monthStart = current.startOf('month').startOf('week')
        const monthEnd = current.endOf('month').endOf('week')
        const days = monthEnd.diff(monthStart, 'day') + 1
        return Array.from({ length: days }, (_, i) => monthStart.add(i, 'day'))
      default:
        return [current]
    }
  }, [currentDate, viewMode])

  // 获取指定时间段的预约
  const getReservationsForTimeSlot = (date: Dayjs, hour?: number) => {
    return reservations.filter((r) => {
      const start = dayjs(r.startTime)
      const end = dayjs(r.endTime)
      if (hour !== undefined) {
        const slotStart = date.hour(hour).minute(0)
        const slotEnd = date.hour(hour).minute(59)
        return start.isBefore(slotEnd) && end.isAfter(slotStart)
      }
      return start.isSame(date, 'day') || end.isSame(date, 'day')
    })
  }

  // 处理日期导航
  const handlePrev = () => {
    const current = dayjs(currentDate)
    let newDate: Dayjs
    switch (viewMode) {
      case 'day':
        newDate = current.subtract(1, 'day')
        break
      case 'week':
        newDate = current.subtract(1, 'week')
        break
      case 'month':
        newDate = current.subtract(1, 'month')
        break
      default:
        newDate = current
    }
    onDateChange?.(newDate.toDate())
  }

  const handleNext = () => {
    const current = dayjs(currentDate)
    let newDate: Dayjs
    switch (viewMode) {
      case 'day':
        newDate = current.add(1, 'day')
        break
      case 'week':
        newDate = current.add(1, 'week')
        break
      case 'month':
        newDate = current.add(1, 'month')
        break
      default:
        newDate = current
    }
    onDateChange?.(newDate.toDate())
  }

  const handleToday = () => {
    onDateChange?.(new Date())
  }

  // 渲染日视图
  const renderDayView = () => {
    const current = dayjs(currentDate)
    const dayReservations = getReservationsForTimeSlot(current)

    return (
      <div className="calendar-day-view">
        <div className="calendar-header">
          <div className="time-column-header">{t('reservation.time')}</div>
          <div className="reservation-column-header">
            <span>{t('reservation.reservationDetails')}</span>
            <span className="date-display">{current.format('YYYY-MM-DD dddd')}</span>
          </div>
        </div>
        <div className="calendar-body">
          {HOURS.map((hour) => {
            const hourReservations = dayReservations.filter((r) => {
              const start = dayjs(r.startTime).hour()
              const end = dayjs(r.endTime).hour()
              return hour >= start && hour < end
            })

            return (
              <div key={hour} className="calendar-row">
                <div className="time-cell">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                <div
                  className={`reservation-cell ${hoveredSlot === `day-${hour}` ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredSlot(`day-${hour}`)}
                  onMouseLeave={() => setHoveredSlot(null)}
                  onClick={() => {
                    const slot: TimeSlot = {
                      serverId: serverId || '',
                      startTime: current.hour(hour).minute(0).second(0).toDate(),
                      endTime: current.hour(hour + 1).minute(0).second(0).toDate(),
                      status: 'available',
                    }
                    onSlotClick?.(slot)
                  }}
                >
                  {hourReservations.map((r) => (
                    <Tooltip
                      key={r.id}
                      title={
                        <div>
<div><strong>{r.userName || 'Unknown'}</strong></div>
                           <div><ClockCircleOutlined /> {dayjs(r.startTime).format('HH:mm')} - {dayjs(r.endTime).format('HH:mm')}</div>
                           <div>{r.serverName || 'Unknown'} - {(r.gpuIds || []).join(', ')}</div>
                           <div>{r.purpose || ''}</div>
                        </div>
                      }
                    >
                      <div
                        className={`reservation-item status-${r.status}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onReservationClick?.(r)
                        }}
                      >
                        <Tag color={RESERVATION_STATUS_COLORS[r.status]}>
                          {t(`reservation.${r.status}`)}
                        </Tag>
                        <span className="reservation-user">{r.userName || 'Unknown'}</span>
                        <span className="reservation-purpose">{r.purpose || ''}</span>
                      </div>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // 渲染周视图
  const renderWeekView = () => {
    const weekDays = t('reservation.weekdays', { returnObjects: true }) as string[]

    return (
      <div className="calendar-week-view">
        <div className="calendar-header">
          <div className="time-column-header">{t('reservation.time')}</div>
          {dateRange.map((date) => (
            <div
              key={date.format('YYYY-MM-DD')}
              className={`day-column-header ${date.isSame(dayjs(), 'day') ? 'today' : ''}`}
            >
              <div className="day-name">{weekDays[date.day()]}</div>
              <div className="day-date">{date.format('MM/DD')}</div>
            </div>
          ))}
        </div>
        <div className="calendar-body">
          {HOURS.map((hour) => (
            <div key={hour} className="calendar-row">
              <div className="time-cell">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {dateRange.map((date) => {
                const hourReservations = getReservationsForTimeSlot(date, hour)
                const slotId = `week-${date.format('YYYY-MM-DD')}-${hour}`

                return (
                  <div
                    key={date.format('YYYY-MM-DD')}
                    className={`week-cell ${date.isSame(dayjs(), 'day') ? 'today' : ''} ${hoveredSlot === slotId ? 'hovered' : ''}`}
                    onMouseEnter={() => setHoveredSlot(slotId)}
                    onMouseLeave={() => setHoveredSlot(null)}
                    onClick={() => {
                      const slot: TimeSlot = {
                        serverId: serverId || '',
                        startTime: date.hour(hour).minute(0).second(0).toDate(),
                        endTime: date.hour(hour + 1).minute(0).second(0).toDate(),
                        status: 'available',
                      }
                      onSlotClick?.(slot)
                    }}
                  >
                    {(hourReservations || []).slice(0, 2).map((r) => (
                      <Tooltip
                        key={r.id}
                        title={
                          <div>
                            <div><strong>{r.userName || 'Unknown'}</strong></div>
                            <div>{r.serverName || 'Unknown'}</div>
                            <div>{r.purpose || ''}</div>
                          </div>
                        }
                      >
                        <div
                          className={`week-reservation-item status-${r.status}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onReservationClick?.(r)
                          }}
                        >
{r.userName || 'Unknown'}
                        </div>
                      </Tooltip>
                    ))}
                    {hourReservations.length > 2 && (
                       <div className="more-items">+{hourReservations.length - 2} {t('reservation.more')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 渲染月视图
  const renderMonthView = () => {
    const weekDays = t('reservation.weekdays', { returnObjects: true }) as string[]
    const weeks: Dayjs[][] = []
    let currentWeek: Dayjs[] = []

    dateRange.forEach((date, index) => {
      currentWeek.push(date)
      if (currentWeek.length === 7 || index === dateRange.length - 1) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    })

    return (
      <div className="calendar-month-view">
        <div className="calendar-header">
          {weekDays.map((day) => (
            <div key={day} className="weekday-header">{day}</div>
          ))}
        </div>
        <div className="calendar-body">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="calendar-week-row">
              {week.map((date) => {
                const dayReservations = getReservationsForTimeSlot(date)
                const isCurrentMonth = date.isSame(dayjs(currentDate), 'month')

                return (
                  <div
                    key={date.format('YYYY-MM-DD')}
                    className={`month-cell ${date.isSame(dayjs(), 'day') ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''} ${dayReservations.length > 0 ? 'has-reservations' : ''}`}
                    onClick={() => {
                      // Navigate to day view when clicking on the cell
                      onDateChange?.(date.toDate())
                      onViewModeChange?.('day')
                    }}
                  >
                    <div className="month-date">
                      {date.date()}
                      {/* Show clear reservation indicator badge */}
                      {dayReservations.length > 0 && (
                        <Badge 
                          count={dayReservations.length} 
                          size="small" 
                          style={{ 
                            marginLeft: 4, 
                            backgroundColor: RESERVATION_STATUS_COLORS[dayReservations[0]?.status] || '#1890ff'
                          }}
                        />
                      )}
                    </div>
                    <div className="month-reservations">
                      {(dayReservations || []).slice(0, 3).map((r) => (
                        <Tooltip
                          key={r.id}
                          title={
                            <div>
                              <div><strong>{r.userName || 'Unknown'}</strong></div>
                              <div><ClockCircleOutlined style={{ marginRight: 4 }} />{dayjs(r.startTime).format('HH:mm')} - {dayjs(r.endTime).format('HH:mm')}</div>
                              <div>{r.purpose || ''}</div>
                              <div style={{ marginTop: 4, color: '#aaa' }}>{t('reservation.clickToViewDetails')}</div>
                            </div>
                          }
                        >
                          <div
                            className={`month-reservation-item status-${r.status}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              // Navigate to day view AND show this reservation
                              onDateChange?.(date.toDate())
                              onViewModeChange?.('day')
                              onReservationClick?.(r)
                            }}
                          >
                            <CalendarOutlined style={{ marginRight: 4, fontSize: 10 }} />
                            {(r.purpose || t('reservation.noPurpose')).slice(0, 12)}
                          </div>
                        </Tooltip>
                      ))}
                      {dayReservations.length > 3 && (
                        <div 
                          className="more-items"
                          onClick={(e) => {
                            e.stopPropagation()
                            // Navigate to day view to see all reservations
                            onDateChange?.(date.toDate())
                            onViewModeChange?.('day')
                          }}
                        >
                          +{dayReservations.length - 3} {t('reservation.more')}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 获取标题显示
  const getTitle = () => {
    const current = dayjs(currentDate)
    switch (viewMode) {
      case 'day':
        return current.format('YYYY-MM-DD')
      case 'week':
        const weekStart = current.startOf('week')
        const weekEnd = current.endOf('week')
        return `${weekStart.format('MM-DD')} - ${weekEnd.format('MM-DD')}`
      case 'month':
        return current.format('YYYY-MM')
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <Card className="calendar-view">
        <Spin />
      </Card>
    )
  }

  return (
    <Card className="calendar-view">
      {/* 工具栏 */}
      <div className="calendar-toolbar">
        <div className="toolbar-left">
          <Select
            allowClear
            placeholder={t('reservation.selectServer')}
            style={{ width: 200 }}
            value={serverId}
            onChange={onServerChange}
            options={servers.map((s) => ({ label: s.name, value: s.id }))}
          />
        </div>
        
        <div className="toolbar-center">
          <Button icon={<LeftOutlined />} onClick={handlePrev} />
          <span className="current-date" onClick={handleToday}>{getTitle()}</span>
          <Button icon={<RightOutlined />} onClick={handleNext} />
        </div>

        <div className="toolbar-right">
          <Segmented
            value={viewMode}
            onChange={(value) => onViewModeChange?.(value as 'day' | 'week' | 'month')}
            options={[
              { label: t('reservation.day'), value: 'day' },
              { label: t('reservation.week'), value: 'week' },
              { label: t('reservation.month'), value: 'month' },
            ]}
          />
        </div>
      </div>

      {/* 图例 */}
      <div className="calendar-legend">
        <span className="legend-item">
          <span className="legend-color" style={{ background: RESERVATION_STATUS_COLORS.pending }}></span>
          {t('reservation.pending')}
        </span>
        <span className="legend-item">
          <span className="legend-color" style={{ background: RESERVATION_STATUS_COLORS.approved }}></span>
          {t('reservation.approved')}
        </span>
        <span className="legend-item">
          <span className="legend-color" style={{ background: RESERVATION_STATUS_COLORS.active }}></span>
          {t('reservation.active')}
        </span>
        <span className="legend-item">
          <span className="legend-color" style={{ background: RESERVATION_STATUS_COLORS.completed }}></span>
          {t('reservation.completed')}
        </span>
        <span className="legend-item">
          <span className="legend-color" style={{ background: RESERVATION_STATUS_COLORS.cancelled }}></span>
          {t('reservation.cancelled')}
        </span>
      </div>

      {/* 日历内容 */}
      {viewMode === 'day' && renderDayView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'month' && renderMonthView()}

      {reservations.length === 0 && !loading && (
        <Empty description={t('reservation.noReservations')} style={{ margin: '40px 0' }} />
      )}
    </Card>
  )
}

export default CalendarView