import { EmailService, EmailType } from '../services/email.service';

/**
 * Email Template Engine
 */
export class EmailTemplateService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Get email template by type
   */
  getTemplate(type: EmailType, data: Record<string, any>): {
    subject: string;
    html: string;
    text: string;
  } {
    switch (type) {
      case EmailType.WELCOME:
        return this.getWelcomeTemplate(data);
      case EmailType.TASK_ASSIGNED:
        return this.getTaskAssignedTemplate(data);
      case EmailType.TASK_COMPLETED:
        return this.getTaskCompletedTemplate(data);
      case EmailType.ALERT:
        return this.getAlertTemplate(data);
      case EmailType.GPU_ALLOCATED:
        return this.getGpuAllocatedTemplate(data);
      default:
        throw new Error(`Unknown email type: ${type}`);
    }
  }

  /**
   * Welcome email template
   */
  private getWelcomeTemplate(data: { username: string; email: string }): {
    subject: string;
    html: string;
    text: string;
  } {
    return {
      subject: '欢迎加入 LSM 系统！',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 欢迎加入 LSM 系统！</h1>
            </div>
            <div class="content">
              <p>亲爱的 <strong>${data.username}</strong>，</p>
              <p>感谢您加入 Laboratory Server Management System！</p>
              <p>您的账户已创建成功，现在可以登录系统开始使用了。</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">立即登录</a>
              </p>
              <p>如有任何问题，请随时联系管理员。</p>
            </div>
            <div class="footer">
              <p>LSM 团队 © ${new Date().getFullYear()}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `欢迎 ${data.username} 加入 LSM 系统！请登录：${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
    };
  }

  /**
   * Task assigned email template
   */
  private getTaskAssignedTemplate(data: {
    username: string;
    taskName: string;
    priority: string;
    taskUrl: string;
  }): { subject: string; html: string; text: string } {
    const priorityColors: Record<string, string> = {
      LOW: '#28a745',
      MEDIUM: '#ffc107',
      HIGH: '#fd7e14',
      CRITICAL: '#dc3545',
    };

    return {
      subject: `新任务分配：${data.taskName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #667eea; color: white; padding: 20px; }
            .content { padding: 30px; background: #f9f9f9; }
            .priority { display: inline-block; padding: 4px 12px; background: ${priorityColors[data.priority] || '#6c757d'}; color: white; border-radius: 3px; font-size: 12px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📋 新任务分配</h2>
            </div>
            <div class="content">
              <p>${data.username}，您好！</p>
              <p>您有一个新任务：</p>
              <ul>
                <li><strong>任务名称：</strong>${data.taskName}</li>
                <li><strong>优先级：</strong><span class="priority">${data.priority}</span></li>
              </ul>
              <p style="text-align: center;">
                <a href="${data.taskUrl}" class="button">查看详情</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `您有一个新任务：${data.taskName}（优先级：${data.priority}）。查看详情：${data.taskUrl}`,
    };
  }

  /**
   * Alert email template
   */
  private getAlertTemplate(data: {
    alertType: string;
    message: string;
    severity: string;
    timestamp: string;
  }): { subject: string; html: string; text: string } {
    const severityConfig: Record<string, { color: string; icon: string }> = {
      CRITICAL: { color: '#dc3545', icon: '🔴' },
      HIGH: { color: '#ff6600', icon: '🟠' },
      MEDIUM: { color: '#ffc107', icon: '🟡' },
      LOW: { color: '#28a745', icon: '🟢' },
    };

    const config = severityConfig[data.severity] || severityConfig.LOW;

    return {
      subject: `【${data.severity}】系统告警：${data.alertType}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${config.color}; color: white; padding: 20px; }
            .content { padding: 30px; background: #f9f9f9; }
            .alert-box { border-left: 4px solid ${config.color}; padding: 15px; background: white; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${config.icon} 系统告警</h2>
            </div>
            <div class="content">
              <div class="alert-box">
                <p><strong>告警类型：</strong>${data.alertType}</p>
                <p><strong>严重程度：</strong>${data.severity}</p>
                <p><strong>告警内容：</strong></p>
                <p>${data.message}</p>
                <p><strong>时间：</strong>${data.timestamp}</p>
              </div>
              <p style="color: ${config.color};"><strong>请立即处理！</strong></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `【${data.severity}】系统告警：${data.alertType}\n\n${data.message}\n\n时间：${data.timestamp}\n\n请立即处理！`,
    };
  }

  /**
   * GPU allocated email template
   */
  private getGpuAllocatedTemplate(data: {
    username: string;
    gpuModel: string;
    memory: number;
    serverName: string;
    taskName: string;
  }): { subject: string; html: string; text: string } {
    return {
      subject: 'GPU 分配成功',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .info-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #11998e; color: white; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎮 GPU 分配成功</h1>
            </div>
            <div class="content">
              <p>${data.username}，您好！</p>
              <p>您的 GPU 资源已分配成功：</p>
              <div class="info-box">
                <ul>
                  <li><strong>GPU 型号：</strong>${data.gpuModel}</li>
                  <li><strong>显存：</strong>${data.memory}GB</li>
                  <li><strong>服务器：</strong>${data.serverName}</li>
                  <li><strong>任务：</strong>${data.taskName}</li>
                </ul>
              </div>
              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks" class="button">查看任务</a>
              </p>
              <p>现在可以开始使用 GPU 资源了。</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `GPU 分配成功！型号：${data.gpuModel} (${data.memory}GB)，服务器：${data.serverName}，任务：${data.taskName}`,
    };
  }

  /**
   * Send email with template
   */
  async sendWithTemplate(
    type: EmailType,
    to: string,
    data: Record<string, any>
  ): Promise<boolean> {
    const template = this.getTemplate(type, data);

    return this.emailService.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }
}

// Export singleton instance
export const emailTemplateService = new EmailTemplateService();
