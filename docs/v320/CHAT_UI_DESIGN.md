# LSM v3.2.0 Chat UI 设计文档

**版本**: 3.2.0 | **日期**: 2026-03-15 | **作者**: Frontend Team

---

## 1. 组件架构

```
ChatWidget/
├── ChatWindow.tsx      # 主容器组件
├── ChatMessage.tsx     # 消息气泡组件
├── ChatInput.tsx       # 输入框组件
└── ChatWindow.css      # 样式文件
```

---

## 2. 组件设计

### 2.1 ChatWindow (聊天窗口)

**职责**: 聊天容器，管理消息列表滚动和整体布局

**Props**:
```typescript
interface ChatWindowProps {
  isOpen: boolean;           // 窗口开关状态
  onClose: () => void;       // 关闭回调
  position?: 'bottom-right' | 'bottom-left';
}
```

**状态**:
- `messages: Message[]` - 消息列表
- `isLoading: boolean` - 加载状态
- `connectionStatus: 'connected' | 'disconnected' | 'connecting'`

**布局**:
```
┌─────────────────────────────┐
│  🤖 LSM Agent        [×][−] │  <- Header (可折叠)
├─────────────────────────────┤
│                             │
│  [消息气泡列表区域]           │  <- 消息滚动区
│  (自动滚动到底部)            │
│                             │
├─────────────────────────────┤
│  [输入框] [发送按钮]         │  <- 输入区域
└─────────────────────────────┘
```

---

### 2.2 ChatMessage (消息气泡)

**职责**: 渲染单条消息，区分用户/Agent，支持 Markdown

**Props**:
```typescript
interface ChatMessageProps {
  message: Message;
  isLast?: boolean;
}
```

**消息类型**:
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  metadata?: {
    actionType?: 'query' | 'execute' | 'confirm';
    needsConfirmation?: boolean;
    relatedEntity?: string;
  };
}
```

**视觉区分**:
| 角色 | 对齐 | 背景 | 头像 |
|------|------|------|------|
| user | 右对齐 | #1890ff | 用户头像 |
| assistant | 左对齐 | #f0f0f0 | 机器人图标 |
| system | 居中 | #fffbe6 | 警告图标 |

---

### 2.3 ChatInput (输入框)

**职责**: 用户输入、命令补全、快捷指令

**Props**:
```typescript
interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}
```

**功能**:
- 自动高度调整 (1-4 行)
- Enter 发送 / Shift+Enter 换行
- 快捷指令提示 (/help, /status, /allocate 等)
- 发送状态指示器

**快捷指令**:
| 指令 | 描述 |
|------|------|
| /help | 显示帮助 |
| /status | 查看资源状态 |
| /allocate | 分配资源 |
| /release | 释放资源 |
| /cancel | 取消当前操作 |

---

## 3. WebSocket 连接 (useChat Hook)

### 3.1 连接管理

```typescript
interface UseChatReturn {
  messages: Message[];
  sendMessage: (content: string) => void;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  clearHistory: () => void;
}
```

### 3.2 消息协议

```typescript
// 客户端 → 服务端
interface ClientMessage {
  type: 'chat' | 'command' | 'confirm' | 'cancel';
  content: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

// 服务端 → 客户端
interface ServerMessage {
  type: 'message' | 'action' | 'error' | 'status';
  payload: Message | ActionPayload | ErrorPayload;
}
```

---

## 4. 核心交互流程

### 4.1 正常对话

```
用户输入 → WebSocket发送 → Agent处理 → 返回响应 → 更新UI
```

### 4.2 需确认操作

```
用户输入 → Agent返回确认请求 → 显示确认卡片
   → 用户确认/取消 → Agent执行 → 返回结果
```

---

## 5. 样式规范

### 5.1 主题适配

使用 CSS 变量实现明暗主题切换:

```css
.chat-window {
  --chat-bg: var(--bg-primary);
  --chat-user-bubble: #1890ff;
  --chat-agent-bubble: var(--bg-secondary);
  --chat-text: var(--text-primary);
}
```

### 5.2 动画

| 动画 | 时长 | 曲线 |
|------|------|------|
| 窗口展开 | 200ms | ease-out |
| 消息滑入 | 150ms | ease |
| 打字指示器 | 1.4s | 循环 |

---

## 6. 响应式设计

| 断点 | 布局 | 尺寸 |
|------|------|------|
| Desktop | 浮动窗口 | 400px × 600px |
| Tablet | 浮动窗口 | 350px × 500px |
| Mobile | 全屏模态 | 100vw × 100vh |

---

## 7. 错误处理

| 场景 | 处理方式 |
|------|---------|
| 连接断开 | 显示重连按钮 + 自动重连 (指数退避) |
| 发送失败 | 消息标记错误 + 重试按钮 |
| Agent 超时 | 显示超时提示 + 建议重试 |
| 权限不足 | 显示权限提示 + 引导联系管理员 |

---

## 8. 无障碍支持

- ARIA 标签完整
- 键盘导航支持
- 屏幕阅读器友好
- 高对比度模式兼容

---

## 9. 文件清单

| 文件 | 职责 |
|------|------|
| ChatWindow.tsx | 主容器组件 |
| ChatMessage.tsx | 消息气泡组件 |
| ChatInput.tsx | 输入框组件 |
| useChat.ts | WebSocket 连接 Hook |
| ChatWindow.css | 样式文件 |

---

*维护者: LSM 前端团队*