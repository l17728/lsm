import { ContextManager, ConversationContext, Message } from './context-manager';
import { ResponseBuilder, ResponseType } from './response-builder';

/**
 * 对话服务 - 管理用户与 Agent 的对话交互
 * 支持多轮对话上下文保持、澄清问题生成、操作确认提示
 */
export class ConversationService {
  private contextManager: ContextManager;
  private responseBuilder: ResponseBuilder;
  private maxContextMessages: number = 50;
  private contextExpireMs: number = 24 * 60 * 60 * 1000; // 24小时

  constructor() {
    this.contextManager = new ContextManager();
    this.responseBuilder = new ResponseBuilder();
  }

  /**
   * 处理用户消息并返回响应
   */
  async handleMessage(
    userId: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<ConversationResponse> {
    // 获取或创建对话上下文
    const context = await this.contextManager.getOrCreateContext(userId);
    
    // 添加用户消息到上下文
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date(),
      metadata,
    };
    await this.contextManager.addMessage(userId, userMessage);

    // 分析意图并生成响应
    const intent = this.analyzeIntent(content, context);
    const response = await this.generateResponse(userId, intent, context);

    // 添加助手消息到上下文
    const assistantMessage: Message = {
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      metadata: { intent: intent.type, requiresConfirmation: response.requiresConfirmation },
    };
    await this.contextManager.addMessage(userId, assistantMessage);

    return response;
  }

  /**
   * 分析用户意图
   */
  private analyzeIntent(content: string, context: ConversationContext): IntentResult {
    const lowerContent = content.toLowerCase();
    
    // 检测确认操作
    if (this.isConfirmation(content, context)) {
      return { type: 'confirmation', confidence: 0.9, data: context.pendingAction };
    }

    // 检测取消操作
    if (this.isCancellation(content)) {
      return { type: 'cancellation', confidence: 0.9 };
    }

    // 检测澄清请求
    if (this.needsClarification(content, context)) {
      return { type: 'clarification', confidence: 0.8, missingInfo: this.getMissingInfo(content) };
    }

    // 检测资源操作
    if (this.isResourceOperation(content)) {
      return { type: 'resource_operation', confidence: 0.85, operation: this.extractOperation(content) };
    }

    // 检测查询操作
    if (this.isQueryOperation(content)) {
      return { type: 'query', confidence: 0.8, queryType: this.extractQueryType(content) };
    }

    return { type: 'general', confidence: 0.6 };
  }

  /**
   * 生成响应
   */
  private async generateResponse(
    userId: string,
    intent: IntentResult,
    context: ConversationContext
  ): Promise<ConversationResponse> {
    switch (intent.type) {
      case 'confirmation':
        return this.handleConfirmation(userId, context);
      
      case 'cancellation':
        await this.contextManager.clearPendingAction(userId);
        return this.responseBuilder.build(ResponseType.CANCELLATION);
      
      case 'clarification':
        return this.responseBuilder.buildClarification(intent.missingInfo || []);
      
      case 'resource_operation':
        return this.handleResourceOperation(userId, intent, context);
      
      case 'query':
        return this.handleQuery(userId, intent, context);
      
      default:
        return this.responseBuilder.build(ResponseType.GENERAL);
    }
  }

  /**
   * 处理确认操作
   */
  private async handleConfirmation(userId: string, context: ConversationContext): Promise<ConversationResponse> {
    if (!context.pendingAction) {
      return this.responseBuilder.build(ResponseType.NO_PENDING_ACTION);
    }

    // 执行待确认的操作
    const result = await this.executePendingAction(context.pendingAction);
    await this.contextManager.clearPendingAction(userId);

    return {
      content: result.message,
      requiresConfirmation: false,
      data: result.data,
    };
  }

  /**
   * 处理资源操作
   */
  private handleResourceOperation(
    userId: string,
    intent: IntentResult,
    context: ConversationContext
  ): ConversationResponse {
    const operation = intent.operation;
    
    // 需要确认的操作
    if (operation?.requiresConfirmation) {
      this.contextManager.setPendingAction(userId, {
        type: operation.type,
        params: operation.params,
        createdAt: new Date(),
      });

      return this.responseBuilder.buildConfirmation(operation);
    }

    return this.responseBuilder.build(ResponseType.OPERATION_QUEUED);
  }

  /**
   * 处理查询操作
   */
  private handleQuery(
    userId: string,
    intent: IntentResult,
    context: ConversationContext
  ): ConversationResponse {
    return {
      content: `正在查询${intent.queryType || '相关信息'}...`,
      requiresConfirmation: false,
      queryType: intent.queryType,
    };
  }

  // 辅助方法
  private isConfirmation(content: string, context: ConversationContext): boolean {
    const confirmWords = ['确认', '是的', '好的', '确定', 'yes', 'ok', '执行'];
    return confirmWords.some(word => content.toLowerCase().includes(word)) && !!context.pendingAction;
  }

  private isCancellation(content: string): boolean {
    const cancelWords = ['取消', '放弃', '不要', 'cancel', 'abort'];
    return cancelWords.some(word => content.toLowerCase().includes(word));
  }

  private needsClarification(content: string, context: ConversationContext): boolean {
    return this.getMissingInfo(content).length > 0;
  }

  private getMissingInfo(content: string): string[] {
    const missing: string[] = [];
    // 简单的缺失信息检测逻辑
    if (content.includes('预约') && !content.includes('时间')) {
      missing.push('预约时间');
    }
    if (content.includes('服务器') && !content.includes('名称') && !content.includes('ID')) {
      missing.push('服务器标识');
    }
    return missing;
  }

  private isResourceOperation(content: string): boolean {
    const operationWords = ['创建', '删除', '修改', '启动', '停止', '重启', '分配', '释放'];
    return operationWords.some(word => content.includes(word));
  }

  private isQueryOperation(content: string): boolean {
    const queryWords = ['查询', '查看', '显示', '列出', '获取', '状态'];
    return queryWords.some(word => content.includes(word));
  }

  private extractOperation(content: string): OperationInfo | null {
    const operations: Record<string, OperationInfo> = {
      '创建': { type: 'create', requiresConfirmation: true, params: {} },
      '删除': { type: 'delete', requiresConfirmation: true, params: {} },
      '启动': { type: 'start', requiresConfirmation: false, params: {} },
      '停止': { type: 'stop', requiresConfirmation: true, params: {} },
    };

    for (const [keyword, info] of Object.entries(operations)) {
      if (content.includes(keyword)) {
        return info;
      }
    }
    return null;
  }

  /**
   * 提取查询类型
   */
  private extractQueryType(content: string): string {
    const queryTypes: Record<string, string> = {
      '服务器': '服务器信息',
      '任务': '任务列表',
      '问题': '问题反馈',
      '状态': '系统状态',
      '日志': '运行日志',
      '用户': '用户信息',
      'GPU': 'GPU资源',
    };

    for (const [keyword, type] of Object.entries(queryTypes)) {
      if (content.includes(keyword)) {
        return type;
      }
    }
    return '相关信息';
  }

  private async executePendingAction(action: PendingAction): Promise<{ message: string; data?: any }> {
    // 实际执行逻辑由具体业务模块实现
    return { message: `操作 ${action.type} 已成功执行`, data: action.params };
  }

  /**
   * 获取对话历史
   */
  async getConversationHistory(userId: string, limit?: number): Promise<Message[]> {
    return this.contextManager.getMessages(userId, limit || this.maxContextMessages);
  }

  /**
   * 清除对话上下文
   */
  async clearContext(userId: string): Promise<void> {
    await this.contextManager.clearContext(userId);
  }
}

// 类型定义
interface IntentResult {
  type: 'confirmation' | 'cancellation' | 'clarification' | 'resource_operation' | 'query' | 'general';
  confidence: number;
  data?: any;
  missingInfo?: string[];
  operation?: OperationInfo | null;
  queryType?: string;
}

interface OperationInfo {
  type: string;
  requiresConfirmation: boolean;
  params: Record<string, any>;
}

interface PendingAction {
  type: string;
  params: Record<string, any>;
  createdAt: Date;
}

interface ConversationResponse {
  content: string;
  requiresConfirmation: boolean;
  data?: any;
  queryType?: string;
}

// 导出单例
export const conversationService = new ConversationService();