import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  status?: 'sending' | 'sent' | 'error'
  metadata?: { actionType?: 'query' | 'execute' | 'confirm'; needsConfirmation?: boolean; relatedEntity?: string; actionPayload?: Record<string, unknown> }
}

export interface ChatSession { id: string; title: string; createdAt: Date; updatedAt: Date; messageCount: number }
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

interface ChatState {
  messages: Message[]
  currentSessionId: string | null
  sessions: ChatSession[]
  connectionStatus: ConnectionStatus
  isTyping: boolean
  unreadCount: number
  // OpenClaw 配置
  openclawToken: string | null
  openclawConnected: boolean
  openclawSessionKey: string | null
  addMessage: (message: Message) => void
  updateMessageStatus: (id: string, status: Message['status']) => void
  setMessages: (messages: Message[]) => void
  clearMessages: () => void
  setCurrentSession: (sessionId: string | null) => void
  addSession: (session: ChatSession) => void
  updateSession: (id: string, updates: Partial<ChatSession>) => void
  removeSession: (id: string) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setTyping: (isTyping: boolean) => void
  incrementUnread: () => void
  clearUnread: () => void
  // OpenClaw 相关
  setOpenClawToken: (token: string | null) => void
  setOpenClawConnected: (connected: boolean) => void
  setOpenClawSessionKey: (key: string | null) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [], currentSessionId: null, sessions: [], connectionStatus: 'disconnected', isTyping: false, unreadCount: 0,
      openclawToken: null, openclawConnected: false, openclawSessionKey: null,
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      updateMessageStatus: (id, status) => set((state) => ({ messages: state.messages.map((m) => m.id === id ? { ...m, status } : m) })),
      setMessages: (messages) => set({ messages }),
      clearMessages: () => set({ messages: [] }),
      setCurrentSession: (sessionId) => set({ currentSessionId: sessionId, unreadCount: 0 }),
      addSession: (session) => set((state) => ({ sessions: [session, ...state.sessions] })),
      updateSession: (id, updates) => set((state) => ({ sessions: state.sessions.map((s) => s.id === id ? { ...s, ...updates } : s) })),
      removeSession: (id) => set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id), currentSessionId: state.currentSessionId === id ? null : state.currentSessionId })),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setTyping: (isTyping) => set({ isTyping }),
      incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
      clearUnread: () => set({ unreadCount: 0 }),
      // OpenClaw 相关
      setOpenClawToken: (token) => set({ openclawToken: token }),
      setOpenClawConnected: (connected) => set({ openclawConnected: connected }),
      setOpenClawSessionKey: (key) => set({ openclawSessionKey: key }),
    }),
    { 
      name: 'chat-storage', 
      partialize: (state) => ({ 
        currentSessionId: state.currentSessionId, 
        sessions: state.sessions,
        openclawToken: state.openclawToken
      }) 
    }
  )
)

export default useChatStore