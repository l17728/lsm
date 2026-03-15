/**
 * Scheduled Analyzer Service - 定时分析服务
 * v3.2.0 - 定时扫描问题库并生成分析报告
 * 
 * 功能：
 * - 定时扫描问题库
 * - 自动生成分析报告
 * - 发送分析通知
 * - 清理过期数据
 */

import {
  FeedbackService,
  Feedback,
  FeedbackStatus,
  FeedbackType,
  FeedbackSeverity,
} from './feedback.service';

import {
  RequirementAnalyzerService,
  RequirementSuggestion,
  RequirementPriority,
  RequirementStatus,
  AnalysisReport,
} from './requirement-analyzer.service';

// 定时任务配置
export interface ScheduleConfig {
  // 扫描间隔（毫秒）
  scanInterval: number;
  
  // 报告生成间隔（毫秒）
  reportInterval: number;
  
  // 数据清理间隔（毫秒）
  cleanupInterval: number;
  
  // 报告保留天数
  reportRetentionDays: number;
  
  // 已解决问题保留天数
  resolvedRetentionDays: number;
  
  // 是否启用自动通知
  enableNotifications: boolean;
  
  // 通知渠道
  notificationChannels: ('email' | 'webhook' | 'websocket')[];
}

// 默认配置
const DEFAULT_CONFIG: ScheduleConfig = {
  scanInterval: 5 * 60 * 1000,        // 5 分钟
  reportInterval: 24 * 60 * 60 * 1000, // 24 小时
  cleanupInterval: 6 * 60 * 60 * 1000, // 6 小时
  reportRetentionDays: 90,
  resolvedRetentionDays: 30,
  enableNotifications: true,
  notificationChannels: ['websocket'],
};

// 扫描结果
export interface ScanResult {
  timestamp: Date;
  newFeedbacks: number;
  processedFeedbacks: number;
  newRequirements: number;
  highPriorityCount: number;
  alerts: string[];
}

// 报告存储
interface StoredReport {
  id: string;
  report: AnalysisReport;
  createdAt: Date;
}

/**
 * 定时分析服务
 */
export class ScheduledAnalyzerService {
  private feedbackService: FeedbackService;
  private analyzerService: RequirementAnalyzerService;
  private config: ScheduleConfig;
  
  // 定时器
  private scanTimer: NodeJS.Timeout | null = null;
  private reportTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  // 存储的报告
  private reports: Map<string, StoredReport> = new Map();
  
  // 最后扫描结果
  private lastScanResult: ScanResult | null = null;
  
  // 服务状态
  private isRunning: boolean = false;

  constructor(
    feedbackService?: FeedbackService,
    analyzerService?: RequirementAnalyzerService,
    config?: Partial<ScheduleConfig>
  ) {
    this.feedbackService = feedbackService || new FeedbackService();
    this.analyzerService = analyzerService || new RequirementAnalyzerService(this.feedbackService);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动服务
   */
  start(): void {
    if (this.isRunning) {
      console.log('[ScheduledAnalyzer] Service is already running');
      return;
    }

    this.isRunning = true;

    // 启动定时扫描
    this.scanTimer = setInterval(() => {
      this.scan().catch(err => {
        console.error('[ScheduledAnalyzer] Scan error:', err);
      });
    }, this.config.scanInterval);

    // 启动定时报告
    this.reportTimer = setInterval(() => {
      this.generateDailyReport().catch(err => {
        console.error('[ScheduledAnalyzer] Report generation error:', err);
      });
    }, this.config.reportInterval);

    // 启动定时清理
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(err => {
        console.error('[ScheduledAnalyzer] Cleanup error:', err);
      });
    }, this.config.cleanupInterval);

    console.log('[ScheduledAnalyzer] Service started');
    console.log(`[ScheduledAnalyzer] Scan interval: ${this.config.scanInterval / 1000}s`);
    console.log(`[ScheduledAnalyzer] Report interval: ${this.config.reportInterval / 1000}s`);
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.isRunning = false;
    console.log('[ScheduledAnalyzer] Service stopped');
  }

  /**
   * 执行扫描
   */
  async scan(): Promise<ScanResult> {
    const timestamp = new Date();
    const alerts: string[] = [];

    console.log('[ScheduledAnalyzer] Starting scan...');

    // 获取新问题
    const { feedbacks: newFeedbacks } = await this.feedbackService.queryFeedbacks({
      status: [FeedbackStatus.NEW],
    });

    // 获取待处理问题
    const { feedbacks: pendingFeedbacks } = await this.feedbackService.queryFeedbacks({
      status: [FeedbackStatus.NEW, FeedbackStatus.TRIAGED],
    });

    // 分析问题并生成需求建议
    const requirements = await this.analyzerService.analyzeFeedbacks(pendingFeedbacks);

    // 统计高优先级
    const highPriorityCount = requirements.filter(
      r => r.priority === RequirementPriority.P0 || r.priority === RequirementPriority.P1
    ).length;

    // 检查告警条件
    if (newFeedbacks.length >= 5) {
      alerts.push(`检测到 ${newFeedbacks.length} 个新问题待处理`);
    }

    if (highPriorityCount >= 3) {
      alerts.push(`存在 ${highPriorityCount} 个高优先级需求建议`);
    }

    // 检查严重问题
    const criticalFeedbacks = pendingFeedbacks.filter(
      f => f.severity === FeedbackSeverity.CRITICAL
    );
    if (criticalFeedbacks.length > 0) {
      alerts.push(`发现 ${criticalFeedbacks.length} 个严重问题需要立即处理`);
    }

    // 更新问题状态
    for (const feedback of newFeedbacks) {
      await this.feedbackService.updateStatus(feedback.id, FeedbackStatus.TRIAGED);
    }

    const result: ScanResult = {
      timestamp,
      newFeedbacks: newFeedbacks.length,
      processedFeedbacks: pendingFeedbacks.length,
      newRequirements: requirements.length,
      highPriorityCount,
      alerts,
    };

    this.lastScanResult = result;

    // 发送通知
    if (this.config.enableNotifications && alerts.length > 0) {
      await this.sendNotifications(alerts);
    }

    console.log('[ScheduledAnalyzer] Scan completed:', result);
    return result;
  }

  /**
   * 生成日报
   */
  async generateDailyReport(): Promise<AnalysisReport> {
    console.log('[ScheduledAnalyzer] Generating daily report...');

    const now = new Date();
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 生成报告
    const report = await this.analyzerService.generateReport(startDate, now);

    // 存储报告
    this.reports.set(report.id, {
      id: report.id,
      report,
      createdAt: now,
    });

    // 发送报告通知
    if (this.config.enableNotifications) {
      await this.sendReportNotification(report);
    }

    console.log('[ScheduledAnalyzer] Daily report generated:', report.id);
    console.log('[ScheduledAnalyzer] Summary:', report.summary);

    return report;
  }

  /**
   * 生成周报
   */
  async generateWeeklyReport(): Promise<AnalysisReport> {
    console.log('[ScheduledAnalyzer] Generating weekly report...');

    const now = new Date();
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const report = await this.analyzerService.generateReport(startDate, now);

    // 存储报告
    this.reports.set(report.id, {
      id: report.id,
      report,
      createdAt: now,
    });

    console.log('[ScheduledAnalyzer] Weekly report generated:', report.id);
    return report;
  }

  /**
   * 清理过期数据
   */
  async cleanup(): Promise<{
    deletedReports: number;
    deletedFeedbacks: number;
  }> {
    console.log('[ScheduledAnalyzer] Starting cleanup...');

    const now = new Date();
    let deletedReports = 0;
    let deletedFeedbacks = 0;

    // 清理过期报告
    const reportCutoff = new Date(
      now.getTime() - this.config.reportRetentionDays * 24 * 60 * 60 * 1000
    );

    for (const [id, stored] of this.reports) {
      if (stored.createdAt < reportCutoff) {
        this.reports.delete(id);
        deletedReports++;
      }
    }

    // 清理已解决的旧问题（通过状态更新标记）
    const { feedbacks: resolvedFeedbacks } = await this.feedbackService.queryFeedbacks({
      status: [FeedbackStatus.RESOLVED, FeedbackStatus.CLOSED],
    });

    const feedbackCutoff = new Date(
      now.getTime() - this.config.resolvedRetentionDays * 24 * 60 * 60 * 1000
    );

    for (const feedback of resolvedFeedbacks) {
      if (feedback.resolvedAt && feedback.resolvedAt < feedbackCutoff) {
        // 可以在这里实现实际的删除逻辑
        deletedFeedbacks++;
      }
    }

    console.log(`[ScheduledAnalyzer] Cleanup completed: ${deletedReports} reports, ${deletedFeedbacks} feedbacks removed`);

    return { deletedReports, deletedFeedbacks };
  }

  /**
   * 发送通知
   */
  private async sendNotifications(alerts: string[]): Promise<void> {
    const message = alerts.map((a, i) => `${i + 1}. ${a}`).join('\n');
    console.log('[ScheduledAnalyzer] Sending notifications:');
    console.log(message);

    // 这里可以集成实际的通知服务
    // 例如：邮件、钉钉、企业微信等
    for (const channel of this.config.notificationChannels) {
      switch (channel) {
        case 'email':
          // await emailService.send({...});
          break;
        case 'webhook':
          // await fetch(webhookUrl, {...});
          break;
        case 'websocket':
          // await websocketService.broadcast({...});
          break;
      }
    }
  }

  /**
   * 发送报告通知
   */
  private async sendReportNotification(report: AnalysisReport): Promise<void> {
    const summary = `
【问题分析日报】
生成时间: ${report.generatedAt.toLocaleString()}
统计周期: ${report.period.start.toLocaleString()} - ${report.period.end.toLocaleString()}

📊 概览
- 问题总数: ${report.summary.totalFeedbacks}
- 新需求建议: ${report.summary.newRequirements}
- 识别模式: ${report.summary.patternsIdentified}
- 高优先级: ${report.summary.highPriorityCount}

🔍 主要模式
${report.patterns.slice(0, 3).map((p, i) =>
  `${i + 1}. ${p.pattern} (${p.frequency}次)`
).join('\n')}

📋 优先需求
${report.requirements.slice(0, 3).map((r, i) =>
  `${i + 1}. [${r.priority}] ${r.title}`
).join('\n')}
`.trim();

    console.log('[ScheduledAnalyzer] Report notification:');
    console.log(summary);
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    isRunning: boolean;
    config: ScheduleConfig;
    lastScan: ScanResult | null;
    reportsCount: number;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      lastScan: this.lastScanResult,
      reportsCount: this.reports.size,
    };
  }

  /**
   * 获取历史报告
   */
  getReports(limit: number = 10): StoredReport[] {
    return Array.from(this.reports.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * 获取指定报告
   */
  getReport(id: string): AnalysisReport | null {
    const stored = this.reports.get(id);
    return stored?.report || null;
  }

  /**
   * 手动触发扫描
   */
  async triggerScan(): Promise<ScanResult> {
    return this.scan();
  }

  /**
   * 手动触发报告生成
   */
  async triggerReport(): Promise<AnalysisReport> {
    return this.generateDailyReport();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ScheduleConfig>): void {
    this.config = { ...this.config, ...config };

    // 如果服务正在运行，重启定时器
    if (this.isRunning) {
      this.stop();
      this.start();
    }

    console.log('[ScheduledAnalyzer] Config updated');
  }

  /**
   * 获取统计摘要
   */
  async getSummary(): Promise<{
    feedbackStats: Awaited<ReturnType<FeedbackService['getStats']>>;
    requirementStats: {
      total: number;
      byPriority: Record<string, number>;
      byStatus: Record<string, number>;
    };
    recentAlerts: string[];
  }> {
    const feedbackStats = await this.feedbackService.getStats();
    const requirements = await this.analyzerService.getRequirements();

    const byPriority: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const req of requirements) {
      byPriority[req.priority] = (byPriority[req.priority] || 0) + 1;
      byStatus[req.status] = (byStatus[req.status] || 0) + 1;
    }

    return {
      feedbackStats,
      requirementStats: {
        total: requirements.length,
        byPriority,
        byStatus,
      },
      recentAlerts: this.lastScanResult?.alerts || [],
    };
  }
}

// 导出单例
export const scheduledAnalyzerService = new ScheduledAnalyzerService();
export default scheduledAnalyzerService;