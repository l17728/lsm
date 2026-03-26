/**
 * EmailQueueService Unit Tests
 *
 * Tests for enqueue, getStats, and clear operations.
 * EmailService and the Prisma emailNotification model are mocked.
 */

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock EmailService so no real SMTP calls happen
const mockEmailSend = jest.fn().mockResolvedValue(true);
jest.mock('../../services/email.service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    send: mockEmailSend,
  })),
  EmailType: {
    WELCOME: 'welcome',
    TASK_ASSIGNED: 'task_assigned',
    TASK_COMPLETED: 'task_completed',
    ALERT: 'alert',
    GPU_ALLOCATED: 'gpu_allocated',
    PASSWORD_RESET: 'password_reset',
    GPU_RELEASED: 'gpu_released',
  },
}));

// Mock email-template.service (dynamically imported inside processItem)
jest.mock('../../services/email-template.service', () => ({
  emailTemplateService: {
    getTemplate: jest.fn().mockReturnValue({
      subject: 'Test Subject',
      html: '<p>HTML</p>',
      text: 'Plain text',
    }),
  },
}));

// email-queue.service.ts creates its own PrismaClient
const mockEmailNotification = {
  create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    emailNotification: mockEmailNotification,
  })),
}));

import { EmailQueueService } from '../../services/email-queue.service';
import { EmailType } from '../../services/email.service';

describe('EmailQueueService', () => {
  let service: EmailQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailQueueService();
  });

  describe('enqueue', () => {
    it('should persist a PENDING record to the database and return an ID', async () => {
      const id = await service.enqueue(
        EmailType.WELCOME,
        'user@example.com',
        { userId: 'user-1', username: 'Alice' }
      );

      expect(typeof id).toBe('string');
      expect(id).toMatch(/^email_/);
      expect(mockEmailNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: EmailType.WELCOME,
            status: 'PENDING',
          }),
        })
      );
    });

    it('should use the supplied priority when provided', async () => {
      const id = await service.enqueue(
        EmailType.ALERT,
        'admin@example.com',
        { alertType: 'CPU', severity: 'CRITICAL', message: 'High CPU', timestamp: new Date().toISOString() },
        'high'
      );

      expect(typeof id).toBe('string');
    });

    it('should handle a scheduled future send', async () => {
      const futureDate = new Date(Date.now() + 60_000);

      const id = await service.enqueue(
        EmailType.TASK_ASSIGNED,
        'dev@example.com',
        { taskName: 'Train model', priority: 'HIGH', taskUrl: 'http://localhost/tasks/1' },
        'medium',
        futureDate
      );

      expect(typeof id).toBe('string');
    });
  });

  describe('getStats', () => {
    it('should return zero counts on a fresh instance', () => {
      const stats = service.getStats();

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('clear', () => {
    it('should empty the in-memory queue', async () => {
      // Enqueue something to populate the queue (don't await processing)
      mockEmailNotification.create.mockResolvedValue({ id: 'notif-2' });
      await service.enqueue(
        EmailType.WELCOME,
        'a@b.com',
        { userId: 'u1' }
      );

      service.clear();

      const stats = service.getStats();
      expect(stats.total).toBe(0);
    });
  });
});
