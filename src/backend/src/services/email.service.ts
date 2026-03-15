import nodemailer from 'nodemailer';

/**
 * Email configuration interface
 */
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

/**
 * Email message interface
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: string }>;
}

/**
 * Email notification types
 */
export enum EmailType {
  WELCOME = 'welcome',
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  ALERT = 'alert',
  PASSWORD_RESET = 'password_reset',
  GPU_ALLOCATED = 'gpu_allocated',
  GPU_RELEASED = 'gpu_released',
}

/**
 * Email Service
 */
export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor() {
    // 🔐 SECURITY: SMTP 密码必须通过环境变量配置
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpUser = process.env.SMTP_USER;
    
    // 验证 SMTP 配置
    if (process.env.NODE_ENV === 'production') {
      if (!smtpPassword || !smtpUser) {
        console.error('[Email] WARNING: SMTP_USER and SMTP_PASSWORD are required in production');
      }
    }

    this.config = {
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpUser || '',
        pass: smtpPassword || '',
      },
    };

    this.transporter = nodemailer.createTransport(this.config);
  }

  /**
   * Send email
   */
  async send(message: EmailMessage): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || 'LSM System'}" <${process.env.SMTP_FROM_EMAIL || 'noreply@example.com'}>`,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments,
      });

      console.log(`[Email] Sent to ${message.to}: ${message.subject}`);
      return true;
    } catch (error) {
      console.error('[Email] Send error:', error);
      return false;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcome(email: string, username: string): Promise<boolean> {
    const html = `
      <h1>欢迎加入 LSM 系统！</h1>
      <p>亲爱的 ${username}，</p>
      <p>感谢您加入 Laboratory Server Management System！</p>
      <p>您的账户已创建成功，现在可以登录系统开始使用了。</p>
      <br/>
      <p>如有任何问题，请随时联系管理员。</p>
      <br/>
      <p>LSM 团队</p>
    `;

    return this.send({
      to: email,
      subject: '欢迎加入 LSM 系统！',
      html,
      text: `欢迎 ${username} 加入 LSM 系统！`,
    });
  }

  /**
   * Send task assignment notification
   */
  async sendTaskAssigned(
    email: string,
    username: string,
    taskName: string,
    priority: string
  ): Promise<boolean> {
    const html = `
      <h2>新任务分配</h2>
      <p>${username}，您好！</p>
      <p>您有一个新任务：</p>
      <ul>
        <li><strong>任务名称：</strong>${taskName}</li>
        <li><strong>优先级：</strong>${priority}</li>
      </ul>
      <p>请登录系统查看详情。</p>
      <br/>
      <p>LSM 系统</p>
    `;

    return this.send({
      to: email,
      subject: `新任务分配：${taskName}`,
      html,
    });
  }

  /**
   * Send task completion notification
   */
  async sendTaskCompleted(
    email: string,
    taskName: string,
    status: string
  ): Promise<boolean> {
    const html = `
      <h2>任务完成通知</h2>
      <p>您的任务已完成：</p>
      <ul>
        <li><strong>任务名称：</strong>${taskName}</li>
        <li><strong>状态：</strong>${status}</li>
      </ul>
      <p>请登录系统查看详细结果。</p>
      <br/>
      <p>LSM 系统</p>
    `;

    return this.send({
      to: email,
      subject: `任务完成：${taskName}`,
      html,
    });
  }

  /**
   * Send alert notification
   */
  async sendAlert(
    email: string,
    alertType: string,
    message: string,
    severity: string
  ): Promise<boolean> {
    const color = severity === 'CRITICAL' ? '#ff0000' : severity === 'HIGH' ? '#ff6600' : '#ffcc00';
    
    const html = `
      <h2 style="color: ${color};">⚠️ 系统告警</h2>
      <p><strong>告警类型：</strong>${alertType}</p>
      <p><strong>严重程度：</strong>${severity}</p>
      <p><strong>告警内容：</strong></p>
      <p>${message}</p>
      <br/>
      <p>请立即处理！</p>
      <br/>
      <p>LSM 监控系统</p>
    `;

    return this.send({
      to: email,
      subject: `【${severity}】系统告警：${alertType}`,
      html,
    });
  }

  /**
   * Send GPU allocation notification
   */
  async sendGpuAllocated(
    email: string,
    username: string,
    gpuModel: string,
    serverName: string
  ): Promise<boolean> {
    const html = `
      <h2>GPU 分配成功</h2>
      <p>${username}，您好！</p>
      <p>您的 GPU 资源已分配成功：</p>
      <ul>
        <li><strong>GPU 型号：</strong>${gpuModel}</li>
        <li><strong>服务器：</strong>${serverName}</li>
      </ul>
      <p>现在可以开始使用 GPU 资源了。</p>
      <br/>
      <p>LSM 系统</p>
    `;

    return this.send({
      to: email,
      subject: 'GPU 分配成功',
      html,
    });
  }

  /**
   * Test email service
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('[Email] SMTP connection successful');
      return true;
    } catch (error) {
      console.error('[Email] SMTP connection failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
