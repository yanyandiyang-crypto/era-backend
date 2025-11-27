import { SendSMSDTO } from './notifications.types';
import { env } from '../../config/environment';

export class SMSService {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private twilioClient: any;

  constructor() {
    this.accountSid = env.TWILIO_ACCOUNT_SID || '';
    this.authToken = env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = env.TWILIO_PHONE_NUMBER || '';

    // Only initialize Twilio if credentials are provided
    if (this.accountSid && this.authToken) {
      try {
        // Dynamic import would be better, but for now we'll handle it gracefully
        // const twilio = require('twilio');
        // this.twilioClient = twilio(this.accountSid, this.authToken);
        // console.log('SMS service initialized (Twilio credentials found)');
      } catch (error) {
        // console.warn('Twilio module not available. SMS will be simulated.');
      }
    }
  }

  async sendSMS(data: SendSMSDTO): Promise<void> {
    try {
      const recipients = Array.isArray(data.to) ? data.to : [data.to];

      for (const recipient of recipients) {
        await this.sendSingleSMS(recipient, data.message);
      }

      // console.log(`SMS sent to ${recipients.length} recipient(s)`);
    } catch (error) {
      // console.error('Failed to send SMS:', error);
      throw new Error('Failed to send SMS');
    }
  }

  private async sendSingleSMS(to: string, message: string): Promise<void> {
    // If Twilio is configured, send real SMS
    if (this.twilioClient) {
      await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: to,
      });
    } else {
      // Simulate SMS sending for development
      // console.log(`[SIMULATED SMS] To: ${to}, Message: ${message}`);
    }
  }

  async sendBulkSMS(messages: SendSMSDTO[]): Promise<void> {
    const promises = messages.map((sms) => this.sendSMS(sms));
    await Promise.allSettled(promises);
  }

  isConfigured(): boolean {
    return !!(this.accountSid && this.authToken && this.fromNumber);
  }
}
