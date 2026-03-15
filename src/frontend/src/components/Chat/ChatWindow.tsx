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
        return '已连接'
      case 'connecting':
        return '连接中...'
      case 'disconnected':
        return '已断开'
    }
  }

  // 渲染欢迎消息
  const renderWelcomeMessage = () => (
    <div className="chat-welcome">
      <div className="chat-welcome-icon">
        <RobotOutlined />
      </div>
      <div className="chat-welcome-title">LSM Agent</div>
      <div className="chat-welcome-subtitle">智能实验室运维助手</div>
      <div className="chat-welcome-tips">
        <div className="tip-item">💡 输入自然语言描述您的需求</div>
        <div className="tip-item">💡 例如: "帮我申请一台 A100 服务器"</div>
        <div className="tip-item">💡 输入 /help 查看所有指令</div>
      </div>
    </div>
  )

  // 渲染断开连接提示
  const renderDisconnectedBanner = () => (
    <div className="chat-disconnected-banner">
      <DisconnectOutlined />
      <span>连接已断开</span>
      <button onClick={handleReconnect} className="reconnect-btn">
        <ReloadOutlined /> 重新连接
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
          <span>Agent 正在思考...</span>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={connectionStatus !== 'connected'}
        placeholder={
          connectionStatus !== 'connected' 
            ? '连接已断开...' 
            : '输入消息或指令...'
        }
      />
    </div>
  )
}

export default ChatWindow