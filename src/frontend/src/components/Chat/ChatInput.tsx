import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Tooltip, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  SendOutlined,
  QuestionCircleOutlined,
  CloudServerOutlined,
  RocketOutlined,
  ReloadOutlined,
  StopOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import './ChatInput.css'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

// 快捷指令列表
const QUICK_COMMANDS = [
  { key: '/help', icon: <QuestionCircleOutlined />, label: '帮助', desc: '显示帮助信息' },
  { key: '/status', icon: <CloudServerOutlined />, label: '状态', desc: '查看资源状态' },
  { key: '/allocate', icon: <RocketOutlined />, label: '分配', desc: '分配服务器资源' },
  { key: '/release', icon: <StopOutlined />, label: '释放', desc: '释放服务器资源' },
  { key: '/cancel', icon: <ReloadOutlined />, label: '取消', desc: '取消当前操作' },
]

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = '输入消息...',
}) => {
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showCommandHint, setShowCommandHint] = useState(false)
  const [filteredCommands, setFilteredCommands] = useState(QUICK_COMMANDS)

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 120)
      textarea.style.height = `${newHeight}px`
    }
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [inputValue, adjustHeight])

  // 检测命令输入
  useEffect(() => {
    if (inputValue.startsWith('/')) {
      const query = inputValue.toLowerCase()
      const filtered = QUICK_COMMANDS.filter(cmd => 
        cmd.key.toLowerCase().startsWith(query) ||
        cmd.label.toLowerCase().includes(query.slice(1))
      )
      setFilteredCommands(filtered)
      setShowCommandHint(filtered.length > 0)
    } else {
      setShowCommandHint(false)
    }
  }, [inputValue])

  const handleSend = () => {
    if (inputValue.trim() && !disabled) {
      onSend(inputValue.trim())
      setInputValue('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 发送, Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    // Tab 补全命令
    if (e.key === 'Tab' && showCommandHint && filteredCommands.length > 0) {
      e.preventDefault()
      setInputValue(filteredCommands[0].key + ' ')
      setShowCommandHint(false)
    }
    // Escape 关闭提示
    if (e.key === 'Escape') {
      setShowCommandHint(false)
    }
  }

  const handleCommandClick = (command: typeof QUICK_COMMANDS[0]) => {
    setInputValue(command.key + ' ')
    setShowCommandHint(false)
    textareaRef.current?.focus()
  }

  // 快捷命令下拉菜单
  const commandMenuItems: MenuProps['items'] = QUICK_COMMANDS.map(cmd => ({
    key: cmd.key,
    icon: cmd.icon,
    label: `${cmd.key} - ${cmd.desc}`,
    onClick: () => handleCommandClick(cmd),
  }))

  return (
    <div className={`chat-input-container ${isFocused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}>
      {/* 命令提示 */}
      {showCommandHint && (
        <div className="command-hints">
          {filteredCommands.map(cmd => (
            <div
              key={cmd.key}
              className="command-hint-item"
              onClick={() => handleCommandClick(cmd)}
            >
              <span className="command-key">{cmd.key}</span>
              <span className="command-label">{cmd.label}</span>
              <span className="command-desc">{cmd.desc}</span>
            </div>
          ))}
        </div>
      )}

      <div className="chat-input-wrapper">
        {/* 快捷命令按钮 */}
        <Dropdown
          menu={{ items: commandMenuItems }}
          trigger={['click']}
          disabled={disabled}
        >
          <Tooltip title="快捷指令">
            <Button 
              type="text" 
              className="input-action-btn"
              icon={<MenuOutlined />}
              disabled={disabled}
            />
          </Tooltip>
        </Dropdown>

        {/* 输入框 */}
        <textarea
          ref={textareaRef}
          className="chat-input-textarea"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
        />

        {/* 发送按钮 */}
        <Tooltip title={inputValue ? '发送 (Enter)' : '请输入消息'}>
          <Button
            type="primary"
            className="send-btn"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={disabled || !inputValue.trim()}
          />
        </Tooltip>
      </div>

      {/* 快捷提示 */}
      <div className="chat-input-hints">
        <span className="hint-item">Enter 发送</span>
        <span className="hint-divider">|</span>
        <span className="hint-item">Shift+Enter 换行</span>
        <span className="hint-divider">|</span>
        <span className="hint-item">/ 调用命令</span>
      </div>
    </div>
  )
}

export default ChatInput