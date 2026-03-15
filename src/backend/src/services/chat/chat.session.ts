/**
 * Chat Session Management Service
 * Handles user session creation, storage, and lifecycle
 */

import { v4 as uuidv4 } from 'uuid'

const SESSION_CONFIG = {
  maxSessionsPerUser: 5,
  sessionTimeout: 30 * 60 * 1000,
  cleanupInterval: 5 * 60 * 1000,
}

export interface ChatSession {
  id: string
  userId: string
  createdAt: Date
  lastActivityAt: Date
  messageCount: number
}

export interface SessionMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  status: 'sending' | 'sent' | 'error'
}

const sessions = new Map<string, ChatSession>()
const messages = new Map<string, SessionMessage[]>()

class ChatSessionManager {
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor() {
    this.startCleanupTimer()
  }

  createSession(userId: string): ChatSession {
    const sessionId = uuidv4()
    const now = new Date()
    const session: ChatSession = { id: sessionId, userId, createdAt: now, lastActivityAt: now, messageCount: 0 }
    sessions.set(sessionId, session)
    messages.set(sessionId, [])
    this.enforceSessionLimit(userId)
    return session
  }

  getSession(sessionId: string): ChatSession | undefined {
    return sessions.get(sessionId)
  }

  getUserSessions(userId: string): ChatSession[] {
    return Array.from(sessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
  }

  touchSession(sessionId: string): boolean {
    const session = sessions.get(sessionId)
    if (session) { session.lastActivityAt = new Date(); return true }
    return false
  }

  addMessage(sessionId: string, message: Omit<SessionMessage, 'sessionId'>): SessionMessage | null {
    const session = sessions.get(sessionId)
    if (!session) return null
    const sessionMessage: SessionMessage = { ...message, sessionId }
    const sessionMessages = messages.get(sessionId) || []
    sessionMessages.push(sessionMessage)
    messages.set(sessionId, sessionMessages)
    session.messageCount = sessionMessages.length
    session.lastActivityAt = new Date()
    return sessionMessage
  }

  getMessages(sessionId: string, limit = 50): SessionMessage[] {
    return (messages.get(sessionId) || []).slice(-limit)
  }

  clearMessages(sessionId: string): boolean {
    const session = sessions.get(sessionId)
    if (!session) return false
    messages.set(sessionId, [])
    session.messageCount = 0
    return true
  }

  deleteSession(sessionId: string): boolean {
    if (!sessions.get(sessionId)) return false
    sessions.delete(sessionId)
    messages.delete(sessionId)
    return true
  }

  private enforceSessionLimit(userId: string): void {
    const userSessions = this.getUserSessions(userId)
    if (userSessions.length > SESSION_CONFIG.maxSessionsPerUser) {
      userSessions.slice(SESSION_CONFIG.maxSessionsPerUser).forEach(s => this.deleteSession(s.id))
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      sessions.forEach((session, id) => {
        if (now - session.lastActivityAt.getTime() > SESSION_CONFIG.sessionTimeout) this.deleteSession(id)
      })
    }, SESSION_CONFIG.cleanupInterval)
  }

  stopCleanupTimer(): void { if (this.cleanupTimer) clearInterval(this.cleanupTimer) }
}

export const chatSessionManager = new ChatSessionManager()
export default chatSessionManager