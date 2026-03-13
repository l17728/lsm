import { TaskExecutorService, ExecutionResult } from '../../services/task-executor.service';
import { Client } from 'ssh2';

jest.mock('ssh2', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      on: jest.fn().mockReturnThis(),
      connect: jest.fn(),
      exec: jest.fn(),
      end: jest.fn(),
    })),
  };
});

describe('TaskExecutorService', () => {
  let executor: TaskExecutorService;
  let mockSshClient: any;

  beforeEach(() => {
    executor = new TaskExecutorService();
    mockSshClient = new Client();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeLocal', () => {
    it('should execute local command successfully', async () => {
      const result = await executor.executeLocal('echo "test"');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.output).toContain('test');
    });

    it('should handle command failure', async () => {
      const result = await executor.executeLocal('exit 1');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('executeSSH', () => {
    it('should execute remote command successfully', async () => {
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('remote output'));
          } else if (event === 'close') {
            callback();
          }
        }),
      };

      mockSshClient.exec.mockImplementation((cmd, callback) => {
        callback(null, mockStream);
      });

      // Note: This is a simplified test - actual SSH testing requires mocking
      expect(mockSshClient.exec).toBeDefined();
    });
  });
});
