import React, { useMemo } from 'react'
import { Avatar, Tag, Button, Space, Tooltip } from 'antd'
import {
  UserOutlined,
  RobotOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Message } from '../../hooks/useChat'
import './ChatWindow.css'

interface ChatMessageProps {
  message: Message
  isLast?: boolean
}

interface ActionPayload {
  type: 'confirm' | 'execute'
  actionId: string
  description: string
  params?: Record<string, unknown>
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLast }) => {
  const { role, content, timestamp, status, metadata } = message

  // 判断消息类型
  const isUser = role === 'user'
  const isSystem = role === 'system'
  const isAssistant = role === 'assistant'

  // 渲染时间
  const formattedTime = useMemo(() => {
    return dayjs(timestamp).format('HH:mm')
  }, [timestamp])

  // 获取状态图标
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <LoadingOutlined style={{ fontSize: 12, color: '#999' }} />
      case 'sent':
        return <CheckCircleOutlined style={{ fontSize: 12, color: '#52c41a' }} />
      case 'error':
        return <ExclamationCircleOutlined style={{ fontSize: 12, color: '#ff4d4f' }} />
      default:
        return null
    }
  }

  // 解析消息内容 (简单 Markdown 支持)
  const renderContent = () => {
    // 检查是否包含操作确认
    if (metadata?.needsConfirmation && metadata.actionType === 'confirm') {
      return renderConfirmationCard()
    }

    // 渲染普通文本内容
    return (
      <div className="message-text">
        {formatContent(content)}
      </div>
    )
  }

  // 格式化内容 (支持简单的 Markdown)
  const formatContent = (text: string) => {
    // 处理代码块
    const parts = text.split(/(```[\s\S]*?```)/g)
    
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3)
        const [lang, ...lines] = code.split('\n')
        const language = lang.trim() || 'text'
        const codeContent = lines.join('\n')
        
        return (
          <pre key={index} className="message-code-block">
            <code className={`language-${language}`}>{codeContent}</code>
          </pre>
        )
      }
      
      // 处理行内代码
      const inlineCodeParts = part.split(/(`[^`]+`)/g)
      return (
        <span key={index}>
          {inlineCodeParts.map((p, i) => {
            if (p.startsWith('`') && p.endsWith('`')) {
              return <code key={i} className="message-inline-code">{p.slice(1, -1)}</code>
            }
            // 处理粗体
            const boldParts = p.split(/(\*\*[^*]+\*\*)/g)
            return boldParts.map((bp, j) => {
              if (bp.startsWith('**') && bp.endsWith('**')) {
                return <strong key={`${i}-${j}`}>{bp.slice(2, -2)}</strong>
              }
              return bp
            })
          })}
        </span>
      )
    })
  }

  // 渲染确认卡片
  const renderConfirmationCard = () => {
    const actionPayload = metadata?.actionPayload as ActionPayload | undefined
    
    return (
      <div className="message-confirmation-card">
        <div className="confirmation-header">
          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
          <span>操作确认</span>
        </div>
        <div className="confirmation-content">
          <p>{content}</p>
          {actionPayload?.params && (
            <div className="confirmation-params">
              {Object.entries(actionPayload.params).map(([key, value]) => (
                <div key={key} className="param-row">
                  <span className="param-key">{key}:</span>
                  <span className="param-value">{String(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="confirmation-actions">
          <Space>
            <Button size="small" type="primary">
              确认执行
            </Button>
            <Button size="small" danger>
              取消
            </Button>
          </Space>
        </div>
      </div>
    )
  }

  // 系统消息样式
  if (isSystem) {
    return (
      <div className="chat-message system">
        <div className="message-system-content">
          <InfoCircleOutlined />
          <span>{content}</span>
        </div>
        <span className="message-time">{formattedTime}</span>
      </div>
    )
  }

  // 用户消息
  if (isUser) {
    return (
      <div className="chat-message user">
        <div className="message-bubble user-bubble">
          <div className="message-text">{content}</div>
        </div>
        <div className="message-meta">
          <span className="message-time">{formattedTime}</span>
          {getStatusIcon()}
        </div>
      </div>
    )
  }

  // 助手消息
  return (
    <div className="chat-message assistant">
      <div className="message-avatar">
        <Avatar 
          size={32} 
          icon={<RobotOutlined />} 
          style={{ backgroundColor: '#1890ff' }}
        />
      </div>
      <div className="message-content">
        <div className="message-bubble assistant-bubble">
          {renderContent()}
        </div>
        <div className="message-meta">
          <span className="message-time">{formattedTime}</span>
          {metadata?.actionType && (
            <Tag color="blue" style={{ marginLeft: 8, fontSize: 10 }}>
              {metadata.actionType === 'query' ? '查询' : 
               metadata.actionType === 'execute' ? '执行' : '确认'}
            </Tag>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatMessage