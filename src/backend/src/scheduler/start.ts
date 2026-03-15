/**
 * LSM Scheduler - 启动脚本
 * 
 * 独立启动定时任务调度器
 * 可以作为独立进程运行，或集成到主应用
 */

import scheduler from './index';
import prisma from '../utils/prisma';
import config from '../config';

// 优雅退出处理
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Scheduler] 收到 ${signal} 信号，开始优雅退出...`);

  try {
    // 1. 停止调度器
    scheduler.stop();
    console.log('[Scheduler] 调度器已停止');

    // 2. 关闭数据库连接
    await prisma.$disconnect();
    console.log('[Scheduler] 数据库连接已关闭');

    // 3. 完成退出
    console.log('[Scheduler] 优雅退出完成');
    process.exit(0);
  } catch (error) {
    console.error('[Scheduler] 退出时发生错误:', error);
    process.exit(1);
  }
}

// 未捕获异常处理
process.on('uncaughtException', (error: Error) => {
  console.error('[Scheduler] 未捕获异常:', error);
  // 记录错误后继续运行，不退出
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  console.error('[Scheduler] 未处理的 Promise 拒绝:', reason);
  // 记录错误后继续运行，不退出
});

/**
 * 初始化调度器
 */
async function initialize(): Promise<void> {
  console.log('[Scheduler] 初始化调度器...');

  // 验证数据库连接
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[Scheduler] 数据库连接成功');
  } catch (error) {
    console.error('[Scheduler] 数据库连接失败:', error);
    throw error;
  }

  // 验证配置
  if (!config.nodeEnv) {
    console.warn('[Scheduler] NODE_ENV 未设置，使用默认配置');
  }

  console.log(`[Scheduler] 运行环境: ${config.nodeEnv}`);
}

/**
 * 启动调度器主函数
 */
async function main(): Promise<void> {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         LSM Scheduler - 定时任务调度器                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // 1. 初始化
    await initialize();

    // 2. 注册退出处理
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // 3. 启动调度器
    scheduler.start();

    // 4. 可选：启动时立即执行一次扫描
    if (process.env.SCHEDULER_IMMEDIATE_SCAN === 'true') {
      console.log('[Scheduler] 执行初始扫描...');
      await scheduler.runJob('hourly-issue-scan');
    }

    console.log('');
    console.log('[Scheduler] 调度器已就绪，等待定时任务触发...');
    console.log('[Scheduler] 按 Ctrl+C 退出');
    console.log('');

    // 5. 保持进程运行
    // 使用 setInterval 保持进程活跃，同时定期输出心跳日志
    setInterval(() => {
      const status = scheduler.getStatus();
      const runningJobs = Array.from(status.jobs.keys());
      console.log(`[Scheduler] 心跳检查 - 运行中任务: ${runningJobs.length}`);
    }, 60 * 60 * 1000); // 每小时输出心跳

  } catch (error) {
    console.error('[Scheduler] 启动失败:', error);
    process.exit(1);
  }
}

/**
 * 健康检查端点（可选）
 * 如果需要独立的健康检查，可以启动简单的 HTTP 服务
 */
function startHealthServer(): void {
  if (process.env.SCHEDULER_HEALTH_PORT) {
    const http = require('http');
    const port = parseInt(process.env.SCHEDULER_HEALTH_PORT, 10);

    const server = http.createServer((req: any, res: any) => {
      if (req.url === '/health') {
        const status = scheduler.getStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: status.isRunning ? 'healthy' : 'stopped',
          jobs: Array.from(status.jobs.keys()),
          lastRun: Object.fromEntries(status.lastRun),
          errors: Object.fromEntries(status.errors),
        }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(port, () => {
      console.log(`[Scheduler] 健康检查服务已启动: http://localhost:${port}/health`);
    });
  }
}

/**
 * 集成模式 - 供主应用调用
 */
export function integrateScheduler(): void {
  console.log('[Scheduler] 以集成模式启动...');
  scheduler.start();
}

/**
 * 导出启动函数
 */
export { main };

// 如果直接运行此脚本
if (require.main === module) {
  main().catch((error) => {
    console.error('[Scheduler] 致命错误:', error);
    process.exit(1);
  });

  // 可选启动健康检查服务
  startHealthServer();
}