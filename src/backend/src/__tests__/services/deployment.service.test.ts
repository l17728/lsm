/**
 * DeploymentService Unit Tests
 *
 * Tests for build, migration, health check, rollback and cleanup operations.
 * The service uses child_process.exec and fs — both are mocked.
 */

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock child_process so no real shell commands are executed
const mockExecAsync = jest.fn();
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn().mockReturnValue(mockExecAsync),
}));

// Mock fs module
const mockReaddir = jest.fn();
const mockStat = jest.fn();
const mockRm = jest.fn();
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  promises: {
    readdir: mockReaddir,
    stat: mockStat,
    rm: mockRm,
  },
}));

import { DeploymentService } from '../../services/deployment.service';

describe('DeploymentService', () => {
  let service: DeploymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeploymentService();
  });

  describe('buildBackend', () => {
    it('should resolve successfully when exec succeeds', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await expect(service.buildBackend()).resolves.toBeUndefined();
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('npm run build')
      );
    });

    it('should throw "Backend build failed" when exec rejects', async () => {
      mockExecAsync.mockRejectedValue(new Error('tsc error'));

      await expect(service.buildBackend()).rejects.toThrow('Backend build failed');
    });
  });

  describe('buildFrontend', () => {
    it('should resolve successfully when exec succeeds', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await expect(service.buildFrontend()).resolves.toBeUndefined();
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('npm run build')
      );
    });

    it('should throw "Frontend build failed" when exec rejects', async () => {
      mockExecAsync.mockRejectedValue(new Error('vite error'));

      await expect(service.buildFrontend()).rejects.toThrow('Frontend build failed');
    });
  });

  describe('runMigrations', () => {
    it('should invoke prisma migrate deploy command', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await expect(service.runMigrations()).resolves.toBeUndefined();
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('prisma migrate deploy')
      );
    });

    it('should throw "Migrations failed" on exec error', async () => {
      mockExecAsync.mockRejectedValue(new Error('migration error'));

      await expect(service.runMigrations()).rejects.toThrow('Migrations failed');
    });
  });

  describe('healthCheck', () => {
    it('should return true when both backend and frontend return 200', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '200', stderr: '' })
        .mockResolvedValueOnce({ stdout: '200', stderr: '' });

      const result = await service.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when backend health check returns non-200', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: '503', stderr: '' });

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false when exec throws', async () => {
      mockExecAsync.mockRejectedValue(new Error('curl failed'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('cleanOldBackups', () => {
    it('should delete directories older than the cutoff date', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      mockReaddir.mockResolvedValue(['backup-old', 'backup-new']);
      mockStat
        .mockResolvedValueOnce({ isDirectory: () => true, mtime: oldDate })   // backup-old
        .mockResolvedValueOnce({ isDirectory: () => true, mtime: new Date() }); // backup-new
      mockRm.mockResolvedValue(undefined);

      await service.cleanOldBackups(7);

      // Only the old backup should be removed
      expect(mockRm).toHaveBeenCalledTimes(1);
      expect(mockRm).toHaveBeenCalledWith(
        expect.stringContaining('backup-old'),
        { recursive: true, force: true }
      );
    });

    it('should not throw when backup directory listing fails', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));

      await expect(service.cleanOldBackups()).resolves.toBeUndefined();
    });
  });
});
