import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'

// 消息类型定义
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  status?: 'sending' | 'sent' | 'error'
  metadata?: {
    actionType?: 'query' | 'execute' | 'confirm'
    needsConfirmation?: boolean
    relatedEntity?: string
    actionPayload?: Record<string, unknown>
  }
}

// 连接状态类型
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

// 服务端消息类型
interface ServerMessage {
  type: 'message' | 'action' | 'error' | 'status'
  payload: {
    id?: string
    role: 'assistant' | 'system'
    content: string
    timestamp?: string
    metadata?: Message['metadata']
  }
}

// Hook 返回类型
interface UseChatReturn {
  messages: Message[]
  sendMessage: (content: string) => void
  isConnected: boolean
  connectionStatus: ConnectionStatus
  clearHistory: () => void
  retry: () => void
}

// 生成唯一 ID
const generateId = (): string => {
  return uuidv4()
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const socketRef = useRef<Socket | null>(null)
  const sessionIdRef = useRef<string>(generateId())
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const { token, isAuthenticated } = useAuthStore()

  // 初始化 WebSocket 连接
  const initSocket = useCallback(() => {
    if (socketRef.current?.connected) {
      return
    }

    setConnectionStatus('connecting')

    const socket = io({
      path: '/ws/chat',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current = socket

    // 连接成功
    socket.on('connect', () => {
      console.log('[Chat] WebSocket connected')
      setConnectionStatus('connected')
      reconnectAttemptsRef.current = 0
      
      // 加入聊天会话
      socket.emit('join:chat', { sessionId: sessionIdRef.current })
    })

    // 连接断开
    socket.on('disconnect', (reason) => {
      console.log('[Chat] WebSocket disconnected:', reason)
      setConnectionStatus('disconnected')
    })

    // 连接错误
    socket.on('connect_error', (error) => {
      console.error('[Chat] WebSocket connection error:', error)
      reconnectAttemptsRef.current += 1
      
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setConnectionStatus('disconnected')
      }
    })

    // 接收消息
    socket.on('chat:message', (data: ServerMessage) => {
      const message: Message = {
        id: data.payload.id || generateId(),
        role: data.payload.role,
        content: data.payload.content,
        timestamp: data.payload.timestamp ? new Date(data.payload.timestamp) : new Date(),
        metadata: data.payload.metadata,
      }
      
      setMessages(prev => [...prev, message])
    })

    // 接收错误
    socket.on('chat:error', (error: { message: string; code?: string }) => {
      const errorMessage: Message = {
        id: generateId(),
        role: 'system',
        content: `错误: ${error.message}`,
        timestamp: new Date(),
      }
      
      setMessages(prev => [...prev, errorMessage])
    })

    // 状态更新
    socket.on('chat:status', (data: { typing: boolean; action?: string }) => {
      // 可以在这里处理打字指示器等状态
      console.log('[Chat] Status:', data)
    })

    return socket
  }, [token])

  // 断开连接
  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('leave:chat', { sessionId: sessionIdRef.current })
      socketRef.current.disconnect()
      socketRef.current = null
    }
  }, [])

  // 发送消息
  const sendMessage = useCallback((content: string) => {
    if (!socketRef.current?.connected) {
      console.error('[Chat] Socket not connected')
      
      // 添加错误提示
      const errorMessage: Message = {
        id: generateId(),
        role: 'system',
        content: '连接已断开，请稍后重试',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
      return
    }

    // 添加用户消息
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'sending',
    }

    setMessages(prev => [...prev, userMessage])

    // 发送到服务端
    socketRef.current.emit('chat:message', {
      type: 'chat',
      content,
      sessionId: sessionIdRef.current,
      timestamp: new Date().toISOString(),
    })

    // 更新消息状态为已发送
    setTimeout(() => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, status: 'sent' } 
            : msg
        )
      )
    }, 100)
  }, [])

  // 清空历史
  const clearHistory = useCallback(() => {
    setMessages([])
    
    // 通知服务端清空会话
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:clear', { sessionId: sessionIdRef.current })
    }
  }, [])

  // 重试连接
  const retry = useCallback(() => {
    disconnectSocket()
    reconnectAttemptsRef.current = 0
    initSocket()
  }, [disconnectSocket, initSocket])

  // 初始化连接
  useEffect(() => {
    if (isAuthenticated && token) {
      initSocket()
    }

    return () => {
      disconnectSocket()
    }
  }, [isAuthenticated, token, initSocket, disconnectSocket])

  return {
    messages,
    sendMessage,
    isConnected: connectionStatus === 'connected',
    connectionStatus,
    clearHistory,
    retry,
  }
}

export default useChat