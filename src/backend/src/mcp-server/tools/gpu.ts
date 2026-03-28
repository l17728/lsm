/**
 * LSM MCP Server - GPU Tools
 * Implements lsm_allocate_gpu and lsm_release_gpu tools
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import prisma from '../../utils/prisma';
import { server_status as ServerStatus } from '@prisma/client';

/**
 * Register GPU-related MCP tools
 */
export function registerGpuTools(server: McpServer): void {
  // lsm_allocate_gpu - Allocate GPU resources
  server.tool(
    'lsm_allocate_gpu',
    'Allocate GPU resources for a user. Requires GPU count, purpose, and optional GPU type preference.',
    {
      count: z.number().min(1).max(64).describe('Number of GPUs to allocate (1-64)'),
      purpose: z.string().min(1).describe('Purpose description for the allocation'),
      duration_hours: z.number().min(1).max(720).optional().describe('Duration in hours, default 24'),
      gpu_type: z.enum(['A100', 'H100', 'A10', 'T4']).optional().describe('GPU type preference'),
      user_id: z.string().optional().describe('User ID (defaults to MCP system user)'),
    },
    async (params) => {
      try {
        const { count, purpose, duration_hours = 24, gpu_type, user_id } = params;

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

        // Find available GPUs (allocated = false or null)
        const whereClause: any = {
          allocated: false,
          server: { status: ServerStatus.ONLINE },
        };
        if (gpu_type) {
          whereClause.model = { contains: gpu_type };
        }

        const availableGpus = await prisma.gpu.findMany({
          where: whereClause,
          include: { server: true },
          take: count,
        });

        if (availableGpus.length < count) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: {
                      code: 'RESOURCE_EXHAUSTED',
                      message: `Insufficient GPUs. Requested: ${count}, Available: ${availableGpus.length}`,
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

        // Create allocations
        const allocatedGpuIds: string[] = [];
        const allocationIds: string[] = [];
        const serverId = availableGpus[0].serverId;
        const expiresAt = new Date(Date.now() + duration_hours * 60 * 60 * 1000);

        for (const gpu of availableGpus) {
          const allocation = await prisma.gpuAllocation.create({
            data: {
              userId: userId!,
              gpuId: gpu.id,
              allocatedAt: new Date(),
              duration: duration_hours * 60, // Store duration in minutes
            },
          });

          await prisma.gpu.update({
            where: { id: gpu.id },
            data: { allocated: true },
          });

          allocatedGpuIds.push(gpu.id);
          allocationIds.push(allocation.id);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  allocation_id: allocationIds[0],
                  allocation_ids: allocationIds,
                  gpu_ids: allocatedGpuIds,
                  server_id: serverId,
                  gpu_type: availableGpus[0].model,
                  expires_at: expiresAt.toISOString(),
                  purpose,
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
                    message: error.message || 'Failed to allocate GPU',
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

  // lsm_release_gpu - Release GPU resources
  server.tool(
    'lsm_release_gpu',
    'Release allocated GPU resources. Requires the allocation ID.',
    {
      allocation_id: z.string().describe('The allocation ID to release'),
      force: z.boolean().optional().describe('Force release even if in use, default false'),
    },
    async (params) => {
      try {
        const { allocation_id, force = false } = params;

        const allocation = await prisma.gpuAllocation.findUnique({
          where: { id: allocation_id },
          include: { gpu: true },
        });

        if (!allocation) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: {
                      code: 'RESOURCE_NOT_FOUND',
                      message: `Allocation ${allocation_id} not found`,
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

        // Check if already released (has releasedAt)
        if (allocation.releasedAt && !force) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: {
                      code: 'CONFLICT',
                      message: `Allocation is already released at ${allocation.releasedAt.toISOString()}`,
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

        // Release the allocation
        await prisma.gpuAllocation.update({
          where: { id: allocation_id },
          data: {
            releasedAt: new Date(),
          },
        });

        await prisma.gpu.update({
          where: { id: allocation.gpuId },
          data: { allocated: false },
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  allocation_id,
                  released_at: new Date().toISOString(),
                  gpu_id: allocation.gpuId,
                  gpu_ids: [allocation.gpuId],
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
                    message: error.message || 'Failed to release GPU',
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

export default registerGpuTools;