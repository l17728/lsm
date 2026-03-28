/**
 * 动作执行器 - 执行解析后的意图
 * Action Executor - Execute parsed intents
 */

import { gpuService } from '../gpu.service';
import { taskService } from '../task.service';
import { serverService } from '../server.service';
import { reservationService } from '../reservation.service';
import { ParsedIntent, IntentType, IntentEntities } from './intent-parser';
import { task_priority as TaskPriority } from '@prisma/client';

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
}

export class ActionExecutor {
  /**
   * 执行意图
   */
  async execute(intent: ParsedIntent, userId: string): Promise<ActionResult> {
    switch (intent.type) {
      case 'GPU_ALLOCATE':
        return this.executeGpuAllocate(intent.entities, userId);
      case 'GPU_RELEASE':
        return this.executeGpuRelease(intent.entities, userId);
      case 'GPU_QUERY':
        return this.executeGpuQuery(intent.entities);
      case 'TASK_CREATE':
        return this.executeTaskCreate(intent.entities, userId);
      case 'TASK_CANCEL':
        return this.executeTaskCancel(intent.entities, userId);
      case 'TASK_QUERY':
        return this.executeTaskQuery(intent.entities, userId);
      case 'SERVER_STATUS':
        return this.executeServerStatus(intent.entities);
      case 'RESERVATION_CREATE':
        return this.executeReservationCreate(intent.entities, userId);
      case 'RESERVATION_CANCEL':
        return this.executeReservationCancel(intent.entities, userId);
      case 'RESERVATION_QUERY':
        return this.executeReservationQuery(intent.entities, userId);
      case 'HELP':
        return this.executeHelp();
      default:
        return {
          success: false,
          message: '抱歉，我无法理解您的请求。请尝试更具体地描述您的需求。',
        };
    }
  }

  /**
   * GPU 申请
   */
  private async executeGpuAllocate(entities: IntentEntities, userId: string): Promise<ActionResult> {
    try {
      const result = await gpuService.allocateGpu({
        userId,
        gpuModel: entities.gpuModel,
        minMemory: entities.minMemory,
      });

      return {
        success: true,
        message: `GPU 分配成功！\n` +
          `- GPU 型号: ${result.gpuModel}\n` +
          `- 显存: ${result.gpuMemory}GB\n` +
          `- 服务器: ${result.serverName}\n` +
          `- 分配ID: ${result.allocationId}`,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `GPU 分配失败: ${error.message}`,
      };
    }
  }

  /**
   * GPU 释放
   */
  private async executeGpuRelease(entities: IntentEntities, userId: string): Promise<ActionResult> {
    try {
      if (!entities.allocationId) {
        // 查询用户当前的所有 GPU 分配
        const allocations = await gpuService.getUserAllocations(userId);
        if (allocations.length === 0) {
          return {
            success: false,
            message: '您当前没有活跃的 GPU 分配。',
          };
        }
        if (allocations.length === 1) {
          // 只有一个，直接释放
          const result = await gpuService.releaseGpu(allocations[0].id, userId);
          return {
            success: true,
            message: 'GPU 已成功释放。',
            data: result,
          };
        }
        // 多个分配，让用户选择
        const allocationList = allocations
          .map((a, i) => `${i + 1}. ${a.gpu.model} (${a.gpu.memory}GB) - ${a.gpu.server.name}`)
          .join('\n');
        return {
          success: false,
          message: `您有多个活跃的 GPU 分配，请指定要释放的ID：\n${allocationList}`,
          requiresConfirmation: true,
        };
      }

      const result = await gpuService.releaseGpu(entities.allocationId, userId);
      return {
        success: true,
        message: 'GPU 已成功释放。',
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `GPU 释放失败: ${error.message}`,
      };
    }
  }

  /**
   * GPU 查询
   */
  private async executeGpuQuery(entities: IntentEntities): Promise<ActionResult> {
    try {
      const stats = await gpuService.getGpuStats();

      return {
        success: true,
        message: `GPU 资源状态：\n` +
          `- 总数: ${stats.total}\n` +
          `- 可用: ${stats.available}\n` +
          `- 已分配: ${stats.allocated}\n` +
          `- 型号分布: ${JSON.stringify(stats.byModel)}`,
        data: stats,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `GPU 状态查询失败: ${error.message}`,
      };
    }
  }

  /**
   * 任务创建
   */
  private async executeTaskCreate(entities: IntentEntities, userId: string): Promise<ActionResult> {
    try {
      if (!entities.taskName) {
        return {
          success: false,
          message: '请提供任务名称。例如：创建任务 "模型训练"',
        };
      }

      const priorityMap: Record<string, TaskPriority> = {
        'LOW': TaskPriority.LOW,
        'MEDIUM': TaskPriority.MEDIUM,
        'HIGH': TaskPriority.HIGH,
        'CRITICAL': TaskPriority.CRITICAL,
      };

      const task = await taskService.createTask({
        name: entities.taskName,
        description: entities.taskDescription,
        userId,
        priority: entities.priority ? priorityMap[entities.priority] : TaskPriority.MEDIUM,
      });

      return {
        success: true,
        message: `任务创建成功！\n` +
          `- 任务ID: ${task.id}\n` +
          `- 名称: ${task.name}\n` +
          `- 优先级: ${task.priority}`,
        data: task,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `任务创建失败: ${error.message}`,
      };
    }
  }

  /**
   * 任务取消
   */
  private async executeTaskCancel(entities: IntentEntities, userId: string): Promise<ActionResult> {
    try {
      if (!entities.taskId) {
        return {
          success: false,
          message: '请提供要取消的任务ID。',
        };
      }

      const task = await taskService.cancelTask(entities.taskId, userId);
      return {
        success: true,
        message: `任务 "${task.name}" 已取消。`,
        data: task,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `任务取消失败: ${error.message}`,
      };
    }
  }

  /**
   * 任务查询
   */
  private async executeTaskQuery(entities: IntentEntities, userId: string): Promise<ActionResult> {
    try {
      const tasks = await taskService.getUserTasks(userId);

      if (tasks.length === 0) {
        return {
          success: true,
          message: '您当前没有任务。',
        };
      }

      const taskList = tasks
        .slice(0, 10)
        .map((t, i) => `${i + 1}. [${t.status}] ${t.name}`)
        .join('\n');

      return {
        success: true,
        message: `您的任务列表：\n${taskList}`,
        data: tasks,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `任务查询失败: ${error.message}`,
      };
    }
  }

  /**
   * 服务器状态查询
   */
  private async executeServerStatus(entities: IntentEntities): Promise<ActionResult> {
    try {
      const stats = await serverService.getServerStats();
      const servers = await serverService.getAllServers();

      const serverList = servers
        .slice(0, 5)
        .map(s => `- ${s.name}: ${s.status} (${s.gpus?.length || 0} GPUs)`)
        .join('\n');

      return {
        success: true,
        message: `服务器状态概览：\n` +
          `- 总数: ${stats.total}\n` +
          `- 在线: ${stats.online}\n` +
          `- 离线: ${stats.offline}\n` +
          `- 维护: ${stats.maintenance}\n\n` +
          `服务器列表：\n${serverList}`,
        data: { stats, servers },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `服务器状态查询失败: ${error.message}`,
      };
    }
  }

  /**
   * 资源预约创建
   */
  private async executeReservationCreate(entities: IntentEntities, userId: string): Promise<ActionResult> {
    try {
      if (!entities.startTime || !entities.endTime) {
        return {
          success: false,
          message: '请提供预约的开始和结束时间。例如：预约明天 2 小时的 GPU',
        };
      }

      const result = await reservationService.createReservation(userId, {
        title: entities.title || 'GPU 预约',
        startTime: entities.startTime,
        endTime: entities.endTime,
        gpuCount: entities.gpuCount || 1,
        minMemory: entities.minMemory,
      });

      return {
        success: true,
        message: `预约创建成功！\n` +
          `- 预约ID: ${result.reservation.id}\n` +
          `- 时间: ${entities.startTime.toLocaleString()} - ${entities.endTime.toLocaleString()}\n` +
          `${result.warnings ? `- 提示: ${result.warnings.join(', ')}` : ''}`,
        data: result.reservation,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `预约创建失败: ${error.message}`,
      };
    }
  }

  /**
   * 资源预约取消
   */
  private async executeReservationCancel(entities: IntentEntities, userId: string): Promise<ActionResult> {
    try {
      if (!entities.reservationId) {
        return {
          success: false,
          message: '请提供要取消的预约ID。',
        };
      }

      const result = await reservationService.cancelReservation(
        entities.reservationId,
        userId,
        '用户主动取消'
      );

      return {
        success: true,
        message: '预约已成功取消。',
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `预约取消失败: ${error.message}`,
      };
    }
  }

  /**
   * 资源预约查询
   */
  private async executeReservationQuery(entities: IntentEntities, userId: string): Promise<ActionResult> {
    try {
      const result = await reservationService.getReservations({
        userId,
        limit: 10,
      });

      if (result.data.length === 0) {
        return {
          success: true,
          message: '您当前没有预约。',
        };
      }

      const reservationList = result.data
        .map((r, i) => `${i + 1}. [${r.status}] ${r.title} - ${r.startTime.toLocaleDateString()}`)
        .join('\n');

      return {
        success: true,
        message: `您的预约列表：\n${reservationList}`,
        data: result.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `预约查询失败: ${error.message}`,
      };
    }
  }

  /**
   * 帮助信息
   */
  private executeHelp(): ActionResult {
    return {
      success: true,
      message: `我是 LSM 数字管理员，可以帮您：\n\n` +
        `🖥️ GPU 管理：\n` +
        `- 申请 GPU："给我分配一个 A100"\n` +
        `- 释放 GPU："释放我的 GPU"\n` +
        `- 查询 GPU："GPU 状态"\n\n` +
        `📋 任务管理：\n` +
        `- 创建任务："创建任务 \"模型训练\""\n` +
        `- 取消任务："取消任务 [ID]"\n` +
        `- 查询任务："我的任务"\n\n` +
        `🖥️ 服务器状态：\n` +
        `- "服务器状态"\n\n` +
        `📅 资源预约：\n` +
        `- "预约明天 2 小时 GPU"\n` +
        `- "我的预约"\n\n` +
        `有什么可以帮您的？`,
    };
  }
}

export const actionExecutor = new ActionExecutor();
export default actionExecutor;