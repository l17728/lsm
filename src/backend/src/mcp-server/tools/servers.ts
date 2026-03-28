/**
 * LSM MCP Server - Server Tools
 * Implements lsm_list_servers tool
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { serverService } from '../../services/server.service';

/**
 * Register server-related MCP tools
 */
export function registerServerTools(server: McpServer): void {
  // lsm_list_servers - Query server list
  server.tool(
    'lsm_list_servers',
    'Query the list of servers in the cluster. Supports filtering by status and region.',
    {
      status: z.string().optional().describe('Filter by status: online/offline/maintenance/all'),
      region: z.string().optional().describe('Filter by region'),
      limit: z.number().min(1).max(200).optional().describe('Number of results, default 50, max 200'),
    },
    async (params) => {
      try {
        const { status = 'all', region, limit = 50 } = params;
        const allServers = await serverService.getAllServers();

        // Filter by status
        let filtered = allServers;
        if (status && status !== 'all') {
          const statusMap: Record<string, string> = {
            online: 'ONLINE',
            offline: 'OFFLINE',
            maintenance: 'MAINTENANCE',
            error: 'ERROR',
          };
          filtered = filtered.filter((s: any) => s.status === statusMap[status]);
        }

        // Filter by region (location field)
        if (region) {
          filtered = filtered.filter((s: any) =>
            s.location?.toLowerCase().includes(region.toLowerCase())
          );
        }

        // Apply limit
        const limited = filtered.slice(0, limit);

        // Format response
        const servers = limited.map((s: any) => ({
          id: s.id,
          name: s.name,
          status: s.status?.toLowerCase() || 'unknown',
          gpu_count: s.gpus?.length || 0,
          region: s.location || 'unknown',
        }));

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  servers,
                  total: filtered.length,
                  filtered: limited.length,
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
                    message: error.message || 'Failed to list servers',
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

export default registerServerTools;