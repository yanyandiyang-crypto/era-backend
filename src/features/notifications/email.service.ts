import nodemailer, { Transporter } from 'nodemailer';
import { SendEmailDTO } from './notifications.types';
import { env } from '../../config/environment';

export class EmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(env.SMTP_PORT || '587'),
      secure: env.SMTP_SECURE === 'true',
      auth: env.SMTP_USER && env.SMTP_PASS ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      } : undefined,
    });
  }

  async sendEmail(data: SendEmailDTO): Promise<void> {
    try {
      const recipients = Array.isArray(data.to) ? data.to.join(', ') : data.to;

      await this.transporter.sendMail({
        from: data.from || env.SMTP_FROM || 'noreply@era-system.com',
        to: recipients,
        subject: data.subject,
        text: data.body,
        html: data.html || data.body,
      });

      // console.log(`Email sent to ${recipients}: ${data.subject}`);
    } catch (error) {
      // console.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendBulkEmails(emails: SendEmailDTO[]): Promise<void> {
    const promises = emails.map((email) => this.sendEmail(email));
    await Promise.allSettled(promises);
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      // console.error('Email service connection failed:', error);
      return false;
    }
  }
}
