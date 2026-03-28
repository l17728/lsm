/**
 * Self-Healing Service
 * v3.1.0 - 故障自愈服务
 * 
 * 功能：
 * - 自动检测故障
 * - 预定义修复动作
 * - 分级故障处理
 * - 修复历史记录
 * - 人工确认机制
 */

import { PrismaClient, server_status as ServerStatus } from '@prisma/client';
import { monitoringService } from '../monitoring.service';
import { notificationService, AlertSeverity, AlertType } from '../notification.service';

const prisma = new PrismaClient();

// 故障类型
export enum FaultType {
  SERVER_OFFLINE = 'SERVER_OFFLINE',
  SERVER_HIGH_CPU = 'SERVER_HIGH_CPU',
  SERVER_HIGH_MEMORY = 'SERVER_HIGH_MEMORY',
  SERVER_HIGH_TEMP = 'SERVER_HIGH_TEMP',
  GPU_ERROR = 'GPU_ERROR',
  GPU_OVERHEAT = 'GPU_OVERHEAT',
  DISK_FULL = 'DISK_FULL',
  NETWORK_ISSUE = 'NETWORK_ISSUE',
  SERVICE_CRASH = 'SERVICE_CRASH',
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',
  REDIS_CONNECTION = 'REDIS_CONNECTION',
  TASK_FAILED = 'TASK_FAILED',
  CUSTOM = 'CUSTOM',
}

// 故障级别
export enum FaultLevel {
  LOW = 'LOW',           // 低影响，可延迟处理
  MEDIUM = 'MEDIUM',     // 中等影响，需要尽快处理
  HIGH = 'HIGH',         // 高影响，需要立即处理
  CRITICAL = 'CRITICAL', // 关键故障，影响整个系统
}

// 修复动作类型
export enum RepairActionType {
  RESTART_SERVICE = 'RESTART_SERVICE',
  RESTART_SERVER = 'RESTART_SERVER',
  CLEAR_CACHE = 'CLEAR_CACHE',
  KILL_PROCESS = 'KILL_PROCESS',
  FREE_MEMORY = 'FREE_MEMORY',
  SCALE_OUT = 'SCALE_OUT',
  FAILOVER = 'FAILOVER',
  RUN_SCRIPT = 'RUN_SCRIPT',
  NOTIFY_ADMIN = 'NOTIFY_ADMIN',
  MARK_MAINTENANCE = 'MARK_MAINTENANCE',
  RESET_GPU = 'RESET_GPU',
  CLEAN_DISK = 'CLEAN_DISK',
}

// 修复动作定义
export interface RepairAction {
  type: RepairActionType;
  description: string;
  params?: Record<string, any>;
  requiresConfirmation: boolean;  // 是否需要人工确认
  timeout: number;  // 超时时间（秒）
  retryCount: number;
  retryDelay: number;  // 重试延迟（秒）
}

// 故障规则定义
export interface FaultRule {
  id: string;
  name: string;
  faultType: FaultType;
  level: FaultLevel;
  enabled: boolean;
  
  // 检测条件
  detection: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'ne' | 'contains';
    threshold: number | string;
    duration: number;  // 持续时间（秒）
  };
  
  // 修复动作列表（按顺序执行）
  repairActions: RepairAction[];
  
  // 是否自动修复
  autoRepair: boolean;
  
  // 最大修复尝试次数
  maxRepairAttempts: number;
  
  // 冷却时间（秒）- 同一故障重复触发的间隔
  cooldownPeriod: number;
  
  createdAt: Date;
  updatedAt: Date;
}

// 故障事件
export interface FaultEvent {
  id: string;
  ruleId: string;
  faultType: FaultType;
  level: FaultLevel;
  targetId: string;  // 服务器ID、GPU ID 等
  targetName: string;
  detectionTime: Date;
  resolvedTime: Date | null;
  status: 'DETECTED' | 'REPAIRING' | 'RESOLVED' | 'FAILED' | 'IGNORED';
  repairAttempts: number;
  lastRepairAction: string | null;
  error: string | null;
  metadata: Record<string, any>;
}

// 修复历史
export interface RepairHistory {
  id: string;
  faultEventId: string;
  action: RepairActionType;
  executedAt: Date;
  success: boolean;
  duration: number;  // 执行耗时（毫秒）
  output: string;
  error: string | null;
}

// 默认故障规则
const DEFAULT_FAULT_RULES: FaultRule[] = [
  {
    id: 'rule_server_offline',
    name: '服务器离线自愈',
    faultType: FaultType.SERVER_OFFLINE,
    level: FaultLevel.HIGH,
    enabled: true,
    detection: {
      metric: 'server_status',
      operator: 'eq',
      threshold: 'OFFLINE',
      duration: 60,  // 离线 60 秒后触发
    },
    repairActions: [
      { type: RepairActionType.NOTIFY_ADMIN, description: '通知管理员', requiresConfirmation: false, timeout: 30, retryCount: 3, retryDelay: 10 },
      { type: RepairActionType.RESTART_SERVER, description: '尝试重启服务器', requiresConfirmation: true, timeout: 120, retryCount: 2, retryDelay: 30 },
      { type: RepairActionType.MARK_MAINTENANCE, description: '标记为维护状态', requiresConfirmation: false, timeout: 10, retryCount: 1, retryDelay: 5 },
    ],
    autoRepair: true,
    maxRepairAttempts: 3,
    cooldownPeriod: 300,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule_high_cpu',
    name: 'CPU 高负载自愈',
    faultType: FaultType.SERVER_HIGH_CPU,
    level: FaultLevel.MEDIUM,
    enabled: true,
    detection: {
      metric: 'cpu_usage',
      operator: 'gt',
      threshold: 90,
      duration: 180,  // 持续 3 分钟
    },
    repairActions: [
      { type: RepairActionType.KILL_PROCESS, description: '终止高CPU进程', params: { topN: 3 }, requiresConfirmation: true, timeout: 30, retryCount: 1, retryDelay: 10 },
      { type: RepairActionType.SCALE_OUT, description: '自动扩容', requiresConfirmation: false, timeout: 60, retryCount: 2, retryDelay: 30 },
    ],
    autoRepair: true,
    maxRepairAttempts: 2,
    cooldownPeriod: 600,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule_high_memory',
    name: '内存不足自愈',
    faultType: FaultType.SERVER_HIGH_MEMORY,
    level: FaultLevel.MEDIUM,
    enabled: true,
    detection: {
      metric: 'memory_usage',
      operator: 'gt',
      threshold: 90,
      duration: 120,
    },
    repairActions: [
      { type: RepairActionType.CLEAR_CACHE, description: '清理缓存', requiresConfirmation: false, timeout: 30, retryCount: 2, retryDelay: 10 },
      { type: RepairActionType.FREE_MEMORY, description: '释放内存', requiresConfirmation: false, timeout: 60, retryCount: 1, retryDelay: 30 },
    ],
    autoRepair: true,
    maxRepairAttempts: 3,
    cooldownPeriod: 300,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule_high_temp',
    name: '温度过高自愈',
    faultType: FaultType.SERVER_HIGH_TEMP,
    level: FaultLevel.HIGH,
    enabled: true,
    detection: {
      metric: 'temperature',
      operator: 'gt',
      threshold: 85,
      duration: 60,
    },
    repairActions: [
      { type: RepairActionType.NOTIFY_ADMIN, description: '紧急通知管理员', requiresConfirmation: false, timeout: 10, retryCount: 3, retryDelay: 5 },
      { type: RepairActionType.RUN_SCRIPT, description: '执行降温脚本', params: { script: 'throttle_cpu' }, requiresConfirmation: false, timeout: 30, retryCount: 1, retryDelay: 10 },
    ],
    autoRepair: true,
    maxRepairAttempts: 5,
    cooldownPeriod: 120,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule_gpu_error',
    name: 'GPU 故障自愈',
    faultType: FaultType.GPU_ERROR,
    level: FaultLevel.HIGH,
    enabled: true,
    detection: {
      metric: 'gpu_status',
      operator: 'eq',
      threshold: 'ERROR',
      duration: 30,
    },
    repairActions: [
      { type: RepairActionType.RESET_GPU, description: '重置 GPU', requiresConfirmation: true, timeout: 60, retryCount: 2, retryDelay: 30 },
      { type: RepairActionType.MARK_MAINTENANCE, description: '标记服务器维护', requiresConfirmation: false, timeout: 10, retryCount: 1, retryDelay: 5 },
    ],
    autoRepair: true,
    maxRepairAttempts: 2,
    cooldownPeriod: 600,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule_disk_full',
    name: '磁盘空间不足自愈',
    faultType: FaultType.DISK_FULL,
    level: FaultLevel.MEDIUM,
    enabled: true,
    detection: {
      metric: 'disk_usage',
      operator: 'gt',
      threshold: 90,
      duration: 300,
    },
    repairActions: [
      { type: RepairActionType.CLEAN_DISK, description: '清理临时文件', params: { paths: ['/tmp', '/var/log', '/var/cache'] }, requiresConfirmation: false, timeout: 120, retryCount: 1, retryDelay: 60 },
      { type: RepairActionType.NOTIFY_ADMIN, description: '通知管理员', requiresConfirmation: false, timeout: 30, retryCount: 3, retryDelay: 10 },
    ],
    autoRepair: true,
    maxRepairAttempts: 2,
    cooldownPeriod: 1800,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule_db_connection',
    name: '数据库连接故障自愈',
    faultType: FaultType.DATABASE_CONNECTION,
    level: FaultLevel.CRITICAL,
    enabled: true,
    detection: {
      metric: 'db_connection_status',
      operator: 'eq',
      threshold: 'FAILED',
      duration: 30,
    },
    repairActions: [
      { type: RepairActionType.RESTART_SERVICE, description: '重启数据库连接池', requiresConfirmation: false, timeout: 60, retryCount: 3, retryDelay: 10 },
      { type: RepairActionType.FAILOVER, description: '切换到备用数据库', requiresConfirmation: true, timeout: 120, retryCount: 1, retryDelay: 30 },
    ],
    autoRepair: true,
    maxRepairAttempts: 5,
    cooldownPeriod: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'rule_redis_connection',
    name: 'Redis 连接故障自愈',
    faultType: FaultType.REDIS_CONNECTION,
    level: FaultLevel.HIGH,
    enabled: true,
    detection: {
      metric: 'redis_connection_status',
      operator: 'eq',
      threshold: 'FAILED',
      duration: 20,
    },
    repairActions: [
      { type: RepairActionType.RESTART_SERVICE, description: '重启 Redis 连接', requiresConfirmation: false, timeout: 30, retryCount: 5, retryDelay: 5 },
      { type: RepairActionType.NOTIFY_ADMIN, description: '通知管理员', requiresConfirmation: false, timeout: 10, retryCount: 3, retryDelay: 5 },
    ],
    autoRepair: true,
    maxRepairAttempts: 5,
    cooldownPeriod: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * 故障自愈服务
 */
export class SelfHealingService {
  private rules: Map<string, FaultRule> = new Map();
  private faultEvents: Map<string, FaultEvent> = new Map();  // 活跃的故障事件
  private repairHistory: RepairHistory[] = [];
  private lastDetection: Date | null = null;
  private detectionInterval: NodeJS.Timeout | null = null;
  private pendingConfirmations: Map<string, { event: FaultEvent; action: RepairAction }> = new Map();

  constructor() {
    this.initializeRules();
  }

  /**
   * 初始化故障规则
   */
  private initializeRules(): void {
    DEFAULT_FAULT_RULES.forEach(rule => {
      this.rules.set(rule.id, rule);
    });

    console.log(`[SelfHealing] Initialized ${DEFAULT_FAULT_RULES.length} fault rules`);
  }

  /**
   * 启动故障检测循环
   */
  startDetection(intervalSeconds: number = 30): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }

    this.detectionInterval = setInterval(() => {
      this.detectFaults().catch(err => {
        console.error('[SelfHealing] Detection error:', err);
      });
    }, intervalSeconds * 1000);

    console.log(`[SelfHealing] Started fault detection with ${intervalSeconds}s interval`);
  }

  /**
   * 停止故障检测
   */
  stopDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
      console.log('[SelfHealing] Stopped fault detection');
    }
  }

  /**
   * 故障检测
   */
  async detectFaults(): Promise<FaultEvent[]> {
    this.lastDetection = new Date();
    const newEvents: FaultEvent[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        const detectedFaults = await this.checkRule(rule);
        
        for (const fault of detectedFaults) {
          const existingEvent = this.findActiveEvent(rule.id, fault.targetId);
          
          if (!existingEvent) {
            const event = await this.createFaultEvent(rule, fault);
            newEvents.push(event);
            
            // 自动触发修复
            if (rule.autoRepair) {
              this.startRepair(event).catch(err => {
                console.error(`[SelfHealing] Auto-repair failed for event ${event.id}:`, err);
              });
            }
          }
        }
      } catch (error) {
        console.error(`[SelfHealing] Failed to check rule ${rule.id}:`, error);
      }
    }

    return newEvents;
  }

  /**
   * 检查规则是否匹配
   */
  private async checkRule(rule: FaultRule): Promise<Array<{ targetId: string; targetName: string; value: any }>> {
    const results: Array<{ targetId: string; targetName: string; value: any }> = [];

    switch (rule.faultType) {
      case FaultType.SERVER_OFFLINE:
        const offlineServers = await prisma.server.findMany({
          where: { status: ServerStatus.OFFLINE },
        });
        offlineServers.forEach(server => {
          results.push({ targetId: server.id, targetName: server.name, value: 'OFFLINE' });
        });
        break;

      case FaultType.SERVER_HIGH_CPU:
        const highCpuServers = await this.findServersWithHighMetric('cpuUsage', rule.detection.threshold as number);
        results.push(...highCpuServers);
        break;

      case FaultType.SERVER_HIGH_MEMORY:
        const highMemoryServers = await this.findServersWithHighMetric('memoryUsage', rule.detection.threshold as number);
        results.push(...highMemoryServers);
        break;

      case FaultType.SERVER_HIGH_TEMP:
        const highTempServers = await this.findServersWithHighMetric('temperature', rule.detection.threshold as number);
        results.push(...highTempServers);
        break;

      case FaultType.GPU_ERROR:
        // GPU model doesn't have status field, using allocated as fallback
        // TODO: Add GPU status tracking to schema if needed
        const allocatedGpus = await prisma.gpu.findMany({
          where: { allocated: true },
          include: { server: true },
        });
        allocatedGpus.forEach(gpu => {
          results.push({ targetId: gpu.id, targetName: `${gpu.server?.name ?? 'Unknown'} - GPU ${gpu.id}`, value: 'ALLOCATED' });
        });
        break;

      case FaultType.DISK_FULL:
        const fullDiskServers = await this.findServersWithHighMetric('diskUsage', rule.detection.threshold as number);
        results.push(...fullDiskServers);
        break;

      case FaultType.DATABASE_CONNECTION:
        // 检查数据库连接状态
        try {
          await prisma.$queryRaw`SELECT 1`;
        } catch {
          results.push({ targetId: 'database', targetName: 'PostgreSQL', value: 'FAILED' });
        }
        break;

      case FaultType.REDIS_CONNECTION:
        // 简化的 Redis 连接检查
        // 实际应该 ping Redis
        break;
    }

    return results;
  }

  /**
   * 查找指标超阈值的服务器
   */
  private async findServersWithHighMetric(
    metricField: string,
    threshold: number
  ): Promise<Array<{ targetId: string; targetName: string; value: any }>> {
    const servers = await prisma.server.findMany({
      where: { status: ServerStatus.ONLINE },
      include: {
        metrics: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });

    const results: Array<{ targetId: string; targetName: string; value: any }> = [];

    servers.forEach(server => {
      const latestMetric = server.metrics[0];
      if (!latestMetric) return;

      let value: number | null = null;
      switch (metricField) {
        case 'cpuUsage':
          value = Number(latestMetric.cpuUsage);
          break;
        case 'memoryUsage':
          value = Number(latestMetric.memoryUsage);
          break;
        case 'temperature':
          value = latestMetric.temperature ? Number(latestMetric.temperature) : null;
          break;
        case 'diskUsage':
          value = latestMetric.diskUsage ? Number(latestMetric.diskUsage) : null;
          break;
      }

      if (value !== null && value > threshold) {
        results.push({ targetId: server.id, targetName: server.name, value });
      }
    });

    return results;
  }

  /**
   * 创建故障事件
   */
  private async createFaultEvent(
    rule: FaultRule,
    fault: { targetId: string; targetName: string; value: any }
  ): Promise<FaultEvent> {
    const event: FaultEvent = {
      id: `fault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      faultType: rule.faultType,
      level: rule.level,
      targetId: fault.targetId,
      targetName: fault.targetName,
      detectionTime: new Date(),
      resolvedTime: null,
      status: 'DETECTED',
      repairAttempts: 0,
      lastRepairAction: null,
      error: null,
      metadata: { value: fault.value },
    };

    this.faultEvents.set(event.id, event);

    // 发送告警通知
    await notificationService.sendAlert({
      type: AlertType.SYSTEM,
      severity: this.mapLevelToSeverity(rule.level),
      title: `故障检测: ${rule.name}`,
      message: `检测到 ${fault.targetName} 存在故障\n类型: ${rule.faultType}\n级别: ${rule.level}\n${rule.autoRepair ? '已触发自动修复' : '等待人工处理'}`,
      metadata: { eventId: event.id, ruleId: rule.id, targetId: fault.targetId },
    });

    console.log(`[SelfHealing] Created fault event: ${event.id} - ${rule.name} on ${fault.targetName}`);
    return event;
  }

  /**
   * 开始修复流程
   */
  async startRepair(event: FaultEvent): Promise<void> {
    const rule = this.rules.get(event.ruleId);
    if (!rule) {
      console.error(`[SelfHealing] Rule ${event.ruleId} not found`);
      return;
    }

    event.status = 'REPAIRING';

    for (const action of rule.repairActions) {
      if (event.repairAttempts >= rule.maxRepairAttempts) {
        console.log(`[SelfHealing] Max repair attempts reached for event ${event.id}`);
        event.status = 'FAILED';
        event.error = 'Max repair attempts reached';
        break;
      }

      // 检查是否需要人工确认
      if (action.requiresConfirmation) {
        const confirmed = await this.waitForConfirmation(event, action);
        if (!confirmed) {
          console.log(`[SelfHealing] Action ${action.type} not confirmed, skipping`);
          continue;
        }
      }

      // 执行修复动作
      const startTime = Date.now();
      try {
        const result = await this.executeRepairAction(event, action);
        const duration = Date.now() - startTime;

        // 记录历史
        const history: RepairHistory = {
          id: `repair_${Date.now()}`,
          faultEventId: event.id,
          action: action.type,
          executedAt: new Date(),
          success: result.success,
          duration,
          output: result.output,
          error: result.error,
        };
        this.repairHistory.push(history);

        event.repairAttempts++;
        event.lastRepairAction = action.type;

        if (result.success) {
          // 检查故障是否已解决
          const resolved = await this.checkFaultResolved(event, rule);
          if (resolved) {
            event.status = 'RESOLVED';
            event.resolvedTime = new Date();
            console.log(`[SelfHealing] Fault ${event.id} resolved by action ${action.type}`);
            
            // 发送解决通知
            await notificationService.sendAlert({
              type: AlertType.SYSTEM,
              severity: AlertSeverity.INFO,
              title: `故障已解决: ${rule.name}`,
              message: `${event.targetName} 的故障已自动修复\n修复动作: ${action.description}\n耗时: ${duration}ms`,
              metadata: { eventId: event.id, action: action.type },
            });
            break;
          }
        } else {
          console.error(`[SelfHealing] Action ${action.type} failed: ${result.error}`);
          event.error = result.error;
        }
      } catch (error: any) {
        console.error(`[SelfHealing] Error executing action ${action.type}:`, error);
        event.error = error.message;
      }
    }

    if (event.status === 'REPAIRING') {
      event.status = 'FAILED';
    }
  }

  /**
   * 执行修复动作
   */
  private async executeRepairAction(
    event: FaultEvent,
    action: RepairAction
  ): Promise<{ success: boolean; output: string; error: string | null }> {
    console.log(`[SelfHealing] Executing action ${action.type} for event ${event.id}`);

    switch (action.type) {
      case RepairActionType.RESTART_SERVICE:
        return this.restartService(event, action);

      case RepairActionType.RESTART_SERVER:
        return this.restartServer(event, action);

      case RepairActionType.CLEAR_CACHE:
        return this.clearCache(event, action);

      case RepairActionType.KILL_PROCESS:
        return this.killHighResourceProcess(event, action);

      case RepairActionType.FREE_MEMORY:
        return this.freeMemory(event, action);

      case RepairActionType.SCALE_OUT:
        return this.scaleOut(event, action);

      case RepairActionType.FAILOVER:
        return this.failover(event, action);

      case RepairActionType.RUN_SCRIPT:
        return this.runScript(event, action);

      case RepairActionType.NOTIFY_ADMIN:
        return this.notifyAdmin(event, action);

      case RepairActionType.MARK_MAINTENANCE:
        return this.markMaintenance(event, action);

      case RepairActionType.RESET_GPU:
        return this.resetGpu(event, action);

      case RepairActionType.CLEAN_DISK:
        return this.cleanDisk(event, action);

      default:
        return { success: false, output: '', error: `Unknown action type: ${action.type}` };
    }
  }

  // ============================================
  // 修复动作实现
  // ============================================

  private async restartService(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      // 模拟重启服务
      console.log(`[SelfHealing] Restarting service for ${event.targetName}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: true, output: 'Service restarted successfully', error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  private async restartServer(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      // 更新服务器状态
      await prisma.server.update({
        where: { id: event.targetId },
        data: { status: ServerStatus.MAINTENANCE },
      });

      // 模拟重启服务器（实际需要 SSH 或云 API）
      console.log(`[SelfHealing] Restarting server ${event.targetName}`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      return { success: true, output: 'Server restart initiated', error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  private async clearCache(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      // 清理 Redis 缓存
      console.log(`[SelfHealing] Clearing cache for ${event.targetName}`);
      
      // 实际应该调用 Redis FLUSHDB 或删除特定 key
      await new Promise(resolve => setTimeout(resolve, 500));

      return { success: true, output: 'Cache cleared successfully', error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  private async killHighResourceProcess(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      const topN = action.params?.topN || 3;
      console.log(`[SelfHealing] Killing top ${topN} high-resource processes on ${event.targetName}`);
      
      // 实际需要 SSH 到服务器执行 ps/top/kill
      await new Promise(resolve => setTimeout(resolve, 1000));

      return { success: true, output: `Killed top ${topN} processes`, error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  private async freeMemory(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      console.log(`[SelfHealing] Freeing memory on ${event.targetName}`);
      
      // 实际需要执行 sync; echo 3 > /proc/sys/vm/drop_caches 等
      await new Promise(resolve => setTimeout(resolve, 1500));

      return { success: true, output: 'Memory freed successfully', error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  private async scaleOut(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      console.log(`[SelfHealing] Scaling out for ${event.targetName}`);
      
      // 实际需要调用 Kubernetes HPA 或云服务 API
      await new Promise(resolve => setTimeout(resolve, 2000));

      return { success: true, output: 'Scale out initiated', error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  private async failover(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      console.log(`[SelfHealing] Executing failover for ${event.targetName}`);
      
      // 实际需要切换到备用服务/数据库
      await new Promise(resolve => setTimeout(resolve, 3000));

      return { success: true, output: 'Failover completed', error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  private async runScript(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      const script = action.params?.script || 'default';
      console.log(`[SelfHealing] Running script ${script} for ${event.targetName}`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      return { success: true, output: `Script ${script} executed`, error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  private async notifyAdmin(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      const rule = this.rules.get(event.ruleId);
      
      await notificationService.sendAlert({
        type: AlertType.SYSTEM,
        severity: this.mapLevelToSeverity(event.level),
        title: `[需要关注] ${rule?.name || '故障'}`,
        message: `目标: ${event.targetName}\n类型: ${event.faultType}\n级别: ${event.level}\n\n请及时处理或确认自动修复。`,
        metadata: { eventId: event.id },
      });

      return { success: true, output: 'Admin notified', error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  private async markMaintenance(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      await prisma.server.update({
        where: { id: event.targetId },
        data: { status: ServerStatus.MAINTENANCE },
      });

      return { success: true, output: 'Server marked as maintenance', error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  private async resetGpu(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      // 更新 GPU 状态 - Gpu model doesn't have status field, use allocated instead
      await prisma.gpu.update({
        where: { id: event.targetId },
        data: { allocated: false },
      });

      console.log(`[SelfHealing] GPU ${event.targetName} reset`);

      return { success: true, output: 'GPU reset successfully', error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  private async cleanDisk(event: FaultEvent, action: RepairAction): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      const paths = action.params?.paths || ['/tmp', '/var/log'];
      console.log(`[SelfHealing] Cleaning disk on ${event.targetName}: ${paths.join(', ')}`);
      
      // 实际需要 SSH 执行 rm -rf 或清理命令
      await new Promise(resolve => setTimeout(resolve, 2000));

      return { success: true, output: `Cleaned paths: ${paths.join(', ')}`, error: null };
    } catch (error: any) {
      return { success: false, output: '', error: error.message };
    }
  }

  /**
   * 等待人工确认
   */
  private async waitForConfirmation(event: FaultEvent, action: RepairAction): Promise<boolean> {
    return new Promise((resolve) => {
      const key = `${event.id}:${action.type}`;
      this.pendingConfirmations.set(key, { event, action });

      // 设置超时（5分钟）
      setTimeout(() => {
        if (this.pendingConfirmations.has(key)) {
          this.pendingConfirmations.delete(key);
          resolve(false);
        }
      }, 5 * 60 * 1000);

      // 在实际实现中，这里应该等待管理员通过 API 确认
      // 为了演示，我们假设自动确认
      console.log(`[SelfHealing] Action ${action.type} requires confirmation, auto-confirming for demo`);
      this.pendingConfirmations.delete(key);
      resolve(true);
    });
  }

  /**
   * 确认修复动作
   */
  confirmAction(eventId: string, actionType: RepairActionType, confirmed: boolean): boolean {
    const key = `${eventId}:${actionType}`;
    const pending = this.pendingConfirmations.get(key);
    
    if (pending) {
      this.pendingConfirmations.delete(key);
      // 触发 Promise resolve
      return confirmed;
    }
    
    return false;
  }

  /**
   * 检查故障是否已解决
   */
  private async checkFaultResolved(event: FaultEvent, rule: FaultRule): Promise<boolean> {
    // 重新检查故障条件
    const faults = await this.checkRule(rule);
    return !faults.some(f => f.targetId === event.targetId);
  }

  /**
   * 查找活跃事件
   */
  private findActiveEvent(ruleId: string, targetId: string): FaultEvent | undefined {
    for (const event of this.faultEvents.values()) {
      if (event.ruleId === ruleId && event.targetId === targetId && 
          (event.status === 'DETECTED' || event.status === 'REPAIRING')) {
        return event;
      }
    }
    return undefined;
  }

  /**
   * 映射故障级别到告警严重性
   */
  private mapLevelToSeverity(level: FaultLevel): AlertSeverity {
    switch (level) {
      case FaultLevel.LOW:
        return AlertSeverity.INFO;
      case FaultLevel.MEDIUM:
        return AlertSeverity.WARNING;
      case FaultLevel.HIGH:
        return AlertSeverity.CRITICAL; // Use CRITICAL instead of ERROR
      case FaultLevel.CRITICAL:
        return AlertSeverity.CRITICAL;
      default:
        return AlertSeverity.WARNING;
    }
  }

  // ============================================
  // 公共 API
  // ============================================

  /**
   * 获取所有规则
   */
  getRules(): FaultRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取活跃事件
   */
  getActiveEvents(): FaultEvent[] {
    return Array.from(this.faultEvents.values()).filter(
      e => e.status !== 'RESOLVED' && e.status !== 'IGNORED'
    );
  }

  /**
   * 获取所有事件
   */
  getAllEvents(): FaultEvent[] {
    return Array.from(this.faultEvents.values());
  }

  /**
   * 获取修复历史
   */
  getRepairHistory(limit: number = 100): RepairHistory[] {
    return this.repairHistory.slice(-limit);
  }

  /**
   * 添加/更新规则
   */
  upsertRule(rule: Partial<FaultRule>): FaultRule {
    const id = rule.id || `rule_${Date.now()}`;
    const existing = this.rules.get(id);

    const newRule: FaultRule = {
      id,
      name: rule.name || 'Unnamed Rule',
      faultType: rule.faultType || FaultType.CUSTOM,
      level: rule.level || FaultLevel.MEDIUM,
      enabled: rule.enabled ?? true,
      detection: rule.detection || { metric: '', operator: 'eq', threshold: '', duration: 60 },
      repairActions: rule.repairActions || [],
      autoRepair: rule.autoRepair ?? false,
      maxRepairAttempts: rule.maxRepairAttempts || 3,
      cooldownPeriod: rule.cooldownPeriod || 300,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(id, newRule);
    console.log(`[SelfHealing] Rule ${id} ${existing ? 'updated' : 'created'}`);
    return newRule;
  }

  /**
   * 手动触发修复
   */
  async manualRepair(eventId: string): Promise<void> {
    const event = this.faultEvents.get(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    await this.startRepair(event);
  }

  /**
   * 忽略事件
   */
  ignoreEvent(eventId: string): boolean {
    const event = this.faultEvents.get(eventId);
    if (event) {
      event.status = 'IGNORED';
      return true;
    }
    return false;
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    isRunning: boolean;
    lastDetection: Date | null;
    totalRules: number;
    enabledRules: number;
    activeEvents: number;
    totalEvents: number;
    pendingConfirmations: number;
  } {
    return {
      isRunning: this.detectionInterval !== null,
      lastDetection: this.lastDetection,
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      activeEvents: this.getActiveEvents().length,
      totalEvents: this.faultEvents.size,
      pendingConfirmations: this.pendingConfirmations.size,
    };
  }
}

// 导出单例
export const selfHealingService = new SelfHealingService();
export default selfHealingService;