import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatWindow from '../ChatWindow'

// Mock useChat hook
const mockSendMessage = vi.fn()
const mockClearHistory = vi.fn()
const mockRetry = vi.fn()

vi.mock('../../../hooks/useChat', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: mockSendMessage,
    isConnected: true,
    connectionStatus: 'connected',
    clearHistory: mockClearHistory,
    retry: mockRetry,
  }),
}))

vi.mock('uuid', () => ({ v4: () => 'test-uuid-123' }))

describe('ChatWindow', () => {
  const defaultProps = { isOpen: true, onClose: vi.fn() }

  beforeEach(() => vi.clearAllMocks())

  describe('渲染测试', () => {
    it('当 isOpen 为 false 时不渲染', () => {
      render(<ChatWindow {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('LSM Agent')).not.toBeInTheDocument()
    })

    it('正常渲染聊天窗口标题', () => {
      render(<ChatWindow {...defaultProps} />)
      expect(screen.getByText('LSM Agent')).toBeInTheDocument()
    })

    it('渲染欢迎消息', () => {
      render(<ChatWindow {...defaultProps} />)
      expect(screen.getByText('智能实验室运维助手')).toBeInTheDocument()
      expect(screen.getByText(/输入自然语言描述您的需求/)).toBeInTheDocument()
    })
  })

  describe('交互测试', () => {
    it('点击关闭按钮调用 onClose', async () => {
      const onClose = vi.fn()
      render(<ChatWindow {...defaultProps} onClose={onClose} />)
      const closeBtn = document.querySelector('.chat-header-btn.close')
      fireEvent.click(closeBtn!)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('点击最小化按钮最小化窗口', async () => {
      render(<ChatWindow {...defaultProps} />)
      const minimizeBtn = document.querySelector('.chat-header-btn:not(.close)')
      fireEvent.click(minimizeBtn!)
      await waitFor(() => {
        expect(document.querySelector('.chat-window.minimized')).toBeTruthy()
      })
    })

    it('输入框可以输入文本', async () => {
      const user = userEvent.setup()
      render(<ChatWindow {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('输入消息或指令...')
      await user.type(textarea, '测试消息')
      expect(textarea).toHaveValue('测试消息')
    })
  })

  describe('位置测试', () => {
    it('默认位置为 bottom-right', () => {
      render(<ChatWindow {...defaultProps} />)
      expect(document.querySelector('.chat-window.bottom-right')).toBeTruthy()
    })

    it('可以设置为 bottom-left', () => {
      render(<ChatWindow {...defaultProps} position="bottom-left" />)
      expect(document.querySelector('.chat-window.bottom-left')).toBeTruthy()
    })
  })

  describe('断开连接状态', () => {
    it('显示断开连接提示', () => {
      vi.mock('../../../hooks/useChat', () => ({
        useChat: () => ({
          messages: [],
          sendMessage: mockSendMessage,
          isConnected: false,
          connectionStatus: 'disconnected',
          clearHistory: mockClearHistory,
          retry: mockRetry,
        }),
      }))
      render(<ChatWindow {...defaultProps} />)
      const textarea = screen.getByPlaceholderText('连接已断开...')
      expect(textarea).toBeDisabled()
    })
  })
})