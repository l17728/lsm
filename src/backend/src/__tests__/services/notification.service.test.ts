/**
 * Notification Service Tests
 * 
 * Tests for multi-channel notifications: Email, DingTalk, WebSocket
 */

// Mock dependencies before import
jest.mock('../../services/email.service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../../services/email-template.service', () => ({
  EmailTemplateService: jest.fn().mockImplementation(() => ({
    sendWithTemplate: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 'admin-1', email: 'admin@test.com' }]),
    },
    emailNotification: {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    },
  })),
}));

import { NotificationService, AlertSeverity, AlertType } from '../../services/notification.service';
import { EmailTemplateService } from '../../services/email-template.service';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockEmailTemplateService: jest.Mocked<EmailTemplateService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEmailTemplateService = {
      sendWithTemplate: jest.fn().mockResolvedValue(true),
    } as any;
    
    (EmailTemplateService as jest.Mock).mockImplementation(() => mockEmailTemplateService);
    
    // Mock global websocket
    (global as any).websocketServer = {
      broadcast: jest.fn(),
    };
    
    notificationService = new NotificationService();
  });

  afterEach(() => {
    delete (global as any).websocketServer;
  });

  describe('sendAlert', () => {
    it('should send alert through configured channels', async () => {
      // Enable email notifications
      notificationService.updatePreferences({
        emailEnabled: true,
        severityFilter: [AlertSeverity.CRITICAL, AlertSeverity.WARNING],
      });

      await notificationService.sendAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.CRITICAL,
        title: 'Server Alert',
        message: 'Server is down',
        recipients: ['admin@example.com'],
      });

      // Check WebSocket broadcast (enabled by default)
      expect((global as any).websocketServer.broadcast).toHaveBeenCalled();
    });

    it('should filter out lower severity alerts', async () => {
      // Default severity filter is [CRITICAL, WARNING]
      await notificationService.sendAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.INFO,
        title: 'Info Alert',
        message: 'This is info',
        recipients: ['admin@example.com'],
      });

      // INFO is filtered out by default
      expect(mockEmailTemplateService.sendWithTemplate).not.toHaveBeenCalled();
    });
  });

  describe('updatePreferences', () => {
    it('should update notification preferences', () => {
      notificationService.updatePreferences({
        emailEnabled: false,
        dingtalkEnabled: true,
      });

      const prefs = notificationService.getPreferences();

      expect(prefs.emailEnabled).toBe(false);
      expect(prefs.dingtalkEnabled).toBe(true);
    });

    it('should merge with existing preferences', () => {
      const originalPrefs = notificationService.getPreferences();
      
      notificationService.updatePreferences({
        emailEnabled: false,
      });

      const newPrefs = notificationService.getPreferences();

      expect(newPrefs.emailEnabled).toBe(false);
      expect(newPrefs.severityFilter).toEqual(originalPrefs.severityFilter);
    });
  });

  describe('testChannels', () => {
    it('should test all enabled channels', async () => {
      notificationService.updatePreferences({
        emailEnabled: true,
      });

      const results = await notificationService.testChannels('test@example.com');

      expect(Array.isArray(results)).toBe(true);
      results.forEach(result => {
        expect(result).toHaveProperty('channel');
        expect(result).toHaveProperty('success');
      });
    });
  });

  describe('AlertSeverity enum', () => {
    it('should have correct severity levels', () => {
      expect(AlertSeverity.CRITICAL).toBe('CRITICAL');
      expect(AlertSeverity.WARNING).toBe('WARNING');
      expect(AlertSeverity.INFO).toBe('INFO');
    });
  });

  describe('AlertType enum', () => {
    it('should have correct alert types', () => {
      expect(AlertType.SYSTEM).toBe('SYSTEM');
      expect(AlertType.PERFORMANCE).toBe('PERFORMANCE');
      expect(AlertType.RESOURCE).toBe('RESOURCE');
      expect(AlertType.SECURITY).toBe('SECURITY');
      expect(AlertType.TASK).toBe('TASK');
    });
  });

  describe('Notification Preferences', () => {
    it('should have default preferences', () => {
      const prefs = notificationService.getPreferences();

      expect(prefs).toHaveProperty('emailEnabled');
      expect(prefs).toHaveProperty('dingtalkEnabled');
      expect(prefs).toHaveProperty('websocketEnabled');
      expect(prefs).toHaveProperty('severityFilter');
    });
  });
});