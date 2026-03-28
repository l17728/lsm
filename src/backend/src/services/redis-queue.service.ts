import Redis from 'ioredis';

/**
 * Message queue job interface
 */
export interface Job<T = any> {
  id: string;
  type: string;
  payload: T;
  priority: number;
  createdAt: number;
  maxRetries: number;
  retries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  processedAt?: number;
  completedAt?: number;
}

/**
 * Job options
 */
export interface JobOptions {
  priority?: number;
  maxRetries?: number;
  delay?: number;
  timeout?: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  queueName: string;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
}

/**
 * Redis Message Queue Service (Simplified)
 * 
 * Uses Redis Lists for simple queue operations:
 * - LPUSH/RPOP for queue operations
 * - Sorted sets for delayed jobs
 * - Hash for job status
 */
export class RedisMessageQueueService {
  private client: Redis | null = null;
  private connected: boolean = false;
  private processingJobs: Map<string, NodeJS.Timeout> = new Map();
  private jobHandlers: Map<string, (job: Job) => Promise<any>> = new Map();

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.client = new Redis(redisUrl);

      this.client.on('error', (err) => {
        console.error('[RedisQueue] Redis error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        console.log('[RedisQueue] Connected to Redis');
        this.connected = true;
      });

    } catch (error) {
      console.error('[RedisQueue] Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Add job to queue
   */
  async enqueue<T>(
    queueName: string,
    type: string,
    payload: T,
    options: JobOptions = {}
  ): Promise<string> {
    if (!this.connected || !this.client) {
      throw new Error('Redis not connected');
    }

    const jobId = `job:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const job: Job<T> = {
      id: jobId,
      type,
      payload,
      priority: options.priority || 0,
      createdAt: Date.now(),
      maxRetries: options.maxRetries || 3,
      retries: 0,
      status: 'pending',
    };

    // Store job data
    await this.client.hset(`jobs:${queueName}`, jobId, JSON.stringify(job));
    
    // Add to queue (using sorted set with priority)
    await this.client.zadd(`queue:${queueName}`, -job.priority, jobId);

    console.log(`[RedisQueue] Job ${jobId} added to queue ${queueName}`);
    return jobId;
  }

  /**
   * Process jobs from queue
   */
  async processQueue(
    queueName: string,
    handler: (job: Job) => Promise<any>,
    concurrency: number = 1
  ): Promise<void> {
    if (!this.connected || !this.client) {
      throw new Error('Redis not connected');
    }

    this.jobHandlers.set(queueName, handler);

    for (let i = 0; i < concurrency; i++) {
      this.startWorker(queueName, i);
    }
  }

  /**
   * Start worker
   */
  private async startWorker(queueName: string, workerId: number): Promise<void> {
    if (!this.client) return;

    console.log(`[RedisQueue] Worker ${workerId} started for queue ${queueName}`);

    while (this.connected) {
      try {
        // Get highest priority job
        const results = await this.client.zpopmax(`queue:${queueName}`);
        
        if (!results || results.length === 0) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        const jobId = results[0];
        const jobData = await this.client.hget(`jobs:${queueName}`, jobId);
        
        if (!jobData) continue;

        const job: Job = JSON.parse(jobData);
        job.status = 'processing';
        await this.client.hset(`jobs:${queueName}`, jobId, JSON.stringify(job));

        const handler = this.jobHandlers.get(queueName);
        if (!handler) continue;

        try {
          const result = await handler(job);
          job.status = 'completed';
          job.result = result;
          job.completedAt = Date.now();
        } catch (error: any) {
          job.retries++;
          job.error = error.message;
          
          if (job.retries < job.maxRetries) {
            job.status = 'pending';
            await this.client.zadd(`queue:${queueName}`, -job.priority, jobId);
          } else {
            job.status = 'failed';
            console.error(`[RedisQueue] Job ${jobId} failed:`, error.message);
          }
        }

        await this.client.hset(`jobs:${queueName}`, jobId, JSON.stringify(job));

      } catch (error) {
        console.error(`[RedisQueue] Worker ${workerId} error:`, error);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(queueName: string, jobId: string): Promise<Job | null> {
    if (!this.client) return null;
    
    const jobData = await this.client.hget(`jobs:${queueName}`, jobId);
    return jobData ? JSON.parse(jobData) : null;
  }

  /**
   * Get queue stats
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    if (!this.client) {
      throw new Error('Redis not connected');
    }

    const jobs = await this.client.hgetall(`jobs:${queueName}`);
    const jobList = Object.values(jobs).map(j => JSON.parse(j) as Job);

    return {
      queueName,
      pending: jobList.filter(j => j.status === 'pending').length,
      processing: jobList.filter(j => j.status === 'processing').length,
      completed: jobList.filter(j => j.status === 'completed').length,
      failed: jobList.filter(j => j.status === 'failed').length,
      avgProcessingTime: 0,
    };
  }

  /**
   * Clear completed jobs
   */
  async clearCompleted(queueName: string): Promise<number> {
    if (!this.client) return 0;

    const jobs = await this.client.hgetall(`jobs:${queueName}`);
    let cleared = 0;

    for (const [id, data] of Object.entries(jobs)) {
      const job = JSON.parse(data) as Job;
      if (job.status === 'completed') {
        await this.client.hdel(`jobs:${queueName}`, id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    this.connected = false;
    
    for (const timer of this.processingJobs.values()) {
      clearTimeout(timer);
    }
    this.processingJobs.clear();

    if (this.client) {
      await this.client.quit();
      this.client = null;
    }

    console.log('[RedisQueue] Shutdown complete');
  }
}

export const redisQueueService = new RedisMessageQueueService();