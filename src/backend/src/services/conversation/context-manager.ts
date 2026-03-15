import { Redis } from 'ioredis';

/**
 * 消息结构
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * 对话上下文
 */
export interface ConversationContext {
  userId: string;
  messages: Message[];
  pendingAction?: PendingAction;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * 待确认操作
 */
export interface PendingAction {
  type: string;
  params: Record<string, any>;
  createdAt: Date;
}

/**
 * 上下文管理器 - 管理多轮对话的上下文状态
 * 使用 Redis 持久化对话历史，支持跨进程上下文保持
 */
export class ContextManager {
  private redis: Redis;
  private contextPrefix: string = 'conversation:context:';
  private messagePrefix: string = 'conversation:messages:';
  private maxMessages: number = 100;
  private contextTTL: number = 24 * 60 * 60; // 24小时（秒）

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB) || 0,
    });

    this.redis.on('error', (err) => {
      console.error('[ContextManager] Redis error:', err);
    });
  }

  /**
   * 获取或创建对话上下文
   */
  async getOrCreateContext(userId: string): Promise<ConversationContext> {
    const contextKey = `${this.contextPrefix}${userId}`;
    const existing = await this.redis.get(contextKey);

    if (existing) {
      const context = JSON.parse(existing) as ConversationContext;
      context.updatedAt = new Date();
      return context;
    }

    // 创建新上下文
    const newContext: ConversationContext = {
      userId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveContext(newContext);
    return newContext;
  }

  /**
   * 保存上下文
   */
  private async saveContext(context: ConversationContext): Promise<void> {
    const contextKey = `${this.contextPrefix}${context.userId}`;
    await this.redis.setex(contextKey, this.contextTTL, JSON.stringify(context));
  }

  /**
   * 添加消息到上下文
   */
  async addMessage(userId: string, message: Message): Promise<void> {
    const context = await this.getOrCreateContext(userId);
    
    // 添加消息
    context.messages.push(message);
    
    // 限制消息数量，保留最近的消息
    if (context.messages.length > this.maxMessages) {
      context.messages = context.messages.slice(-this.maxMessages);
    }
    
    context.updatedAt = new Date();
    await this.saveContext(context);

    // 同时保存到消息列表（用于历史查询）
    const messageKey = `${this.messagePrefix}${userId}`;
    const messageData = JSON.stringify(message);
    await this.redis.rpush(messageKey, messageData);
    await this.redis.expire(messageKey, this.contextTTL);
  }

  /**
   * 获取消息历史
   */
  async getMessages(userId: string, limit?: number): Promise<Message[]> {
    const context = await this.getOrCreateContext(userId);
    const messages = context.messages;
    
    if (limit && messages.length > limit) {
      return messages.slice(-limit);
    }
    
    return messages;
  }

  /**
   * 获取最近 N 条消息（用于构建 AI 上下文）
   */
  async getRecentMessages(userId: string, count: number = 10): Promise<Message[]> {
    const messages = await this.getMessages(userId);
    return messages.slice(-count);
  }

  /**
   * 设置待确认操作
   */
  async setPendingAction(userId: string, action: PendingAction): Promise<void> {
    const context = await this.getOrCreateContext(userId);
    context.pendingAction = action;
    context.updatedAt = new Date();
    await this.saveContext(context);
  }

  /**
   * 获取待确认操作
   */
  async getPendingAction(userId: string): Promise<PendingAction | undefined> {
    const context = await this.getOrCreateContext(userId);
    return context.pendingAction;
  }

  /**
   * 清除待确认操作
   */
  async clearPendingAction(userId: string): Promise<void> {
    const context = await this.getOrCreateContext(userId);
    delete context.pendingAction;
    context.updatedAt = new Date();
    await this.saveContext(context);
  }

  /**
   * 检查是否有待确认操作
   */
  async hasPendingAction(userId: string): Promise<boolean> {
    const context = await this.getOrCreateContext(userId);
    return !!context.pendingAction;
  }

  /**
   * 清除整个对话上下文
   */
  async clearContext(userId: string): Promise<void> {
    const contextKey = `${this.contextPrefix}${userId}`;
    const messageKey = `${this.messagePrefix}${userId}`;
    
    await Promise.all([
      this.redis.del(contextKey),
      this.redis.del(messageKey),
    ]);
  }

  /**
   * 获取上下文摘要（用于 AI 提示词）
   */
  async getContextSummary(userId: string): Promise<string> {
    const context = await this.getOrCreateContext(userId);
    const recentMessages = await this.getRecentMessages(userId, 5);
    
    let summary = `用户ID: ${userId}\n`;
    summary += `对话开始时间: ${context.createdAt.toISOString()}\n`;
    summary += `消息总数: ${context.messages.length}\n`;
    
    if (context.pendingAction) {
      summary += `待确认操作: ${context.pendingAction.type}\n`;
    }
    
    if (recentMessages.length > 0) {
      summary += `\n最近对话:\n`;
      recentMessages.forEach(msg => {
        const role = msg.role === 'user' ? '用户' : '助手';
        summary += `[${role}]: ${msg.content.slice(0, 100)}...\n`;
      });
    }
    
    return summary;
  }

  /**
   * 更新上下文元数据
   */
  async updateMetadata(userId: string, metadata: Record<string, any>): Promise<void> {
    const context = await this.getOrCreateContext(userId);
    context.metadata = { ...context.metadata, ...metadata };
    context.updatedAt = new Date();
    await this.saveContext(context);
  }

  /**
   * 获取活跃上下文数量
   */
  async getActiveContextCount(): Promise<number> {
    const keys = await this.redis.keys(`${this.contextPrefix}*`);
    return keys.length;
  }

  /**
   * 清理过期上下文（由 Redis TTL 自动处理）
   */
  async cleanupExpiredContexts(): Promise<number> {
    // Redis TTL 会自动清理过期键
    // 此方法可用于手动清理或统计
    const keys = await this.redis.keys(`${this.contextPrefix}*`);
    let cleaned = 0;
    
    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -1) {
        // 没有设置 TTL 的键，设置默认 TTL
        await this.redis.expire(key, this.contextTTL);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * 关闭 Redis 连接
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// 导出单例
export const contextManager = new ContextManager();