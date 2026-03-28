import React, { useState, useRef, useEffect } from 'react'
import { Badge, Tooltip, Spin } from 'antd'
import {
  RobotOutlined,
  CloseOutlined,
  MinusOutlined,
  ReloadOutlined,
  WifiOutlined,
  DisconnectOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import { useChat } from '../../hooks/useChat'
import type { Message } from '../../hooks/useChat'
import './ChatWindow.css'

interface ChatWindowProps {
  isOpen: boolean
  onClose: () => void
  position?: 'bottom-right' | 'bottom-left'
}

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

const ChatWindow: React.FC<ChatWindowProps> = ({
  isOpen,
  onClose,
  position = 'bottom-right',
}) => {
  const { t } = useTranslation()
  const [isMinimized, setIsMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')

  const {
    messages,
    sendMessage,
    isConnected,
    connectionStatus: chatConnectionStatus,
    clearHistory,
    retry,
  } = useChat()

  // 同步连接状态
  useEffect(() => {
    setConnectionStatus(chatConnectionStatus)
  }, [chatConnectionStatus])

  // 自动滚动到底部
  useEffect(() => {
    if (messagesEndRef.current && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isMinimized])

  const handleSend = (content: string) => {
    if (content.trim()) {
      sendMessage(content.trim())
    }
  }

  const handleMinimize = () => {
    setIsMinimized(true)
  }

  const handleExpand = () => {
    setIsMinimized(false)
  }

  const handleReconnect = () => {
    if (retry) {
      retry()
    }
  }

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <WifiOutlined style={{ color: '#52c41a' }} />
      case 'connecting':
        return <LoadingOutlined spin style={{ color: '#faad14' }} />
      case 'disconnected':
        return <DisconnectOutlined style={{ color: '#ff4d4f' }} />
    }
  }

  const getConnectionTooltip = () => {
    switch (connectionStatus) {
      case 'connected':
        return t('chat.connected')
      case 'connecting':
        return t('chat.connecting')
      case 'disconnected':
        return t('chat.disconnected')
    }
  }

  // Render welcome message
  const renderWelcomeMessage = () => (
    <div className="chat-welcome">
      <div className="chat-welcome-icon">
        <RobotOutlined />
      </div>
      <div className="chat-welcome-title">LSM Agent</div>
      <div className="chat-welcome-subtitle">{t('chat.subtitle')}</div>
      <div className="chat-welcome-tips">
        <div className="tip-item">💡 {t('chat.welcome')}</div>
        <div className="tip-item">💡 {t('chat.example')}</div>
        <div className="tip-item">💡 {t('chat.helpCommand')}</div>
      </div>
    </div>
  )

  // Render disconnected banner
  const renderDisconnectedBanner = () => (
    <div className="chat-disconnected-banner">
      <DisconnectOutlined />
      <span>{t('chat.disconnectedTip')}</span>
      <button onClick={handleReconnect} className="reconnect-btn">
        <ReloadOutlined /> {t('chat.reconnect')}
      </button>
    </div>
  )

  if (!isOpen) {
    return null
  }

  // 最小化状态
  if (isMinimized) {
    return (
      <div
        className={`chat-window minimized ${position}`}
        onClick={handleExpand}
      >
        <Badge count={messages.length > 0 ? messages.length : 0} size="small">
          <div className="chat-minimized-header">
            <RobotOutlined />
            <span>LSM Agent</span>
          </div>
        </Badge>
      </div>
    )
  }

  return (
    <div className={`chat-window ${position}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <RobotOutlined className="chat-header-icon" />
          <span className="chat-header-title">LSM Agent</span>
        </div>
        <div className="chat-header-right">
          <Tooltip title={getConnectionTooltip()}>
            {getConnectionIcon()}
          </Tooltip>
          <button className="chat-header-btn" onClick={handleMinimize}>
            <MinusOutlined />
          </button>
          <button className="chat-header-btn close" onClick={onClose}>
            <CloseOutlined />
          </button>
        </div>
      </div>

      {/* 连接状态横幅 */}
      {connectionStatus === 'disconnected' && renderDisconnectedBanner()}

      {/* Messages */}
      <div className="chat-messages" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          renderWelcomeMessage()
        ) : (
          <>
            {messages.map((message: Message, index: number) => (
              <ChatMessage
                key={message.id}
                message={message}
                isLast={index === messages.length - 1}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Loading indicator */}
      {messages.length > 0 && 
       messages[messages.length - 1].role === 'user' && 
       connectionStatus === 'connected' && (
        <div className="chat-typing-indicator">
          <Spin size="small" />
          <span>Agent {t('chat.thinking')}</span>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={connectionStatus !== 'connected'}
        placeholder={
          connectionStatus !== 'connected' 
            ? t('chat.inputDisabled') 
            : t('chat.inputPlaceholder')
        }
      />
    </div>
  )
}

export default ChatWindow