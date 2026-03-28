import { RedisMessageQueueService, Job } from '../../services/redis-queue.service';

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock ioredis
const mockRedisOn = jest.fn();
const mockHset = jest.fn().mockResolvedValue(1);
const mockZadd = jest.fn().mockResolvedValue(1);
const mockHget = jest.fn();
const mockHgetall = jest.fn();
const mockHdel = jest.fn().mockResolvedValue(1);
const mockQuit = jest.fn().mockResolvedValue('OK');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: mockRedisOn.mockImplementation((event: string, cb: () => void) => {
      if (event === 'connect') {
        // Simulate immediate connect
        setImmediate(cb);
      }
    }),
    hset: mockHset,
    zadd: mockZadd,
    hget: mockHget,
    hgetall: mockHgetall,
    hdel: mockHdel,
    quit: mockQuit,
  }));
});

describe('RedisMessageQueueService', () => {
  let service: RedisMessageQueueService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new RedisMessageQueueService();
    // Manually set connected = true and client via initialize side-effects
    await service.initialize();
    // Force connected=true since we simulate the connect callback via setImmediate
    await new Promise(r => setImmediate(r));
  });

  afterEach(async () => {
    await service.shutdown();
  });

  it('should enqueue a job and return a job ID', async () => {
    const jobId = await service.enqueue('test-queue', 'EMAIL', { to: 'user@test.com' });

    expect(jobId).toMatch(/^job:/);
    expect(mockHset).toHaveBeenCalledWith('jobs:test-queue', expect.stringMatching(/^job:/), expect.any(String));
    // Service stores -priority (negated) for zpopmax semantics, default priority=0 → -0
    expect(mockZadd).toHaveBeenCalledWith('queue:test-queue', expect.any(Number), expect.stringMatching(/^job:/));
  });

  it('should store job with correct payload and default options', async () => {
    const payload = { taskId: 'task-123', action: 'process' };
    const jobId = await service.enqueue('work-queue', 'PROCESS', payload);

    const storedArg = mockHset.mock.calls[0][2];
    const stored = JSON.parse(storedArg);

    expect(stored.id).toBe(jobId);
    expect(stored.type).toBe('PROCESS');
    expect(stored.payload).toEqual(payload);
    expect(stored.status).toBe('pending');
    expect(stored.priority).toBe(0);
    expect(stored.maxRetries).toBe(3);
    expect(stored.retries).toBe(0);
  });

  it('should respect priority option when enqueueing', async () => {
    await service.enqueue('prio-queue', 'HIGH', {}, { priority: 10 });

    // zadd is called with negative priority (higher priority = more negative for zpopmax)
    expect(mockZadd).toHaveBeenCalledWith('queue:prio-queue', expect.any(Number), expect.stringMatching(/^job:/));
    const storedArg = mockHset.mock.calls[0][2];
    const stored = JSON.parse(storedArg);
    expect(stored.priority).toBe(10);
  });

  it('should retrieve job status by queue name and job ID', async () => {
    const mockJob: Job = {
      id: 'job:123:abc',
      type: 'EMAIL',
      payload: {},
      priority: 0,
      createdAt: Date.now(),
      maxRetries: 3,
      retries: 0,
      status: 'completed',
      completedAt: Date.now(),
    };
    mockHget.mockResolvedValue(JSON.stringify(mockJob));

    const result = await service.getJobStatus('test-queue', 'job:123:abc');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('job:123:abc');
    expect(result!.status).toBe('completed');
    expect(mockHget).toHaveBeenCalledWith('jobs:test-queue', 'job:123:abc');
  });

  it('should return null for non-existent job', async () => {
    mockHget.mockResolvedValue(null);

    const result = await service.getJobStatus('test-queue', 'missing-job');

    expect(result).toBeNull();
  });

  it('should return queue stats with correct counts', async () => {
    const jobs: Job[] = [
      { id: 'j1', type: 'T', payload: {}, priority: 0, createdAt: 0, maxRetries: 3, retries: 0, status: 'pending' },
      { id: 'j2', type: 'T', payload: {}, priority: 0, createdAt: 0, maxRetries: 3, retries: 1, status: 'processing' },
      { id: 'j3', type: 'T', payload: {}, priority: 0, createdAt: 0, maxRetries: 3, retries: 0, status: 'completed' },
      { id: 'j4', type: 'T', payload: {}, priority: 0, createdAt: 0, maxRetries: 3, retries: 3, status: 'failed' },
    ];

    mockHgetall.mockResolvedValue(
      Object.fromEntries(jobs.map(j => [j.id, JSON.stringify(j)]))
    );

    const stats = await service.getQueueStats('test-queue');

    expect(stats.queueName).toBe('test-queue');
    expect(stats.pending).toBe(1);
    expect(stats.processing).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(1);
  });
});
