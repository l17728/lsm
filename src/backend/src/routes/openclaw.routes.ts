import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import axios from 'axios';
import WebSocket from 'ws';

const router = Router();

// OpenClaw Gateway 配置
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
const OPENCLAW_WS_URL = process.env.OPENCLAW_WS_URL || 'ws://localhost:18789';

// 存储活跃的 OpenClaw WebSocket 连接
const activeConnections = new Map<string, { ws: WebSocket; sessionKey: string; createdAt: Date }>();

/**
 * @route   POST /api/openclaw/connect
 * @desc    连接 OpenClaw Gateway 并创建会话
 * @access  Private
 */
router.post('/connect', authenticate, async (req: AuthRequest, res) => {
  const userId = (req.user as any)?.id;
  
  try {
    // 关闭已有连接
    const existing = activeConnections.get(userId);
    if (existing) {
      existing.ws.close();
      activeConnections.delete(userId);
    }

    // 创建本地会话（实际 OpenClaw 连接在发送消息时建立）
    const sessionKey = `openclaw-${userId}-${Date.now()}`;
    
    res.json({
      success: true,
      sessionKey,
      mode: 'openclaw',
      message: '已连接 OpenClaw Gateway'
    });

  } catch (error: any) {
    console.error('[OpenClaw] Connect error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Connection failed'
    });
  }
});

/**
 * @route   POST /api/openclaw/disconnect
 * @desc    断开 OpenClaw 连接
 * @access  Private
 */
router.post('/disconnect', authenticate, async (req: AuthRequest, res) => {
  const userId = (req.user as any)?.id;
  
  const conn = activeConnections.get(userId);
  if (conn) {
    conn.ws.close();
    activeConnections.delete(userId);
  }
  
  res.json({ success: true, message: 'Disconnected' });
});

/**
 * @route   POST /api/openclaw/chat
 * @desc    发送消息到 OpenClaw（使用 sessions_spawn 方式）
 * @access  Private
 */
router.post('/chat', authenticate, async (req: AuthRequest, res) => {
  const { message, sessionKey } = req.body;
  const userId = (req.user as any)?.id;

  if (!message) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  try {
    // 调用本地 OpenClaw 的 sessions API
    // 通过 HTTP 请求触发 OpenClaw 创建会话并获取响应
    const response = await callOpenClawSession(message, userId);
    
    res.json({
      success: true,
      message: response,
      mode: 'openclaw'
    });
  } catch (error: any) {
    console.error('[OpenClaw] Chat error:', error);
    
    // 降级到本地响应
    const localResponse = await getLocalResponse(message);
    res.json({
      success: true,
      message: localResponse,
      mode: 'local',
      note: 'OpenClaw 暂不可用，已切换到本地模式'
    });
  }
});

/**
 * 通过 OpenClaw CLI 或内部 API 调用会话
 */
async function callOpenClawSession(message: string, userId: string): Promise<string> {
  // 方式1: 尝试通过 OpenClaw 内部 API
  try {
    // 检查 OpenClaw Gateway 是否有可用的 REST API
    const response = await axios.post(`${OPENCLAW_GATEWAY_URL}/api/session`, {
      message,
      context: {
        system: 'lsm',
        userId
      }
    }, {
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    return response.data?.response || response.data?.message || '收到';
  } catch (error: any) {
    // 如果 REST API 不可用，返回错误让调用方降级
    throw new Error(`OpenClaw API unavailable: ${error.message}`);
  }
}

/**
 * 本地智能响应（降级模式）
 */
async function getLocalResponse(message: string): Promise<string> {
  const lowerMessage = message.toLowerCase();
  
  try {
    const lsmApiUrl = 'http://localhost:8080';
    
    if (lowerMessage.includes('服务器') || lowerMessage.includes('server')) {
      const response = await axios.get(`${lsmApiUrl}/api/servers/stats`, {
        headers: { 'Origin': 'http://localhost' }
      });
      const stats = response.data.data || {};
      return `📊 **服务器状态**\n\n• 总数: ${stats.total || 0} 台\n• 在线: ${stats.online || 0} 台\n• 离线: ${stats.offline || 0} 台`;
    }
    
    if (lowerMessage.includes('gpu') || lowerMessage.includes('显卡')) {
      const response = await axios.get(`${lsmApiUrl}/api/gpu/stats`, {
        headers: { 'Origin': 'http://localhost' }
      });
      const stats = response.data.data || {};
      return `🎮 **GPU 资源状态**\n\n• 总数: ${stats.total || 0} 块\n• 可用: ${stats.available || 0} 块`;
    }
    
    if (lowerMessage.includes('任务') || lowerMessage.includes('task')) {
      const response = await axios.get(`${lsmApiUrl}/api/tasks/stats`, {
        headers: { 'Origin': 'http://localhost' }
      });
      const stats = response.data.data || {};
      return `📋 **任务状态**\n\n• 总数: ${stats.total || 0} 个\n• 运行中: ${stats.running || 0} 个`;
    }
    
  } catch (error) {
    console.error('LSM API error:', error);
  }
  
  return `🦐 **LSM 智能助手**\n\n我可以帮助您：\n• 📊 查询服务器状态\n• 🎮 查看 GPU 资源\n• 📋 管理任务\n\n请问有什么可以帮您的？`;
}

/**
 * @route   GET /api/openclaw/health
 * @desc    检查连接状态
 * @access  Public
 */
router.get('/health', async (req: Request, res: Response) => {
  const status = { openclaw: false, lsm: false };

  try {
    const response = await axios.get(`${OPENCLAW_GATEWAY_URL}/health`, { timeout: 5000 });
    status.openclaw = response.data?.ok === true || response.data?.status === 'live';
  } catch {
    // OpenClaw not available
  }

  try {
    await axios.get('http://localhost:8080/health', { timeout: 5000 });
    status.lsm = true;
  } catch {
    // LSM not available
  }

  res.json({ success: true, data: status });
});

export default router;