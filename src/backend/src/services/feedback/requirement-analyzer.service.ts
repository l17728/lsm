/**
 * Requirement Analyzer Service - 需求分析服务
 * v3.2.0 - 从问题反馈中提取需求建议
 * 
 * 功能：
 * - 分析问题模式和趋势
 * - 生成需求建议
 * - 优先级排序
 * - 需求影响评估
 */

import {
  FeedbackService,
  Feedback,
  FeedbackType,
  FeedbackSeverity,
  FeedbackTag,
  FeedbackStatus,
} from './feedback.service';

// 需求优先级
export enum RequirementPriority {
  P0 = 'P0',  // 最高优先级 - 必须立即处理
  P1 = 'P1',  // 高优先级 - 本迭代处理
  P2 = 'P2',  // 中优先级 - 下迭代处理
  P3 = 'P3',  // 低优先级 - 后续规划
}

// 需求状态
export enum RequirementStatus {
  DRAFT = 'DRAFT',          // 草稿
  PROPOSED = 'PROPOSED',    // 已提出
  APPROVED = 'APPROVED',    // 已批准
  IN_DEVELOPMENT = 'IN_DEV',// 开发中
  COMPLETED = 'COMPLETED',  // 已完成
  REJECTED = 'REJECTED',    // 已拒绝
}

// 需求分类
export enum RequirementCategory {
  FEATURE = 'FEATURE',          // 新功能
  OPTIMIZATION = 'OPTIMIZATION',// 优化改进
  BUGFIX = 'BUGFIX',           // 缺陷修复
  SECURITY = 'SECURITY',       // 安全相关
  UX = 'UX',                   // 用户体验
  PERFORMANCE = 'PERFORMANCE', // 性能优化
}

// 需求建议接口
export interface RequirementSuggestion {
  id: string;
  title: string;
  description: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  status: RequirementStatus;
  
  // 来源问题
  sourceFeedbackIds: string[];
  relatedFeedbackCount: number;
  
  // 影响评估
  userImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  businessImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  technicalComplexity: 'HIGH' | 'MEDIUM' | 'LOW';
  
  // 标签
  tags: string[];
  
  // 预估
  estimatedEffort?: number;  // 人天
  estimatedValue?: number;   // 价值评分 1-100
  
  // 时间
  createdAt: Date;
  updatedAt: Date;
  proposedBy?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

// 问题模式分析结果
export interface PatternAnalysis {
  pattern: string;           // 模式描述
  frequency: number;         // 出现频率
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  affectedUsers: number;     // 影响用户数
  relatedFeedbacks: string[];// 相关问题 ID
  suggestedAction: string;   // 建议行动
}

// 分析报告
export interface AnalysisReport {
  id: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  
  // 概览
  summary: {
    totalFeedbacks: number;
    newRequirements: number;
    patternsIdentified: number;
    highPriorityCount: number;
  };
  
  // 模式分析
  patterns: PatternAnalysis[];
  
  // 需求建议
  requirements: RequirementSuggestion[];
  
  // 趋势分析
  trends: {
    type: string;
    count: number;
    change: number;  // 百分比变化
  }[];
}

/**
 * 需求分析服务
 */
export class RequirementAnalyzerService {
  private feedbackService: FeedbackService;
  private requirements: Map<string, RequirementSuggestion> = new Map();
  private idCounter: number = 0;

  constructor(feedbackService?: FeedbackService) {
    this.feedbackService = feedbackService || new FeedbackService();
  }

  /**
   * 分析问题并生成需求建议
   */
  async analyzeFeedbacks(
    feedbacks?: Feedback[]
  ): Promise<RequirementSuggestion[]> {
    // 获取未处理的问题
    const { feedbacks: allFeedbacks } = feedbacks
      ? { feedbacks }
      : await this.feedbackService.queryFeedbacks({ status: [FeedbackStatus.NEW, FeedbackStatus.TRIAGED] });

    if (allFeedbacks.length === 0) {
      return [];
    }

    // 按模式分组
    const groups = this.groupByPattern(allFeedbacks);
    const suggestions: RequirementSuggestion[] = [];

    for (const [pattern, items] of groups) {
      const suggestion = this.createSuggestion(pattern, items);
      if (suggestion) {
        this.requirements.set(suggestion.id, suggestion);
        suggestions.push(suggestion);
      }
    }

    // 按优先级排序
    suggestions.sort((a, b) => {
      const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    console.log(`[RequirementAnalyzer] Generated ${suggestions.length} requirement suggestions`);
    return suggestions;
  }

  /**
   * 按模式分组问题
   */
  private groupByPattern(feedbacks: Feedback[]): Map<string, Feedback[]> {
    const groups = new Map<string, Feedback[]>();

    for (const feedback of feedbacks) {
      // 按类型 + 标签组合生成模式键
      const patternKeys = this.extractPatternKeys(feedback);

      for (const key of patternKeys) {
        const existing = groups.get(key) || [];
        existing.push(feedback);
        groups.set(key, existing);
      }
    }

    // 只保留有多个问题的组（表明是共性问题）
    const significantGroups = new Map<string, Feedback[]>();
    for (const [key, items] of groups) {
      if (items.length >= 1) {  // 至少1个问题就值得分析
        significantGroups.set(key, items);
      }
    }

    return significantGroups;
  }

  /**
   * 提取模式键
   */
  private extractPatternKeys(feedback: Feedback): string[] {
    const keys: string[] = [];

    // 基于类型
    keys.push(`type:${feedback.type}`);

    // 基于标签
    for (const tag of feedback.tags) {
      keys.push(`tag:${tag}`);
    }

    // 基于关键词
    const keywords = this.extractKeywords(feedback.description);
    for (const kw of keywords) {
      keys.push(`keyword:${kw}`);
    }

    return keys;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    const patterns = [
      { regex: /性能|慢|卡|超时/g, keyword: 'performance' },
      { regex: /崩溃|无法|失败/g, keyword: 'stability' },
      { regex: /界面|显示|按钮|UI/g, keyword: 'ui' },
      { regex: /安全|权限|漏洞/g, keyword: 'security' },
      { regex: /数据|丢失|错误/g, keyword: 'data' },
      { regex: /文档|说明|帮助/g, keyword: 'documentation' },
      { regex: /移动端|手机|APP/g, keyword: 'mobile' },
    ];

    for (const { regex, keyword } of patterns) {
      if (regex.test(text)) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }

  /**
   * 创建需求建议
   */
  private createSuggestion(pattern: string, feedbacks: Feedback[]): RequirementSuggestion | null {
    const id = `req_${Date.now()}_${++this.idCounter}`;
    const now = new Date();

    // 从第一个问题提取标题
    const firstFeedback = feedbacks[0];
    const title = this.generateTitle(pattern, feedbacks);
    const description = this.generateDescription(feedbacks);

    // 确定分类
    const category = this.determineCategory(pattern, feedbacks);

    // 计算优先级
    const priority = this.calculatePriority(feedbacks);

    // 评估影响
    const userImpact = this.assessUserImpact(feedbacks);
    const businessImpact = this.assessBusinessImpact(feedbacks);
    const technicalComplexity = this.assessTechnicalComplexity(pattern, feedbacks);

    // 提取标签
    const tags = this.extractTags(feedbacks);

    // 预估价值和工时
    const estimatedValue = this.estimateValue(feedbacks, userImpact, businessImpact);
    const estimatedEffort = this.estimateEffort(technicalComplexity, feedbacks);

    return {
      id,
      title,
      description,
      category,
      priority,
      status: RequirementStatus.DRAFT,
      sourceFeedbackIds: feedbacks.map(f => f.id),
      relatedFeedbackCount: feedbacks.length,
      userImpact,
      businessImpact,
      technicalComplexity,
      tags,
      estimatedEffort,
      estimatedValue,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 生成需求标题
   */
  private generateTitle(pattern: string, feedbacks: Feedback[]): string {
    const typeMatch = pattern.match(/type:(\w+)/);
    const tagMatch = pattern.match(/tag:(\w+)/);

    let title = '';

    if (tagMatch) {
      const tagNames: Record<string, string> = {
        UI: '界面优化',
        PERFORMANCE: '性能优化',
        SECURITY: '安全改进',
        DATA: '数据处理',
        INTEGRATION: '集成优化',
        DOCUMENTATION: '文档完善',
        MOBILE: '移动端优化',
        API: 'API 改进',
      };
      title = tagNames[tagMatch[1]] || '功能改进';
    } else if (typeMatch) {
      const typeNames: Record<string, string> = {
        BUG: '缺陷修复',
        FEATURE: '新功能需求',
        IMPROVEMENT: '功能优化',
        QUESTION: '使用体验改进',
        COMPLAINT: '用户体验提升',
      };
      title = typeNames[typeMatch[1]] || '需求优化';
    } else {
      title = '综合需求';
    }

    // 添加具体描述
    const keywords = feedbacks[0].title.split(' ').slice(0, 3).join(' ');
    if (keywords) {
      title += ` - ${keywords.substring(0, 30)}`;
    }

    return title;
  }

  /**
   * 生成需求描述
   */
  private generateDescription(feedbacks: Feedback[]): string {
    const descriptions = feedbacks
      .slice(0, 3)
      .map((f, i) => `${i + 1}. ${f.description.substring(0, 100)}...`)
      .join('\n');

    return `基于 ${feedbacks.length} 个用户反馈的问题，建议进行以下优化：\n\n${descriptions}`;
  }

  /**
   * 确定需求分类
   */
  private determineCategory(pattern: string, feedbacks: Feedback[]): RequirementCategory {
    if (pattern.includes('tag:PERFORMANCE') || pattern.includes('keyword:performance')) {
      return RequirementCategory.PERFORMANCE;
    }
    if (pattern.includes('tag:SECURITY') || pattern.includes('keyword:security')) {
      return RequirementCategory.SECURITY;
    }
    if (pattern.includes('tag:UI') || pattern.includes('keyword:ui')) {
      return RequirementCategory.UX;
    }
    if (pattern.includes('type:BUG')) {
      return RequirementCategory.BUGFIX;
    }
    if (pattern.includes('type:FEATURE')) {
      return RequirementCategory.FEATURE;
    }
    return RequirementCategory.OPTIMIZATION;
  }

  /**
   * 计算优先级
   */
  private calculatePriority(feedbacks: Feedback[]): RequirementPriority {
    const hasCritical = feedbacks.some(f => f.severity === FeedbackSeverity.CRITICAL);
    const hasHigh = feedbacks.some(f => f.severity === FeedbackSeverity.HIGH);
    const count = feedbacks.length;

    if (hasCritical || count >= 5) {
      return RequirementPriority.P0;
    }
    if (hasHigh || count >= 3) {
      return RequirementPriority.P1;
    }
    if (count >= 2) {
      return RequirementPriority.P2;
    }
    return RequirementPriority.P3;
  }

  /**
   * 评估用户影响
   */
  private assessUserImpact(feedbacks: Feedback[]): 'HIGH' | 'MEDIUM' | 'LOW' {
    const uniqueUsers = new Set(feedbacks.map(f => f.userId).filter(Boolean)).size;
    if (uniqueUsers >= 3 || feedbacks.some(f => f.severity === FeedbackSeverity.CRITICAL)) {
      return 'HIGH';
    }
    if (uniqueUsers >= 2 || feedbacks.some(f => f.severity === FeedbackSeverity.HIGH)) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * 评估业务影响
   */
  private assessBusinessImpact(feedbacks: Feedback[]): 'HIGH' | 'MEDIUM' | 'LOW' {
    const hasComplaint = feedbacks.some(f => f.type === FeedbackType.COMPLAINT);
    const hasFeature = feedbacks.some(f => f.type === FeedbackType.FEATURE);

    if (hasComplaint || feedbacks.length >= 5) {
      return 'HIGH';
    }
    if (hasFeature || feedbacks.length >= 3) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * 评估技术复杂度
   */
  private assessTechnicalComplexity(pattern: string, feedbacks: Feedback[]): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (pattern.includes('SECURITY') || pattern.includes('INTEGRATION')) {
      return 'HIGH';
    }
    if (pattern.includes('PERFORMANCE') || pattern.includes('DATA')) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * 提取标签
   */
  private extractTags(feedbacks: Feedback[]): string[] {
    const tagSet = new Set<string>();
    for (const f of feedbacks) {
      for (const tag of f.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet);
  }

  /**
   * 预估价值
   */
  private estimateValue(
    feedbacks: Feedback[],
    userImpact: string,
    businessImpact: string
  ): number {
    let score = 0;

    // 数量因素
    score += Math.min(feedbacks.length * 10, 30);

    // 影响因素
    const impactScores = { HIGH: 30, MEDIUM: 20, LOW: 10 };
    score += impactScores[userImpact] || 10;
    score += impactScores[businessImpact] || 10;

    // 类型因素
    const hasFeature = feedbacks.some(f => f.type === FeedbackType.FEATURE);
    if (hasFeature) score += 15;

    return Math.min(score, 100);
  }

  /**
   * 预估工时
   */
  private estimateEffort(
    complexity: string,
    feedbacks: Feedback[]
  ): number {
    const baseEffort = { HIGH: 10, MEDIUM: 5, LOW: 2 };
    let effort = baseEffort[complexity] || 5;

    // 根据问题数量调整
    if (feedbacks.length >= 5) effort += 3;
    if (feedbacks.length >= 10) effort += 5;

    return effort;
  }

  /**
   * 获取需求建议列表
   */
  async getRequirements(
    status?: RequirementStatus[]
  ): Promise<RequirementSuggestion[]> {
    let results = Array.from(this.requirements.values());

    if (status?.length) {
      results = results.filter(r => status.includes(r.status));
    }

    return results.sort((a, b) => {
      const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * 更新需求状态
   */
  async updateRequirementStatus(
    id: string,
    status: RequirementStatus,
    approvedBy?: string
  ): Promise<RequirementSuggestion | null> {
    const req = this.requirements.get(id);
    if (!req) return null;

    req.status = status;
    req.updatedAt = new Date();

    if (status === RequirementStatus.APPROVED && approvedBy) {
      req.approvedBy = approvedBy;
      req.approvedAt = new Date();
    }

    this.requirements.set(id, req);
    return req;
  }

  /**
   * 生成分析报告
   */
  async generateReport(
    startDate: Date,
    endDate: Date
  ): Promise<AnalysisReport> {
    const { feedbacks } = await this.feedbackService.queryFeedbacks({
      startDate,
      endDate,
    });

    const requirements = await this.analyzeFeedbacks(feedbacks);
    const patterns = this.analyzePatterns(feedbacks);
    const trends = this.analyzeTrends(feedbacks, startDate, endDate);

    return {
      id: `report_${Date.now()}`,
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary: {
        totalFeedbacks: feedbacks.length,
        newRequirements: requirements.length,
        patternsIdentified: patterns.length,
        highPriorityCount: requirements.filter(r =>
          r.priority === RequirementPriority.P0 || r.priority === RequirementPriority.P1
        ).length,
      },
      patterns,
      requirements,
      trends,
    };
  }

  /**
   * 分析问题模式
   */
  private analyzePatterns(feedbacks: Feedback[]): PatternAnalysis[] {
    const groups = this.groupByPattern(feedbacks);
    const patterns: PatternAnalysis[] = [];

    for (const [pattern, items] of groups) {
      if (items.length < 2) continue;

      patterns.push({
        pattern: this.formatPatternName(pattern),
        frequency: items.length,
        trend: 'STABLE',  // 简化处理
        affectedUsers: new Set(items.map(f => f.userId).filter(Boolean)).size,
        relatedFeedbacks: items.map(f => f.id),
        suggestedAction: this.suggestAction(pattern, items),
      });
    }

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * 格式化模式名称
   */
  private formatPatternName(pattern: string): string {
    return pattern
      .replace(/type:/g, '类型: ')
      .replace(/tag:/g, '标签: ')
      .replace(/keyword:/g, '关键词: ');
  }

  /**
   * 建议行动
   */
  private suggestAction(pattern: string, items: Feedback[]): string {
    if (pattern.includes('BUG')) {
      return '建议优先修复相关缺陷';
    }
    if (pattern.includes('PERFORMANCE')) {
      return '建议进行性能优化评估';
    }
    if (pattern.includes('SECURITY')) {
      return '建议立即进行安全审计';
    }
    if (pattern.includes('UI')) {
      return '建议优化用户界面设计';
    }
    return '建议进行需求分析和评估';
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(
    feedbacks: Feedback[],
    startDate: Date,
    endDate: Date
  ): AnalysisReport['trends'] {
    const typeCounts: Record<string, number> = {};

    for (const f of feedbacks) {
      typeCounts[f.type] = (typeCounts[f.type] || 0) + 1;
    }

    return Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
      change: 0,  // 需要历史数据对比
    }));
  }
}

// 导出单例
export const requirementAnalyzerService = new RequirementAnalyzerService();
export default requirementAnalyzerService;