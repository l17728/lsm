/**
 * NLP 服务 - 自然语言理解主服务
 */

import { IntentMatcher, IntentType, IntentResult } from './intent-matcher';
import { EntityExtractor, ExtractionResult, EntityType, ExtractedEntity } from './entity-extractor';

/** NLP 解析结果 */
export interface NlpParseResult {
  intent: IntentType;
  intentConfidence: number;
  entities: ExtractedEntity[];
  slots: Record<string, any>;
  originalText: string;
  needsMoreInfo: boolean;
  missingSlots: string[];
  suggestedResponse?: string;
}

/** 槽位定义 */
interface SlotDef { name: string; entityType: EntityType; required: boolean; prompt: string; }

/** 意图槽位映射 */
const INTENT_SLOTS: Record<IntentType, SlotDef[]> = {
  [IntentType.ALLOCATE_GPU]: [
    { name: 'gpuModel', entityType: EntityType.GPU_MODEL, required: false, prompt: '请指定 GPU 型号' },
    { name: 'gpuCount', entityType: EntityType.GPU_COUNT, required: false, prompt: '需要几张 GPU？' },
    { name: 'duration', entityType: EntityType.TIME_DURATION, required: false, prompt: '需要使用多久？' },
  ],
  [IntentType.RELEASE_GPU]: [
    { name: 'gpuModel', entityType: EntityType.GPU_MODEL, required: false, prompt: '要释放哪个 GPU？' },
  ],
  [IntentType.CREATE_TASK]: [
    { name: 'taskName', entityType: EntityType.TASK_NAME, required: true, prompt: '请提供任务名称' },
    { name: 'priority', entityType: EntityType.PRIORITY, required: false, prompt: '任务优先级？' },
  ],
  [IntentType.CANCEL_TASK]: [
    { name: 'taskName', entityType: EntityType.TASK_NAME, required: false, prompt: '要取消哪个任务？' },
  ],
  [IntentType.QUERY_STATUS]: [],
  [IntentType.CREATE_RESERVATION]: [
    { name: 'gpuModel', entityType: EntityType.GPU_MODEL, required: false, prompt: '需要哪种 GPU？' },
    { name: 'duration', entityType: EntityType.TIME_DURATION, required: false, prompt: '预约多长时间？' },
  ],
  [IntentType.UNKNOWN]: [],
};

export class NlpService {
  private intentMatcher = new IntentMatcher();
  private entityExtractor = new EntityExtractor();

  /** 解析用户消息 */
  parse(text: string): NlpParseResult {
    const extraction = this.entityExtractor.extract(text);
    const intentResult = this.intentMatcher.match(text, extraction);
    const slots = this.fillSlots(intentResult.primaryIntent.intent, extraction);
    const missingSlots = this.checkMissing(intentResult.primaryIntent.intent, slots);
    const suggestedResponse = this.genSuggestion(intentResult.primaryIntent.intent, missingSlots);

    return {
      intent: intentResult.primaryIntent.intent,
      intentConfidence: intentResult.primaryIntent.confidence,
      entities: extraction.entities,
      slots,
      originalText: text,
      needsMoreInfo: missingSlots.length > 0,
      missingSlots,
      suggestedResponse,
    };
  }

  private fillSlots(intent: IntentType, extraction: ExtractionResult): Record<string, any> {
    const slots: Record<string, any> = {};
    for (const slot of INTENT_SLOTS[intent] || []) {
      const entity = extraction.entities.find(e => e.type === slot.entityType);
      if (entity) slots[slot.name] = entity.value;
    }
    return slots;
  }

  private checkMissing(intent: IntentType, slots: Record<string, any>): string[] {
    return (INTENT_SLOTS[intent] || []).filter(s => s.required && !(s.name in slots)).map(s => s.name);
  }

  private genSuggestion(intent: IntentType, missing: string[]): string {
    const slotDefs = INTENT_SLOTS[intent] || [];
    if (missing.length > 0) {
      const def = slotDefs.find(s => missing.includes(s.name));
      return def?.prompt || '请提供更多信息';
    }
    const responses: Record<IntentType, string> = {
      [IntentType.ALLOCATE_GPU]: '好的，我来为您分配 GPU 资源。',
      [IntentType.RELEASE_GPU]: '好的，我来为您释放 GPU 资源。',
      [IntentType.CREATE_TASK]: '好的，我来为您创建任务。',
      [IntentType.CANCEL_TASK]: '好的，我来为您取消任务。',
      [IntentType.QUERY_STATUS]: '让我为您查询当前状态。',
      [IntentType.CREATE_RESERVATION]: '好的，我来为您创建预约。',
      [IntentType.UNKNOWN]: '抱歉，我不太理解。可尝试说"申请GPU"、"创建任务"或"查询状态"。',
    };
    return responses[intent];
  }

  /** 快速意图检测 */
  quickDetect(text: string): IntentType {
    return this.intentMatcher.quickMatch(text);
  }

  /** 获取可执行参数 */
  getActionParams(result: NlpParseResult): Record<string, any> {
    return { ...result.slots, _context: { originalText: result.originalText, confidence: result.intentConfidence } };
  }

  /** 判断结果是否可靠 */
  isConfident(result: NlpParseResult, threshold = 0.7): boolean {
    return result.intentConfidence >= threshold && !result.needsMoreInfo;
  }

  /** 获取意图描述 */
  getIntentDescription(intent: IntentType): string {
    const desc: Record<IntentType, string> = {
      [IntentType.ALLOCATE_GPU]: '申请 GPU 资源',
      [IntentType.RELEASE_GPU]: '释放 GPU 资源',
      [IntentType.CREATE_TASK]: '创建新任务',
      [IntentType.CANCEL_TASK]: '取消任务',
      [IntentType.QUERY_STATUS]: '查询资源状态',
      [IntentType.CREATE_RESERVATION]: '创建预约',
      [IntentType.UNKNOWN]: '未知操作',
    };
    return desc[intent];
  }
}

export const nlpService = new NlpService();
export { IntentType, EntityType, ExtractedEntity, ExtractionResult };
export default nlpService;