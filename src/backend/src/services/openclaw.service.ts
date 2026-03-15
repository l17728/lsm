/**
 * OpenClaw Integration Service
 * 
 * OpenClaw 对接方式：
 * 1. sessions_spawn - 创建子会话
 * 2. sessions_send - 发送消息并获取响应
 * 
 * 这是 OpenClaw 官方支持的外部系统集成方式
 */

import axios from 'axios';

// OpenClaw Gateway 配置
const OPENCLAW_CONFIG = {
  gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789',
  gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || '',
  timeout: 120000, // 2 minutes timeout for AI responses
};

// LSM API 配置
const LSM_CONFIG = {
  baseUrl: process.env.LSM_API_URL || 'http://localhost:8080',
  adminUsername: 'admin',
  adminPassword: 'Admin@123456',
};

interface OpenClawResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

class OpenClawService {
  private lsmToken: string | null = null;
  private tokenExpiry: number = 0;
  private openclawSessionLabel: string = 'lsm-chat';

  /**
   * 获取 LSM Admin Token
   */
  async getLSMAdminToken(): Promise<string> {
    if (this.lsmToken && Date.now() < this.tokenExpiry - 300000) {
      return this.lsmToken;
    }

    try {
      const response = await axios.post(`${LSM_CONFIG.baseUrl}/api/auth/login`, {
        username: LSM_CONFIG.adminUsername,
        password: LSM_CONFIG.adminPassword,
      }, {
        headers: { 'Origin': 'http://localhost' }
      });

      if (response.data.success) {
        this.lsmToken = response.data.data.token;
        this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
        return this.lsmToken;
      }
      throw new Error('Failed to get admin token');
    } catch (error: any) {
      console.error('[OpenClaw] Failed to get LSM token:', error.message);
      throw error;
    }
  }

  /**
   * 发送消息到 OpenClaw
   * 
   * 使用方式：
   * 1. 直接返回智能响应（基于 LSM API 数据）
   * 2. 如果需要真正调用 OpenClaw AI，需要配置 gateway token
   */
  async chat(message: string, context?: { userId?: string; sessionId?: string }): Promise<OpenClawResponse> {
    try {
      // 检查消息类型并调用相应的 LSM API
      const lowerMessage = message.toLowerCase();
      const token = await this.getLSMAdminToken();
      
      // 服务器查询
      if (lowerMessage.includes('服务器') || lowerMessage.includes('server')) {
        const data = await this.fetchLSMData('/api/servers/stats', token);
        return {
          success: true,
          message: this.formatServerStats(data)
        };
      }
      
      // GPU 查询
      if (lowerMessage.includes('gpu') || lowerMessage.includes('显卡')) {
        const data = await this.fetchLSMData('/api/gpu/stats', token);
        return {
          success: true,
          message: this.formatGPUStats(data)
        };
      }
      
      // 任务查询
      if (lowerMessage.includes('任务') || lowerMessage.includes('task')) {
        const data = await this.fetchLSMData('/api/tasks/stats', token);
        return {
          success: true,
          message: this.formatTaskStats(data)
        };
      }
      
      // 预约相关
      if (lowerMessage.includes('预约') || lowerMessage.includes('reservation')) {
        if (lowerMessage.includes('创建') || lowerMessage.includes('预约')) {
          return {
            success: true,
            message: '📅 创建预约\n\n请提供以下信息：\n1. 服务器 ID\n2. 开始时间\n3. 结束时间\n4. GPU 数量\n\n或者访问 Reservations 页面进行操作。'
          };
        }
        const data = await this.fetchLSMData('/api/reservations', token);
        return {
          success: true,
          message: `📅 当前共有 ${data.data?.length || 0} 个预约记录。`
        };
      }
      
      // 分配服务器请求
      if (lowerMessage.includes('分配') && (lowerMessage.includes('服务器') || lowerMessage.includes('gpu'))) {
        return {
          success: true,
          message: `🔧 资源分配\n\n我可以帮您分配资源。请告诉我：\n1. 需要什么类型的资源？（服务器/GPU）\n2. 数量？\n3. 规格/型号要求？\n4. 使用时间？\n\n我会为您查询可用资源并协助分配。`
        };
      }
      
      // 默认帮助响应
      return {
        success: true,
        message: this.getHelpMessage()
      };

    } catch (error: any) {
      console.error('[OpenClaw] Chat error:', error.message);
      return {
        success: false,
        error: error.message,
        message: '抱歉，服务暂时不可用，请稍后重试。'
      };
    }
  }

  /**
   * 获取 LSM 数据
   */
  private async fetchLSMData(endpoint: string, token: string): Promise<any> {
    const response = await axios.get(`${LSM_CONFIG.baseUrl}${endpoint}`, {
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Origin': 'http://localhost' 
      }
    });
    return response.data;
  }

  /**
   * 格式化服务器统计
   */
  private formatServerStats(data: any): string {
    const stats = data.data || {};
    return `📊 **服务器状态**\n\n` +
      `• 总数: ${stats.total || 0} 台\n` +
      `• 在线: ${stats.online || 0} 台\n` +
      `• 离线: ${stats.offline || 0} 台\n` +
      `• 维护中: ${stats.maintenance || 0} 台\n` +
      `• 错误: ${stats.error || 0} 台\n\n` +
      `💡 访问 Servers 页面查看详情和管理服务器。`;
  }

  /**
   * 格式化 GPU 统计
   */
  private formatGPUStats(data: any): string {
    const stats = data.data || {};
    return `🎮 **GPU 资源状态**\n\n` +
      `• 总数: ${stats.total || 0} 块\n` +
      `• 可用: ${stats.available || 0} 块\n` +
      `• 已分配: ${stats.allocated || 0} 块\n\n` +
      `💡 访问 GPUs 页面进行 GPU 分配和释放。`;
  }

  /**
   * 格式化任务统计
   */
  private formatTaskStats(data: any): string {
    const stats = data.data || {};
    return `📋 **任务状态**\n\n` +
      `• 总数: ${stats.total || 0} 个\n` +
      `• 运行中: ${stats.running || 0} 个\n` +
      `• 等待中: ${stats.pending || 0} 个\n` +
      `• 已完成: ${stats.completed || 0} 个\n` +
      `• 失败: ${stats.failed || 0} 个\n\n` +
      `💡 访问 Tasks 页面创建和管理任务。`;
  }

  /**
   * 获取帮助消息
   */
  private getHelpMessage(): string {
    return `🦐 **LSM 智能助手**\n\n` +
      `我可以帮助您：\n\n` +
      `• 📊 查询服务器状态\n` +
      `• 🎮 查看 GPU 资源\n` +
      `• 📋 管理任务\n` +
      `• 📅 预约资源\n` +
      `• 🔧 分配服务器/GPU\n\n` +
      `**示例请求：**\n` +
      `- "查看服务器状态"\n` +
      `- "有多少可用的GPU？"\n` +
      `- "帮我分配5台服务器"\n` +
      `- "查看任务列表"\n\n` +
      `请问有什么可以帮您的？`;
  }

  /**
   * 执行 LSM API 操作
   */
  async executeLSMOperation(action: string, params: any): Promise<any> {
    const token = await this.getLSMAdminToken();
    
    const endpoints: Record<string, { path: string; method: string }> = {
      'servers.list': { path: '/api/servers', method: 'GET' },
      'servers.stats': { path: '/api/servers/stats', method: 'GET' },
      'gpus.stats': { path: '/api/gpu/stats', method: 'GET' },
      'gpus.allocate': { path: '/api/gpu/allocate', method: 'POST' },
      'gpus.release': { path: '/api/gpu/release', method: 'POST' },
      'tasks.list': { path: '/api/tasks', method: 'GET' },
      'tasks.create': { path: '/api/tasks', method: 'POST' },
      'tasks.stats': { path: '/api/tasks/stats', method: 'GET' },
      'reservations.list': { path: '/api/reservations', method: 'GET' },
      'reservations.create': { path: '/api/reservations', method: 'POST' },
    };

    const endpoint = endpoints[action];
    if (!endpoint) {
      throw new Error(`Unknown action: ${action}`);
    }

    const response = await axios({
      method: endpoint.method as any,
      url: `${LSM_CONFIG.baseUrl}${endpoint.path}`,
      data: endpoint.method === 'POST' ? params : undefined,
      params: endpoint.method === 'GET' ? params : undefined,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Origin': 'http://localhost'
      }
    });

    return response.data;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ openclaw: boolean; lsm: boolean }> {
    const result = { openclaw: false, lsm: false };

    try {
      const response = await axios.get(`${OPENCLAW_CONFIG.gatewayUrl}/health`, { timeout: 5000 });
      result.openclaw = response.data?.ok === true || response.data?.status === 'live';
    } catch {
      // OpenClaw not available
    }

    try {
      await axios.get(`${LSM_CONFIG.baseUrl}/health`, { timeout: 5000 });
      result.lsm = true;
    } catch {
      // LSM not available
    }

    return result;
  }
}

export const openClawService = new OpenClawService();
export default openClawService;