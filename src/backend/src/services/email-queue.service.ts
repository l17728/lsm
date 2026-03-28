import { EmailService, EmailType } from './email.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Notification queue item
 */
interface NotificationQueueItem {
  id: string;
  type: EmailType;
  recipient: string;
  data: Record<string, any>;
  priority: 'low' | 'medium' | 'high';
  scheduledAt?: Date;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'sent' | 'failed';
}

/**
 * Email Queue Service for managing email delivery
 */
export class EmailQueueService {
  private emailService: EmailService;
  private queue: NotificationQueueItem[] = [];
  private processing: boolean = false;
  private concurrency: number = 5; // Process 5 emails concurrently
  private retryDelay: number = 5000; // 5 seconds between retries

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Add email to queue
   */
  async enqueue(
    type: EmailType,
    recipient: string,
    data: Record<string, any>,
    priority: 'low' | 'medium' | 'high' = 'medium',
    scheduledAt?: Date
  ): Promise<string> {
    const id = this.generateId();
    
    const item: NotificationQueueItem = {
      id,
      type,
      recipient,
      data,
      priority,
      scheduledAt,
      attempts: 0,
      maxAttempts: 3,
      status: 'pending',
    };

    // Save to database
    await prisma.emailNotification.create({
      data: {
        userId: data.userId || null,
        type: item.type,
        subject: this.getSubject(type, data),
        body: JSON.stringify(data),
        status: 'PENDING',
      },
    });

    this.queue.push(item);
    console.log(`[EmailQueue] Enqueued ${type} to ${recipient} (ID: ${id})`);

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Process email queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Get pending items sorted by priority
      const pendingItems = this.queue
        .filter(
          (item) =>
            item.status === 'pending' &&
            (!item.scheduledAt || item.scheduledAt <= new Date())
        )
        .sort((a, b) => this.getPriorityScore(b.priority) - this.getPriorityScore(a.priority));

      if (pendingItems.length === 0) {
        await this.sleep(1000);
        continue;
      }

      // Process up to concurrency limit
      const batch = pendingItems.slice(0, this.concurrency);
      const promises = batch.map((item) => this.processItem(item));

      await Promise.allSettled(promises);

      // Small delay between batches
      await this.sleep(100);
    }

    this.processing = false;
  }

  /**
   * Process single queue item
   */
  private async processItem(item: NotificationQueueItem): Promise<void> {
    item.status = 'processing';
    item.attempts++;

    try {
      const template = await this.getTemplate(item.type, item.data);
      
      const success = await this.emailService.send({
        to: item.recipient,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      if (success) {
        item.status = 'sent';
        await this.updateNotificationStatus(item.id, 'SENT');
        console.log(`[EmailQueue] Sent ${item.type} to ${item.recipient}`);
      } else {
        throw new Error('Email send failed');
      }
    } catch (error) {
      console.error(`[EmailQueue] Error sending ${item.type}:`, error);

      if (item.attempts < item.maxAttempts) {
        item.status = 'pending';
        await this.updateNotificationStatus(item.id, 'PENDING');
        console.log(`[EmailQueue] Will retry ${item.type} to ${item.recipient} (attempt ${item.attempts}/${item.maxAttempts})`);
        await this.sleep(this.retryDelay * item.attempts); // Exponential backoff
      } else {
        item.status = 'failed';
        await this.updateNotificationStatus(item.id, 'FAILED', error instanceof Error ? error.message : 'Unknown error');
        console.error(`[EmailQueue] Failed to send ${item.type} to ${item.recipient} after ${item.maxAttempts} attempts`);
      }
    }

    // Remove from queue
    this.queue = this.queue.filter((q) => q.id !== item.id);
  }

  /**
   * Get email template
   */
  private async getTemplate(type: EmailType, data: Record<string, any>): Promise<{
    subject: string;
    html: string;
    text: string;
  }> {
    // Import template service dynamically
    const { emailTemplateService } = await import('./email-template.service');
    return emailTemplateService.getTemplate(type, data);
  }

  /**
   * Get subject line for email type
   */
  private getSubject(type: EmailType, data: Record<string, any>): string {
    switch (type) {
      case EmailType.WELCOME:
        return '欢迎加入 LSM 系统！';
      case EmailType.TASK_ASSIGNED:
        return `新任务分配：${data.taskName || 'Unknown'}`;
      case EmailType.TASK_COMPLETED:
        return `任务完成：${data.taskName || 'Unknown'}`;
      case EmailType.ALERT:
        return `【${data.severity || 'WARNING'}】系统告警：${data.alertType || 'Unknown'}`;
      case EmailType.GPU_ALLOCATED:
        return 'GPU 分配成功';
      default:
        return 'LSM System Notification';
    }
  }

  /**
   * Get priority score for sorting
   */
  private getPriorityScore(priority: string): number {
    const scores: Record<string, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };
    return scores[priority] || 2;
  }

  /**
   * Update notification status in database
   */
  private async updateNotificationStatus(
    notificationId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.emailNotification.updateMany({
        where: {
          id: notificationId,
        },
        data: {
          status,
          errorMessage: errorMessage || null,
          sentAt: status === 'SENT' ? new Date() : undefined,
        },
      });
    } catch (error) {
      console.error('[EmailQueue] Failed to update notification status:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    failed: number;
  } {
    return {
      total: this.queue.length,
      pending: this.queue.filter((q) => q.status === 'pending').length,
      processing: this.queue.filter((q) => q.status === 'processing').length,
      failed: this.queue.filter((q) => q.status === 'failed').length,
    };
  }

  /**
   * Clear queue (for development)
   */
  clear(): void {
    this.queue = [];
    console.log('[EmailQueue] Queue cleared');
  }
}

// Export singleton instance
export const emailQueueService = new EmailQueueService();
