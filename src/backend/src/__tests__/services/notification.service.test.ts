/**
 * Notification Service Tests
 *
 * Tests for multi-channel notifications: Email, DingTalk, WebSocket.
 * Includes regression tests for the createMany fix (serial INSERT → batch).
 */

// Mock dependencies before import
jest.mock('../../services/email.service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue(true),
  })),
  // Export the real EmailType enum so notification.service can use EmailType.ALERT
  EmailType: {
    ALERT: 'alert',
    RESET_PASSWORD: 'reset_password',
    WELCOME: 'welcome',
    NOTIFICATION: 'notification',
  },
}));

jest.mock('../../services/email-template.service', () => ({
  EmailTemplateService: jest.fn().mockImplementation(() => ({
    sendWithTemplate: jest.fn().mockResolvedValue(true),
  })),
}));

// Setup prisma mock factory so we can control per-test behavior
const mockUserFindMany = jest.fn();
const mockEmailNotificationCreate = jest.fn().mockResolvedValue({ id: 'notif-1' });
const mockEmailNotificationCreateMany = jest.fn().mockResolvedValue({ count: 1 });

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findMany: mockUserFindMany,
    },
    emailNotification: {
      create: mockEmailNotificationCreate,
      createMany: mockEmailNotificationCreateMany,
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

    // Reset prisma mocks to sane defaults
    mockUserFindMany.mockResolvedValue([{ id: 'admin-1', email: 'admin@test.com' }]);
    mockEmailNotificationCreateMany.mockResolvedValue({ count: 1 });

    // Mock global websocket
    (global as any).websocketServer = {
      broadcast: jest.fn(),
    };

    notificationService = new NotificationService();
  });

  afterEach(() => {
    delete (global as any).websocketServer;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // saveNotificationToDatabase – createMany regression tests
  // ─────────────────────────────────────────────────────────────────────────────
  describe('saveNotificationToDatabase (via sendAlert)', () => {
    it('REGRESSION: should use createMany instead of individual create() calls', async () => {
      mockUserFindMany.mockResolvedValue([
        { id: 'admin-1', email: 'a1@test.com' },
        { id: 'admin-2', email: 'a2@test.com' },
        { id: 'admin-3', email: 'a3@test.com' },
      ]);

      await notificationService.sendAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.CRITICAL,
        title: 'Test Alert',
        message: 'Test message',
      });

      // createMany should be called exactly once (not N times)
      expect(mockEmailNotificationCreateMany).toHaveBeenCalledTimes(1);
      // create should NOT be called at all
      expect(mockEmailNotificationCreate).not.toHaveBeenCalled();
    });

    it('should pass correct data shape to createMany', async () => {
      mockUserFindMany.mockResolvedValue([
        { id: 'admin-1', email: 'a1@test.com' },
        { id: 'admin-2', email: 'a2@test.com' },
      ]);

      await notificationService.sendAlert({
        type: AlertType.PERFORMANCE,
        severity: AlertSeverity.CRITICAL,
        title: 'High CPU',
        message: 'CPU at 95%',
      });

      expect(mockEmailNotificationCreateMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ userId: 'admin-1', subject: 'High CPU', status: 'SENT' }),
          expect.objectContaining({ userId: 'admin-2', subject: 'High CPU', status: 'SENT' }),
        ],
      });
    });

    it('should NOT call createMany when there are no admin users', async () => {
      mockUserFindMany.mockResolvedValue([]); // no admins

      await notificationService.sendAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.CRITICAL,
        title: 'Empty Alert',
        message: 'No admins',
      });

      expect(mockEmailNotificationCreateMany).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully without throwing', async () => {
      mockUserFindMany.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        notificationService.sendAlert({
          type: AlertType.SYSTEM,
          severity: AlertSeverity.CRITICAL,
          title: 'Alert',
          message: 'msg',
        })
      ).resolves.not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // sendAlert – channel routing
  // ─────────────────────────────────────────────────────────────────────────────
  describe('sendAlert', () => {
    it('should broadcast via WebSocket for critical alerts', async () => {
      await notificationService.sendAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.CRITICAL,
        title: 'Server Alert',
        message: 'Server is down',
      });

      expect((global as any).websocketServer.broadcast).toHaveBeenCalled();
    });

    it('should NOT send when severity is filtered out (INFO filtered by default)', async () => {
      await notificationService.sendAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.INFO,
        title: 'Info Alert',
        message: 'This is info',
        recipients: ['admin@example.com'],
      });

      // INFO is not in [CRITICAL, WARNING] filter
      expect(mockEmailTemplateService.sendWithTemplate).not.toHaveBeenCalled();
      expect((global as any).websocketServer.broadcast).not.toHaveBeenCalled();
    });

    it('should send email to each recipient when email is enabled', async () => {
      notificationService.updatePreferences({ emailEnabled: true });

      await notificationService.sendAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.CRITICAL,
        title: 'Alert',
        message: 'msg',
        recipients: ['a@test.com', 'b@test.com'],
      });

      expect(mockEmailTemplateService.sendWithTemplate).toHaveBeenCalledTimes(2);
    });

    it('should NOT send email when emailEnabled is false', async () => {
      notificationService.updatePreferences({ emailEnabled: false });

      await notificationService.sendAlert({
        type: AlertType.SYSTEM,
        severity: AlertSeverity.CRITICAL,
        title: 'Alert',
        message: 'msg',
        recipients: ['a@test.com'],
      });

      expect(mockEmailTemplateService.sendWithTemplate).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // preferences
  // ─────────────────────────────────────────────────────────────────────────────
  describe('updatePreferences', () => {
    it('should update only specified fields', () => {
      const before = notificationService.getPreferences();
      notificationService.updatePreferences({ emailEnabled: false });
      const after = notificationService.getPreferences();

      expect(after.emailEnabled).toBe(false);
      expect(after.severityFilter).toEqual(before.severityFilter); // unchanged
    });

    it('should update severityFilter', () => {
      notificationService.updatePreferences({ severityFilter: [AlertSeverity.INFO] });
      expect(notificationService.getPreferences().severityFilter).toEqual([AlertSeverity.INFO]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // enums
  // ─────────────────────────────────────────────────────────────────────────────
  describe('enum values', () => {
    it('AlertSeverity should have correct string values', () => {
      expect(AlertSeverity.CRITICAL).toBe('CRITICAL');
      expect(AlertSeverity.WARNING).toBe('WARNING');
      expect(AlertSeverity.INFO).toBe('INFO');
    });

    it('AlertType should have correct string values', () => {
      expect(AlertType.SYSTEM).toBe('SYSTEM');
      expect(AlertType.PERFORMANCE).toBe('PERFORMANCE');
      expect(AlertType.RESOURCE).toBe('RESOURCE');
      expect(AlertType.SECURITY).toBe('SECURITY');
      expect(AlertType.TASK).toBe('TASK');
    });
  });
});
