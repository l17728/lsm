import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'
import { useChatStore, type Message } from '../store/chatStore'
import axios from 'axios'

interface ServerMessage {
  type: 'message' | 'action' | 'error' | 'typing'
  payload: { id?: string; role: 'assistant' | 'system'; content: string; timestamp?: string; metadata?: Message['metadata'] }
}

// OpenClaw Gateway 帧格式（非标准 JSON-RPC）
interface OpenClawRequest {
  type: 'req'
  id: string
  method: string
  params?: Record<string, unknown>
}

interface OpenClawResponse {
  type: 'res'
  id: string
  ok: boolean
  payload?: any
  error?: { message: string; code?: number }
}

interface OpenClawEvent {
  type: 'event'
  event: string
  payload?: any
  seq?: number
}

class ChatService {
  private socket: Socket | null = null
  private openclawWs: WebSocket | null = null
  private reconnectAttempts = 0
  private openclawMessageHandler: ((data: any) => void) | null = null
  private openclawRequestId = 0
  private openclawAuthenticated = false
  private pendingMessages: string[] = []

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
      // 只在没有当前会话时才创建新会话
      const currentSessionId = useChatStore.getState().currentSessionId
      if (!currentSessionId) {
        this.socket?.emit('create:session')
      }
    })
    this.socket.on('disconnect', () => useChatStore.getState().setConnectionStatus('disconnected'))
    this.socket.on('connect_error', () => { if (++this.reconnectAttempts >= 5) useChatStore.getState().setConnectionStatus('disconnected') })
    this.socket.on('chat:message', (data: ServerMessage) => {
      useChatStore.getState().addMessage({ id: data.payload.id || this.genId(), role: data.payload.role, content: data.payload.content, timestamp: data.payload.timestamp ? new Date(data.payload.timestamp) : new Date(), status: 'sent', metadata: data.payload.metadata })
    })
    this.socket.on('chat:session', (data: { sessionId: string }) => {
      const state = useChatStore.getState()
      // 只在会话ID变化时才添加欢迎消息
      if (state.currentSessionId !== data.sessionId) {
        state.setCurrentSession(data.sessionId)
        // 只在没有消息时才显示欢迎消息（首次创建会话）
        if (state.messages.length === 0) {
          useChatStore.getState().addMessage({
            id: this.genId(),
            role: 'assistant',
            content: '你好！我是 LSM 智能助手。\n\n💡 点击右上角 <ApiOutlined /> 图标可连接 OpenClaw AI。',
            timestamp: new Date(),
            status: 'sent'
          })
        }
      }
    })
    this.socket.on('chat:typing', (data: { typing: boolean }) => useChatStore.getState().setTyping(data.typing))
    this.socket.on('chat:error', (err: { message: string }) => useChatStore.getState().addMessage({ id: this.genId(), role: 'system', content: `错误: ${err.message}`, timestamp: new Date(), status: 'error' }))
    this.socket.on('chat:history', (data: { messages: Message[] }) => useChatStore.getState().setMessages(data.messages))
  }

  /**
   * 连接 OpenClaw Gateway (WebSocket) - Challenge-Response 协议
   */
  async connectOpenClaw(gatewayToken: string): Promise<{ success: boolean; message: string }> {
    try {
      useChatStore.getState().setTyping(true)
      this.openclawRequestId = 0
      this.openclawAuthenticated = false
      this.pendingMessages = []
      
      // 断开现有 OpenClaw 连接
      if (this.openclawWs) {
        this.openclawWs.close()
        this.openclawWs = null
      }

      // OpenClaw Gateway WebSocket URL
      const host = window.location.hostname || 'localhost'
      const wsUrl = `ws://${host}:18789/`
      console.log('[OpenClaw] Connecting to:', wsUrl)
      
      return new Promise((resolve) => {
        try {
          this.openclawWs = new WebSocket(wsUrl)
          
          this.openclawWs.onopen = () => {
            console.log('[OpenClaw] WebSocket connected, sending connect...')
            // 直接发送 connect 请求（allowInsecureAuth 模式不发送 challenge）
            const connectReq: OpenClawRequest = {
              type: 'req',
              id: `connect-${Date.now()}`,
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                  id: 'openclaw-control-ui',
                  version: '2026.3.8',
                  platform: 'web',
                  mode: 'webchat'
                },
                auth: { token: gatewayToken },
                role: 'operator',
                scopes: ['operator.admin']
              }
            }
            this.openclawWs!.send(JSON.stringify(connectReq))
          }
          
          this.openclawWs.onmessage = (event) => {
            try {
              const rawData = event.data.toString()
              const data = JSON.parse(rawData)
              console.log('[OpenClaw] Received:', data)
              
              // 处理响应帧 (type: 'res')
              if (data.type === 'res') {
                console.log('[OpenClaw] Response:', data)
                
                if (data.ok && !this.openclawAuthenticated) {
                  // 只在首次连接成功时显示欢迎消息
                  this.openclawAuthenticated = true
                  useChatStore.getState().setOpenClawConnected(true)
                  useChatStore.getState().setOpenClawSessionKey('main')
                  useChatStore.getState().setOpenClawToken(gatewayToken)
                  useChatStore.getState().setTyping(false)
                    
                    useChatStore.getState().addMessage({
                      id: this.genId(),
                      role: 'system',
                      content: '✅ 已连接到 OpenClaw！可以开始对话了。\n\n我是大漂亮 🦐，你的贴心外星虾助手，有什么我可以帮你的吗？',
                      timestamp: new Date(),
                      status: 'sent'
                    })
                    
                    resolve({ success: true, message: '连接成功' })
                } else if (data.error) {
                  useChatStore.getState().setTyping(false)
                  const errorMsg = data.error?.message || '认证失败'
                  useChatStore.getState().addMessage({
                    id: this.genId(),
                    role: 'system',
                    content: `❌ 认证失败: ${errorMsg}`,
                    timestamp: new Date(),
                    status: 'error'
                  })
                  resolve({ success: false, message: errorMsg })
                }
                return
              }
              
              // 处理服务端推送事件 (type: 'event')
              if (data.type === 'event') {
                this.handleOpenClawEvent(data)
              }
              
            } catch (e) {
              console.error('[OpenClaw] Parse error:', e)
            }
          }
          
          this.openclawWs.onerror = (error) => {
            console.error('[OpenClaw] WebSocket error:', error)
            useChatStore.getState().setOpenClawConnected(false)
            useChatStore.getState().setTyping(false)
            resolve({ success: false, message: 'WebSocket 连接错误' })
          }
          
          this.openclawWs.onclose = (event) => {
            console.log('[OpenClaw] WebSocket closed:', event.code, event.reason)
            useChatStore.getState().setOpenClawConnected(false)
            useChatStore.getState().setTyping(false)
            this.openclawAuthenticated = false
          }
          
          // 设置超时
          setTimeout(() => {
            if (!useChatStore.getState().openclawConnected) {
              resolve({ success: false, message: '连接超时，请检查 Gateway 是否运行' })
            }
          }, 10000)
          
        } catch (error: any) {
          useChatStore.getState().setTyping(false)
          resolve({ success: false, message: `连接失败: ${error.message}` })
        }
      })

    } catch (error: any) {
      console.error('Failed to connect OpenClaw:', error)
      useChatStore.getState().setTyping(false)
      return { success: false, message: error.message || '连接失败' }
    }
  }

  /**
   * 发送请求到 OpenClaw Gateway（自定义帧格式）
   */
  private sendOpenClawRequest(method: string, params?: Record<string, unknown>): void {
    if (this.openclawWs?.readyState !== WebSocket.OPEN) return
    
    const request: OpenClawRequest = {
      type: 'req',
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      method,
      params
    }
    
    this.openclawWs.send(JSON.stringify(request))
    console.log('[OpenClaw] Sent request:', request)
  }

  /**
   * 处理 OpenClaw 推送事件
   */
  private handleOpenClawEvent(data: OpenClawEvent): void {
    const { event, payload } = data
    console.log('[OpenClaw] Event:', event, payload)
    
    switch (event) {
      case 'chat':
        // chat 事件格式: { state: 'delta' | 'final', message: { role, content, timestamp } }
        const message = payload?.message
        if (message?.role === 'assistant') {
          // content 可能是字符串或数组
          let content = message.content
          if (Array.isArray(content)) {
            content = content.map((c: any) => {
              if (typeof c === 'string') return c
              if (c?.type === 'text') return c.text
              return ''
            }).join('')
          }
          
          if (!content) break
          
          const state = payload?.state
          const messages = useChatStore.getState().messages
          const lastMsg = messages[messages.length - 1]
          
          if (state === 'delta') {
            // delta: 增量内容，追加到最后一条消息
            if (lastMsg?.role === 'assistant' && lastMsg.status === 'sent') {
              // 追加到最后一条消息
              const updatedMessages = [...messages]
              updatedMessages[messages.length - 1] = { 
                ...lastMsg, 
                content: lastMsg.content + content 
              }
              useChatStore.getState().setMessages(updatedMessages)
            } else {
              // 没有可追加的消息，创建新消息
              useChatStore.getState().addMessage({
                id: this.genId(),
                role: 'assistant',
                content: content,
                timestamp: new Date(),
                status: 'sent'
              })
            }
          } else if (state === 'final') {
            // final: 最终消息，直接更新最后一条消息的内容
            if (lastMsg?.role === 'assistant') {
              const updatedMessages = [...messages]
              updatedMessages[messages.length - 1] = { 
                ...lastMsg, 
                content: content 
              }
              useChatStore.getState().setMessages(updatedMessages)
            } else {
              // 没有可更新的消息，创建新消息
              useChatStore.getState().addMessage({
                id: this.genId(),
                role: 'assistant',
                content: content,
                timestamp: new Date(),
                status: 'sent'
              })
            }
            useChatStore.getState().setTyping(false)
          }
        }
        break
        
      case 'agent':
        // agent 事件格式: { stream: 'assistant' | 'tool_use', data: {...} }
        if (payload?.stream === 'assistant' && payload?.data) {
          // 流式响应，可能是增量内容
          const delta = payload.data
          if (delta?.content) {
            useChatStore.getState().setTyping(false)
            const messages = useChatStore.getState().messages
            const lastMsg = messages[messages.length - 1]
            if (lastMsg?.role === 'assistant' && lastMsg.status === 'sent') {
              const updatedMessages = [...messages]
              updatedMessages[messages.length - 1] = { 
                ...lastMsg, 
                content: lastMsg.content + delta.content 
              }
              useChatStore.getState().setMessages(updatedMessages)
            } else {
              useChatStore.getState().addMessage({
                id: this.genId(),
                role: 'assistant',
                content: delta.content,
                timestamp: new Date(),
                status: 'sent'
              })
            }
          }
        }
        break
        
      case 'chat.typing':
        useChatStore.getState().setTyping(payload?.typing ?? true)
        break
        
      case 'chat.error':
        useChatStore.getState().addMessage({
          id: this.genId(),
          role: 'system',
          content: `❌ 错误: ${payload?.message || '未知错误'}`,
          timestamp: new Date(),
          status: 'error'
        })
        break
        
      default:
        // 其他事件，尝试提取内容
        if (payload?.content || payload?.message?.content) {
          const content = payload.content || payload.message.content
          useChatStore.getState().addMessage({
            id: this.genId(),
            role: 'assistant',
            content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
            timestamp: new Date(),
            status: 'sent'
          })
          useChatStore.getState().setTyping(false)
        }
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
   * 发送消息到 OpenClaw (正确参数格式)
   */
  private sendToOpenClaw(content: string): void {
    const msg: Message = { id: this.genId(), role: 'user', content, timestamp: new Date(), status: 'sending' }
    useChatStore.getState().addMessage(msg)
    useChatStore.getState().setTyping(true)

    if (this.openclawWs?.readyState === WebSocket.OPEN && this.openclawAuthenticated) {
      // 使用正确的 chat.send 参数格式
      this.sendOpenClawRequest('chat.send', {
        sessionKey: 'main',
        message: content,
        idempotencyKey: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })
      useChatStore.getState().updateMessageStatus(msg.id, 'sent')
      console.log('[OpenClaw] Sent message:', content)
    } else {
      useChatStore.getState().updateMessageStatus(msg.id, 'error')
      useChatStore.getState().addMessage({
        id: this.genId(),
        role: 'system',
        content: 'OpenClaw 连接已断开或未认证',
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