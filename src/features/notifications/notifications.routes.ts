import { FastifyInstance } from 'fastify';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { prisma } from '../../config/database';
import { validate, authMiddleware, requireRole } from '../../core/middleware';
import {
  sendEmailSchema,
  sendSMSSchema,
  sendNotificationSchema,
} from './notifications.schema';

export async function notificationsRoutes(app: FastifyInstance) {
  const notificationsService = new NotificationsService(prisma);
  const notificationsController = new NotificationsController(notificationsService);

  // All routes require authentication and admin role
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', requireRole('ADMIN', 'SUPER_ADMIN'));

  // Send email
  app.post(
    '/email',
    {
      preHandler: [validate(sendEmailSchema)],
    },
    notificationsController.sendEmail.bind(notificationsController) as any
  );

  // Send SMS
  app.post(
    '/sms',
    {
      preHandler: [validate(sendSMSSchema)],
    },
    notificationsController.sendSMS.bind(notificationsController) as any
  );

  // Send multi-channel notification
  app.post(
    '/send',
    {
      preHandler: [validate(sendNotificationSchema)],
    },
    notificationsController.sendNotification.bind(notificationsController) as any
  );

  // Send emergency alert to all
  app.post(
    '/emergency-alert',
    notificationsController.sendEmergencyAlert.bind(notificationsController)
  );

  // Test connections
  app.get(
    '/test/email',
    notificationsController.testEmailConnection.bind(notificationsController)
  );

  app.get(
    '/test/sms',
    notificationsController.testSMSConnection.bind(notificationsController)
  );
}
