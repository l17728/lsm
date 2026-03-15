/**
 * 实体提取器 - 从用户文本中提取结构化实体信息
 */

/** 实体类型枚举 */
export enum EntityType {
  GPU_MODEL = 'GPU_MODEL',
  GPU_COUNT = 'GPU_COUNT',
  MEMORY_SIZE = 'MEMORY_SIZE',
  TASK_NAME = 'TASK_NAME',
  TIME_DURATION = 'TIME_DURATION',
  PRIORITY = 'PRIORITY',
}

/** 提取出的实体 */
export interface ExtractedEntity {
  type: EntityType;
  value: string | number;
  rawText: string;
  confidence: number;
}

/** 实体提取结果 */
export interface ExtractionResult {
  entities: ExtractedEntity[];
  originalText: string;
}

/** GPU 型号正则映射 */
const GPU_PATTERNS: Record<string, RegExp> = {
  'A100': /\bA[-\s]?100\b/i, 'H100': /\bH[-\s]?100\b/i,
  'V100': /\bV[-\s]?100\b/i, 'RTX 4090': /\bRTX[-\s]?4090\b|\b4090\b/i,
  'RTX 3090': /\bRTX[-\s]?3090\b/i, 'A10': /\bA[-\s]?10\b(?!0)/i,
  'T4': /\bT[-\s]?4\b(?!0)/i,
};

/** 优先级关键词 */
const PRIORITY_MAP: Record<string, string> = {
  '紧急': 'URGENT', '高': 'HIGH', '中': 'MEDIUM', '低': 'LOW',
  'urgent': 'URGENT', 'high': 'HIGH', 'critical': 'URGENT',
};

/** 时间单位 (转小时) */
const TIME_UNITS: Record<string, number> = {
  '小时': 1, 'h': 1, 'hour': 1, '分钟': 1/60, 'min': 1/60,
  '天': 24, 'day': 24, '周': 168, 'week': 168,
};

export class EntityExtractor {
  /** 从文本中提取所有实体 */
  extract(text: string): ExtractionResult {
    const entities: ExtractedEntity[] = [];
    this.extractGpuModels(text, entities);
    this.extractGpuCount(text, entities);
    this.extractMemorySize(text, entities);
    this.extractTimeDuration(text, entities);
    this.extractPriority(text, entities);
    this.extractTaskName(text, entities);
    return { entities, originalText: text };
  }

  private extractGpuModels(text: string, entities: ExtractedEntity[]): void {
    for (const [model, pattern] of Object.entries(GPU_PATTERNS)) {
      const match = pattern.exec(text);
      if (match) entities.push({ type: EntityType.GPU_MODEL, value: model, rawText: match[0], confidence: 0.9 });
    }
  }

  private extractGpuCount(text: string, entities: ExtractedEntity[]): void {
    const match = /(\d+)\s*(?:张|块|个)?\s*(?:显卡|GPU|gpu)s?/i.exec(text);
    if (match) entities.push({ type: EntityType.GPU_COUNT, value: parseInt(match[1]), rawText: match[0], confidence: 0.85 });
  }

  private extractMemorySize(text: string, entities: ExtractedEntity[]): void {
    const match = /(\d+)\s*(?:GB|G)\s*(?:显存|内存)?/i.exec(text);
    if (match) entities.push({ type: EntityType.MEMORY_SIZE, value: parseInt(match[1]), rawText: match[0], confidence: 0.8 });
  }

  private extractTimeDuration(text: string, entities: ExtractedEntity[]): void {
    for (const [unit, mult] of Object.entries(TIME_UNITS)) {
      const match = new RegExp(`(\\d+)\\s*${unit}`, 'i').exec(text);
      if (match) {
        entities.push({ type: EntityType.TIME_DURATION, value: Math.round(parseInt(match[1]) * mult * 100) / 100, rawText: match[0], confidence: 0.85 });
        break;
      }
    }
  }

  private extractPriority(text: string, entities: ExtractedEntity[]): void {
    for (const [kw, priority] of Object.entries(PRIORITY_MAP)) {
      if (text.includes(kw)) {
        entities.push({ type: EntityType.PRIORITY, value: priority, rawText: kw, confidence: 0.8 });
        break;
      }
    }
  }

  private extractTaskName(text: string, entities: ExtractedEntity[]): void {
    const match = /["']([^"']+)["']|《([^》]+)》/.exec(text);
    if (match) entities.push({ type: EntityType.TASK_NAME, value: match[1] || match[2], rawText: match[0], confidence: 0.75 });
  }

  getEntityByType(result: ExtractionResult, type: EntityType): ExtractedEntity | undefined {
    return result.entities.find(e => e.type === type);
  }
}

export const entityExtractor = new EntityExtractor();
export default entityExtractor;