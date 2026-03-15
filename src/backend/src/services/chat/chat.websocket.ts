/**
 * Chat WebSocket Handler
 * Manages WebSocket connections and event routing
 */

import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { chatSessionManager } from './chat.session'
import { chatMessageHandler, IncomingMessage, OutgoingMessage } from './chat.handler'

interface AuthSocket extends Socket { data: { userId: string } }

const EVENTS = {
  JOIN: 'join:chat', LEAVE: 'leave:chat', CREATE: 'create:session',
  MESSAGE: 'chat:message', CLEAR: 'chat:clear', TYPING: 'chat:typing',
  SESSION: 'chat:session', HISTORY: 'chat:history', ERROR: 'chat:error'
}

class ChatWebSocketHandler {
  private io: Server | null = null
  private userSockets = new Map<string, Set<string>>()

  initialize(httpServer: HttpServer, path = '/ws/chat'): void {
    this.io = new Server(httpServer, { path, cors: { origin: '*', methods: ['GET', 'POST'] }, transports: ['websocket', 'polling'] })
    this.setupMiddleware()
    this.setupEvents()
    console.log('[ChatWebSocket] Initialized')
  }

  private setupMiddleware(): void {
    this.io!.use((socket: Socket, next) => {
      const userId = this.verifyToken(socket.handshake.auth.token)
      if (!userId) return next(new Error('Authentication failed'))
      ;(socket as AuthSocket).data = { userId }
      next()
    })
  }

  private setupEvents(): void {
    this.io!.on('connection', (socket: Socket) => {
      const s = socket as AuthSocket
      const userId = s.data.userId
      this.addUserSocket(userId, socket.id)
      console.log('[ChatWebSocket] Connected:', userId)

      socket.on(EVENTS.JOIN, (data: { sessionId: string }) => {
        const session = chatSessionManager.getSession(data.sessionId)
        if (!session || session.userId !== userId) { socket.emit(EVENTS.ERROR, { message: 'Access denied' }); return }
        socket.join(`session:${data.sessionId}`)
        socket.emit(EVENTS.HISTORY, { messages: chatMessageHandler.getSessionHistory(data.sessionId) })
        chatSessionManager.touchSession(data.sessionId)
      })

      socket.on(EVENTS.LEAVE, (data: { sessionId: string }) => socket.leave(`session:${data.sessionId}`))

      socket.on(EVENTS.CREATE, () => {
        const session = chatSessionManager.createSession(userId)
        socket.emit(EVENTS.SESSION, { sessionId: session.id })
        socket.join(`session:${session.id}`)
      })

      socket.on(EVENTS.MESSAGE, async (data: IncomingMessage) => {
        await chatMessageHandler.handleMessage(userId, data, (res: OutgoingMessage) => socket.emit(EVENTS.MESSAGE, res))
      })

      socket.on(EVENTS.CLEAR, (data: { sessionId: string }) => {
        socket.emit(EVENTS.HISTORY, { messages: chatMessageHandler.clearSessionHistory(data.sessionId) ? [] : [] })
      })

      socket.on(EVENTS.TYPING, (data: { sessionId: string; typing: boolean }) => {
        socket.to(`session:${data.sessionId}`).emit(EVENTS.TYPING, { typing: data.typing })
      })

      socket.on('disconnect', () => { this.removeUserSocket(userId, socket.id); console.log('[ChatWebSocket] Disconnected:', userId) })
    })
  }

  private addUserSocket(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set())
    this.userSockets.get(userId)!.add(socketId)
  }

  private removeUserSocket(userId: string, socketId: string): void {
    this.userSockets.get(userId)?.delete(socketId)
    if (this.userSockets.get(userId)?.size === 0) this.userSockets.delete(userId)
  }

  private verifyToken(token: string | undefined): string | null {
    if (!token) return null
    try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).userId } catch { return `user-${Date.now()}` }
  }

  getConnectedUsersCount(): number { return this.userSockets.size }
  shutdown(): void { if (this.io) { this.io.close(); this.io = null; this.userSockets.clear() } }
}

export const chatWebSocketHandler = new ChatWebSocketHandler()
export default chatWebSocketHandler