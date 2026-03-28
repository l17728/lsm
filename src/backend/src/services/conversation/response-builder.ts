/**
 * 响应类型枚举
 */
export enum ResponseType {
  GENERAL = 'general',
  CONFIRMATION = 'confirmation',
  CANCELLATION = 'cancellation',
  CLARIFICATION = 'clarification',
  OPERATION_QUEUED = 'operation_queued',
  NO_PENDING_ACTION = 'no_pending_action',
  SUCCESS = 'success',
  ERROR = 'error',
  PERMISSION_DENIED = 'permission_denied',
  RESOURCE_NOT_FOUND = 'resource_not_found',
}

/**
 * 操作信息
 */
interface OperationInfo {
  type: string;
  params?: Record<string, any>;
  requiresConfirmation?: boolean;
}

/**
 * 响应构建器 - 生成标准化的对话响应
 * 支持多语言、澄清问题生成、操作确认提示
 */
export class ResponseBuilder {
  // 响应模板
  private templates: Map<ResponseType, ResponseTemplate> = new Map();
  private language: string = 'zh-CN';

  constructor() {
    this.initializeTemplates();
  }

  /**
   * 初始化响应模板
   */
  private initializeTemplates(): void {
    this.templates.set(ResponseType.GENERAL, {
      zh: '我已收到您的请求，正在处理中...',
      en: 'I have received your request and am processing it...',
    });

    this.templates.set(ResponseType.CANCELLATION, {
      zh: '已取消当前操作。有什么其他需要帮助的吗？',
      en: 'Operation cancelled. How else can I help you?',
    });

    this.templates.set(ResponseType.OPERATION_QUEUED, {
      zh: '操作已加入队列，正在执行中...',
      en: 'Operation queued and executing...',
    });

    this.templates.set(ResponseType.NO_PENDING_ACTION, {
      zh: '没有待确认的操作。请先提出您的请求。',
      en: 'No pending action to confirm. Please make a request first.',
    });

    this.templates.set(ResponseType.SUCCESS, {
      zh: '操作已成功完成！',
      en: 'Operation completed successfully!',
    });

    this.templates.set(ResponseType.ERROR, {
      zh: '操作失败，请稍后重试。',
      en: 'Operation failed. Please try again later.',
    });

    this.templates.set(ResponseType.PERMISSION_DENIED, {
      zh: '抱歉，您没有执行此操作的权限。',
      en: 'Sorry, you do not have permission to perform this operation.',
    });

    this.templates.set(ResponseType.RESOURCE_NOT_FOUND, {
      zh: '未找到指定的资源。',
      en: 'The specified resource was not found.',
    });
  }

  /**
   * 构建基础响应
   */
  build(type: ResponseType, params?: Record<string, any>): ConversationResponse {
    const template = this.templates.get(type);
    const content = template ? this.getLocalizedTemplate(template) : '';

    return {
      content: this.interpolate(content, params),
      type,
      requiresConfirmation: false,
      timestamp: new Date(),
      params,
    };
  }

  /**
   * 构建确认提示响应
   */
  buildConfirmation(operation: OperationInfo): ConversationResponse {
    const operationNames: Record<string, string> = {
      create: '创建',
      delete: '删除',
      update: '更新',
      start: '启动',
      stop: '停止',
      restart: '重启',
      allocate: '分配',
      release: '释放',
    };

    const operationName = operationNames[operation.type] || operation.type;
    const paramsDesc = this.formatParams(operation.params || {});

    const content = `⚠️ 确认操作\n\n` +
      `您即将执行以下操作：\n` +
      `• 操作类型：${operationName}\n` +
      `${paramsDesc}\n\n` +
      `请回复"确认"或"取消"来继续。`;

    return {
      content,
      type: ResponseType.CONFIRMATION,
      requiresConfirmation: true,
      pendingAction: {
        type: operation.type,
        params: operation.params || {},
      },
      timestamp: new Date(),
    };
  }

  /**
   * 构建澄清问题响应
   */
  buildClarification(missingInfo: string[]): ConversationResponse {
    if (missingInfo.length === 0) {
      return this.build(ResponseType.GENERAL);
    }

    const questions = this.generateClarificationQuestions(missingInfo);
    
    const content = `📝 需要更多信息\n\n` +
      `请提供以下信息以便我更好地为您服务：\n\n` +
      questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

    return {
      content,
      type: ResponseType.CLARIFICATION,
      requiresConfirmation: false,
      missingInfo,
      timestamp: new Date(),
    };
  }

  /**
   * 构建成功响应
   */
  buildSuccess(message: string, data?: any): ConversationResponse {
    return {
      content: `✅ ${message}`,
      type: ResponseType.SUCCESS,
      requiresConfirmation: false,
      data,
      timestamp: new Date(),
    };
  }

  /**
   * 构建错误响应
   */
  buildError(message: string, code?: string): ConversationResponse {
    return {
      content: `❌ ${message}`,
      type: ResponseType.ERROR,
      requiresConfirmation: false,
      errorCode: code,
      timestamp: new Date(),
    };
  }

  /**
   * 构建资源列表响应
   */
  buildResourceList(resources: any[], resourceType: string): ConversationResponse {
    if (resources.length === 0) {
      return {
        content: `暂无${resourceType}数据。`,
        type: ResponseType.GENERAL,
        requiresConfirmation: false,
        timestamp: new Date(),
      };
    }

    const header = `📊 ${resourceType}列表 (共 ${resources.length} 项)\n\n`;
    const items = resources.map((r, i) => {
      const name = r.name || r.id || `项目${i + 1}`;
      const status = r.status ? ` [${r.status}]` : '';
      return `${i + 1}. ${name}${status}`;
    }).join('\n');

    return {
      content: header + items,
      type: ResponseType.GENERAL,
      requiresConfirmation: false,
      data: { resources, count: resources.length },
      timestamp: new Date(),
    };
  }

  /**
   * 构建状态响应
   */
  buildStatusResponse(resource: any, resourceType: string): ConversationResponse {
    const lines: string[] = [`📊 ${resourceType}状态\n`];
    
    const fields = ['name', 'status', 'createdAt', 'updatedAt'];
    fields.forEach(field => {
      if (resource[field]) {
        const label = this.getFieldLabel(field);
        let value = resource[field];
        if (field.includes('At') && value) {
          value = new Date(value).toLocaleString('zh-CN');
        }
        lines.push(`• ${label}: ${value}`);
      }
    });

    return {
      content: lines.join('\n'),
      type: ResponseType.GENERAL,
      requiresConfirmation: false,
      data: resource,
      timestamp: new Date(),
    };
  }

  /**
   * 生成澄清问题
   */
  private generateClarificationQuestions(missingInfo: string[]): string[] {
    const questionMap: Record<string, string> = {
      '预约时间': '您希望预约什么时间段？(例如：明天下午2点到5点)',
      '服务器标识': '请指定服务器名称或ID？',
      'GPU数量': '您需要多少GPU？',
      '持续时间': '操作预计持续多长时间？',
      '用户标识': '请提供相关用户的用户名或ID？',
      '任务名称': '请提供任务的名称？',
      '描述信息': '请提供更多描述信息？',
    };

    return missingInfo.map(info => questionMap[info] || `请提供${info}？`);
  }

  /**
   * 格式化参数描述
   */
  private formatParams(params: Record<string, any>): string {
    const entries = Object.entries(params);
    if (entries.length === 0) return '';
    
    return entries.map(([key, value]) => {
      const label = this.getFieldLabel(key);
      return `• ${label}: ${value}`;
    }).join('\n');
  }

  /**
   * 获取字段标签
   */
  private getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      name: '名称',
      status: '状态',
      createdAt: '创建时间',
      updatedAt: '更新时间',
      serverId: '服务器',
      userId: '用户',
      gpuCount: 'GPU数量',
      startTime: '开始时间',
      endTime: '结束时间',
    };
    return labels[field] || field;
  }

  /**
   * 获取本地化模板
   */
  private getLocalizedTemplate(template: ResponseTemplate): string {
    return this.language === 'zh-CN' ? template.zh : template.en;
  }

  /**
   * 插值模板参数
   */
  private interpolate(template: string, params?: Record<string, any>): string {
    if (!params) return template;
    
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return params[key] !== undefined ? String(params[key]) : `{${key}}`;
    });
  }

  /**
   * 设置语言
   */
  setLanguage(lang: string): void {
    this.language = lang;
  }
}

/**
 * 响应模板
 */
interface ResponseTemplate {
  zh: string;
  en: string;
}

/**
 * 对话响应
 */
interface ConversationResponse {
  content: string;
  type: ResponseType;
  requiresConfirmation: boolean;
  pendingAction?: {
    type: string;
    params: Record<string, any>;
  };
  missingInfo?: string[];
  data?: any;
  params?: Record<string, any>;
  errorCode?: string;
  timestamp: Date;
}

// 导出单例
export const responseBuilder = new ResponseBuilder();