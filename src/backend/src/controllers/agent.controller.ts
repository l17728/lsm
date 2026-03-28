import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../utils/prisma';

/**
 * Agent 状态类型
 */
interface AgentStatus {
  isOnline: boolean;
  lastActiveAt: Date | null;
  pendingApprovals: number;
  activeConversations: number;
  version: string;
}

/**
 * 对话消息类型
 */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 对话会话类型
 */
interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 审批请求类型
 */
interface ApprovalRequest {
  id: string;
  type: 'reservation' | 'task' | 'resource';
  resourceId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  processedAt?: Date;
  processedBy?: string;
  reason?: string;
}

// 内存存储 (生产环境应使用数据库)
const conversations = new Map<string, Conversation>();
const approvalRequests = new Map<string, ApprovalRequest>();
const agentStatus: AgentStatus = {
  isOnline: true,
  lastActiveAt: new Date(),
  pendingApprovals: 0,
  activeConversations: 0,
  version: '1.0.0',
};

/**
 * Agent Controller
 * 处理 Agent 相关的 API 请求
 */
export class AgentController {
  /**
   * 发送消息给 Agent
   * POST /api/agent/chat
   */
  async chat(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { message, conversationId, context } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Message is required',
        });
        return;
      }

      // 获取或创建对话
      let conversation: Conversation;
      if (conversationId && conversations.has(conversationId)) {
        conversation = conversations.get(conversationId)!;
      } else {
        const newId = generateUUID();
        conversation = {
          id: newId,
          userId,
          title: message.substring(0, 50),
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        conversations.set(newId, conversation);
      }

      // 添加用户消息
      const userMessage: ChatMessage = {
        id: generateUUID(),
        role: 'user',
        content: message,
        timestamp: new Date(),
        metadata: { context },
      };
      conversation.messages.push(userMessage);

      // 生成 Agent 响应 (这里应接入实际的 AI 服务)
      const assistantMessage: ChatMessage = {
        id: generateUUID(),
        role: 'assistant',
        content: await this.generateResponse(message, context),
        timestamp: new Date(),
      };
      conversation.messages.push(assistantMessage);
      conversation.updatedAt = new Date();

      // 更新状态
      agentStatus.lastActiveAt = new Date();
      agentStatus.activeConversations = conversations.size;

      res.json({
        success: true,
        data: {
          conversationId: conversation.id,
          message: assistantMessage,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * 获取对话历史
   * GET /api/agent/conversations
   */
  async getConversations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { limit = '20', offset = '0' } = req.query;

      // 过滤当前用户的对话
      const userConversations = Array.from(conversations.values())
        .filter((conv) => conv.userId === userId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      // 分页
      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);
      const paginated = userConversations.slice(offsetNum, offsetNum + limitNum);

      res.json({
        success: true,
        data: {
          conversations: paginated.map((conv) => ({
            id: conv.id,
            title: conv.title,
            messageCount: conv.messages.length,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            lastMessage: conv.messages[conv.messages.length - 1]?.content || '',
          })),
          total: userConversations.length,
          limit: limitNum,
          offset: offsetNum,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * 获取单个对话详情
   * GET /api/agent/conversations/:id
   */
  async getConversationById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const conversation = conversations.get(id);
      if (!conversation) {
        res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
        return;
      }

      if (conversation.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * 审批操作
   * POST /api/agent/approve
   */
  async approve(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { type, resourceId, action, reason } = req.body;

      if (!type || !resourceId || !action) {
        res.status(400).json({
          success: false,
          error: 'Type, resourceId, and action are required',
        });
        return;
      }

      if (!['approve', 'reject'].includes(action)) {
        res.status(400).json({
          success: false,
          error: 'Action must be either "approve" or "reject"',
        });
        return;
      }

      // 根据类型处理不同的审批逻辑
      let result;
      switch (type) {
        case 'reservation':
          result = await this.handleReservationApproval(userId, resourceId, action, reason);
          break;
        case 'task':
          result = await this.handleTaskApproval(userId, resourceId, action, reason);
          break;
        case 'resource':
          result = await this.handleResourceApproval(userId, resourceId, action, reason);
          break;
        default:
          res.status(400).json({
            success: false,
            error: `Unknown approval type: ${type}`,
          });
          return;
      }

      // 更新审批统计
      const pendingApprovals = Array.from(approvalRequests.values())
        .filter((r) => r.status === 'pending').length;
      agentStatus.pendingApprovals = pendingApprovals;

      res.json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * 获取 Agent 状态
   * GET /api/agent/status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const pendingApprovals = Array.from(approvalRequests.values())
        .filter((r) => r.status === 'pending').length;

      res.json({
        success: true,
        data: {
          ...agentStatus,
          pendingApprovals,
          activeConversations: conversations.size,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * 获取待审批列表
   * GET /api/agent/approvals
   */
  async getPendingApprovals(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { status, type, limit = '20' } = req.query;

      let approvals = Array.from(approvalRequests.values());

      // 过滤
      if (status) {
        approvals = approvals.filter((a) => a.status === status);
      }
      if (type) {
        approvals = approvals.filter((a) => a.type === type);
      }

      // 排序和分页
      approvals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const limitNum = parseInt(limit as string, 10);
      approvals = approvals.slice(0, limitNum);

      res.json({
        success: true,
        data: approvals,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * 生成 Agent 响应 (模拟实现)
   */
  private async generateResponse(message: string, context?: unknown): Promise<string> {
    // 这里应接入实际的 AI 服务
    // 当前为模拟实现
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return 'Hello! I am the Laboratory Server Management Agent. How can I help you today?';
    }

    if (lowerMessage.includes('server') && lowerMessage.includes('status')) {
      return 'Currently, all servers are operating normally. Would you like me to provide more details?';
    }

    if (lowerMessage.includes('gpu') && lowerMessage.includes('available')) {
      return 'Checking GPU availability... There are 8 GPUs available across 3 servers. Would you like to make a reservation?';
    }

    if (lowerMessage.includes('help')) {
      return 'I can help you with:\n- Checking server status\n- GPU availability and reservations\n- Task management\n- Resource approvals\n- System monitoring\n\nWhat would you like to do?';
    }

    return `I received your message: "${message}". How can I assist you further?`;
  }

  /**
   * 处理预约审批
   */
  private async handleReservationApproval(
    userId: string,
    reservationId: string,
    action: string,
    reason?: string
  ): Promise<Record<string, unknown>> {
    // 查询预约信息
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { user: true, server: true },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    // 更新预约状态
    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        approvedBy: userId,
        approvedAt: new Date(),
        rejectionReason: action === 'reject' ? reason : null,
      },
    });

    // 创建审批记录
    await prisma.reservationApproval.create({
      data: {
        reservationId,
        approverId: userId,
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        comment: reason,
        approvedAt: new Date(),
      },
    });

    return {
      type: 'reservation',
      resourceId: reservationId,
      action,
      status: updated.status,
      processedBy: userId,
      processedAt: new Date(),
    };
  }

  /**
   * 处理任务审批
   */
  private async handleTaskApproval(
    userId: string,
    taskId: string,
    action: string,
    reason?: string
  ): Promise<Record<string, unknown>> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // 更新任务状态
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: action === 'approve' ? 'RUNNING' : 'CANCELLED',
        errorMessage: action === 'reject' ? reason : null,
      },
    });

    return {
      type: 'task',
      resourceId: taskId,
      action,
      status: updated.status,
      processedBy: userId,
      processedAt: new Date(),
    };
  }

  /**
   * 处理资源审批 (通用)
   */
  private async handleResourceApproval(
    userId: string,
    resourceId: string,
    action: string,
    reason?: string
  ): Promise<Record<string, unknown>> {
    // 创建审批记录
    const approvalId = generateUUID();
    const approval: ApprovalRequest = {
      id: approvalId,
      type: 'resource',
      resourceId,
      userId,
      status: action === 'approve' ? 'approved' : 'rejected',
      createdAt: new Date(),
      processedAt: new Date(),
      processedBy: userId,
      reason,
    };
    approvalRequests.set(approvalId, approval);

    return {
      type: 'resource',
      resourceId,
      action,
      status: approval.status,
      processedBy: userId,
      processedAt: new Date(),
    };
  }
}

// 工具函数
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default new AgentController();