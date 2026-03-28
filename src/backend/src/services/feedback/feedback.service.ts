/**
 * Feedback Service - 问题收集服务
 * v3.2.0 - 用户问题反馈收集与分类
 * 
 * 功能：
 * - 收集用户聊天中的问题反馈
 * - 问题分类和标签管理
 * - 问题优先级评估
 * - 问题状态跟踪
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 问题类型枚举
export enum FeedbackType {
  BUG = 'BUG',                    // 功能缺陷
  FEATURE = 'FEATURE',            // 功能需求
  IMPROVEMENT = 'IMPROVEMENT',    // 改进建议
  QUESTION = 'QUESTION',          // 使用疑问
  COMPLAINT = 'COMPLAINT',        // 投诉反馈
  OTHER = 'OTHER',                // 其他
}

// 问题严重程度
export enum FeedbackSeverity {
  CRITICAL = 'CRITICAL',  // 严重：影响核心功能
  HIGH = 'HIGH',          // 高：影响主要功能
  MEDIUM = 'MEDIUM',      // 中：影响次要功能
  LOW = 'LOW',            // 低：小问题或建议
}

// 问题状态
export enum FeedbackStatus {
  NEW = 'NEW',                  // 新建
  TRIAGED = 'TRIAGED',          // 已分类
  IN_PROGRESS = 'IN_PROGRESS',  // 处理中
  RESOLVED = 'RESOLVED',        // 已解决
  CLOSED = 'CLOSED',            // 已关闭
  WONT_FIX = 'WONT_FIX',        // 不予修复
}

// 问题标签
export enum FeedbackTag {
  UI = 'UI',                    // 界面问题
  PERFORMANCE = 'PERFORMANCE',  // 性能问题
  SECURITY = 'SECURITY',        // 安全问题
  DATA = 'DATA',                // 数据问题
  INTEGRATION = 'INTEGRATION',  // 集成问题
  DOCUMENTATION = 'DOCS',       // 文档问题
  MOBILE = 'MOBILE',            // 移动端问题
  API = 'API',                  // API 问题
}

// 问题来源
export enum FeedbackSource {
  CHAT = 'CHAT',          // 聊天反馈
  EMAIL = 'EMAIL',        // 邮件反馈
  WEB_FORM = 'WEB_FORM',  // 网页表单
  MOBILE = 'MOBILE',      // 移动端
  SYSTEM = 'SYSTEM',      // 系统自动检测
}

// 问题反馈接口
export interface Feedback {
  id: string;
  type: FeedbackType;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  title: string;
  description: string;
  tags: FeedbackTag[];
  source: FeedbackSource;
  userId?: string;
  userName?: string;
  serverId?: string;
  taskId?: string;
  attachments?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
}

// 问题统计
export interface FeedbackStats {
  totalCount: number;
  byType: Record<FeedbackType, number>;
  bySeverity: Record<FeedbackSeverity, number>;
  byStatus: Record<FeedbackStatus, number>;
  byTag: Record<FeedbackTag, number>;
  resolutionRate: number;
  avgResolutionTime: number;  // 小时
}

// 问题筛选条件
export interface FeedbackFilter {
  type?: FeedbackType[];
  severity?: FeedbackSeverity[];
  status?: FeedbackStatus[];
  tags?: FeedbackTag[];
  source?: FeedbackSource[];
  userId?: string;
  serverId?: string;
  startDate?: Date;
  endDate?: Date;
  keyword?: string;
}

/**
 * 问题反馈收集服务
 */
export class FeedbackService {
  // 内存存储（可替换为数据库）
  private feedbacks: Map<string, Feedback> = new Map();
  private idCounter: number = 0;

  /**
   * 创建问题反馈
   */
  async createFeedback(data: {
    type: FeedbackType;
    severity?: FeedbackSeverity;
    title: string;
    description: string;
    tags?: FeedbackTag[];
    source: FeedbackSource;
    userId?: string;
    userName?: string;
    serverId?: string;
    taskId?: string;
    attachments?: string[];
    metadata?: Record<string, any>;
  }): Promise<Feedback> {
    const id = `fb_${Date.now()}_${++this.idCounter}`;
    const now = new Date();

    // 自动评估严重程度
    const severity = data.severity || this.assessSeverity(data);

    const feedback: Feedback = {
      id,
      type: data.type,
      severity,
      status: FeedbackStatus.NEW,
      title: data.title,
      description: data.description,
      tags: data.tags || this.autoTag(data),
      source: data.source,
      userId: data.userId,
      userName: data.userName,
      serverId: data.serverId,
      taskId: data.taskId,
      attachments: data.attachments || [],
      metadata: data.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    this.feedbacks.set(id, feedback);

    console.log(`[FeedbackService] Created feedback ${id}: ${feedback.title}`);
    return feedback;
  }

  /**
   * 从聊天消息提取问题
   */
  async extractFromChat(
    message: string,
    userId?: string,
    userName?: string,
    metadata?: Record<string, any>
  ): Promise<Feedback | null> {
    // 关键词匹配识别问题类型
    const type = this.detectFeedbackType(message);
    if (!type) {
      return null;  // 不是问题反馈
    }

    // 提取标题（取第一行或前50字符）
    const title = message.split('\n')[0].substring(0, 50) || '用户反馈';

    return this.createFeedback({
      type,
      title,
      description: message,
      source: FeedbackSource.CHAT,
      userId,
      userName,
      metadata: {
        ...metadata,
        originalMessage: message,
        extractedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * 检测问题类型
   */
  private detectFeedbackType(message: string): FeedbackType | null {
    const lowerMsg = message.toLowerCase();

    // Bug 相关关键词
    if (/错误|bug|崩溃|无法|失败|异常|报错|不行|不能用/.test(lowerMsg)) {
      return FeedbackType.BUG;
    }

    // 功能需求关键词
    if (/希望|建议添加|能不能|可以加|需要.*功能|想要|feature/.test(lowerMsg)) {
      return FeedbackType.FEATURE;
    }

    // 改进建议关键词
    if (/建议|改进|优化|提升|更好|应该/.test(lowerMsg)) {
      return FeedbackType.IMPROVEMENT;
    }

    // 问题咨询关键词
    if (/怎么|如何|为什么|什么|？|\?$/.test(lowerMsg)) {
      return FeedbackType.QUESTION;
    }

    // 投诉关键词
    if (/投诉|不满|太慢|太差|难用|垃圾/.test(lowerMsg)) {
      return FeedbackType.COMPLAINT;
    }

    return null;
  }

  /**
   * 自动评估严重程度
   */
  private assessSeverity(data: {
    type: FeedbackType;
    title: string;
    description: string;
  }): FeedbackSeverity {
    const text = `${data.title} ${data.description}`.toLowerCase();

    // 严重问题关键词
    if (/崩溃|无法使用|数据丢失|安全|宕机|严重/.test(text)) {
      return FeedbackSeverity.CRITICAL;
    }

    // 高优先级关键词
    if (/影响|紧急|重要|核心功能/.test(text)) {
      return FeedbackSeverity.HIGH;
    }

    // 根据类型默认设置
    switch (data.type) {
      case FeedbackType.BUG:
        return FeedbackSeverity.HIGH;
      case FeedbackType.COMPLAINT:
        return FeedbackSeverity.HIGH;
      case FeedbackType.FEATURE:
      case FeedbackType.IMPROVEMENT:
        return FeedbackSeverity.MEDIUM;
      case FeedbackType.QUESTION:
      case FeedbackType.OTHER:
        return FeedbackSeverity.LOW;
      default:
        return FeedbackSeverity.MEDIUM;
    }
  }

  /**
   * 自动打标签
   */
  private autoTag(data: {
    type: FeedbackType;
    title: string;
    description: string;
  }): FeedbackTag[] {
    const tags: FeedbackTag[] = [];
    const text = `${data.title} ${data.description}`.toLowerCase();

    if (/界面|显示|按钮|页面|ui/.test(text)) tags.push(FeedbackTag.UI);
    if (/慢|卡|超时|性能|加载/.test(text)) tags.push(FeedbackTag.PERFORMANCE);
    if (/安全|权限|泄露|漏洞/.test(text)) tags.push(FeedbackTag.SECURITY);
    if (/数据|丢失|错误|不一致/.test(text)) tags.push(FeedbackTag.DATA);
    if (/接口|api|集成|同步/.test(text)) tags.push(FeedbackTag.INTEGRATION);
    if (/文档|说明|教程|帮助/.test(text)) tags.push(FeedbackTag.DOCUMENTATION);
    if (/手机|移动端|app|小程序/.test(text)) tags.push(FeedbackTag.MOBILE);
    if (/api|接口|请求|响应/.test(text)) tags.push(FeedbackTag.API);

    return tags.length > 0 ? tags : [];
  }

  /**
   * 获取问题详情
   */
  async getFeedback(id: string): Promise<Feedback | null> {
    return this.feedbacks.get(id) || null;
  }

  /**
   * 查询问题列表
   */
  async queryFeedbacks(
    filter?: FeedbackFilter,
    page: number = 1,
    limit: number = 20
  ): Promise<{ feedbacks: Feedback[]; total: number }> {
    let results = Array.from(this.feedbacks.values());

    // 应用筛选条件
    if (filter) {
      if (filter.type?.length) {
        results = results.filter(f => filter.type!.includes(f.type));
      }
      if (filter.severity?.length) {
        results = results.filter(f => filter.severity!.includes(f.severity));
      }
      if (filter.status?.length) {
        results = results.filter(f => filter.status!.includes(f.status));
      }
      if (filter.tags?.length) {
        results = results.filter(f => f.tags.some(t => filter.tags!.includes(t)));
      }
      if (filter.userId) {
        results = results.filter(f => f.userId === filter.userId);
      }
      if (filter.serverId) {
        results = results.filter(f => f.serverId === filter.serverId);
      }
      if (filter.startDate) {
        results = results.filter(f => f.createdAt >= filter.startDate!);
      }
      if (filter.endDate) {
        results = results.filter(f => f.createdAt <= filter.endDate!);
      }
      if (filter.keyword) {
        const kw = filter.keyword.toLowerCase();
        results = results.filter(f =>
          f.title.toLowerCase().includes(kw) ||
          f.description.toLowerCase().includes(kw)
        );
      }
    }

    // 按创建时间倒序
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = results.length;
    const start = (page - 1) * limit;
    const feedbacks = results.slice(start, start + limit);

    return { feedbacks, total };
  }

  /**
   * 更新问题状态
   */
  async updateStatus(
    id: string,
    status: FeedbackStatus,
    resolvedBy?: string,
    resolution?: string
  ): Promise<Feedback | null> {
    const feedback = this.feedbacks.get(id);
    if (!feedback) return null;

    feedback.status = status;
    feedback.updatedAt = new Date();

    if (status === FeedbackStatus.RESOLVED || status === FeedbackStatus.CLOSED) {
      feedback.resolvedAt = new Date();
      feedback.resolvedBy = resolvedBy;
      feedback.resolution = resolution;
    }

    this.feedbacks.set(id, feedback);
    console.log(`[FeedbackService] Updated feedback ${id} status to ${status}`);
    return feedback;
  }

  /**
   * 添加标签
   */
  async addTags(id: string, tags: FeedbackTag[]): Promise<Feedback | null> {
    const feedback = this.feedbacks.get(id);
    if (!feedback) return null;

    feedback.tags = [...new Set([...feedback.tags, ...tags])];
    feedback.updatedAt = new Date();
    this.feedbacks.set(id, feedback);
    return feedback;
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<FeedbackStats> {
    const all = Array.from(this.feedbacks.values());

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byTag: Record<string, number> = {};

    let resolvedCount = 0;
    let totalResolutionTime = 0;

    for (const f of all) {
      byType[f.type] = (byType[f.type] || 0) + 1;
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
      byStatus[f.status] = (byStatus[f.status] || 0) + 1;

      for (const tag of f.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }

      if (f.resolvedAt) {
        resolvedCount++;
        totalResolutionTime += (f.resolvedAt.getTime() - f.createdAt.getTime()) / (1000 * 60 * 60);
      }
    }

    return {
      totalCount: all.length,
      byType: byType as any,
      bySeverity: bySeverity as any,
      byStatus: byStatus as any,
      byTag: byTag as any,
      resolutionRate: all.length > 0 ? resolvedCount / all.length : 0,
      avgResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
    };
  }
}

// 导出单例
export const feedbackService = new FeedbackService();
export default feedbackService;