/**
 * MCP HTTP Routes - Expose MCP Tools via REST API & WebSocket Bridge
 * @module routes/mcp
 * 
 * 安全策略:
 * - 只读操作 (list/check): 直接执行，无需确认
 * - 写操作 (allocate/release/create/cancel): 需要用户确认后执行
 * - 危险操作 (批量删除/全部释放): 永远禁止通过 MCP 执行
 */

import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { serverService } from '../services/server.service';

const router = Router();

// 操作风险等级
const RISK_LEVELS = {
  READ_ONLY: 'read_only',      // 只读，无需确认
  MODERATE: 'moderate',         // 中等风险，需要确认
  HIGH: 'high',                 // 高风险，需要双重确认
  FORBIDDEN: 'forbidden'        // 禁止执行
} as const;

// 工具元数据 (包含风险等级和描述)
const toolMetadata: Record<string, {
  description: string;
  riskLevel: typeof RISK_LEVELS[keyof typeof RISK_LEVELS];
  impact: string;
  confirmMessage: string;
}> = {
  lsm_list_servers: {
    description: '查询服务器列表 (只读)',
    riskLevel: RISK_LEVELS.READ_ONLY,
    impact: '无影响',
    confirmMessage: ''
  },
  lsm_check_status: {
    description: '检查系统/服务器/任务状态 (只读)',
    riskLevel: RISK_LEVELS.READ_ONLY,
    impact: '无影响',
    confirmMessage: ''
  },
  lsm_allocate_gpu: {
    description: '分配 GPU 资源 (写入操作)',
    riskLevel: RISK_LEVELS.MODERATE,
    impact: '将锁定 GPU 资源，其他用户无法使用',
    confirmMessage: '确认分配 GPU？此操作将锁定资源直至释放或过期。'
  },
  lsm_release_gpu: {
    description: '释放 GPU 资源 (写入操作)',
    riskLevel: RISK_LEVELS.MODERATE,
    impact: '将释放 GPU，相关任务可能中断',
    confirmMessage: '确认释放 GPU？正在使用此 GPU 的任务将受到影响。'
  },
  lsm_create_task: {
    description: '创建新任务 (写入操作)',
    riskLevel: RISK_LEVELS.MODERATE,
    impact: '将在系统中创建新任务并占用资源',
    confirmMessage: '确认创建任务？'
  },
  lsm_cancel_task: {
    description: '取消任务 (写入操作)',
    riskLevel: RISK_LEVELS.MODERATE,
    impact: '任务将被取消，无法恢复',
    confirmMessage: '确认取消任务？此操作不可逆。'
  }
};

async function getMcpUser(): Promise<string> {
  let user = await prisma.user.findFirst({ where: { username: 'mcp-system' } });
  if (!user) user = await prisma.user.create({ data: { username: 'mcp-system', email: 'mcp-system@lsm.local', passwordHash: 'x', role: 'ADMIN' } });
  return user.id;
}

// Tool handlers
const handlers = {
  async lsm_list_servers(p: { status?: string; region?: string; limit?: number }) {
    const { status = 'all', region, limit = 50 } = p;
    let servers = await serverService.getAllServers();
    if (status !== 'all') {
      const map: Record<string, string> = { online: 'ONLINE', offline: 'OFFLINE', maintenance: 'MAINTENANCE', error: 'ERROR' };
      servers = servers.filter((s: any) => s.status === map[status]);
    }
    if (region) servers = servers.filter((s: any) => s.location?.toLowerCase().includes(region.toLowerCase()));
    return { servers: servers.slice(0, limit).map((s: any) => ({ id: s.id, name: s.name, status: s.status?.toLowerCase(), gpu_count: s.gpus?.length || 0, region: s.location })), total: servers.length };
  },

  async lsm_allocate_gpu(p: { count: number; purpose: string; duration_hours?: number; gpu_type?: string; user_id?: string }) {
    const { count, purpose, duration_hours = 24, gpu_type, user_id } = p;
    const userId = user_id || await getMcpUser();
    const where: any = { allocated: false, server: { status: 'ONLINE' } };
    if (gpu_type) where.model = { contains: gpu_type };
    const gpus = await prisma.gpu.findMany({ where, include: { server: true }, take: count });
    if (gpus.length < count) throw { code: 'RESOURCE_EXHAUSTED', message: `Insufficient GPUs. Need ${count}, have ${gpus.length}` };
    const allocationIds: string[] = [], gpuIds: string[] = [];
    for (const gpu of gpus) {
      const alloc = await prisma.gpuAllocation.create({ data: { userId, gpuId: gpu.id, duration: duration_hours * 3600 } });
      await prisma.gpu.update({ where: { id: gpu.id }, data: { allocated: true } });
      allocationIds.push(alloc.id); gpuIds.push(gpu.id);
    }
    return { allocation_id: allocationIds[0], allocation_ids: allocationIds, gpu_ids: gpuIds, server_id: gpus[0].serverId, gpu_type: gpus[0].model, expires_at: new Date(Date.now() + duration_hours * 3600000).toISOString(), purpose };
  },

  async lsm_release_gpu(p: { allocation_id: string; force?: boolean }) {
    const { allocation_id } = p;
    const alloc = await prisma.gpuAllocation.findUnique({ where: { id: allocation_id }, include: { gpu: true } });
    if (!alloc) throw { code: 'NOT_FOUND', message: `Allocation ${allocation_id} not found` };
    if (alloc.releasedAt) throw { code: 'CONFLICT', message: 'Allocation already released' };
    await prisma.gpuAllocation.update({ where: { id: allocation_id }, data: { releasedAt: new Date() } });
    await prisma.gpu.update({ where: { id: alloc.gpuId }, data: { allocated: false } });
    return { allocation_id, released_at: new Date().toISOString(), gpu_ids: [alloc.gpuId] };
  },

  async lsm_create_task(p: { task_type: string; target: string; params?: any; priority?: string; user_id?: string }) {
    const { task_type, target, params: tp, priority = 'normal', user_id } = p;
    const userId = user_id || await getMcpUser();
    const map: Record<string, string> = { low: 'LOW', normal: 'MEDIUM', high: 'HIGH' };
    const task = await prisma.task.create({ data: { name: `[MCP] ${task_type}: ${target}`, description: JSON.stringify({ task_type, target, params: tp }), userId, priority: map[priority] as any, status: 'PENDING' } });
    return { task_id: task.id, status: 'pending', created_at: task.createdAt?.toISOString(), task_type, target };
  },

  async lsm_cancel_task(p: { task_id: string; reason?: string }) {
    const { task_id, reason } = p;
    const task = await prisma.task.findUnique({ where: { id: task_id } });
    if (!task) throw { code: 'NOT_FOUND', message: `Task ${task_id} not found` };
    if (['COMPLETED', 'FAILED'].includes(task.status)) throw { code: 'CONFLICT', message: `Cannot cancel ${task.status} task` };
    const updated = await prisma.task.update({ where: { id: task_id }, data: { status: 'CANCELLED', completedAt: new Date(), errorMessage: reason ? `Cancelled: ${reason}` : 'Cancelled via MCP' } });
    return { task_id, status: 'cancelled', cancelled_at: updated.completedAt?.toISOString() };
  },

  async lsm_check_status(p: { scope?: string; target_id?: string }) {
    const { scope = 'cluster', target_id } = p;
    if (scope === 'cluster') {
      const stats = await serverService.getServerStats();
      const taskStats = await prisma.task.groupBy({ by: ['status'], _count: true });
      const tasks: Record<string, number> = {}; taskStats.forEach(t => tasks[t.status.toLowerCase()] = t._count);
      return { scope: 'cluster', status: 'operational', total_servers: stats.total, online: stats.online, offline: stats.offline, total_gpus: stats.totalGpus, available_gpus: stats.availableGpus, tasks };
    }
    if (!target_id) throw { code: 'INVALID_PARAMS', message: 'target_id required' };
    if (scope === 'task') {
      const task = await prisma.task.findUnique({ where: { id: target_id } });
      if (!task) throw { code: 'NOT_FOUND', message: `Task ${target_id} not found` };
      return { scope: 'task', task_id: task.id, status: task.status.toLowerCase(), name: task.name, created_at: task.createdAt?.toISOString() };
    }
    if (scope === 'server') {
      const server = await prisma.server.findUnique({ where: { id: target_id }, include: { gpus: true } });
      if (!server) throw { code: 'NOT_FOUND', message: `Server ${target_id} not found` };
      return { scope: 'server', server_id: server.id, status: server.status?.toLowerCase(), name: server.name, gpu_count: server.gpus?.length || 0 };
    }
    throw { code: 'INVALID_PARAMS', message: 'Invalid scope' };
  },
};

// Routes
router.get('/tools', (_req, res) => res.json({ 
  tools: Object.keys(handlers).map(name => ({
    name,
    description: toolMetadata[name]?.description || `LSM Tool: ${name}`,
    riskLevel: toolMetadata[name]?.riskLevel || 'unknown',
    impact: toolMetadata[name]?.impact || '',
    requiresConfirmation: toolMetadata[name]?.riskLevel !== RISK_LEVELS.READ_ONLY
  }))
}));

// 获取操作预览 (用于确认前展示)
router.post('/preview', async (req, res) => {
  try {
    const { tool, params = {} } = req.body;
    if (!tool || !handlers[tool as keyof typeof handlers]) {
      return res.status(400).json({ success: false, error: `Unknown tool: ${tool}` });
    }
    
    const meta = toolMetadata[tool];
    if (!meta) {
      return res.status(400).json({ success: false, error: 'Tool metadata not found' });
    }
    
    // 检查是否为禁止操作
    if (meta.riskLevel === RISK_LEVELS.FORBIDDEN) {
      return res.status(403).json({ 
        success: false, 
        error: '此操作禁止通过 MCP 执行，请通过管理界面操作' 
      });
    }
    
    res.json({
      success: true,
      preview: {
        tool,
        description: meta.description,
        riskLevel: meta.riskLevel,
        impact: meta.impact,
        confirmMessage: meta.confirmMessage,
        params,
        requiresConfirmation: meta.riskLevel !== RISK_LEVELS.READ_ONLY
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal error' });
  }
});

// 执行操作 (需确认)
router.post('/invoke', async (req, res) => {
  try {
    const { tool, params = {}, confirmed = false } = req.body;
    if (!tool || !handlers[tool as keyof typeof handlers]) {
      return res.status(400).json({ success: false, error: `Unknown tool: ${tool}` });
    }
    
    const meta = toolMetadata[tool];
    
    // 检查是否为禁止操作
    if (meta?.riskLevel === RISK_LEVELS.FORBIDDEN) {
      return res.status(403).json({ 
        success: false, 
        error: '此操作禁止通过 MCP 执行' 
      });
    }
    
    // 非只读操作需要确认
    if (meta && meta.riskLevel !== RISK_LEVELS.READ_ONLY && !confirmed) {
      return res.status(409).json({ 
        success: false, 
        error: '操作需要确认',
        requiresConfirmation: true,
        preview: {
          tool,
          description: meta.description,
          impact: meta.impact,
          confirmMessage: meta.confirmMessage,
          params
        }
      });
    }
    
    const result = await handlers[tool as keyof typeof handlers](params);
    res.json({ success: true, result });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'CONFLICT' ? 409 : 500;
    res.status(status).json({ success: false, error: err.message || 'Internal error' });
  }
});

router.post('/call', async (req, res) => {
  const { method, params = {}, id } = req.body;
  try {
    if (!method || !handlers[method as keyof typeof handlers]) return res.status(400).json({ jsonrpc: '2.0', error: { code: -32601, message: `Method not found: ${method}` }, id });
    const result = await handlers[method as keyof typeof handlers](params);
    res.json({ jsonrpc: '2.0', result, id });
  } catch (err: any) {
    res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: err.message || 'Internal error' }, id });
  }
});

// Export handlers for WebSocket bridge
export const mcpTools = handlers;
export default router;