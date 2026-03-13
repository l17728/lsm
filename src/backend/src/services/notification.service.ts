import { EmailService, EmailType } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

/**
 * Alert types
 */
export enum AlertType {
  SYSTEM = 'SYSTEM',
  PERFORMANCE = 'PERFORMANCE',
  RESOURCE = 'RESOURCE',
  SECURITY = 'SECURITY',
  TASK = 'TASK',
}

/**
 * Notification channel types
 */
export enum NotificationChannel {
  EMAIL = 'EMAIL',
  DINGTALK = 'DINGTALK',
  WEBSOCKET = 'WEBSOCKET',
}

/**
 * Alert notification interface
 */
export interface AlertNotification {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  recipients?: string[];
}

/**
 * Notification preferences interface
 */
export interface NotificationPreferences {
  emailEnabled: boolean;
  dingtalkEnabled: boolean;
  websocketEnabled: boolean;
  severityFilter: AlertSeverity[];
  quietHours?: {
    start: string;
    end: string;
  };
}

/**
 * Notification Service
 * 
 * Handles alert notifications across multiple channels:
 * - Email notifications
 * - DingTalk webhook notifications
 * - WebSocket real-time notifications
 */
export class NotificationService {
  private emailService: EmailService;
  private emailTemplateService: EmailTemplateService;
  private dingtalkWebhookUrl: string;
  private preferences: NotificationPreferences;

  constructor() {
    this.emailService = new EmailService();
    this.emailTemplateService = new EmailTemplateService();
    this.dingtalkWebhookUrl = process.env.DINGTALK_WEBHOOK_URL || '';
    
    this.preferences = {
      emailEnabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
      dingtalkEnabled: !!this.dingtalkWebhookUrl,
      websocketEnabled: true,
      severityFilter: [AlertSeverity.CRITICAL, AlertSeverity.WARNING],
    };
  }

  /**
   * Send alert notification through all configured channels
   */
  async sendAlert(notification: AlertNotification): Promise<void> {
    console.log(`[Notification] Sending alert: ${notification.title} (${notification.severity})`);

    // Check if severity should be notified
    if (!this.preferences.severityFilter.includes(notification.severity)) {
      console.log('[Notification] Severity filtered out, skipping notification');
      return;
    }

    // Check quiet hours
    if (this.isQuietHours()) {
      console.log('[Notification] Quiet hours, skipping non-critical notifications');
      if (notification.severity !== AlertSeverity.CRITICAL) {
        return;
      }
    }

    const promises: Promise<void>[] = [];

    // Send email notifications
    if (this.preferences.emailEnabled && notification.recipients?.length) {
      for (const recipient of notification.recipients) {
        promises.push(this.sendEmailNotification(notification, recipient));
      }
    }

    // Send DingTalk notification
    if (this.preferences.dingtalkEnabled) {
      promises.push(this.sendDingtalkNotification(notification));
    }

    // Send WebSocket notification (real-time)
    if (this.preferences.websocketEnabled) {
      promises.push(this.sendWebSocketNotification(notification));
    }

    // Save notification to database
    promises.push(this.saveNotificationToDatabase(notification));

    await Promise.all(promises);
    console.log('[Notification] Alert sent successfully');
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    notification: AlertNotification,
    recipient: string
  ): Promise<void> {
    try {
      await this.emailTemplateService.sendWithTemplate(EmailType.ALERT, recipient, {
        alertType: notification.type,
        message: notification.message,
        severity: notification.severity,
        timestamp: new Date().toISOString(),
        ...notification.metadata,
      });

      console.log(`[Notification] Email sent to ${recipient}`);
    } catch (error) {
      console.error('[Notification] Email send failed:', error);
    }
  }

  /**
   * Send DingTalk webhook notification
   */
  private async sendDingtalkNotification(notification: AlertNotification): Promise<void> {
    if (!this.dingtalkWebhookUrl) {
      return;
    }

    try {
      const color = this.getSeverityColor(notification.severity);
      const message = {
        msgtype: 'markdown',
        markdown: {
          title: notification.title,
          text: this.formatDingtalkMessage(notification, color),
        },
        at: {
          isAtAll: notification.severity === AlertSeverity.CRITICAL,
        },
      };

      const response = await fetch(this.dingtalkWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (response.ok) {
        console.log('[Notification] DingTalk notification sent');
      } else {
        console.error('[Notification] DingTalk send failed:', await response.text());
      }
    } catch (error) {
      console.error('[Notification] DingTalk send error:', error);
    }
  }

  /**
   * Send WebSocket notification (real-time push)
   */
  private async sendWebSocketNotification(notification: AlertNotification): Promise<void> {
    try {
      // Get WebSocket instance from global
      const ws = (global as any).websocketServer;
      if (ws) {
        ws.broadcast({
          type: 'ALERT',
          payload: {
            id: Date.now().toString(),
            type: notification.type,
            severity: notification.severity,
            title: notification.title,
            message: notification.message,
            timestamp: new Date().toISOString(),
            metadata: notification.metadata,
          },
        });
        console.log('[Notification] WebSocket notification broadcast');
      }
    } catch (error) {
      console.error('[Notification] WebSocket send error:', error);
    }
  }

  /**
   * Save notification to database
   */
  private async saveNotificationToDatabase(notification: AlertNotification): Promise<void> {
    try {
      // Get all admin users as recipients
      const adminUsers = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
          isActive: true,
        },
        select: {
          id: true,
          email: true,
        },
      });

      for (const user of adminUsers) {
        await prisma.emailNotification.create({
          data: {
            userId: user.id,
            type: notification.type,
            subject: notification.title,
            body: notification.message,
            status: 'SENT',
            sentAt: new Date(),
          },
        });
      }

      console.log('[Notification] Notifications saved to database');
    } catch (error) {
      console.error('[Notification] Database save failed:', error);
    }
  }

  /**
   * Format DingTalk markdown message
   */
  private formatDingtalkMessage(notification: AlertNotification, color: string): string {
    const severityIcon = {
      [AlertSeverity.CRITICAL]: '🔴',
      [AlertSeverity.WARNING]: '🟡',
      [AlertSeverity.INFO]: '🔵',
    }[notification.severity] || '⚪';

    return `## ${severityIcon} ${notification.title}

> **类型**: ${notification.type}
> **级别**: ${notification.severity}
> **时间**: ${new Date().toLocaleString('zh-CN')}

---

${notification.message}

${notification.metadata?.details ? `\n**详情**: ${notification.metadata.details}` : ''}
`;
  }

  /**
   * Get color for severity level
   */
  private getSeverityColor(severity: AlertSeverity): string {
    return {
      [AlertSeverity.CRITICAL]: '#dc3545',
      [AlertSeverity.WARNING]: '#ffc107',
      [AlertSeverity.INFO]: '#17a2b8',
    }[severity] || '#6c757d';
  }

  /**
   * Check if current time is within quiet hours
   */
  private isQuietHours(): boolean {
    if (!this.preferences.quietHours) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = this.preferences.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = this.preferences.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Update notification preferences
   */
  updatePreferences(preferences: Partial<NotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
    console.log('[Notification] Preferences updated:', this.preferences);
  }

  /**
   * Get current preferences
   */
  getPreferences(): NotificationPreferences {
    return this.preferences;
  }

  /**
   * Test notification channels
   */
  async testChannels(recipient: string): Promise<{ channel: string; success: boolean }[]> {
    const results: { channel: string; success: boolean }[] = [];

    // Test email
    if (this.preferences.emailEnabled) {
      const emailSuccess = await this.emailService.send({
        to: recipient,
        subject: 'LSM 通知渠道测试',
        html: '<h2>测试成功</h2><p>如果您收到此邮件，说明邮件通知配置正确。</p>',
      });
      results.push({ channel: 'EMAIL', success: emailSuccess });
    }

    // Test DingTalk
    if (this.preferences.dingtalkEnabled) {
      try {
        const response = await fetch(this.dingtalkWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msgtype: 'text',
            text: { content: 'LSM 通知渠道测试 - 钉钉通知配置正确' },
          }),
        });
        results.push({ channel: 'DINGTALK', success: response.ok });
      } catch {
        results.push({ channel: 'DINGTALK', success: false });
      }
    }

    return results;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
