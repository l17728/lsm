import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'
import { useChatStore, type Message } from '../store/chatStore'
import axios from 'axios'

interface ServerMessage {
  type: 'message' | 'action' | 'error' | 'typing'
  payload: { id?: string; role: 'assistant' | 'system'; content: string; timestamp?: string; metadata?: Message['metadata'] }
}

class ChatService {
  private socket: Socket | null = null
  private openclawWs: WebSocket | null = null
  private reconnectAttempts = 0
  private openclawMessageHandler: ((data: any) => void) | null = null

  // 连接 LSM 本地 WebSocket
  connect(): void {
    if (this.socket?.connected) return
    const token = useAuthStore.getState().token
    if (!token) return
    useChatStore.getState().setConnectionStatus('connecting')
    this.socket = io({ auth: { token }, transports: ['websocket', 'polling'], reconnection: true })
    this.setupHandlers()
  }

  private setupHandlers(): void {
    if (!this.socket) return
    this.socket.on('connect', () => {
      this.reconnectAttempts = 0
      useChatStore.getState().setConnectionStatus('connected')
      this.socket?.emit('create:session')
    })
    this.socket.on('disconnect', () => useChatStore.getState().setConnectionStatus('disconnected'))
    this.socket.on('connect_error', () => { if (++this.reconnectAttempts >= 5) useChatStore.getState().setConnectionStatus('disconnected') })
    this.socket.on('chat:message', (data: ServerMessage) => {
      useChatStore.getState().addMessage({ id: data.payload.id || this.genId(), role: data.payload.role, content: data.payload.content, timestamp: data.payload.timestamp ? new Date(data.payload.timestamp) : new Date(), status: 'sent', metadata: data.payload.metadata })
    })
    this.socket.on('chat:session', (data: { sessionId: string }) => {
      useChatStore.getState().setCurrentSession(data.sessionId)
      useChatStore.getState().addMessage({
        id: this.genId(),
        role: 'assistant',
        content: '你好！我是 LSM 智能助手。\n\n💡 点击右上角 <ApiOutlined /> 图标可连接 OpenClaw AI。',
        timestamp: new Date(),
        status: 'sent'
      })
    })
    this.socket.on('chat:typing', (data: { typing: boolean }) => useChatStore.getState().setTyping(data.typing))
    this.socket.on('chat:error', (err: { message: string }) => useChatStore.getState().addMessage({ id: this.genId(), role: 'system', content: `错误: ${err.message}`, timestamp: new Date(), status: 'error' }))
    this.socket.on('chat:history', (data: { messages: Message[] }) => useChatStore.getState().setMessages(data.messages))
  }

  /**
   * 连接 OpenClaw Gateway (WebSocket)
   */
  async connectOpenClaw(gatewayToken: string): Promise<{ success: boolean; message: string }> {
    try {
      useChatStore.getState().setTyping(true)
      
      // 断开现有 OpenClaw 连接
      if (this.openclawWs) {
        this.openclawWs.close()
        this.openclawWs = null
      }

      // OpenClaw Gateway WebSocket URL
      // 使用当前页面的主机名，端口为 Gateway 端口 (18789)
      const host = window.location.hostname || 'localhost'
      const wsUrl = `ws://${host}:18789/`
      console.log('[OpenClaw] Connecting to:', wsUrl)
      
      return new Promise((resolve) => {
        try {
          this.openclawWs = new WebSocket(wsUrl)
          let challengeNonce: string | null = null
          
          this.openclawWs.onopen = () => {
            console.log('[OpenClaw] WebSocket connected, waiting for challenge...')
          }
          
          this.openclawWs.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              console.log('[OpenClaw] Received:', data)
              
              // 处理认证挑战
              if (data.type === 'event' && data.event === 'connect.challenge') {
                challengeNonce = data.payload?.nonce
                console.log('[OpenClaw] Challenge received:', challengeNonce)
                
                // 发送认证响应（如果有 token）
                if (gatewayToken && challengeNonce) {
                  this.openclawWs?.send(JSON.stringify({
                    type: 'auth',
                    token: gatewayToken,
                    nonce: challengeNonce
                  }))
                } else {
                  // 无 token，发送匿名连接
                  this.openclawWs?.send(JSON.stringify({
                    type: 'connect',
                    nonce: challengeNonce
                  }))
                }
                
                // 标记连接成功
                useChatStore.getState().setOpenClawConnected(true)
                useChatStore.getState().setOpenClawSessionKey(`openclaw-${Date.now()}`)
                
                useChatStore.getState().addMessage({
                  id: this.genId(),
                  role: 'system',
                  content: '✅ 已连接到 OpenClaw！可以开始对话了。',
                  timestamp: new Date(),
                  status: 'sent'
                })
                
                resolve({ success: true, message: '连接成功' })
                return
              }
              
              // 处理认证结果
              if (data.type === 'event' && data.event === 'auth.success') {
                console.log('[OpenClaw] Auth success')
                return
              }
              
              if (data.type === 'event' && data.event === 'auth.failed') {
                console.error('[OpenClaw] Auth failed')
                useChatStore.getState().addMessage({
                  id: this.genId(),
                  role: 'system',
                  content: '❌ 认证失败，请检查 Token',
                  timestamp: new Date(),
                  status: 'error'
                })
                return
              }
              
              // 处理 AI 响应消息
              useChatStore.getState().setTyping(false)
              
              if (data.type === 'message' || data.type === 'response') {
                const content = data.content || data.message || data.text || data.payload?.content
                if (content) {
                  useChatStore.getState().addMessage({
                    id: this.genId(),
                    role: 'assistant',
                    content: content,
                    timestamp: new Date(),
                    status: 'sent'
                  })
                }
              } else if (data.type === 'event' && data.event === 'message') {
                const content = data.payload?.content || data.payload?.message
                if (content) {
                  useChatStore.getState().addMessage({
                    id: this.genId(),
                    role: 'assistant',
                    content: content,
                    timestamp: new Date(),
                    status: 'sent'
                  })
                }
              } else if (data.type === 'stream') {
                // 处理流式响应
                const chunk = data.chunk || data.content
                if (chunk) {
                  const messages = useChatStore.getState().messages
                  const lastMsg = messages[messages.length - 1]
                  if (lastMsg?.role === 'assistant' && lastMsg.status === 'sent') {
                    // 更新最后一条消息
                    const updatedMessages = [...messages]
                    updatedMessages[messages.length - 1] = { 
                      ...lastMsg, 
                      content: lastMsg.content + chunk 
                    }
                    useChatStore.getState().setMessages(updatedMessages)
                  } else {
                    useChatStore.getState().addMessage({
                      id: this.genId(),
                      role: 'assistant',
                      content: chunk,
                      timestamp: new Date(),
                      status: 'sent'
                    })
                  }
                }
              } else if (data.content || data.message || data.text) {
                // 其他格式的消息
                useChatStore.getState().addMessage({
                  id: this.genId(),
                  role: 'assistant',
                  content: data.content || data.message || data.text,
                  timestamp: new Date(),
                  status: 'sent'
                })
              }
              
            } catch (e) {
              console.error('[OpenClaw] Parse error:', e)
              // 非 JSON 消息
              if (event.data && typeof event.data === 'string' && event.data.trim()) {
                useChatStore.getState().addMessage({
                  id: this.genId(),
                  role: 'assistant',
                  content: event.data,
                  timestamp: new Date(),
                  status: 'sent'
                })
              }
            }
          }
          
          this.openclawWs.onerror = (error) => {
            console.error('[OpenClaw] WebSocket error:', error)
            useChatStore.getState().setOpenClawConnected(false)
            resolve({ success: false, message: 'WebSocket 连接错误' })
          }
          
          this.openclawWs.onclose = (event) => {
            console.log('[OpenClaw] WebSocket closed:', event.code, event.reason)
            useChatStore.getState().setOpenClawConnected(false)
          }
          
          // 设置超时
          setTimeout(() => {
            if (!useChatStore.getState().openclawConnected) {
              resolve({ success: false, message: '连接超时' })
            }
          }, 15000)
          
        } catch (error: any) {
          resolve({ success: false, message: `连接失败: ${error.message}` })
        }
      })

    } catch (error: any) {
      console.error('Failed to connect OpenClaw:', error)
      return { success: false, message: error.message || '连接失败' }
    } finally {
      useChatStore.getState().setTyping(false)
    }
  }

  /**
   * 断开 OpenClaw 连接
   */
  async disconnectOpenClaw(): Promise<void> {
    if (this.openclawWs) {
      this.openclawWs.close()
      this.openclawWs = null
    }
    
    useChatStore.getState().setOpenClawConnected(false)
    useChatStore.getState().setOpenClawSessionKey(null)
    
    useChatStore.getState().addMessage({
      id: this.genId(),
      role: 'system',
      content: '已断开 OpenClaw 连接。',
      timestamp: new Date(),
      status: 'sent'
    })
  }

  /**
   * 发送消息
   */
  sendMessage(content: string, type: 'chat' | 'action' = 'chat'): void {
    const state = useChatStore.getState()
    
    // 检查是否连接了 OpenClaw
    if (state.openclawConnected && this.openclawWs?.readyState === WebSocket.OPEN) {
      this.sendToOpenClaw(content)
      return
    }
    
    // 否则使用本地 WebSocket
    if (!this.socket?.connected) { 
      useChatStore.getState().setConnectionStatus('disconnected')
      return 
    }
    
    const msg: Message = { id: this.genId(), role: 'user', content, timestamp: new Date(), status: 'sending' }
    useChatStore.getState().addMessage(msg)
    this.socket.emit('chat:message', { type, content, sessionId: useChatStore.getState().currentSessionId || '', timestamp: new Date().toISOString() })
    setTimeout(() => useChatStore.getState().updateMessageStatus(msg.id, 'sent'), 100)
  }

  /**
   * 发送消息到 OpenClaw
   */
  private sendToOpenClaw(content: string): void {
    const msg: Message = { id: this.genId(), role: 'user', content, timestamp: new Date(), status: 'sending' }
    useChatStore.getState().addMessage(msg)
    useChatStore.getState().setTyping(true)

    if (this.openclawWs?.readyState === WebSocket.OPEN) {
      // OpenClaw Gateway 消息格式
      const message = JSON.stringify({
        type: 'message',
        content: content,
        timestamp: Date.now()
      })
      this.openclawWs.send(message)
      useChatStore.getState().updateMessageStatus(msg.id, 'sent')
      console.log('[OpenClaw] Sent message:', content)
    } else {
      useChatStore.getState().updateMessageStatus(msg.id, 'error')
      useChatStore.getState().addMessage({
        id: this.genId(),
        role: 'system',
        content: 'OpenClaw 连接已断开',
        timestamp: new Date(),
        status: 'error'
      })
      useChatStore.getState().setOpenClawConnected(false)
      useChatStore.getState().setTyping(false)
    }
  }

  clearHistory(): void {
    const sid = useChatStore.getState().currentSessionId
    if (this.socket?.connected && sid) this.socket.emit('chat:clear', { sessionId: sid })
    useChatStore.getState().clearMessages()
  }

  createNewSession(): void { 
    if (this.socket?.connected) this.socket.emit('create:session') 
  }
  
  loadSession(sessionId: string): void { 
    if (this.socket?.connected) this.socket.emit('join:chat', { sessionId })
    useChatStore.getState().setCurrentSession(sessionId)
  }
  
  disconnect(): void { 
    const sid = useChatStore.getState().currentSessionId
    if (this.socket) { 
      if (sid) this.socket.emit('leave:chat', { sessionId: sid })
      this.socket.disconnect()
      this.socket = null
    }
    if (this.openclawWs) {
      this.openclawWs.close()
      this.openclawWs = null
    }
    useChatStore.getState().setConnectionStatus('disconnected')
    useChatStore.getState().setOpenClawConnected(false)
  }
  
  reconnect(): void { 
    this.disconnect()
    this.reconnectAttempts = 0
    this.connect()
  }
  
  isConnected(): boolean { return this.socket?.connected ?? false }
  
  private genId(): string { return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }
}

export const chatService = new ChatService()
export default chatService