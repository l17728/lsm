import React from 'react'
import { Card, Tag, Button, Space, Tooltip, Popconfirm, Progress } from 'antd'
import { 
  ClockCircleOutlined, 
  UserOutlined, 
  DesktopOutlined, 
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  EyeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import { useTranslation } from 'react-i18next'
import type { Reservation } from '../../services/reservation.service'
import './ReservationCard.css'

dayjs.extend(duration)

interface ReservationAction {
  key: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  onClick: () => void
  confirm?: string
  loading?: boolean
}

interface ReservationCardProps {
  reservation: Reservation
  mode?: 'list' | 'calendar' | 'detail'
  actions?: ReservationAction[]
  onClick?: () => void
  showActions?: boolean
  onCancel?: (id: string) => void
  onRelease?: (id: string) => void
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onView?: (id: string) => void
}

const STATUS_CONFIG_KEYS: Record<string, { color: string; key: string; icon: React.ReactNode }> = {
  pending: { color: 'warning', key: 'reservation.pending', icon: <ClockCircleOutlined /> },
  PENDING: { color: 'warning', key: 'reservation.pending', icon: <ClockCircleOutlined /> },
  approved: { color: 'processing', key: 'reservation.approved', icon: <CheckCircleOutlined /> },
  APPROVED: { color: 'processing', key: 'reservation.approved', icon: <CheckCircleOutlined /> },
  active: { color: 'success', key: 'reservation.active', icon: <PlayCircleOutlined /> },
  ACTIVE: { color: 'success', key: 'reservation.active', icon: <PlayCircleOutlined /> },
  completed: { color: 'default', key: 'reservation.completed', icon: <CheckCircleOutlined /> },
  COMPLETED: { color: 'default', key: 'reservation.completed', icon: <CheckCircleOutlined /> },
  cancelled: { color: 'error', key: 'reservation.cancelled', icon: <CloseCircleOutlined /> },
  CANCELLED: { color: 'error', key: 'reservation.cancelled', icon: <CloseCircleOutlined /> },
  rejected: { color: 'error', key: 'reservation.rejected', icon: <CloseCircleOutlined /> },
  REJECTED: { color: 'error', key: 'reservation.rejected', icon: <CloseCircleOutlined /> },
}

const ReservationCard: React.FC<ReservationCardProps> = ({
  reservation,
  mode = 'list',
  actions,
  onClick,
  showActions = true,
  onCancel,
  onRelease,
  onApprove,
  onReject,
  onView,
}) => {
  const { t } = useTranslation()
  const statusConfig = STATUS_CONFIG_KEYS[reservation.status] || STATUS_CONFIG_KEYS.pending
  
  // Calculate remaining time or used time
  const getTimeInfo = () => {
    const start = dayjs(reservation.startTime)
    const end = dayjs(reservation.endTime)
    const now = dayjs()
    
    if (reservation.status === 'active') {
      const remaining = end.diff(now)
      if (remaining > 0) {
        const totalMinutes = Math.floor(remaining / 60000)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        return {
          text: `${t('reservation.remaining')}: ${hours}${t('reservation.hours')}${minutes}${t('reservation.minutes')}`,
          progress: ((now.diff(start)) / (end.diff(start))) * 100,
        }
      }
    }
    
    if (reservation.status === 'completed') {
      const totalMinutes = Math.floor(end.diff(start) / 60000)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      return {
        text: `${t('reservation.actualUsage')}: ${hours}${t('reservation.hours')}${minutes}${t('reservation.minutes')}`,
        progress: 100,
      }
    }
    
    const totalMinutes = Math.floor(end.diff(start) / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return {
      text: `${t('reservation.duration')}: ${hours}${t('reservation.hours')}${minutes}${t('reservation.minutes')}`,
      progress: 0,
    }
  }
  
  const timeInfo = getTimeInfo()
  
  // Default action buttons
  const getDefaultActions = (): ReservationAction[] => {
    const result: ReservationAction[] = []
    
    if (onView) {
      result.push({
        key: 'view',
        label: t('reservation.details'),
        icon: <EyeOutlined />,
        onClick: () => onView(reservation.id),
      })
    }
    
    if (reservation.status === 'pending' && onCancel) {
      result.push({
        key: 'cancel',
        label: t('common.cancel'),
        icon: <CloseCircleOutlined />,
        danger: true,
        confirm: t('reservation.cancelConfirm'),
        onClick: () => onCancel(reservation.id),
      })
    }
    
    if (reservation.status === 'active' && onRelease) {
      result.push({
        key: 'release',
        label: t('gpu.release'),
        icon: <StopOutlined />,
        danger: true,
        confirm: t('reservation.releaseConfirm'),
        onClick: () => onRelease(reservation.id),
      })
    }
    
    if (reservation.status === 'pending' && onApprove) {
      result.push({
        key: 'approve',
        label: t('reservation.approved'),
        icon: <CheckCircleOutlined />,
        onClick: () => onApprove(reservation.id),
      })
    }
    
    if (reservation.status === 'pending' && onReject) {
      result.push({
        key: 'reject',
        label: t('reservation.rejected'),
        icon: <CloseCircleOutlined />,
        danger: true,
        confirm: t('reservation.rejectConfirm'),
        onClick: () => onReject(reservation.id),
      })
    }
    
    return result
  }
  
  const allActions = actions || getDefaultActions()
  
  const renderAction = (action: ReservationAction) => {
    const button = (
      <Button
        key={action.key}
        type={action.key === 'approve' ? 'primary' : 'default'}
        danger={action.danger}
        size="small"
        icon={action.icon}
        onClick={(e) => {
          e.stopPropagation()
          action.onClick()
        }}
        loading={action.loading}
      >
        {action.label}
      </Button>
    )
    
    if (action.confirm) {
      return (
        <Popconfirm
          key={action.key}
          title={action.confirm}
          onConfirm={(e) => {
            e?.stopPropagation()
            action.onClick()
          }}
          onCancel={(e) => e?.stopPropagation()}
        >
          <span onClick={(e) => e.stopPropagation()}>{button}</span>
        </Popconfirm>
      )
    }
    
    return button
  }

  // Calendar mode - compact display
  if (mode === 'calendar') {
    return (
      <div
        className={`reservation-card calendar-mode status-${reservation.status}`}
        onClick={onClick}
      >
        <Tag color={statusConfig.color} className="status-tag">
          {statusConfig.icon} {t(statusConfig.key)}
        </Tag>
        <div className="reservation-title">{reservation.purpose}</div>
        <div className="reservation-time">
          {dayjs(reservation.startTime).format('HH:mm')} - {dayjs(reservation.endTime).format('HH:mm')}
        </div>
      </div>
    )
  }

  // Detail mode - full display
  if (mode === 'detail') {
    return (
      <Card className="reservation-card detail-mode" onClick={onClick}>
        <div className="reservation-header">
          <Space>
            <Tag color={statusConfig.color} className="status-tag">
              {statusConfig.icon} {t(statusConfig.key)}
            </Tag>
            <span className="server-name">
              <DesktopOutlined /> {reservation.serverName}
            </span>
          </Space>
        </div>
        
        <div className="reservation-content">
          <div className="info-row">
            <span className="label"><UserOutlined /> {t('user.username')}:</span>
            <span className="value">{reservation.userName}</span>
          </div>
          <div className="info-row">
            <span className="label"><DesktopOutlined /> {t('server.title')}:</span>
            <span className="value">{reservation.serverName}</span>
          </div>
          <div className="info-row">
            <span className="label"><ClockCircleOutlined /> {t('reservation.time')}:</span>
            <span className="value">
              {dayjs(reservation.startTime).format('YYYY-MM-DD HH:mm')} - {dayjs(reservation.endTime).format('YYYY-MM-DD HH:mm')}
            </span>
          </div>
          <div className="info-row">
            <span className="label">GPU:</span>
            <span className="value">{reservation.gpuIds?.join(', ') || ''}</span>
          </div>
          <div className="info-row">
            <span className="label">{t('reservation.purpose')}:</span>
            <span className="value">{reservation.purpose}</span>
          </div>
        </div>
        
        {showActions && allActions.length > 0 && (
          <div className="reservation-actions">
            <Space>{allActions.map(renderAction)}</Space>
          </div>
        )}
      </Card>
    )
  }

  // List mode - default
  return (
    <Card className="reservation-card list-mode" hoverable onClick={onClick}>
      <div className="reservation-header">
        <Space>
          <Tag color={statusConfig.color} className="status-tag">
            {statusConfig.icon} {t(statusConfig.key)}
          </Tag>
          <span className="server-name">
            <DesktopOutlined /> {reservation.serverName} - {reservation.gpuIds?.join(', ') || ''}
          </span>
        </Space>
      </div>
      
      <div className="reservation-body">
        <div className="time-info">
          <ClockCircleOutlined />
          <span>
            {dayjs(reservation.startTime).format('YYYY-MM-DD HH:mm')} - {dayjs(reservation.endTime).format('HH:mm')}
          </span>
        </div>
        <div className="purpose">{reservation.purpose || ''}</div>
      </div>
      
      <div className="reservation-footer">
        <div className="time-progress">
          <span className="time-text">{timeInfo.text}</span>
          {reservation.status === 'active' && (
            <Progress 
              percent={Math.round(timeInfo.progress)} 
              size="small" 
              showInfo={false}
              strokeColor={{
                '0%': '#52c41a',
                '100%': '#faad14',
              }}
            />
          )}
        </div>
        
        {showActions && allActions.length > 0 && (
          <div className="action-buttons">
            <Space size="small">{allActions.map(renderAction)}</Space>
          </div>
        )}
      </div>
    </Card>
  )
}

export default ReservationCard