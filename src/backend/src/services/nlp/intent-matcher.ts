/**
 * 意图匹配器 - 识别用户消息中的操作意图
 */

import { ExtractionResult, EntityType } from './entity-extractor';

/** 意图类型枚举 */
export enum IntentType {
  ALLOCATE_GPU = 'ALLOCATE_GPU',
  RELEASE_GPU = 'RELEASE_GPU',
  CREATE_TASK = 'CREATE_TASK',
  CANCEL_TASK = 'CANCEL_TASK',
  QUERY_STATUS = 'QUERY_STATUS',
  CREATE_RESERVATION = 'CREATE_RESERVATION',
  UNKNOWN = 'UNKNOWN',
}

/** 意图匹配结果 */
export interface IntentMatch {
  intent: IntentType;
  confidence: number;
  matchedKeywords: string[];
}

/** 意图识别结果 */
export interface IntentResult {
  primaryIntent: IntentMatch;
  alternativeIntents: IntentMatch[];
  originalText: string;
}

/** 意图关键词配置 */
const INTENT_KEYWORDS: Record<IntentType, { keywords: string[]; patterns: RegExp[] }> = {
  [IntentType.ALLOCATE_GPU]: {
    keywords: ['申请', '分配', '使用', '要', 'allocate', 'need', '显卡', 'GPU'],
    patterns: [/(申请|分配|要|need).{0,10}(显卡|GPU)/i],
  },
  [IntentType.RELEASE_GPU]: {
    keywords: ['释放', '归还', '还', 'release', 'free', '不用了'],
    patterns: [/(释放|归还|release).{0,10}(显卡|GPU|资源)/i],
  },
  [IntentType.CREATE_TASK]: {
    keywords: ['创建任务', '新建任务', '添加任务', 'create task', '跑任务'],
    patterns: [/(创建|新建|添加|跑).{0,5}任务/i],
  },
  [IntentType.CANCEL_TASK]: {
    keywords: ['取消任务', '删除任务', 'cancel task', '终止任务'],
    patterns: [/(取消|删除|终止|cancel).{0,5}任务/i],
  },
  [IntentType.QUERY_STATUS]: {
    keywords: ['查询', '查看', '状态', '进度', 'query', 'status', '有多少'],
    patterns: [/(查询|查看|status).{0,10}(状态|GPU|任务)/i],
  },
  [IntentType.CREATE_RESERVATION]: {
    keywords: ['预约', '预订', 'reserve', 'booking', '明天', '下周'],
    patterns: [/(预约|预订|reserve)/i],
  },
  [IntentType.UNKNOWN]: { keywords: [], patterns: [] },
};

export class IntentMatcher {
  private threshold: number;

  constructor(threshold: number = 0.5) {
    this.threshold = threshold;
  }

  /** 匹配意图 */
  match(text: string, extractionResult?: ExtractionResult): IntentResult {
    const normalized = text.toLowerCase().trim();
    const results: IntentMatch[] = [];

    for (const [type, config] of Object.entries(INTENT_KEYWORDS)) {
      if (type === IntentType.UNKNOWN) continue;
      const match = this.matchSingle(normalized, config, type as IntentType);
      if (match && match.confidence >= this.threshold) results.push(match);
    }

    if (extractionResult) this.adjustByEntities(results, extractionResult);
    results.sort((a, b) => b.confidence - a.confidence);

    return {
      primaryIntent: results[0] || { intent: IntentType.UNKNOWN, confidence: 0, matchedKeywords: [] },
      alternativeIntents: results.slice(1),
      originalText: text,
    };
  }

  private matchSingle(text: string, config: { keywords: string[]; patterns: RegExp[] }, type: IntentType): IntentMatch | null {
    const matchedKeywords = config.keywords.filter(kw => text.includes(kw.toLowerCase()));
    const patternMatch = config.patterns.some(p => p.test(text));
    if (matchedKeywords.length === 0 && !patternMatch) return null;
    const confidence = Math.min((matchedKeywords.length + (patternMatch ? 1.5 : 0)) / 4, 1);
    return { intent: type, confidence: Math.round(confidence * 100) / 100, matchedKeywords };
  }

  private adjustByEntities(matches: IntentMatch[], result: ExtractionResult): void {
    const hasGpu = result.entities.some(e => e.type === EntityType.GPU_MODEL || e.type === EntityType.GPU_COUNT);
    const hasTask = result.entities.some(e => e.type === EntityType.TASK_NAME);
    for (const m of matches) {
      if (m.intent === IntentType.ALLOCATE_GPU && hasGpu) m.confidence = Math.min(m.confidence + 0.15, 1);
      if (m.intent === IntentType.CREATE_TASK && hasTask) m.confidence = Math.min(m.confidence + 0.1, 1);
    }
  }

  /** 快速检测意图 */
  quickMatch(text: string): IntentType {
    const t = text.toLowerCase();
    if (/(申请|分配|要).{0,10}(显卡|GPU)/i.test(t)) return IntentType.ALLOCATE_GPU;
    if (/(释放|归还|还).{0,10}(显卡|GPU)/i.test(t)) return IntentType.RELEASE_GPU;
    if (/(创建|新建|跑).{0,5}任务/i.test(t)) return IntentType.CREATE_TASK;
    if (/(取消|删除|终止).{0,5}任务/i.test(t)) return IntentType.CANCEL_TASK;
    if (/(查询|查看|状态|进度)/.test(t)) return IntentType.QUERY_STATUS;
    if (/(预约|预订)/.test(t)) return IntentType.CREATE_RESERVATION;
    return IntentType.UNKNOWN;
  }
}

export const intentMatcher = new IntentMatcher();
export default intentMatcher;