/**
 * 意图解析器 - 将自然语言转换为结构化意图
 * Intent Parser - Convert natural language to structured intents
 */

export type IntentType =
  | 'GPU_ALLOCATE'      // GPU 申请
  | 'GPU_RELEASE'       // GPU 释放
  | 'GPU_QUERY'         // GPU 状态查询
  | 'TASK_CREATE'       // 任务创建
  | 'TASK_CANCEL'       // 任务取消
  | 'TASK_QUERY'        // 任务查询
  | 'SERVER_STATUS'     // 服务器状态
  | 'RESERVATION_CREATE' // 资源预约创建
  | 'RESERVATION_CANCEL' // 资源预约取消
  | 'RESERVATION_QUERY'  // 资源预约查询
  | 'HELP'              // 帮助
  | 'UNKNOWN';          // 未知意图

export interface ParsedIntent {
  type: IntentType;
  confidence: number;      // 置信度 0-1
  entities: IntentEntities;
  rawText: string;
  suggestions?: string[];  // 澄清建议
}

export interface IntentEntities {
  // GPU 相关
  gpuCount?: number;
  gpuModel?: string;
  minMemory?: number;
  allocationId?: string;

  // 任务相关
  taskName?: string;
  taskDescription?: string;
  taskId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // 服务器相关
  serverId?: string;
  serverName?: string;

  // 预约相关
  startTime?: Date;
  endTime?: Date;
  reservationId?: string;
  title?: string;

  // 通用
  userId?: string;
  query?: string;
}

// 意图关键词映射
const INTENT_PATTERNS: Array<[IntentType, RegExp[]]> = [
  ['GPU_ALLOCATE', [
    /申请|分配|使用|占用|申请使用.*gpu/i,
    /allocate.*gpu|request.*gpu|use.*gpu/i,
    /我需要.*显卡|给我.*显卡/i,
  ]],
  ['GPU_RELEASE', [
    /释放|归还|释放.*gpu|归还.*gpu/i,
    /release.*gpu|free.*gpu|return.*gpu/i,
    /不用.*显卡|完成.*任务/i,
  ]],
  ['GPU_QUERY', [
    /gpu.*状态|gpu.*情况|显卡.*状态/i,
    /gpu.*available|gpu.*status/i,
    /有多少.*gpu|gpu.*多少/i,
  ]],
  ['TASK_CREATE', [
    /创建.*任务|新建.*任务|添加.*任务/i,
    /create.*task|new.*task|add.*task/i,
    /提交.*任务|开始.*任务/i,
  ]],
  ['TASK_CANCEL', [
    /取消.*任务|删除.*任务|终止.*任务/i,
    /cancel.*task|delete.*task|stop.*task/i,
    /不要.*任务|放弃.*任务/i,
  ]],
  ['TASK_QUERY', [
    /任务.*列表|任务.*状态|我的任务/i,
    /task.*list|task.*status|my.*tasks/i,
    /查看.*任务|任务.*进度/i,
  ]],
  ['SERVER_STATUS', [
    /服务器.*状态|服务器.*情况|服务器.*在线/i,
    /server.*status|server.*online/i,
    /所有服务器|服务器列表/i,
  ]],
  ['RESERVATION_CREATE', [
    /预约|预订|预定.*资源|预约.*gpu/i,
    /reserve|reservation|book.*resource/i,
    /我想预约|预定.*时间/i,
  ]],
  ['RESERVATION_CANCEL', [
    /取消.*预约|删除.*预约|撤销.*预约/i,
    /cancel.*reservation|delete.*reservation/i,
  ]],
  ['RESERVATION_QUERY', [
    /预约.*列表|我的预约|预约.*状态/i,
    /reservation.*list|my.*reservations/i,
    /查看.*预约/i,
  ]],
  ['HELP', [
    /帮助|help|怎么用|使用方法/i,
    /能做什么|功能|支持什么/i,
  ]],
];

export class IntentParser {
  /**
   * 解析自然语言文本，提取意图
   */
  parse(text: string): ParsedIntent {
    const normalizedText = text.trim().toLowerCase();

    // 1. 识别意图类型
    const intentType = this.detectIntentType(normalizedText);

    // 2. 提取实体
    const entities = this.extractEntities(text, intentType);

    // 3. 计算置信度
    const confidence = this.calculateConfidence(intentType, entities, normalizedText);

    // 4. 生成建议
    const suggestions = this.generateSuggestions(intentType, entities);

    return {
      type: intentType,
      confidence,
      entities,
      rawText: text,
      suggestions,
    };
  }

  /**
   * 检测意图类型
   */
  private detectIntentType(text: string): IntentType {
    let bestMatch: IntentType = 'UNKNOWN';
    let bestScore = 0;

    for (const [intent, patterns] of INTENT_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          const score = pattern.source.split('|').length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = intent;
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * 提取实体
   */
  private extractEntities(text: string, intentType: IntentType): IntentEntities {
    const entities: IntentEntities = {};

    // 提取数字
    const numberMatch = text.match(/(\d+)/);
    if (numberMatch) {
      entities.gpuCount = parseInt(numberMatch[1], 10);
    }

    // 提取 GPU 型号 (如 A100, V100, RTX4090)
    const gpuModelMatch = text.match(/(A\d+|V\d+|RTX\d+|GTX\d+|H\d+)/i);
    if (gpuModelMatch) {
      entities.gpuModel = gpuModelMatch[1].toUpperCase();
    }

    // 提取显存大小 (如 80GB)
    const memoryMatch = text.match(/(\d+)\s*(?:GB|G)/i);
    if (memoryMatch) {
      entities.minMemory = parseInt(memoryMatch[1], 10);
    }

    // 提取优先级
    if (/紧急|urgent|critical/i.test(text)) {
      entities.priority = 'CRITICAL';
    } else if (/高优先|high/i.test(text)) {
      entities.priority = 'HIGH';
    } else if (/低优先|low/i.test(text)) {
      entities.priority = 'LOW';
    }

    // 提取时间 (简单的相对时间处理)
    const now = new Date();
    if (/明天|tomorrow/i.test(text)) {
      entities.startTime = new Date(now.setDate(now.getDate() + 1));
    } else if (/后天/i.test(text)) {
      entities.startTime = new Date(now.setDate(now.getDate() + 2));
    }

    // 提取时长 (如 2小时, 3天)
    const durationMatch = text.match(/(\d+)\s*(小时|天|hour|day)/i);
    if (durationMatch && entities.startTime) {
      const amount = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      entities.endTime = new Date(entities.startTime);
      if (unit.includes('小时') || unit.includes('hour')) {
        entities.endTime.setHours(entities.endTime.getHours() + amount);
      } else {
        entities.endTime.setDate(entities.endTime.getDate() + amount);
      }
    }

    // 提取任务名称 (引号内容)
    const taskNameMatch = text.match(/["「」『』]([^"「」『』]+)["「」『』]/);
    if (taskNameMatch) {
      entities.taskName = taskNameMatch[1];
    }

    // 提取服务器名称
    const serverMatch = text.match(/服务器\s*[:：]?\s*([a-zA-Z0-9\-]+)/i);
    if (serverMatch) {
      entities.serverName = serverMatch[1];
    }

    // 提取 ID (UUID 格式)
    const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      if (intentType.includes('TASK')) {
        entities.taskId = uuidMatch[0];
      } else if (intentType.includes('GPU') || intentType.includes('RESERVATION')) {
        entities.allocationId = uuidMatch[0];
        entities.reservationId = uuidMatch[0];
      }
    }

    return entities;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    intentType: IntentType,
    entities: IntentEntities,
    text: string
  ): number {
    if (intentType === 'UNKNOWN') {
      return 0;
    }

    let score = 0.5; // 基础分

    // 根据提取到的实体加分
    const entityCount = Object.values(entities).filter(v => v !== undefined).length;
    score += Math.min(entityCount * 0.1, 0.3);

    // 根据文本长度适当加分
    if (text.length > 10) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * 生成澄清建议
   */
  private generateSuggestions(intentType: IntentType, entities: IntentEntities): string[] {
    const suggestions: string[] = [];

    if (intentType === 'GPU_ALLOCATE' && !entities.gpuCount) {
      suggestions.push('请告诉我需要几个 GPU？');
    }

    if (intentType === 'TASK_CREATE' && !entities.taskName) {
      suggestions.push('请提供任务名称，例如：创建任务 "模型训练"');
    }

    if (intentType === 'RESERVATION_CREATE' && !entities.startTime) {
      suggestions.push('请告诉我预约的开始时间');
    }

    return suggestions;
  }
}

export const intentParser = new IntentParser();
export default intentParser;