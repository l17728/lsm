// Mock server service for MCP testing
export const serverService = {
  getAllServers: jest.fn(),
  getServerById: jest.fn(),
  getServerStats: jest.fn(),
};

export default serverService;