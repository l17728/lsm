import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChatPage from '../ChatPage'

vi.mock('../ChatPage.css', () => ({}))

vi.mock('../../store/chatStore', () => ({
  useChatStore: vi.fn(() => ({
    messages: [],
    connectionStatus: 'disconnected',
    isTyping: false,
    sessions: [],
    clearMessages: vi.fn(),
    setCurrentSession: vi.fn(),
    openclawConnected: false,
    openclawToken: null,
  })),
}))

vi.mock('../../services/chat.service', () => ({
  default: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendMessage: vi.fn(),
    clearHistory: vi.fn(),
    connectOpenClaw: vi.fn().mockResolvedValue({ success: true, message: 'connected' }),
    disconnectOpenClaw: vi.fn(),
    createNewSession: vi.fn(),
    loadSession: vi.fn(),
    reconnect: vi.fn(),
  },
}))

describe('ChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<ChatPage />)
    expect(container).toBeTruthy()
  })

  it('renders chat interface', () => {
    render(<ChatPage />)
    // Use getAllByText since there may be multiple elements with this text
    const elements = screen.getAllByText('LSM Agent')
    expect(elements.length).toBeGreaterThan(0)
  })
})
