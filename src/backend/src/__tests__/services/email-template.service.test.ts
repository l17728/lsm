/**
 * EmailTemplateService Unit Tests
 *
 * Tests for getTemplate — the pure template generation method.
 * EmailService is mocked so no SMTP config is required.
 */

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// EmailTemplateService constructor creates an EmailService instance.
// We mock it to avoid SMTP configuration requirements.
jest.mock('../../services/email.service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue(true),
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

import { EmailTemplateService } from '../../services/email-template.service';
import { EmailType } from '../../services/email.service';

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmailTemplateService();
  });

  describe('getTemplate', () => {
    describe('WELCOME template', () => {
      it('should return subject, html and text containing the username', () => {
        const result = service.getTemplate(EmailType.WELCOME, {
          username: 'Alice',
          email: 'alice@example.com',
        });

        expect(result.subject).toBeTruthy();
        expect(result.html).toContain('Alice');
        expect(result.text).toContain('Alice');
      });
    });

    describe('TASK_ASSIGNED template', () => {
      it('should include task name and priority in both html and text', () => {
        const result = service.getTemplate(EmailType.TASK_ASSIGNED, {
          username: 'Bob',
          taskName: 'Train ResNet',
          priority: 'HIGH',
          taskUrl: 'http://localhost/tasks/42',
        });

        expect(result.subject).toContain('Train ResNet');
        expect(result.html).toContain('Train ResNet');
        expect(result.text).toContain('HIGH');
      });
    });

    describe('TASK_COMPLETED template', () => {
      it('should include status and result in the output', () => {
        const result = service.getTemplate(EmailType.TASK_COMPLETED, {
          username: 'Carol',
          taskName: 'Inference Job',
          status: 'COMPLETED',
          result: 'Accuracy 98%',
        });

        expect(result.subject).toContain('Inference Job');
        expect(result.html).toContain('Accuracy 98%');
        expect(result.text).toContain('COMPLETED');
      });
    });

    describe('ALERT template', () => {
      it('should embed alert type and severity in subject and body', () => {
        const result = service.getTemplate(EmailType.ALERT, {
          alertType: 'CPU_OVERLOAD',
          message: 'CPU usage exceeded 95%',
          severity: 'CRITICAL',
          timestamp: '2026-03-17T10:00:00Z',
        });

        expect(result.subject).toContain('CRITICAL');
        expect(result.subject).toContain('CPU_OVERLOAD');
        expect(result.html).toContain('CPU usage exceeded 95%');
        expect(result.text).toContain('2026-03-17T10:00:00Z');
      });
    });

    describe('GPU_ALLOCATED template', () => {
      it('should include GPU model and memory in the output', () => {
        const result = service.getTemplate(EmailType.GPU_ALLOCATED, {
          username: 'Dave',
          gpuModel: 'NVIDIA A100',
          memory: 80,
          serverName: 'gpu-node-01',
          taskName: 'LLM Training',
        });

        expect(result.subject).toBeTruthy();
        expect(result.html).toContain('NVIDIA A100');
        expect(result.html).toContain('80');
        expect(result.text).toContain('gpu-node-01');
      });
    });

    describe('unknown type', () => {
      it('should throw for an unrecognised email type', () => {
        expect(() =>
          service.getTemplate('unknown_type' as any, {})
        ).toThrow(/Unknown email type/);
      });
    });
  });
});
