import { FastifyRequest, FastifyReply } from 'fastify';
import { NotificationsService } from './notifications.service';
import { SendEmailDTO, SendSMSDTO, SendNotificationDTO } from './notifications.types';
import { SuccessResponse } from '../../types';

export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  async sendEmail(
    request: FastifyRequest<{ Body: SendEmailDTO }>,
    reply: FastifyReply
  ) {
    await this.notificationsService.sendEmail(request.body);

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'Email sent successfully',
    };

    return reply.status(200).send(response);
  }

  async sendSMS(
    request: FastifyRequest<{ Body: SendSMSDTO }>,
    reply: FastifyReply
  ) {
    await this.notificationsService.sendSMS(request.body);

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'SMS sent successfully',
    };

    return reply.status(200).send(response);
  }

  async sendNotification(
    request: FastifyRequest<{ Body: SendNotificationDTO }>,
    reply: FastifyReply
  ) {
    await this.notificationsService.sendNotification(request.body);

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'Notification sent successfully',
    };

    return reply.status(200).send(response);
  }

  async sendEmergencyAlert(
    request: FastifyRequest<{ Body: { title: string; message: string; location: string } }>,
    reply: FastifyReply
  ) {
    await this.notificationsService.sendEmergencyAlert(
      request.body.title,
      request.body.message,
      request.body.location
    );

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'Emergency alert sent to all personnel and admins',
    };

    return reply.status(200).send(response);
  }

  async testEmailConnection(request: FastifyRequest, reply: FastifyReply) {
    const isConnected = await this.notificationsService.testEmailConnection();

    const response: SuccessResponse = {
      success: true,
      data: {
        connected: isConnected,
        message: isConnected
          ? 'Email service is configured and working'
          : 'Email service is not properly configured',
      },
    };

    return reply.status(200).send(response);
  }

  async testSMSConnection(request: FastifyRequest, reply: FastifyReply) {
    const status = await this.notificationsService.testSMSConnection();

    const response: SuccessResponse = {
      success: true,
      data: {
        configured: status.configured,
        message: status.configured
          ? 'SMS service is configured'
          : 'SMS service is not configured. Add Twilio credentials to .env file.',
      },
    };

    return reply.status(200).send(response);
  }
}
