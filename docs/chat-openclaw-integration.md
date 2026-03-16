# LSM Chat OpenClaw 集成指南

> 记录 LSM Web 管理平台 Chat 页面集成 OpenClaw AI 的完整过程。

## 背景

LSM (Laboratory System Management) 是一个实验室资源管理系统，需要在 Web 管理平台的 Chat 页面集成 OpenClaw AI 对话功能，让用户可以通过自然语言与系统交互。

## 架构

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  LSM Frontend   │ ◄───────────────► │  OpenClaw        │
│  (React + AntD) │    ws://IP:18789   │  Gateway         │
│  Port: 8081     │                    │  Port: 18789     │
└─────────────────┘                    └──────────────────┘
```

## OpenClaw Gateway 协议

### 帧格式

OpenClaw Gateway 使用**自定义帧格式**，不是标准 JSON-RPC 2.0：

#### 请求帧 (Request)
```json
{
  "type": "req",
  "id": "unique-request-id",
  "method": "methodName",
  "params": { ... }
}
```

#### 响应帧 (Response)
```json
{
  "type": "res",
  "id": "unique-request-id",
  "ok": true,
  "payload": { ... }
}
```

#### 事件帧 (Event)
```json
{
  "type": "event",
  "event": "eventName",
  "payload": { ... },
  "seq": 123
}
```

### 认证流程

#### 1. 建立连接
```javascript
const ws = new WebSocket('ws://127.0.0.1:18789');
```

#### 2. 收到 Challenge
连接后 Gateway 发送：
```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": {
    "nonce": "uuid-challenge-nonce",
    "ts": 1234567890
  }
}
```

#### 3. 发送认证请求
```json
{
  "type": "req",
  "id": "connect-123",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "lsm-webapp",
      "version": "1.0.0",
      "platform": "web",
      "mode": "webchat"
    },
    "auth": {
      "token": "your-gateway-token"
    },
    "role": "operator",
    "scopes": ["operator.admin"]
  }
}
```

⚠️ **重要**：如果 Gateway 配置了 `allowInsecureAuth: true`，**不要传递 `nonce` 字段**，否则会报错 `unexpected property 'nonce'`。

#### 4. 认证成功
```json
{
  "type": "res",
  "id": "connect-123",
  "ok": true,
  "payload": { ... }
}
```

### 发送消息

#### chat.send 方法
```javascript
{
  "type": "req",
  "id": "msg-123456",
  "method": "chat.send",
  "params": {
    "sessionKey": "main",
    "message": "你好，请介绍一下你自己",
    "idempotencyKey": "msg-123456-abc"
  }
}
```

⚠️ **参数说明**：
- `message` - 消息内容（不是 `text`！）
- `idempotencyKey` - 幂等键，防止重复发送
- `sessionKey` - 会话标识，通常为 `main`

### 接收消息

#### chat 事件
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "runId": "uuid-run-id",
    "sessionKey": "agent:main:main",
    "seq": 42,
    "state": "delta",
    "message": {
      "role": "assistant",
      "content": [{ "type": "text", "text": "你好！" }],
      "timestamp": 1234567890
    }
  }
}
```

**state 字段**：
- `delta` - 增量内容（流式）
- `final` - 最终完整消息

#### agent 事件
```json
{
  "type": "event",
  "event": "agent",
  "payload": {
    "runId": "uuid-run-id",
    "stream": "assistant",
    "data": {
      "text": "完整文本",
      "delta": "增量文本"
    },
    "seq": 42
  }
}
```

## 代码实现

### chat.service.ts 核心代码

```typescript
// 帧格式类型定义
interface OpenClawRequest {
  type: 'req'
  id: string
  method: string
  params?: Record<string, unknown>
}

interface OpenClawResponse {
  type: 'res'
  id: string
  ok: boolean
  payload?: any
  error?: { message: string; code?: number }
}

interface OpenClawEvent {
  type: 'event'
  event: string
  payload?: any
  seq?: number
}

class ChatService {
  private openclawWs: WebSocket | null = null
  private openclawAuthenticated = false

  async connectOpenClaw(gatewayToken: string): Promise<{ success: boolean; message: string }> {
    const host = window.location.hostname || 'localhost'
    const wsUrl = `ws://${host}:18789/`
    
    return new Promise((resolve) => {
      this.openclawWs = new WebSocket(wsUrl)
      
      this.openclawWs.onopen = () => {
        console.log('[OpenClaw] WebSocket connected, sending connect...')
        // 直接发送 connect 请求
        const connectReq: OpenClawRequest = {
          type: 'req',
          id: `connect-${Date.now()}`,
          method: 'connect',
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: 'lsm-webapp',
              version: '1.0.0',
              platform: 'web',
              mode: 'webchat'
            },
            auth: { token: gatewayToken },
            role: 'operator',
            scopes: ['operator.admin']
          }
        }
        this.openclawWs!.send(JSON.stringify(connectReq))
      }
      
      this.openclawWs.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        if (data.type === 'res' && data.ok) {
          this.openclawAuthenticated = true
          // 认证成功
        }
        
        if (data.type === 'event') {
          this.handleOpenClawEvent(data)
        }
      }
    })
  }

  private handleOpenClawEvent(data: OpenClawEvent): void {
    const { event, payload } = data
    
    switch (event) {
      case 'chat':
        if (payload?.state === 'delta' || payload?.state === 'final') {
          const message = payload.message
          if (message?.role === 'assistant') {
            let content = message.content
            if (Array.isArray(content)) {
              content = content.map(c => {
                if (typeof c === 'string') return c
                if (c?.type === 'text') return c.text
                return ''
              }).join('')
            }
            // 显示消息到 UI
            this.displayMessage(content)
          }
        }
        break
        
      case 'agent':
        // 处理流式响应
        if (payload?.stream === 'assistant') {
          const delta = payload.data?.delta || payload.data?.text
          if (delta) {
            this.appendMessage(delta)
          }
        }
        break
    }
  }

  sendToOpenClaw(content: string): void {
    if (!this.openclawWs || !this.openclawAuthenticated) return
    
    const request: OpenClawRequest = {
      type: 'req',
      id: `msg-${Date.now()}`,
      method: 'chat.send',
      params: {
        sessionKey: 'main',
        message: content,
        idempotencyKey: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
    }
    
    this.openclawWs.send(JSON.stringify(request))
  }
}
```

## Gateway 配置

### openclaw.json

```json
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "lan",
    "controlUi": {
      "allowedOrigins": [
        "http://111.229.248.91",
        "http://111.229.248.91:8081",
        "http://localhost:8081"
      ],
      "allowInsecureAuth": true,
      "dangerouslyDisableDeviceAuth": true
    },
    "auth": {
      "mode": "token",
      "token": "your-gateway-token"
    }
  }
}
```

### 关键配置说明

| 配置项 | 说明 |
|--------|------|
| `allowedOrigins` | 允许的前端 Origin，必须包含 LSM 前端地址 |
| `allowInsecureAuth` | 允许简单 token 认证，不需要设备签名 |
| `dangerouslyDisableDeviceAuth` | 禁用设备认证 |

## Nginx 配置

### 缓存问题

浏览器会强缓存 JS 文件，导致新代码不生效。需要修改 Nginx 配置：

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    
    # 禁止缓存 index.html
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # JS/CSS 短缓存
    location ~* \.(js|css)$ {
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
    }
    
    # 静态资源长缓存
    location ~* \.(png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
    }
}
```

## 常见问题

### 1. origin not allowed

**错误**：`origin not allowed (open the Control UI from the gateway host or allow it in gateway.controlUi.allowedOrigins)`

**解决**：在 Gateway 配置的 `allowedOrigins` 中添加前端 Origin（不带端口号的也要加）。

```json
"allowedOrigins": [
  "http://111.229.248.91",
  "http://111.229.248.91:8081"
]
```

### 2. unexpected property 'nonce'

**错误**：`invalid connect params: at root: unexpected property 'nonce'`

**解决**：`allowInsecureAuth: true` 模式下，不要在 connect 参数中传递 `nonce` 字段。

### 3. must have required property 'message'

**错误**：`invalid chat.send params: must have required property 'message'`

**解决**：使用 `message` 参数而不是 `text`：
```json
// ❌ 错误
{ "text": "你好" }

// ✅ 正确
{ "message": "你好", "idempotencyKey": "msg-123" }
```

### 4. 浏览器缓存旧代码

**现象**：修改代码后刷新页面，控制台还是旧的 JS 文件名。

**解决**：
1. 清除站点数据（F12 → Application → Clear site data）
2. 使用无痕模式
3. 添加 URL 参数强制刷新：`http://IP:8081/?v=时间戳`

## 测试验证

### 1. 检查连接

打开浏览器控制台（F12），查看日志：

```
[OpenClaw] WebSocket connected
[OpenClaw] Received: {type: 'res', ok: true, ...}
```

### 2. 检查消息发送

```
[OpenClaw] Sent message: 你好
[OpenClaw] Event: chat {state: 'delta', message: {...}}
```

### 3. 服务端日志

```bash
tail -f /tmp/openclaw/openclaw-*.log | grep -i "chat\|connect"
```

应该看到：
```
webchat connected conn=xxx
⇄ res ✓ chat.send
```

## 完整代码实现

### chat.service.ts 完整代码

```typescript
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'
import { useChatStore, type Message } from '../store/chatStore'
import axios from 'axios'

interface ServerMessage {
  type: 'message' | 'action' | 'error' | 'typing'
  payload: { id?: string; role: 'assistant' | 'system'; content: string; timestamp?: string; metadata?: Message['metadata'] }
}

// OpenClaw Gateway 帧格式（非标准 JSON-RPC）
interface OpenClawRequest {
  type: 'req'
  id: string
  method: string
  params?: Record<string, unknown>
}

interface OpenClawResponse {
  type: 'res'
  id: string
  ok: boolean
  payload?: any
  error?: { message: string; code?: number }
}

interface OpenClawEvent {
  type: 'event'
  event: string
  payload?: any
  seq?: number
}

class ChatService {
  private socket: Socket | null = null
  private openclawWs: WebSocket | null = null
  private reconnectAttempts = 0
  private openclawRequestId = 0
  private openclawAuthenticated = false

  // ... 其他方法 ...

  /**
   * 连接 OpenClaw Gateway
   */
  async connectOpenClaw(gatewayToken: string): Promise<{ success: boolean; message: string }> {
    try {
      useChatStore.getState().setTyping(true)
      this.openclawRequestId = 0
      this.openclawAuthenticated = false
      
      if (this.openclawWs) {
        this.openclawWs.close()
        this.openclawWs = null
      }

      const host = window.location.hostname || 'localhost'
      const wsUrl = `ws://${host}:18789/`
      
      return new Promise((resolve) => {
        this.openclawWs = new WebSocket(wsUrl)
        
        this.openclawWs.onopen = () => {
          console.log('[OpenClaw] WebSocket connected, sending connect...')
          // 直接发送 connect 请求
          const connectReq: OpenClawRequest = {
            type: 'req',
            id: `connect-${Date.now()}`,
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: 'lsm-webapp',
                version: '1.0.0',
                platform: 'web',
                mode: 'webchat'
              },
              auth: { token: gatewayToken },
              role: 'operator',
              scopes: ['operator.admin']
            }
          }
          this.openclawWs!.send(JSON.stringify(connectReq))
        }
        
        this.openclawWs.onmessage = (event) => {
          const data = JSON.parse(event.data)
          
          // 处理响应帧
          if (data.type === 'res') {
            if (data.ok && !this.openclawAuthenticated) {
              this.openclawAuthenticated = true
              useChatStore.getState().setOpenClawConnected(true)
              useChatStore.getState().setTyping(false)
              resolve({ success: true, message: '连接成功' })
            } else if (data.error) {
              resolve({ success: false, message: data.error.message })
            }
            return
          }
          
          // 处理事件帧
          if (data.type === 'event') {
            this.handleOpenClawEvent(data)
          }
        }
        
        this.openclawWs.onerror = () => {
          resolve({ success: false, message: 'WebSocket 连接错误' })
        }
        
        setTimeout(() => {
          if (!useChatStore.getState().openclawConnected) {
            resolve({ success: false, message: '连接超时' })
          }
        }, 10000)
      })
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  }

  /**
   * 核心方法：处理 OpenClaw 推送事件
   */
  private handleOpenClawEvent(data: OpenClawEvent): void {
    const { event, payload } = data
    console.log('[OpenClaw] Event:', event, payload)
    
    switch (event) {
      case 'chat':
        // chat 事件格式: { state: 'delta' | 'final', message: { role, content, timestamp } }
        if (payload?.state === 'delta' || payload?.state === 'final') {
          const message = payload.message
          if (message?.role === 'assistant') {
            // content 可能是字符串或数组
            let content = message.content
            if (Array.isArray(content)) {
              // 提取文本内容：[{ type: 'text', text: '...' }, ...]
              content = content.map(c => {
                if (typeof c === 'string') return c
                if (c?.type === 'text') return c.text
                return ''
              }).join('')
            }
            if (content) {
              useChatStore.getState().addMessage({
                id: this.genId(),
                role: 'assistant',
                content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
                timestamp: new Date(),
                status: 'sent'
              })
              useChatStore.getState().setTyping(false)
            }
          }
        }
        break
        
      case 'agent':
        // agent 事件格式: { stream: 'assistant', data: { text, delta } }
        if (payload?.stream === 'assistant' && payload?.data) {
          const delta = payload.data
          if (delta?.text || delta?.delta) {
            const chunk = delta.text || delta.delta
            const messages = useChatStore.getState().messages
            const lastMsg = messages[messages.length - 1]
            
            // 如果最后一条是 assistant 消息，追加内容
            if (lastMsg?.role === 'assistant' && lastMsg.status === 'sent') {
              const updatedMessages = [...messages]
              updatedMessages[messages.length - 1] = { 
                ...lastMsg, 
                content: lastMsg.content + chunk 
              }
              useChatStore.getState().setMessages(updatedMessages)
            } else {
              // 否则创建新消息
              useChatStore.getState().addMessage({
                id: this.genId(),
                role: 'assistant',
                content: chunk,
                timestamp: new Date(),
                status: 'sent'
              })
            }
          }
        }
        break
        
      case 'chat.typing':
        useChatStore.getState().setTyping(payload?.typing ?? true)
        break
        
      case 'chat.error':
        useChatStore.getState().addMessage({
          id: this.genId(),
          role: 'system',
          content: `❌ 错误: ${payload?.message || '未知错误'}`,
          timestamp: new Date(),
          status: 'error'
        })
        break
        
      default:
        // 兜底处理：尝试从 payload 提取内容
        if (payload?.content || payload?.message?.content) {
          const content = payload.content || payload.message.content
          useChatStore.getState().addMessage({
            id: this.genId(),
            role: 'assistant',
            content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
            timestamp: new Date(),
            status: 'sent'
          })
          useChatStore.getState().setTyping(false)
        }
    }
  }

  /**
   * 发送消息到 OpenClaw
   */
  private sendToOpenClaw(content: string): void {
    const msg: Message = { 
      id: this.genId(), 
      role: 'user', 
      content, 
      timestamp: new Date(), 
      status: 'sending' 
    }
    useChatStore.getState().addMessage(msg)
    useChatStore.getState().setTyping(true)

    if (this.openclawWs?.readyState === WebSocket.OPEN && this.openclawAuthenticated) {
      // 构造正确的请求
      const request: OpenClawRequest = {
        type: 'req',
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        method: 'chat.send',
        params: {
          sessionKey: 'main',
          message: content,  // 注意：是 message 不是 text
          idempotencyKey: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      }
      
      this.openclawWs.send(JSON.stringify(request))
      useChatStore.getState().updateMessageStatus(msg.id, 'sent')
    } else {
      useChatStore.getState().updateMessageStatus(msg.id, 'error')
      useChatStore.getState().addMessage({
        id: this.genId(),
        role: 'system',
        content: 'OpenClaw 连接已断开或未认证',
        timestamp: new Date(),
        status: 'error'
      })
    }
  }

  private genId(): string { 
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` 
  }
}

export const chatService = new ChatService()
export default chatService
```

### 类型定义文件

建议创建单独的类型文件 `types/openclaw.ts`：

```typescript
// OpenClaw Gateway 帧格式类型定义

export interface OpenClawRequest {
  type: 'req'
  id: string
  method: string
  params?: Record<string, unknown>
}

export interface OpenClawResponse {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: {
    message: string
    code?: number
    data?: unknown
  }
}

export interface OpenClawEvent {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
}

// chat 事件 payload
export interface ChatEventPayload {
  runId: string
  sessionKey: string
  seq: number
  state: 'delta' | 'final'
  message: {
    role: 'assistant' | 'user' | 'system'
    content: string | Array<{ type: string; text: string }>
    timestamp: number
  }
}

// agent 事件 payload
export interface AgentEventPayload {
  runId: string
  stream: 'assistant' | 'tool_use' | 'lifecycle'
  data: {
    text?: string
    delta?: string
    content?: string
  }
  sessionKey: string
  seq: number
  ts?: number
}

// connect 方法参数
export interface ConnectParams {
  minProtocol: number
  maxProtocol: number
  client: {
    id: string
    version: string
    platform: string
    mode: string
  }
  auth: {
    token: string
  }
  role: string
  scopes: string[]
}

// chat.send 方法参数
export interface ChatSendParams {
  sessionKey: string
  message: string
  idempotencyKey: string
}
```

## 事件处理流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaw 事件流程                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  用户发送消息                                                │
│       │                                                      │
│       ▼                                                      │
│  chat.send ─────────────────────────────────────┐            │
│       │                                          │            │
│       ▼                                          │            │
│  ┌─────────────────────────────────────────┐    │            │
│  │ event: agent (stream: 'assistant')      │    │            │
│  │ - 流式输出 token                         │    │            │
│  │ - 多次触发，增量内容                      │    │            │
│  └─────────────────────────────────────────┘    │            │
│       │                                          │            │
│       ▼                                          │            │
│  ┌─────────────────────────────────────────┐    │            │
│  │ event: chat (state: 'delta')            │    │            │
│  │ - 消息片段                               │    │            │
│  │ - 多次触发                               │    │            │
│  └─────────────────────────────────────────┘    │            │
│       │                                          │            │
│       ▼                                          │            │
│  ┌─────────────────────────────────────────┐    │            │
│  │ event: chat (state: 'final')            │    │            │
│  │ - 最终完整消息                           │    │            │
│  │ - 触发一次                               │    │            │
│  └─────────────────────────────────────────┘    │            │
│       │                                          │            │
│       ▼                                          │            │
│  ┌─────────────────────────────────────────┐    │            │
│  │ event: agent (stream: 'lifecycle')      │    │            │
│  │ - 生命周期事件                           │    │            │
│  │ - 表示对话结束                           │    │            │
│  └─────────────────────────────────────────┘    │            │
│                                                  │            │
└──────────────────────────────────────────────────┘            │
```

## 总结

1. **协议理解最重要**：OpenClaw Gateway 使用自定义帧格式，需要仔细阅读文档或源码
2. **认证模式**：`allowInsecureAuth` 模式下的参数限制与正常模式不同
3. **参数名称**：`message` vs `text`、`idempotencyKey` 必填
4. **事件处理**：`chat` 事件有 `delta` 和 `final` 两种状态，需要正确处理
5. **内容格式**：`message.content` 可能是字符串或数组，需要兼容处理
6. **浏览器缓存**：前端部署时一定要注意缓存配置

---

*文档创建时间：2026-03-17*
*最后更新：2026-03-17*
*作者：OpenClaw Assistant (大漂亮 🦐)*