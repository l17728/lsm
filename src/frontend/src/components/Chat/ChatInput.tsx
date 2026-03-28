import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Tooltip, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { useTranslation } from 'react-i18next'
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

// quick command list - labels/desc will be translated inside component
interface CommandItem {
  key: string
  icon: React.ReactNode
  label: string
  desc: string
}

const QUICK_COMMANDS: CommandItem[] = [
  { key: '/help', icon: <QuestionCircleOutlined />, label: 'help.label', desc: 'help.desc' },
  { key: '/status', icon: <CloudServerOutlined />, label: 'status.label', desc: 'status.desc' },
  { key: '/allocate', icon: <RocketOutlined />, label: 'allocate.label', desc: 'allocate.desc' },
  { key: '/release', icon: <StopOutlined />, label: 'release.label', desc: 'release.desc' },
  { key: '/cancel', icon: <ReloadOutlined />, label: 'cancel.label', desc: 'cancel.desc' },
]

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder,
}) => {
  const { t } = useTranslation()
  const inputPlaceholder = placeholder || t('chat.inputPlaceholder')

  // quick commands list - labels/desc will be translated in component
  const quickCommands = QUICK_COMMANDS.map(cmd => ({
    ...cmd,
    label: t(`chat.commands.${cmd.label}`),
    desc: t(`chat.commands.${cmd.desc}`),
  }))

  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showCommandHint, setShowCommandHint] = useState(false)
  const [filteredCommands, setFilteredCommands] = useState(quickCommands)

  // auto-adjust height
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

  // detect command input
  useEffect(() => {
    if (inputValue.startsWith('/')) {
      const query = inputValue.toLowerCase()
      const filtered = quickCommands.filter(cmd => 
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
    // Enter send, Shift+Enter newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    // Tab complete command
    if (e.key === 'Tab' && showCommandHint && filteredCommands.length > 0) {
      e.preventDefault()
      setInputValue(filteredCommands[0].key + ' ')
      setShowCommandHint(false)
    }
    // Escape close hint
    if (e.key === 'Escape') {
      setShowCommandHint(false)
    }
  }

  const handleCommandClick = (command: typeof quickCommands[0]) => {
    setInputValue(command.key + ' ')
    setShowCommandHint(false)
    textareaRef.current?.focus()
  }

  // quick commands dropdown menu
  const commandMenuItems: MenuProps['items'] = quickCommands.map(cmd => ({
    key: cmd.key,
    icon: cmd.icon,
    label: `${cmd.key} - ${cmd.desc}`,
    onClick: () => handleCommandClick(cmd),
  }))

  return (
    <div className={`chat-input-container ${isFocused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}>
      {/* command prompt */}
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
        {/* quick command button */}
        <Dropdown
          menu={{ items: commandMenuItems }}
          trigger={['click']}
          disabled={disabled}
        >
          <Tooltip title={t('chat.quickCommands')}>
            <Button 
              type="text" 
              className="input-action-btn"
              icon={<MenuOutlined />}
              disabled={disabled}
            />
          </Tooltip>
        </Dropdown>

        {/* input box */}
        <textarea
          ref={textareaRef}
          className="chat-input-textarea"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={inputPlaceholder}
          disabled={disabled}
          rows={1}
        />

        {/* send button */}
        <Tooltip title={inputValue ? t('chat.send') + ' (Enter)' : t('chat.inputPlaceholder')}>
          <Button
            type="primary"
            className="send-btn"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={disabled || !inputValue.trim()}
          />
        </Tooltip>
      </div>

      {/* quick prompt */}
      <div className="chat-input-hints">
        <span className="hint-item">{t('chat.send')}</span>
        <span className="hint-divider">|</span>
        <span className="hint-item">{t('chat.newline')}</span>
        <span className="hint-divider">|</span>
        <span className="hint-item">{t('chat.commandTip')}</span>
      </div>
    </div>
  )
}

export default ChatInput