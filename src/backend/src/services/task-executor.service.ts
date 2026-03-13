import { exec } from 'child_process';
import { promisify } from 'util';
import { Client } from 'ssh2';
import { PrismaClient } from '@prisma/client';

const execAsync = promisify(exec);

export interface ExecutionResult {
  success: boolean;
  output: string;
  exitCode?: number;
  error?: string;
  duration: number;
}

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export class TaskExecutorService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Execute local command
   */
  async executeLocal(command: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return {
        success: true,
        output: stdout || stderr,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        output: error.stdout || '',
        exitCode: error.code,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute remote command via SSH
   */
  async executeSSH(
    config: SSHConfig,
    command: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const conn = new Client();
      let output = '';
      let exitCode: number | undefined;

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            resolve({
              success: false,
              output: '',
              error: err.message,
              duration: Date.now() - startTime,
            });
            conn.end();
            return;
          }

          stream.on('close', (code: number) => {
            exitCode = code;
            conn.end();
          }).on('data', (data: Buffer) => {
            output += data.toString();
          }).on('stderr', (data: Buffer) => {
            output += data.toString();
          });
        });
      }).on('error', (err) => {
        resolve({
          success: false,
          output: '',
          error: err.message,
          duration: Date.now() - startTime,
        });
      }).connect({
        host: config.host,
        port: config.port || 22,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey
          ? require('fs').readFileSync(config.privateKey)
          : undefined,
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        conn.end();
        resolve({
          success: false,
          output: '',
          error: 'SSH execution timeout',
          duration: Date.now() - startTime,
        });
      }, 5 * 60 * 1000);

      // Wait for stream to close
      let resolved = false;
      const resolveOnce = (result: ExecutionResult) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      // Check for completion
      const checkCompletion = () => {
        if (exitCode !== undefined && !resolved) {
          resolveOnce({
            success: exitCode === 0,
            output,
            exitCode,
            duration: Date.now() - startTime,
          });
        }
      };

      // Poll for exit code
      const checkInterval = setInterval(checkCompletion, 100);
    });
  }

  /**
   * Execute task with retry logic
   */
  async executeWithRetry(
    task: {
      type: 'local' | 'ssh';
      command: string;
      sshConfig?: SSHConfig;
      maxRetries?: number;
    },
    taskId: string
  ): Promise<ExecutionResult> {
    const maxRetries = task.maxRetries || 3;
    let lastResult: ExecutionResult | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[Task ${taskId}] Attempt ${attempt}/${maxRetries}`);

      if (task.type === 'local') {
        lastResult = await this.executeLocal(task.command);
      } else if (task.type === 'ssh' && task.sshConfig) {
        lastResult = await this.executeSSH(task.sshConfig, task.command);
      }

      if (lastResult.success) {
        console.log(`[Task ${taskId}] Completed successfully`);

        // Update task status in database
        await this.prisma.task.update({
          where: { id: taskId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        }).catch(() => {}); // Ignore DB errors

        return lastResult;
      }

      console.log(`[Task ${taskId}] Attempt ${attempt} failed:`, lastResult.error);

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries failed
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
      },
    }).catch(() => {});

    return lastResult!;
  }

  /**
   * Get task execution logs
   */
  async getTaskLogs(taskId: string): Promise<string> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Generate log from task details
    const logs = [
      `[${task.createdAt.toISOString()}] Task created`,
      `[${task.startedAt?.toISOString() || 'N/A'}] Task started`,
      `[${task.completedAt?.toISOString() || task.failedAt?.toISOString() || 'N/A'}] Task ${task.status.toLowerCase()}`,
      `Priority: ${task.priority}`,
      `Status: ${task.status}`,
    ];

    return logs.join('\n');
  }
}
