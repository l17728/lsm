/**
 * LSM MCP Server - Model Context Protocol Integration
 * 
 * Exposes LSM core operations as MCP Tools for AI agent integration.
 * Supports stdio transport for seamless integration with MCP clients.
 * 
 * @module lsm-mcp-server
 * @version 3.2.0
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Import tool registrations
import { registerServerTools } from './tools/servers.js';
import { registerGpuTools } from './tools/gpu.js';
import { registerTaskTools } from './tools/tasks.js';

// MCP Server instance
const server = new McpServer({
  name: 'lsm-server',
  version: '3.2.0',
});

// Register all MCP tools
registerServerTools(server);
registerGpuTools(server);
registerTaskTools(server);

/**
 * Start the MCP server with stdio transport
 */
async function main(): Promise<void> {
  console.error('[LSM MCP Server] Starting...');

  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[LSM MCP Server] Connected via stdio transport');
  } catch (error) {
    console.error('[LSM MCP Server] Failed to start:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('[LSM MCP Server] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[LSM MCP Server] Shutting down...');
  process.exit(0);
});

// Start the server
main();

export { server };