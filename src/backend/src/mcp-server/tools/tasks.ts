/**
 * LSM MCP Server - Task Tools
 * Implements lsm_create_task, lsm_cancel_task, and lsm_check_status tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import prisma from '../../utils/prisma';
import { task_status as TaskStatus, task_priority as TaskPriority } from '@prisma/client';
import { serverService } from '../../services/server.service';

/**
 * Register task-related MCP tools
 */
export function registerTaskTools(server: McpServer): void {
  // lsm_create_task - Create an operations task
  server.tool(
    'lsm_create_task',
    'Create a new operations task',
    async (params: any) => {
      try {
        const { task_type, target, params: taskParams, priority = 'normal', timeout_seconds = 3600, user_id } = params;

        // Find or create MCP system user
        let userId = user_id;
        if (!userId) {
          let systemUser = await prisma.user.findFirst({
            where: { username: 'mcp-system' },
          });
          if (!systemUser) {
            systemUser = await prisma.user.create({
              data: {
                username: 'mcp-system',
                email: 'mcp-system@lsm.local',
                passwordHash: 'mcp-no-login',
                role: 'ADMIN',
              },
            });
          }
          userId = systemUser.id;
        }

        const priorityMap: Record<string, TaskPriority> = {
          low: TaskPriority.LOW,
          normal: TaskPriority.MEDIUM,
          high: TaskPriority.HIGH,
        };

        const task = await prisma.task.create({
          data: {
            name: `[MCP] ${task_type}: ${target}`,
            description: JSON.stringify({ task_type, target, params: taskParams, timeout_seconds }),
            userId: userId!,
            priority: priorityMap[priority],
            status: TaskStatus.PENDING,
          },
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  task_id: task.id,
                  status: 'pending',
                  created_at: task.createdAt?.toISOString(),
                  task_type,
                  target,
                  estimated_duration: `${Math.round(timeout_seconds / 60)} minutes`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to create task',
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // lsm_cancel_task - Cancel a running or pending task
  server.tool(
    'lsm_cancel_task',
    'Cancel a pending or running task by its ID.',
    {
      task_id: z.string().describe('The task ID to cancel'),
      reason: z.string().optional().describe('Reason for cancellation'),
    },
    async (params) => {
      try {
        const { task_id, reason } = params;

        const task = await prisma.task.findUnique({
          where: { id: task_id },
        });

        if (!task) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: {
                      code: 'RESOURCE_NOT_FOUND',
                      message: `Task ${task_id} not found`,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: {
                      code: 'CONFLICT',
                      message: `Cannot cancel task in ${task.status} state`,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const updatedTask = await prisma.task.update({
          where: { id: task_id },
          data: {
            status: TaskStatus.CANCELLED,
            completedAt: new Date(),
            errorMessage: reason ? `Cancelled: ${reason}` : 'Cancelled via MCP',
          },
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  task_id,
                  status: 'cancelled',
                  cancelled_at: updatedTask.completedAt?.toISOString(),
                  reason: reason || 'No reason provided',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to cancel task',
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // lsm_check_status - Check system or task status
  server.tool(
    'lsm_check_status',
    'Check the status of the cluster, a specific task, or a server.',
    {
      scope: z.enum(['cluster', 'task', 'server']).optional().describe('Scope: cluster/task/server, default cluster'),
      target_id: z.string().optional().describe('Task or server ID when scope is task/server'),
    },
    async (params) => {
      try {
        const { scope = 'cluster', target_id } = params;

        if (scope === 'cluster') {
          const stats = await serverService.getServerStats();
          const taskStats = await prisma.task.groupBy({
            by: ['status'],
            _count: true,
          });

          const taskCountByStatus: Record<string, number> = {};
          taskStats.forEach((t) => {
            taskCountByStatus[t.status.toLowerCase()] = t._count;
          });

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    scope: 'cluster',
                    status: 'operational',
                    details: {
                      total_servers: stats.total,
                      online: stats.online,
                      offline: stats.offline,
                      maintenance: stats.maintenance,
                      total_gpus: stats.totalGpus,
                      available_gpus: stats.availableGpus,
                      gpu_utilization: stats.totalGpus > 0
                        ? `${Math.round((1 - stats.availableGpus / stats.totalGpus) * 100)}%`
                        : '0%',
                      tasks: taskCountByStatus,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (scope === 'task' && target_id) {
          const task = await prisma.task.findUnique({
            where: { id: target_id },
          });

          if (!task) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: `Task ${target_id} not found`,
                      },
                    },
                    null,
                    2
                  ),
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    scope: 'task',
                    task_id: task.id,
                    status: task.status.toLowerCase(),
                    details: {
                      name: task.name,
                      priority: task.priority.toLowerCase(),
                      created_at: task.createdAt?.toISOString(),
                      started_at: task.startedAt?.toISOString(),
                      completed_at: task.completedAt?.toISOString(),
                      error_message: task.errorMessage,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        if (scope === 'server' && target_id) {
          // Fetch server with GPUs directly from prisma
          const server = await prisma.server.findUnique({
            where: { id: target_id },
            include: {
              gpus: true,
            },
          });

          if (!server) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: `Server ${target_id} not found`,
                      },
                    },
                    null,
                    2
                  ),
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    scope: 'server',
                    server_id: server.id,
                    status: server.status?.toLowerCase() || 'unknown',
                    details: {
                      name: server.name,
                      gpu_count: server.gpus?.length || 0,
                      gpus: server.gpus?.map((g: any) => ({
                        id: g.id,
                        model: g.model,
                        status: g.status?.toLowerCase(),
                      })),
                      location: server.location,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: {
                    code: 'INVALID_PARAMS',
                    message: 'target_id is required for task and server scopes',
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to check status',
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );
}

export default registerTaskTools;