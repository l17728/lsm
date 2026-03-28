/**
 * Feedback Services Index
 * v3.2.0 - 问题反馈和需求分析服务
 */

export {
  FeedbackService,
  feedbackService,
  Feedback,
  FeedbackType,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackTag,
  FeedbackSource,
  FeedbackStats,
  FeedbackFilter,
} from './feedback.service';

export {
  RequirementAnalyzerService,
  requirementAnalyzerService,
  RequirementSuggestion,
  RequirementPriority,
  RequirementStatus,
  RequirementCategory,
  PatternAnalysis,
  AnalysisReport,
} from './requirement-analyzer.service';

export {
  ScheduledAnalyzerService,
  scheduledAnalyzerService,
  ScheduleConfig,
  ScanResult,
} from './scheduled-analyzer.service';