/**
 * Chat Message Handler
 * Processes incoming messages and generates responses
 * v3.2.0 - 集成问题自动提取
 */

import { chatSessionManager, SessionMessage } from './chat.session';
import {
  feedbackService,
  FeedbackSource,
  FeedbackType,
} from '../feedback';

export type MessageType = 'chat' | 'action' | 'query' | 'confirm';

export interface IncomingMessage {
  type: MessageType;
  content: string;
  sessionId: string;
  timestamp: string;
}

export interface OutgoingMessage {
  type: 'message' | 'action' | 'error';
  payload: {
    id?: string;
    role: 'assistant' | 'system';
    content: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  };
}

const RESPONSES = {
  greeting: ['你好！有什么我可以帮助你的吗？', 'Hi! How can I assist you?'],
  unknown: ['抱歉，我不太理解你的问题。', 'Sorry, I did not understand.'],
  feedback_received: [
    '感谢您的反馈！我们已经记录了您的问题，会尽快处理。',
    'Thanks for your feedback! We have recorded your issue and will process it soon.',
  ],
};

// 问题提取关键词（用于识别潜在问题）
const ISSUE_KEYWORDS = [
  '错误', 'bug', '崩溃', '无法', '失败', '异常', '报错', '不行', '不能用',
  '希望', '建议添加', '能不能', '可以加', '需要', '想要', 'feature',
  '建议', '改进', '优化', '提升', '更好', '应该',
  '投诉', '不满', '太慢', '太差', '难用', '垃圾',
  '问题', '故障', '修复', '尽快',
];

class ChatMessageHandler {
  /**
   * 处理消息入口
   */
  async handleMessage(
    userId: string,
    data: IncomingMessage,
    callback: (response: OutgoingMessage) => void
  ): Promise<void> {
    try {
      const session = chatSessionManager.getSession(data.sessionId);
      if (!session) {
        callback(this.errorResponse('Session not found'));
        return;
      }
      chatSessionManager.touchSession(data.sessionId);

      // 记录用户消息
      const userMessage: Omit<SessionMessage, 'sessionId'> = {
        id: this.genId(),
        role: 'user',
        content: data.content,
        timestamp: new Date(),
        status: 'sent',
      };
      chatSessionManager.addMessage(data.sessionId, userMessage);

      // 🔧 自动从聊天中提取问题
      await this.extractFeedbackFromChat(userId, data.content);

      // 处理不同类型消息
      let response: OutgoingMessage;
      switch (data.type) {
        case 'action':
          response = await this.handleAction(data, userId);
          break;
        case 'query':
          response = await this.handleQuery(data, userId);
          break;
        default:
          response = await this.handleChat(data, userId);
      }

      // 记录助手消息
      if (response.type === 'message' || response.type === 'action') {
        chatSessionManager.addMessage(data.sessionId, {
          id: response.payload.id,
          role: response.payload.role,
          content: response.payload.content,
          timestamp: new Date(response.payload.timestamp || new Date()),
          status: 'sent',
        });
      }
      callback(response);
    } catch (error) {
      console.error('[ChatHandler] Error:', error);
      callback(this.errorResponse('Internal server error'));
    }
  }

  /**
   * 🔧 自动从聊天消息中提取问题反馈
   */
  private async extractFeedbackFromChat(
    userId: string,
    message: string
  ): Promise<void> {
    try {
      // 检测是否包含问题关键词
      const hasIssueKeywords = ISSUE_KEYWORDS.some(keyword =>
        message.toLowerCase().includes(keyword.toLowerCase())
      );

      if (!hasIssueKeywords) {
        return; // 不包含问题关键词，跳过
      }

      // 调用 FeedbackService 提取问题
      const feedback = await feedbackService.extractFromChat(
        message,
        userId,
        undefined, // userName 可以从用户服务获取
        {
          channel: 'chat',
          extractedAt: new Date().toISOString(),
        }
      );

      if (feedback) {
        console.log(`[ChatHandler] Extracted feedback ${feedback.id} from chat`);
      }
    } catch (error) {
      // 提取失败不影响主流程
      console.error('[ChatHandler] Extract feedback error:', error);
    }
  }

  /**
   * 处理普通聊天
   */
  private async handleChat(
    data: IncomingMessage,
    userId: string
  ): Promise<OutgoingMessage> {
    const content = data.content.toLowerCase().trim();

    // 检测问候
    if (content.includes('hello') || content.includes('你好')) {
      return {
        type: 'message',
        payload: {
          id: this.genId(),
          role: 'assistant',
          content: RESPONSES.greeting[Math.floor(Math.random() * RESPONSES.greeting.length)],
          timestamp: new Date().toISOString(),
        },
      };
    }

    // 检测是否是问题反馈
    const isLikelyFeedback = ISSUE_KEYWORDS.some(keyword =>
      content.includes(keyword.toLowerCase())
    );

    if (isLikelyFeedback) {
      // 对于反馈类消息，给出确认响应
      return {
        type: 'message',
        payload: {
          id: this.genId(),
          role: 'assistant',
          content: RESPONSES.feedback_received[
            Math.floor(Math.random() * RESPONSES.feedback_received.length)
          ],
          timestamp: new Date().toISOString(),
          metadata: {
            feedbackDetected: true,
          },
        },
      };
    }

    // 默认响应
    return {
      type: 'message',
      payload: {
        id: this.genId(),
        role: 'assistant',
        content: RESPONSES.unknown[Math.floor(Math.random() * RESPONSES.unknown.length)],
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * 处理操作请求
   */
  private async handleAction(
    data: IncomingMessage,
    userId: string
  ): Promise<OutgoingMessage> {
    // 解析操作内容
    const actionParts = data.content.split(' ');
    const actionType = actionParts[0] || 'unknown';
    const actionTarget = actionParts.slice(1).join(' ') || '';

    return {
      type: 'action',
      payload: {
        id: this.genId(),
        role: 'assistant',
        content: `操作请求已接收: ${actionType}${actionTarget ? ` - ${actionTarget}` : ''}`,
        timestamp: new Date().toISOString(),
        metadata: {
          actionType: 'execute',
          needsConfirmation: true,
          userId,
        },
      },
    };
  }

  /**
   * 处理查询请求
   */
  private async handleQuery(
    data: IncomingMessage,
    userId: string
  ): Promise<OutgoingMessage> {
    const queryContent = data.content.trim();

    // 尝试识别查询类型
    let queryResult = '';

    if (queryContent.includes('服务器') || queryContent.includes('server')) {
      queryResult = '服务器状态查询功能正在开发中...';
    } else if (queryContent.includes('任务') || queryContent.includes('task')) {
      queryResult = '任务列表查询功能正在开发中...';
    } else if (queryContent.includes('问题') || queryContent.includes('issue')) {
      queryResult = '问题反馈查询功能正在开发中...';
    } else {
      queryResult = `查询结果: ${queryContent}`;
    }

    return {
      type: 'message',
      payload: {
        id: this.genId(),
        role: 'assistant',
        content: queryResult,
        timestamp: new Date().toISOString(),
        metadata: {
          actionType: 'query',
          queryContent,
        },
      },
    };
  }

  /**
   * 获取会话历史
   */
  getSessionHistory(sessionId: string, limit = 50): SessionMessage[] {
    return chatSessionManager.getMessages(sessionId, limit);
  }

  /**
   * 清除会话历史
   */
  clearSessionHistory(sessionId: string): boolean {
    return chatSessionManager.clearMessages(sessionId);
  }

  /**
   * 生成错误响应
   */
  private errorResponse(message: string): OutgoingMessage {
    return {
      type: 'error',
      payload: {
        role: 'system',
        content: message,
      },
    };
  }

  /**
   * 生成唯一 ID
   */
  private genId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const chatMessageHandler = new ChatMessageHandler();
export default chatMessageHandler;