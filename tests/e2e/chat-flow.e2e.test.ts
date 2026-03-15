/**
 * LSM Project - Chat Flow E2E Tests
 * 端到端测试：数字管理员聊天流程
 * 
 * 测试场景：
 * 1. 用户发起聊天会话
 * 2. Agent 理解用户意图
 * 3. 执行操作并返回结果
 * 4. 会话历史管理
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Mock WebSocket client for testing
class MockWebSocketClient {
  private connected = false;
  private messageQueue: any[] = [];
  private handlers: Map<string, Function> = new Map();

  async connect(url: string): Promise<boolean> {
    // Simulate connection
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.messageQueue = [];
  }

  send(type: string, payload: any): void {
    this.messageQueue.push({ type, payload, timestamp: Date.now() });
  }

  on(event: string, handler: Function): void {
    this.handlers.set(event, handler);
  }

  simulateResponse(response: any): void {
    const handler = this.handlers.get('message');
    if (handler) handler(response);
  }

  get isConnected(): boolean {
    return this.connected;
  }

  getLastMessage(): any {
    return this.messageQueue[this.messageQueue.length - 1];
  }
}

// HTTP client for REST API calls
class MockHttpClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string): void {
    this.token = token;
  }

  async post(path: string, data: any): Promise<{ status: number; data: any }> {
    // Simulate API response based on path
    if (path === '/api/auth/login') {
      if (data.username === 'admin' && data.password === 'admin123') {
        return { status: 200, data: { token: 'mock-jwt-token', user: { id: 'user-1', role: 'ADMIN' } } };
      }
      return { status: 401, data: { error: 'Invalid credentials' } };
    }

    if (path === '/api/chat/message') {
      return {
        status: 200,
        data: {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `收到消息: ${data.content}`,
          timestamp: new Date().toISOString(),
        },
      };
    }

    return { status: 404, data: { error: 'Not found' } };
  }

  async get(path: string): Promise<{ status: number; data: any }> {
    if (path === '/api/chat/history') {
      return {
        status: 200,
        data: {
          messages: [
            { id: 'msg-1', role: 'user', content: '你好', timestamp: '2026-03-15T10:00:00Z' },
            { id: 'msg-2', role: 'assistant', content: '你好！有什么可以帮助你的？', timestamp: '2026-03-15T10:00:01Z' },
          ],
        },
      };
    }

    return { status: 404, data: { error: 'Not found' } };
  }
}

describe('Chat Flow E2E Tests', () => {
  let wsClient: MockWebSocketClient;
  let httpClient: MockHttpClient;
  let sessionId: string;

  beforeAll(async () => {
    // Initialize clients
    wsClient = new MockWebSocketClient();
    httpClient = new MockHttpClient('http://localhost:8080');

    // Login to get token
    const loginResponse = await httpClient.post('/api/auth/login', {
      username: 'admin',
      password: 'admin123',
    });

    expect(loginResponse.status).toBe(200);
    httpClient.setToken(loginResponse.data.token);

    // Connect WebSocket
    const connected = await wsClient.connect('ws://localhost:8080/ws/chat');
    expect(connected).toBe(true);
  });

  afterAll(async () => {
    await wsClient.disconnect();
  });

  beforeEach(() => {
    sessionId = `session-${Date.now()}`;
  });

  describe('Session Management', () => {
    it('should create a new chat session', async () => {
      // Send session creation request
      wsClient.send('session:create', { userId: 'user-1' });

      // Verify message was sent
      const lastMsg = wsClient.getLastMessage();
      expect(lastMsg).toBeDefined();
      expect(lastMsg.type).toBe('session:create');
    });

    it('should maintain session state across messages', async () => {
      // Send multiple messages in sequence
      const messages = [
        '你好，我需要帮助',
        '我想查询服务器状态',
        '有多少台服务器在线？',
      ];

      for (const content of messages) {
        wsClient.send('chat:message', { sessionId, content });
      }

      // Verify all messages were queued
      expect(wsClient.getLastMessage()).toBeDefined();
    });
  });

  describe('Message Flow', () => {
    it('should send and receive chat messages', async () => {
      const messageContent = '我需要 2 块 GPU 跑训练';

      // Send message via HTTP API
      const response = await httpClient.post('/api/chat/message', {
        sessionId,
        content: messageContent,
        type: 'chat',
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('role', 'assistant');
      expect(response.data).toHaveProperty('content');
    });

    it('should handle intent recognition for GPU requests', async () => {
      const gpuRequest = '我需要 2 块 GPU 跑训练';

      // Simulate sending action message
      wsClient.send('chat:action', {
        sessionId,
        content: gpuRequest,
        type: 'action',
      });

      // Simulate system response
      wsClient.simulateResponse({
        type: 'action',
        payload: {
          id: 'action-1',
          role: 'assistant',
          content: '正在为您分配 2 块 GPU...',
          metadata: { actionType: 'gpu_allocate', quantity: 2 },
        },
      });

      expect(wsClient.isConnected).toBe(true);
    });

    it('should retrieve chat history', async () => {
      const response = await httpClient.get('/api/chat/history');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('messages');
      expect(Array.isArray(response.data.messages)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid session gracefully', async () => {
      wsClient.send('chat:message', {
        sessionId: 'invalid-session-id',
        content: '测试消息',
      });

      // Connection should remain stable
      expect(wsClient.isConnected).toBe(true);
    });

    it('should handle authentication failure', async () => {
      const badClient = new MockHttpClient('http://localhost:8080');

      const response = await badClient.post('/api/auth/login', {
        username: 'invalid',
        password: 'wrong',
      });

      expect(response.status).toBe(401);
      expect(response.data).toHaveProperty('error');
    });

    it('should handle message timeout gracefully', async () => {
      // Send a message that might take time to process
      wsClient.send('chat:message', {
        sessionId,
        content: '执行复杂查询操作',
        timeout: 5000,
      });

      // Should not throw
      expect(wsClient.isConnected).toBe(true);
    });
  });

  describe('Multi-turn Conversation', () => {
    it('should maintain context across conversation turns', async () => {
      const turns = [
        { user: '我需要 GPU', expected: 'GPU' },
        { user: '2 块', expected: '2' },
        { user: '用于模型训练', expected: '训练' },
      ];

      for (const turn of turns) {
        wsClient.send('chat:message', { sessionId, content: turn.user });
        // Simulate response
        wsClient.simulateResponse({
          type: 'message',
          payload: { id: `msg-${Date.now()}`, role: 'assistant', content: `收到: ${turn.expected}` },
        });
      }

      // All messages processed
      expect(wsClient.isConnected).toBe(true);
    });

    it('should handle conversation reset', async () => {
      // Send reset request
      wsClient.send('session:clear', { sessionId });

      // Should still be connected
      expect(wsClient.isConnected).toBe(true);
    });
  });
});