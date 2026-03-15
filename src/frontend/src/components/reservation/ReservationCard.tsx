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

const STATUS_CONFIG: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  pending: { color: 'warning', text: '待审批', icon: <ClockCircleOutlined /> },
  approved: { color: 'processing', text: '已批准', icon: <CheckCircleOutlined /> },
  active: { color: 'success', text: '进行中', icon: <PlayCircleOutlined /> },
  completed: { color: 'default', text: '已完成', icon: <CheckCircleOutlined /> },
  cancelled: { color: 'error', text: '已取消', icon: <CloseCircleOutlined /> },
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
  const statusConfig = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending
  
  // 计算剩余时间或已用时间
  const getTimeInfo = () => {
    const start = dayjs(reservation.startTime)
    const end = dayjs(reservation.endTime)
    const now = dayjs()
    
    if (reservation.status === 'active') {
      const remaining = end.diff(now)
      if (remaining > 0) {
        const dur = dayjs.duration(remaining)
        return {
          text: `剩余: ${dur.hours()}小时${dur.minutes()}分钟`,
          progress: ((now.diff(start)) / (end.diff(start))) * 100,
        }
      }
    }
    
    if (reservation.status === 'completed') {
      const actual = end.diff(start)
      const dur = dayjs.duration(actual)
      return {
        text: `实际使用: ${dur.hours()}小时${dur.minutes()}分钟`,
        progress: 100,
      }
    }
    
    const dur = dayjs.duration(end.diff(start))
    return {
      text: `时长: ${dur.hours()}小时${dur.minutes()}分钟`,
      progress: 0,
    }
  }
  
  const timeInfo = getTimeInfo()
  
  // 默认操作按钮
  const getDefaultActions = (): ReservationAction[] => {
    const result: ReservationAction[] = []
    
    if (onView) {
      result.push({
        key: 'view',
        label: '详情',
        icon: <EyeOutlined />,
        onClick: () => onView(reservation.id),
      })
    }
    
    if (reservation.status === 'pending' && onCancel) {
      result.push({
        key: 'cancel',
        label: '取消',
        icon: <CloseCircleOutlined />,
        danger: true,
        confirm: '确定要取消此预约吗？',
        onClick: () => onCancel(reservation.id),
      })
    }
    
    if (reservation.status === 'active' && onRelease) {
      result.push({
        key: 'release',
        label: '释放',
        icon: <StopOutlined />,
        danger: true,
        confirm: '确定要提前释放此预约吗？',
        onClick: () => onRelease(reservation.id),
      })
    }
    
    if (reservation.status === 'pending' && onApprove) {
      result.push({
        key: 'approve',
        label: '批准',
        icon: <CheckCircleOutlined />,
        onClick: () => onApprove(reservation.id),
      })
    }
    
    if (reservation.status === 'pending' && onReject) {
      result.push({
        key: 'reject',
        label: '拒绝',
        icon: <CloseCircleOutlined />,
        danger: true,
        confirm: '确定要拒绝此预约吗？',
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

  // 日历模式 - 紧凑显示
  if (mode === 'calendar') {
    return (
      <div
        className={`reservation-card calendar-mode status-${reservation.status}`}
        onClick={onClick}
      >
        <Tag color={statusConfig.color} className="status-tag">
          {statusConfig.icon} {statusConfig.text}
        </Tag>
        <div className="reservation-title">{reservation.purpose}</div>
        <div className="reservation-time">
          {dayjs(reservation.startTime).format('HH:mm')} - {dayjs(reservation.endTime).format('HH:mm')}
        </div>
      </div>
    )
  }

  // 详情模式 - 完整显示
  if (mode === 'detail') {
    return (
      <Card className="reservation-card detail-mode" onClick={onClick}>
        <div className="reservation-header">
          <Space>
            <Tag color={statusConfig.color} className="status-tag">
              {statusConfig.icon} {statusConfig.text}
            </Tag>
            <span className="server-name">
              <DesktopOutlined /> {reservation.serverName}
            </span>
          </Space>
        </div>
        
        <div className="reservation-content">
          <div className="info-row">
            <span className="label"><UserOutlined /> 用户:</span>
            <span className="value">{reservation.userName}</span>
          </div>
          <div className="info-row">
            <span className="label"><DesktopOutlined /> 服务器:</span>
            <span className="value">{reservation.serverName}</span>
          </div>
          <div className="info-row">
            <span className="label"><ClockCircleOutlined /> 时间:</span>
            <span className="value">
              {dayjs(reservation.startTime).format('YYYY-MM-DD HH:mm')} - 
              {dayjs(reservation.endTime).format('YYYY-MM-DD HH:mm')}
            </span>
          </div>
          <div className="info-row">
            <span className="label">GPU:</span>
            <span className="value">{reservation.gpuIds.join(', ')}</span>
          </div>
          <div className="info-row">
            <span className="label">用途:</span>
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

  // 列表模式 - 默认
  return (
    <Card className="reservation-card list-mode" hoverable onClick={onClick}>
      <div className="reservation-header">
        <Space>
          <Tag color={statusConfig.color} className="status-tag">
            {statusConfig.icon} {statusConfig.text}
          </Tag>
          <span className="server-name">
            <DesktopOutlined /> {reservation.serverName} - {reservation.gpuIds.join(', ')}
          </span>
        </Space>
      </div>
      
      <div className="reservation-body">
        <div className="time-info">
          <ClockCircleOutlined />
          <span>
            {dayjs(reservation.startTime).format('YYYY-MM-DD HH:mm')} - 
            {dayjs(reservation.endTime).format('HH:mm')}
          </span>
        </div>
        <div className="purpose">{reservation.purpose}</div>
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