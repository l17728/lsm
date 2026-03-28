/**
 * Email Service Tests
 * 
 * Tests for email sending, templates, and SMTP configuration
 */

import nodemailer from 'nodemailer';
import { EmailService, EmailType } from '../../services/email.service';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn(),
    verify: jest.fn(),
  }),
}));

describe('EmailService', () => {
  let emailService: EmailService;
  let mockTransporter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn(),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    emailService = new EmailService();
  });

  describe('send', () => {
    it('should send email successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: '123' });

      const result = await emailService.send({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        text: 'Test content',
      });

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<p>Test content</p>',
        })
      );
    });

    it('should return false when send fails', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await emailService.send({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result).toBe(false);
    });

    it('should include from address', async () => {
      mockTransporter.sendMail.mockResolvedValue({});

      await emailService.send({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.any(String),
        })
      );
    });

    it('should include attachments if provided', async () => {
      mockTransporter.sendMail.mockResolvedValue({});

      await emailService.send({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        attachments: [{ filename: 'test.txt', content: 'content' }],
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [{ filename: 'test.txt', content: 'content' }],
        })
      );
    });
  });

  describe('sendWelcome', () => {
    it('should send welcome email with username', async () => {
      mockTransporter.sendMail.mockResolvedValue({});

      const result = await emailService.sendWelcome('test@example.com', 'testuser');

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('欢迎'),
          html: expect.stringContaining('testuser'),
        })
      );
    });

    it('should include welcome message in Chinese', async () => {
      mockTransporter.sendMail.mockResolvedValue({});

      await emailService.sendWelcome('test@example.com', 'testuser');

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('欢迎');
      expect(call.html).toContain('LSM 系统');
    });
  });

  describe('sendTaskAssigned', () => {
    it('should send task assignment email', async () => {
      mockTransporter.sendMail.mockResolvedValue({});

      const result = await emailService.sendTaskAssigned(
        'user@example.com',
        'John',
        'Training Task',
        'HIGH'
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Training Task'),
          html: expect.stringContaining('John'),
        })
      );
    });

    it('should include task details', async () => {
      mockTransporter.sendMail.mockResolvedValue({});

      await emailService.sendTaskAssigned('user@example.com', 'John', 'Task', 'HIGH');

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('Task');
      expect(call.html).toContain('HIGH');
    });
  });

  describe('sendTaskCompleted', () => {
    it('should send task completion email', async () => {
      mockTransporter.sendMail.mockResolvedValue({});

      const result = await emailService.sendTaskCompleted(
        'user@example.com',
        'Task Name',
        'SUCCESS'
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Task Name'),
        })
      );
    });
  });

  describe('sendAlert', () => {
    it('should send alert email with severity color', async () => {
      mockTransporter.sendMail.mockResolvedValue({});

      const result = await emailService.sendAlert(
        'admin@example.com',
        'CPU_HIGH',
        'CPU usage is at 95%',
        'CRITICAL'
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          subject: expect.stringContaining('CRITICAL'),
        })
      );
    });

    it('should include different colors for different severities', async () => {
      mockTransporter.sendMail.mockResolvedValue({});

      // CRITICAL - red
      await emailService.sendAlert('admin@example.com', 'ALERT', 'msg', 'CRITICAL');
      let call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('#ff0000');

      // HIGH - orange
      mockTransporter.sendMail.mockClear();
      await emailService.sendAlert('admin@example.com', 'ALERT', 'msg', 'HIGH');
      call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('#ff6600');

      // WARNING - yellow
      mockTransporter.sendMail.mockClear();
      await emailService.sendAlert('admin@example.com', 'ALERT', 'msg', 'WARNING');
      call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('#ffcc00');
    });
  });

  describe('sendGpuAllocated', () => {
    it('should send GPU allocation email', async () => {
      mockTransporter.sendMail.mockResolvedValue({});

      const result = await emailService.sendGpuAllocated(
        'user@example.com',
        'John',
        'RTX 3090',
        'GPU-Server-1'
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('GPU'),
          html: expect.stringContaining('RTX 3090'),
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should return true when connection succeeds', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const result = await emailService.testConnection();

      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should return false when connection fails', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));

      const result = await emailService.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('EmailType enum', () => {
    it('should have all email types', () => {
      expect(EmailType.WELCOME).toBe('welcome');
      expect(EmailType.TASK_ASSIGNED).toBe('task_assigned');
      expect(EmailType.TASK_COMPLETED).toBe('task_completed');
      expect(EmailType.ALERT).toBe('alert');
      expect(EmailType.PASSWORD_RESET).toBe('password_reset');
      expect(EmailType.GPU_ALLOCATED).toBe('gpu_allocated');
      expect(EmailType.GPU_RELEASED).toBe('gpu_released');
    });
  });

  describe('Configuration', () => {
    it('should use environment variables for SMTP config', () => {
      const originalEnv = process.env.SMTP_HOST;
      process.env.SMTP_HOST = 'smtp.test.com';

      // Create new instance to pick up env changes
      const service = new EmailService();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.test.com',
        })
      );

      process.env.SMTP_HOST = originalEnv;
    });

    it('should use default values when env vars not set', () => {
      const originalHost = process.env.SMTP_HOST;
      delete process.env.SMTP_HOST;

      const service = new EmailService();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
        })
      );

      process.env.SMTP_HOST = originalHost;
    });
  });
});