import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'

type EventCallback = (data: any) => void

class WebSocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Set<EventCallback>> = new Map()

  connect() {
    if (this.socket?.connected) {
      return
    }

    const token = useAuthStore.getState().token

    this.socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    this.socket.on('connect', () => {
      console.log('WebSocket connected')

      // Join user room
      const userId = useAuthStore.getState().user?.id
      if (userId) {
        this.socket?.emit('join:user', userId)
      }

      // Subscribe to updates
      this.socket?.emit('subscribe:servers')
      this.socket?.emit('subscribe:gpus')
      this.socket?.emit('subscribe:tasks')
    })

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
    })

    this.socket.on('servers:update', (data) => {
      this.emit('servers:update', data)
    })

    this.socket.on('gpus:update', (data) => {
      this.emit('gpus:update', data)
    })

    this.socket.on('tasks:update', (data) => {
      this.emit('tasks:update', data)
    })

    this.socket.on('task:update', (data) => {
      this.emit('task:update', data)
    })

    this.socket.on('gpu:allocated', (data) => {
      this.emit('gpu:allocated', data)
    })

    this.socket.on('gpu:released', (data) => {
      this.emit('gpu:released', data)
    })

    this.socket.on('alerts:new', (data) => {
      this.emit('alerts:new', data)
    })

    this.socket.on('alert', (data) => {
      this.emit('alert', data)
    })

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((callback) => callback(data))
  }

  isConnected() {
    return this.socket?.connected ?? false
  }
}

export const wsService = new WebSocketService()
export default wsService
