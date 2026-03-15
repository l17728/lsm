/**
 * Agent 主服务 - OpenClaw Agent 集成模块
 * Agent Service - OpenClaw Agent Integration Module
 * 
 * 数字管理员核心能力，支持自然语言交互管理 GPU、任务、服务器和预约
 */

import { IntentParser, ParsedIntent, IntentType } from './intent-parser';
import { ActionExecutor, ActionResult } from './action-executor';
import prisma from '../../utils/prisma';

// 会话上下文，用于多轮对话
interface SessionContext {
  userId: string;
  lastIntent?: ParsedIntent;
  pendingAction?: {
    type: IntentType;
    entities: any;
    confirmationToken?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Agent 响应
export interface AgentResponse {
  success: boolean;
  message: string;
  data?: any;
  requiresInput?: boolean;
  inputPrompt?: string;
  suggestions?: string[];
  context?: SessionContext;
}

// 统计信息
interface AgentStats {
  totalConversations: number;
  successfulActions: number;
  failedActions: number;
  intentDistribution: Record<IntentType, number>;
}

export class AgentService {
  private intentParser: IntentParser;
  private actionExecutor: ActionExecutor;
  private sessionCache: Map<string, SessionContext> = new Map();

  constructor() {
    this.intentParser = new IntentParser();
    this.actionExecutor = new ActionExecutor();
  }

  /**
   * 处理用户消息 - 主要入口
   */
  async handleMessage(userId: string, message: string): Promise<AgentResponse> {
    // 1. 获取或创建会话上下文
    const context = this.getOrCreateContext(userId);

    // 2. 解析意图
    const intent = this.intentParser.parse(message);
    intent.entities.userId = userId;

    // 3. 更新上下文
    context.lastIntent = intent;
    context.updatedAt = new Date();

    // 4. 处理多轮对话确认
    if (context.pendingAction && this.isConfirmation(message)) {
      return this.handleConfirmation(userId, message, context);
    }

    // 5. 执行动作
    const result = await this.actionExecutor.execute(intent, userId);

    // 6. 处理需要确认的动作
    if (result.requiresConfirmation) {
      context.pendingAction = {
        type: intent.type,
        entities: intent.entities,
        confirmationToken: this.generateConfirmationToken(),
      };
      this.sessionCache.set(userId, context);
    }

    // 7. 记录交互日志
    await this.logInteraction(userId, intent, result);

    return {
      success: result.success,
      message: result.message,
      data: result.data,
      suggestions: intent.suggestions,
      context,
    };
  }

  /**
   * 获取或创建会话上下文
   */
  private getOrCreateContext(userId: string): SessionContext {
    let context = this.sessionCache.get(userId);
    if (!context) {
      context = {
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.sessionCache.set(userId, context);
    }
    return context;
  }

  /**
   * 检查是否为确认消息
   */
  private isConfirmation(message: string): boolean {
    const confirmPatterns = [
      /^(是|确认|确定|ok|yes|y|好的|没问题)/i,
      /^(取消|不|no|n|不要)/i,
    ];
    return confirmPatterns.some(p => p.test(message.trim()));
  }

  /**
   * 处理确认
   */
  private async handleConfirmation(
    userId: string,
    message: string,
    context: SessionContext
  ): Promise<AgentResponse> {
    const pending = context.pendingAction!;
    const isConfirmed = /^(是|确认|确定|ok|yes|y|好的|没问题)/i.test(message.trim());

    context.pendingAction = undefined;
    this.sessionCache.set(userId, context);

    if (!isConfirmed) {
      return {
        success: true,
        message: '操作已取消。',
        context,
      };
    }

    // 执行待确认的动作
    const result = await this.actionExecutor.execute(
      { type: pending.type, entities: pending.entities, confidence: 1, rawText: message },
      userId
    );

    return {
      success: result.success,
      message: result.message,
      data: result.data,
      context,
    };
  }

  /**
   * 生成确认令牌
   */
  private generateConfirmationToken(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * 记录交互日志
   */
  private async logInteraction(
    userId: string,
    intent: ParsedIntent,
    result: ActionResult
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: `AGENT_${intent.type}`,
          resourceType: 'AGENT',
          details: JSON.parse(JSON.stringify({
            rawText: intent.rawText,
            confidence: intent.confidence,
            entities: intent.entities,
            success: result.success,
          })),
        },
      });
    } catch (error) {
      // 日志记录失败不应影响主流程
      console.error('Failed to log agent interaction:', error);
    }
  }

  /**
   * 清除会话上下文
   */
  clearContext(userId: string): void {
    this.sessionCache.delete(userId);
  }

  /**
   * 获取用户当前状态摘要
   */
  async getUserStatusSummary(userId: string): Promise<string> {
    try {
      const [allocations, tasks, reservations] = await Promise.all([
        gpuService.getUserAllocations(userId),
        taskService.getUserTasks(userId),
        reservationService.getReservations({ userId, limit: 5 }),
      ]);

      const parts: string[] = [];

      if (allocations.length > 0) {
        parts.push(`🖥️ ${allocations.length} 个 GPU 使用中`);
      }

      const pendingTasks = tasks.filter(t => t.status === 'PENDING');
      const runningTasks = tasks.filter(t => t.status === 'RUNNING');
      if (pendingTasks.length > 0 || runningTasks.length > 0) {
        parts.push(`📋 ${pendingTasks.length + runningTasks.length} 个活跃任务`);
      }

      const activeReservations = reservations.data.filter(r =>
        r.status === 'APPROVED' || r.status === 'ACTIVE'
      );
      if (activeReservations.length > 0) {
        parts.push(`📅 ${activeReservations.length} 个预约`);
      }

      if (parts.length === 0) {
        return '您当前没有活跃的资源使用。';
      }

      return `您的状态：\n${parts.map(p => `- ${p}`).join('\n')}`;
    } catch (error) {
      return '获取状态失败，请稍后重试。';
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: string; components: Record<string, boolean> }> {
    const components: Record<string, boolean> = {
      intentParser: true,
      actionExecutor: true,
      database: false,
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      components.database = true;
    } catch {
      components.database = false;
    }

    const allHealthy = Object.values(components).every(v => v);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      components,
    };
  }

  /**
   * 获取支持的意图列表
   */
  getSupportedIntents(): Array<{ type: string; description: string; examples: string[] }> {
    return [
      {
        type: 'GPU_ALLOCATE',
        description: '申请 GPU 资源',
        examples: ['给我分配一个 A100', '申请 2 个 GPU', '我需要 80GB 显存的显卡'],
      },
      {
        type: 'GPU_RELEASE',
        description: '释放 GPU 资源',
        examples: ['释放我的 GPU', '归还显卡', '我不用 GPU 了'],
      },
      {
        type: 'GPU_QUERY',
        description: '查询 GPU 状态',
        examples: ['GPU 状态', '有多少 GPU 可用', '显卡情况'],
      },
      {
        type: 'TASK_CREATE',
        description: '创建新任务',
        examples: ['创建任务 "模型训练"', '新建任务'],
      },
      {
        type: 'TASK_CANCEL',
        description: '取消任务',
        examples: ['取消任务', '删除任务'],
      },
      {
        type: 'TASK_QUERY',
        description: '查询任务列表',
        examples: ['我的任务', '任务列表', '查看任务'],
      },
      {
        type: 'SERVER_STATUS',
        description: '查询服务器状态',
        examples: ['服务器状态', '所有服务器', '服务器在线吗'],
      },
      {
        type: 'RESERVATION_CREATE',
        description: '创建资源预约',
        examples: ['预约明天的 GPU', '预定 2 小时'],
      },
      {
        type: 'RESERVATION_CANCEL',
        description: '取消预约',
        examples: ['取消预约', '删除预约'],
      },
      {
        type: 'RESERVATION_QUERY',
        description: '查询预约列表',
        examples: ['我的预约', '预约列表'],
      },
    ];
  }
}

// 导出单例
import { gpuService } from '../gpu.service';
import { taskService } from '../task.service';
import { reservationService } from '../reservation.service';

export const agentService = new AgentService();
export default agentService;