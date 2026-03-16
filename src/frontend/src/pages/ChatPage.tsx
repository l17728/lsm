import React, { useEffect, useRef, useState } from 'react'
import { Card, Button, Spin, Input, Modal, message, Tooltip, Dropdown, Tag, Form, Space } from 'antd'
import { RobotOutlined, SendOutlined, ClearOutlined, WifiOutlined, DisconnectOutlined, LoadingOutlined, PlusOutlined, HistoryOutlined, ExclamationCircleOutlined, SettingOutlined, ApiOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useChatStore, type Message } from '../store/chatStore'
import chatService from '../services/chat.service'
import type { MenuProps } from 'antd'
import './ChatPage.css'

const { TextArea } = Input

// OpenClaw Gateway 默认配置
const OPENCLAW_DEFAULT_TOKEN = '000d72ae58ccef8e97acd9eb124ddae1b8a856fa57289ea1'
const OPENCLAW_DEFAULT_HOST = '127.0.0.1:18789'

const ChatPage: React.FC = () => {
  const [inputValue, setInputValue] = useState('')
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [gatewayToken, setGatewayToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { 
    messages, connectionStatus, isTyping, sessions, clearMessages, setCurrentSession,
    openclawConnected, openclawToken
  } = useChatStore()

  useEffect(() => { chatService.connect(); return () => chatService.disconnect() }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { 
    // 初始化时设置默认 token
    if (openclawToken) {
      setGatewayToken(openclawToken)
    } else {
      setGatewayToken(OPENCLAW_DEFAULT_TOKEN)
    }
  }, [openclawToken])

  const handleSend = () => {
    const content = inputValue.trim()
    if (!content || connectionStatus !== 'connected') return
    chatService.sendMessage(content)
    setInputValue('')
  }

  const handleClear = () => Modal.confirm({
    title: '清空聊天记录', icon: <ExclamationCircleOutlined />, content: '确定要清空当前会话的所有消息吗？', okText: '确定', cancelText: '取消',
    onOk: () => { chatService.clearHistory(); message.success('已清空') },
  })

  const handleConnectOpenClaw = async () => {
    if (!gatewayToken.trim()) {
      message.warning('请输入 Gateway Token 或留空使用本地模式')
    }
    
    setConnecting(true)
    try {
      const result = await chatService.connectOpenClaw(gatewayToken.trim())
      if (result.success) {
        message.success(result.message)
        setSettingsVisible(false)
      } else {
        message.error(result.message)
      }
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnectOpenClaw = () => {
    chatService.disconnectOpenClaw()
    setGatewayToken('')
    message.info('已断开 OpenClaw 连接')
  }

  const sessionItems: MenuProps['items'] = sessions.slice(0, 5).map((s) => ({
    key: s.id, label: `${s.title} (${new Date(s.updatedAt).toLocaleDateString()})`,
    onClick: () => { chatService.loadSession(s.id); setCurrentSession(s.id) },
  }))

  const statusIcon = connectionStatus === 'connected' ? <WifiOutlined style={{ color: '#52c41a' }} />
    : connectionStatus === 'connecting' ? <LoadingOutlined spin style={{ color: '#faad14' }} /> : <DisconnectOutlined style={{ color: '#ff4d4f' }} />

  const renderMessage = (msg: Message) => (
    <div key={msg.id} className={`chat-message ${msg.role}`}>
      {msg.role !== 'user' && <div className="message-avatar"><RobotOutlined /></div>}
      <div className="message-content">
        <div className={`message-bubble ${msg.role === 'system' ? 'system' : ''}`}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{msg.content}</pre>
        </div>
        <div className="message-meta">
          <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
          {msg.status === 'sending' && <LoadingOutlined spin />}
        </div>
      </div>
      {msg.role === 'user' && <div className="message-avatar user"><span>我</span></div>}
    </div>
  )

  return (
    <div className="chat-page">
      <Card className="chat-container">
        <div className="chat-header">
          <div className="header-left">
            <RobotOutlined className="header-icon" />
            <span className="header-title">LSM Agent</span>
            {openclawConnected && (
              <Tag color="green" style={{ marginLeft: 8 }}>
                <ApiOutlined /> OpenClaw
              </Tag>
            )}
          </div>
          <div className="header-right">
            <Tooltip title={openclawConnected ? 'OpenClaw 已连接' : '连接 OpenClaw'}>
              <Button 
                type="text" 
                icon={openclawConnected ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ApiOutlined />}
                onClick={() => setSettingsVisible(true)}
              />
            </Tooltip>
            <Tooltip title={connectionStatus}>{statusIcon}</Tooltip>
            <Dropdown menu={{ items: sessionItems }}><Button type="text" icon={<HistoryOutlined />} /></Dropdown>
            <Tooltip title="新建会话"><Button type="text" icon={<PlusOutlined />} onClick={() => { chatService.createNewSession(); clearMessages() }} /></Tooltip>
            <Tooltip title="清空记录"><Button type="text" icon={<ClearOutlined />} onClick={handleClear} /></Tooltip>
          </div>
        </div>
        
        {connectionStatus === 'disconnected' && (
          <div className="disconnected-banner"><DisconnectOutlined /><span>连接已断开</span><Button size="small" onClick={() => chatService.reconnect()}>重新连接</Button></div>
        )}
        
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <div className="welcome-icon"><RobotOutlined /></div>
              <h2>LSM Agent</h2>
              <p>智能实验室运维助手</p>
              {openclawConnected ? (
                <Tag color="green" style={{ marginTop: 12 }}>
                  <ApiOutlined /> 已连接 OpenClaw AI
                </Tag>
              ) : (
                <Button 
                  type="primary" 
                  icon={<ApiOutlined />}
                  style={{ marginTop: 16 }}
                  onClick={async () => {
                    setConnecting(true)
                    try {
                      const result = await chatService.connectOpenClaw(gatewayToken || OPENCLAW_DEFAULT_TOKEN)
                      if (!result.success) {
                        message.error(result.message)
                      }
                    } finally {
                      setConnecting(false)
                    }
                  }}
                  loading={connecting}
                >
                  连接 OpenClaw AI
                </Button>
              )}
              <p style={{ color: '#999', fontSize: 12, marginTop: 16 }}>
                点击右上角 <SettingOutlined /> 可修改连接设置
              </p>
            </div>
          ) : <>{messages.map(renderMessage)}<div ref={messagesEndRef} /></>}
        </div>
        
        {isTyping && connectionStatus === 'connected' && <div className="typing-indicator"><Spin size="small" /><span>思考中...</span></div>}
        
        <div className="chat-input-area">
          <TextArea 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            disabled={connectionStatus !== 'connected'} 
            autoSize={{ minRows: 1, maxRows: 4 }} 
            placeholder={openclawConnected ? "与 OpenClaw AI 对话..." : "输入消息..."} 
          />
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!inputValue.trim() || connectionStatus !== 'connected'}>发送</Button>
        </div>
      </Card>

      {/* OpenClaw 设置弹窗 */}
      <Modal
        title={<><SettingOutlined /> OpenClaw 连接设置</>}
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={null}
        width={500}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item 
            label="Gateway Token（可选）"
            help="留空使用本地智能模式，输入 Token 连接 OpenClaw AI"
          >
            <TextArea
              value={gatewayToken}
              onChange={(e) => setGatewayToken(e.target.value)}
              placeholder="输入 OpenClaw Gateway Token..."
              rows={3}
              disabled={openclawConnected}
            />
          </Form.Item>
          
          <Form.Item>
            <Space>
              {openclawConnected ? (
                <Button danger onClick={handleDisconnectOpenClaw}>
                  断开连接
                </Button>
              ) : (
                <Button 
                  type="primary" 
                  onClick={handleConnectOpenClaw}
                  loading={connecting}
                >
                  {gatewayToken.trim() ? '连接 OpenClaw' : '使用本地模式'}
                </Button>
              )}
              <Button onClick={() => setSettingsVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
          
          <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6, marginTop: 16 }}>
            <h4 style={{ margin: '0 0 8px 0' }}>💡 使用说明</h4>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#666' }}>
              <li><strong>本地模式</strong>：使用 LSM 内置智能响应</li>
              <li><strong>OpenClaw 模式</strong>：连接真正的 AI 助手</li>
              <li>Token 可从 OpenClaw Gateway 获取</li>
            </ul>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default ChatPage