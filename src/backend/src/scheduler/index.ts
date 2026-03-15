/**
 * LSM Scheduler - 定时任务调度器
 * 
 * 实现自动化扫描、分析和汇总功能:
 * - 每小时扫描新问题
 * - 每天生成分析报告
 * - 每周生成汇总
 */

import * as cron from 'node-cron';
import prisma from '../utils/prisma';
import monitoringService from '../services/monitoring.service';
import analyticsService from '../services/analytics.service';
import { task_status as TaskStatus } from '@prisma/client';

// 调度器状态
interface SchedulerStatus {
  isRunning: boolean;
  jobs: Map<string, cron.ScheduledTask>;
  lastRun: Map<string, Date>;
  errors: Map<string, string>;
}

const status: SchedulerStatus = {
  isRunning: false,
  jobs: new Map(),
  lastRun: new Map(),
  errors: new Map(),
};

// 任务执行日志
interface JobLog {
  jobName: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'failed';
  result?: any;
  error?: string;
}

const jobLogs: JobLog[] = [];
const MAX_LOGS = 100;

/**
 * 记录任务执行
 */
function logJob(log: JobLog): void {
  jobLogs.push(log);
  if (jobLogs.length > MAX_LOGS) {
    jobLogs.shift();
  }
  console.log(`[Scheduler] ${log.jobName} - ${log.status}${log.error ? `: ${log.error}` : ''}`);
}

/**
 * 每小时扫描新问题
 * 检查服务器状态、GPU 分配、任务队列等
 */
async function scanNewIssues(): Promise<void> {
  const log: JobLog = {
    jobName: 'hourly-issue-scan',
    startTime: new Date(),
    status: 'running',
  };

  try {
    console.log('[Scheduler] 开始扫描新问题...');

    // 1. 收集所有服务器指标
    const healthStatus = await monitoringService.getServerHealth();
    const alerts = await monitoringService.getAlerts();

    // 2. 检查异常服务器
    const offlineServers = healthStatus.filter(s => s.status === 'OFFLINE');
    const errorServers = healthStatus.filter(s => s.status === 'ERROR');

    // 3. 检查高负载服务器
    const highLoadServers = healthStatus.filter(
      s => s.cpuUsage > 90 || s.memoryUsage > 90
    );

    // 4. 记录问题到数据库 (使用 AuditLog)
    for (const alert of alerts) {
      await prisma.auditLog.create({
        data: {
          action: alert.type === 'critical' ? 'SCHEDULER_CRITICAL_ALERT' : 'SCHEDULER_WARNING',
          resourceType: 'server',
          resourceId: alert.serverId,
          details: JSON.parse(JSON.stringify({
            serverName: alert.serverName,
            alertType: alert.message,
            value: alert.value,
            threshold: alert.threshold,
            timestamp: new Date(),
          })),
        },
      });
    }

    // 5. 检查长时间运行的任务
    const staleTasks = await prisma.task.findMany({
      where: {
        status: TaskStatus.RUNNING,
        startedAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 超过24小时
        },
      },
    });

    // 6. 更新调度器状态
    status.lastRun.set('hourly-issue-scan', new Date());
    status.errors.delete('hourly-issue-scan');

    log.endTime = new Date();
    log.status = 'success';
    log.result = {
      serversScanned: healthStatus.length,
      alertsFound: alerts.length,
      offlineServers: offlineServers.length,
      errorServers: errorServers.length,
      highLoadServers: highLoadServers.length,
      staleTasks: staleTasks.length,
    };

    console.log(`[Scheduler] 问题扫描完成: ${alerts.length} 个告警, ${staleTasks.length} 个停滞任务`);
  } catch (error: any) {
    log.endTime = new Date();
    log.status = 'failed';
    log.error = error.message;
    status.errors.set('hourly-issue-scan', error.message);
    console.error('[Scheduler] 问题扫描失败:', error);
  }

  logJob(log);
}

/**
 * 每天生成分析报告
 * 生成资源使用、成本、效率等分析报告
 */
async function generateDailyReport(): Promise<void> {
  const log: JobLog = {
    jobName: 'daily-analysis-report',
    startTime: new Date(),
    status: 'running',
  };

  try {
    console.log('[Scheduler] 开始生成每日分析报告...');

    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endTime = new Date();

    // 1. 获取分析数据
    const summary = await analyticsService.getSummary(startTime, endTime);
    const trends = await analyticsService.getResourceTrends(startTime, endTime);
    const costBreakdown = await analyticsService.getCostBreakdown(startTime, endTime);
    const serverUtilization = await analyticsService.getServerUtilization();
    const efficiency = await analyticsService.getEfficiencyReport();

    // 2. 计算统计数据
    const avgCpuUsage = trends.length > 0
      ? trends.reduce((sum, t) => sum + t.cpu, 0) / trends.length
      : 0;
    const avgMemoryUsage = trends.length > 0
      ? trends.reduce((sum, t) => sum + t.memory, 0) / trends.length
      : 0;
    const avgGpuUsage = trends.length > 0
      ? trends.reduce((sum, t) => sum + (t.gpu || 0), 0) / trends.length
      : 0;

    // 3. 创建报告记录 (使用 AuditLog)
    const report = await prisma.auditLog.create({
      data: {
        action: 'DAILY_REPORT_GENERATED',
        resourceType: 'report',
        details: JSON.parse(JSON.stringify({
          reportType: 'daily',
          period: { start: startTime, end: endTime },
          summary,
          stats: {
            avgCpuUsage: Math.round(avgCpuUsage * 100) / 100,
            avgMemoryUsage: Math.round(avgMemoryUsage * 100) / 100,
            avgGpuUsage: Math.round(avgGpuUsage * 100) / 100,
            totalCost: summary.totalCost,
            efficiency: summary.efficiency,
          },
          costBreakdown,
          efficiencyReport: {
            overallEfficiency: efficiency.overallEfficiency,
            potentialSavings: efficiency.potentialSavings,
          },
          timestamp: new Date(),
        })),
      },
    });

    // 4. 更新状态
    status.lastRun.set('daily-analysis-report', new Date());
    status.errors.delete('daily-analysis-report');

    log.endTime = new Date();
    log.status = 'success';
    log.result = {
      reportId: report.id,
      avgCpuUsage: Math.round(avgCpuUsage * 100) / 100,
      avgMemoryUsage: Math.round(avgMemoryUsage * 100) / 100,
      totalCost: summary.totalCost,
      efficiency: summary.efficiency,
    };

    console.log(`[Scheduler] 每日报告已生成: ID=${report.id}`);
  } catch (error: any) {
    log.endTime = new Date();
    log.status = 'failed';
    log.error = error.message;
    status.errors.set('daily-analysis-report', error.message);
    console.error('[Scheduler] 每日报告生成失败:', error);
  }

  logJob(log);
}

/**
 * 每周生成汇总报告
 * 汇总一周的资源使用、成本分析和趋势预测
 */
async function generateWeeklySummary(): Promise<void> {
  const log: JobLog = {
    jobName: 'weekly-summary',
    startTime: new Date(),
    status: 'running',
  };

  try {
    console.log('[Scheduler] 开始生成每周汇总报告...');

    const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endTime = new Date();

    // 1. 获取周度数据
    const summary = await analyticsService.getSummary(startTime, endTime);
    const trends = await analyticsService.getResourceTrends(startTime, endTime);
    const costBreakdown = await analyticsService.getCostBreakdown(startTime, endTime);
    const efficiency = await analyticsService.getEfficiencyReport();
    const serverUtilization = await analyticsService.getServerUtilization();

    // 2. 计算周度统计数据
    const weeklyStats = {
      avgCpuUsage: trends.reduce((sum, t) => sum + t.cpu, 0) / (trends.length || 1),
      avgMemoryUsage: trends.reduce((sum, t) => sum + t.memory, 0) / (trends.length || 1),
      avgGpuUsage: trends.reduce((sum, t) => sum + (t.gpu || 0), 0) / (trends.length || 1),
      peakCpuUsage: Math.max(...trends.map(t => t.cpu)),
      peakMemoryUsage: Math.max(...trends.map(t => t.memory)),
      peakGpuUsage: Math.max(...trends.map(t => t.gpu || 0)),
    };

    // 3. 获取任务统计
    const taskStats = await prisma.task.groupBy({
      by: ['status'],
      _count: true,
      where: {
        createdAt: { gte: startTime, lte: endTime },
      },
    });

    // 4. 创建汇总报告 (使用 AuditLog)
    const report = await prisma.auditLog.create({
      data: {
        action: 'WEEKLY_SUMMARY_GENERATED',
        resourceType: 'report',
        details: JSON.parse(JSON.stringify({
          reportType: 'weekly',
          period: { start: startTime, end: endTime },
          summary,
          weeklyStats: {
            avgCpuUsage: Math.round(weeklyStats.avgCpuUsage * 100) / 100,
            avgMemoryUsage: Math.round(weeklyStats.avgMemoryUsage * 100) / 100,
            avgGpuUsage: Math.round(weeklyStats.avgGpuUsage * 100) / 100,
            peakCpuUsage: Math.round(weeklyStats.peakCpuUsage * 100) / 100,
            peakMemoryUsage: Math.round(weeklyStats.peakMemoryUsage * 100) / 100,
            peakGpuUsage: Math.round(weeklyStats.peakGpuUsage * 100) / 100,
          },
          costBreakdown,
          efficiency: {
            overallEfficiency: efficiency.overallEfficiency,
            totalSavings: efficiency.totalSavings,
            potentialSavings: efficiency.potentialSavings,
            lowEfficiencyServers: efficiency.serverEfficiency
              .filter(s => s.efficiency < 50)
              .map(s => ({ name: s.serverName, efficiency: s.efficiency })),
          },
          taskStats: taskStats.reduce((acc, t) => {
            acc[t.status] = t._count;
            return acc;
          }, {} as Record<string, number>),
          serverCount: serverUtilization.length,
          timestamp: new Date(),
        })),
      },
    });

    // 5. 更新状态
    status.lastRun.set('weekly-summary', new Date());
    status.errors.delete('weekly-summary');

    log.endTime = new Date();
    log.status = 'success';
    log.result = {
      reportId: report.id,
      totalCost: summary.totalCost,
      efficiency: summary.efficiency,
      avgCpu: Math.round(weeklyStats.avgCpuUsage * 100) / 100,
      avgMemory: Math.round(weeklyStats.avgMemoryUsage * 100) / 100,
    };

    console.log(`[Scheduler] 每周汇总报告已生成: ID=${report.id}`);
  } catch (error: any) {
    log.endTime = new Date();
    log.status = 'failed';
    log.error = error.message;
    status.errors.set('weekly-summary', error.message);
    console.error('[Scheduler] 每周汇总生成失败:', error);
  }

  logJob(log);
}

/**
 * 调度器类
 */
export class Scheduler {
  /**
   * 启动所有定时任务
   */
  start(): void {
    if (status.isRunning) {
      console.log('[Scheduler] 调度器已在运行中');
      return;
    }

    console.log('[Scheduler] 启动定时任务调度器...');

    // 每小时执行问题扫描 (整点)
    const hourlyJob = cron.schedule('0 * * * *', scanNewIssues, {
      timezone: 'Asia/Shanghai',
    });
    status.jobs.set('hourly-issue-scan', hourlyJob);

    // 每天凌晨 2:00 生成分析报告
    const dailyJob = cron.schedule('0 2 * * *', generateDailyReport, {
      timezone: 'Asia/Shanghai',
    });
    status.jobs.set('daily-analysis-report', dailyJob);

    // 每周一凌晨 3:00 生成周汇总
    const weeklyJob = cron.schedule('0 3 * * 1', generateWeeklySummary, {
      timezone: 'Asia/Shanghai',
    });
    status.jobs.set('weekly-summary', weeklyJob);

    status.isRunning = true;
    console.log('[Scheduler] 调度器已启动:');
    console.log('  - 每小时问题扫描: 整点执行');
    console.log('  - 每日分析报告: 每天 02:00');
    console.log('  - 每周汇总报告: 每周一 03:00');
  }

  /**
   * 停止所有定时任务
   */
  stop(): void {
    console.log('[Scheduler] 停止定时任务调度器...');
    status.jobs.forEach((job, name) => {
      job.stop();
      console.log(`[Scheduler] 已停止任务: ${name}`);
    });
    status.jobs.clear();
    status.isRunning = false;
  }

  /**
   * 获取调度器状态
   */
  getStatus(): SchedulerStatus & { recentLogs: JobLog[] } {
    return {
      ...status,
      recentLogs: jobLogs.slice(-20),
    };
  }

  /**
   * 手动触发任务
   */
  async runJob(jobName: string): Promise<void> {
    switch (jobName) {
      case 'hourly-issue-scan':
        await scanNewIssues();
        break;
      case 'daily-analysis-report':
        await generateDailyReport();
        break;
      case 'weekly-summary':
        await generateWeeklySummary();
        break;
      default:
        throw new Error(`未知的任务: ${jobName}`);
    }
  }
}

export const scheduler = new Scheduler();
export default scheduler;