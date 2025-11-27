import { PrismaClient } from '@prisma/client';
import { PersonnelStatus } from '@prisma/client';
import { EmailService } from './email.service';
import { SMSService } from './sms.service';
// import { NotificationTemplates } from './templates'; // Disabled - not needed when SMS/Email are disabled
import { logger } from '../../core/utils/logger';
import {
  SendEmailDTO,
  SendSMSDTO,
  SendNotificationDTO,
  NotificationChannel,
  NotificationEvent,
} from './notifications.types';

export class NotificationsService {
  private emailService: EmailService;
  private smsService: SMSService;

  constructor(private prisma: PrismaClient) {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
  }

  async sendEmail(data: SendEmailDTO): Promise<void> {
    await this.emailService.sendEmail(data);
  }

  async sendSMS(data: SendSMSDTO): Promise<void> {
    await this.smsService.sendSMS(data);
  }

  async sendNotification(data: SendNotificationDTO): Promise<void> {
    // Fetch recipients from both User and Personnel tables
    const [users, personnel] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: data.recipients } },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      }),
      this.prisma.personnel.findMany({
        where: { id: { in: data.recipients } },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      }),
    ]);

    const allRecipients = [...users, ...personnel];

    const channels = data.channels || [NotificationChannel.EMAIL, NotificationChannel.SMS];

    for (const user of allRecipients) {
      // Get user preferences (would come from a NotificationPreferences table in production)
      const shouldSendEmail = channels.includes(NotificationChannel.EMAIL);
      const shouldSendSMS = channels.includes(NotificationChannel.SMS);

      // Send email notification - DISABLED (using WebSocket/push notifications only)
      if (shouldSendEmail && user.email) {
        // Email notifications disabled - relying on WebSocket push notifications
        logger.info(`[NOTIFICATION] Email disabled for ${user.email} - using push notifications`);
        // try {
        //   const emailTemplate = NotificationTemplates.getEmailTemplate(data.event, {
        //     ...data.data,
        //     recipientName: `${user.firstName} ${user.lastName}`,
        //   });

        //   await this.emailService.sendEmail({
        //     to: user.email,
        //     subject: emailTemplate.subject,
        //     body: emailTemplate.body,
        //     html: emailTemplate.html,
        //   });
        // } catch (error) {
        //   // console.error(`Failed to send email to ${user.email}:`, error);
        // }
      }

      // Send SMS notification - DISABLED (using WebSocket/push notifications only)
      if (shouldSendSMS && user.phone) {
        // SMS notifications disabled - relying on WebSocket push notifications
        logger.info(`[NOTIFICATION] SMS disabled for ${user.phone} - using push notifications`);
        // try {
        //   const smsMessage = NotificationTemplates.getSMSTemplate(data.event, data.data);

        //   await this.smsService.sendSMS({
        //     to: user.phone,
        //     message: smsMessage,
        //   });
        // } catch (error) {
        //   // console.error(`Failed to send SMS to ${user.phone}:`, error);
        // }
      }
    }
  }

  // Helper methods for common notification scenarios
  async notifyIncidentCreated(incidentId: string, recipientIds: string[]): Promise<void> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        barangay: true,
      },
    });

    if (!incident) return;

    await this.sendNotification({
      event: NotificationEvent.INCIDENT_CREATED,
      recipients: recipientIds,
      data: {
        incidentNumber: incident.incidentNumber,
        type: incident.type,
        priority: incident.priority,
        address: incident.address,
        barangay: incident.barangay?.name,
      },
    });
  }

  /**
   * Automatically notify available personnel when a new incident is created
   * This considers duty status - notifies personnel who are on duty, on break, responding, or off duty
   * Note: AVAILABLE status is not used in this system - personnel are ON_DUTY instead
   */
  async notifyAvailablePersonnelOfIncident(incidentId: string): Promise<void> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        barangay: true,
      },
    });

    if (!incident) return;

    // Get personnel who should be notified of incidents
    // Using ON_DUTY, ON_BREAK, RESPONDING, and OFF_DUTY (AVAILABLE is not used in this system)
    const availablePersonnel = await this.prisma.personnel.findMany({
      where: {
        status: {
          in: [
            PersonnelStatus.ON_DUTY,      // Main active status
            PersonnelStatus.ON_BREAK,     // On break but can respond
            PersonnelStatus.RESPONDING,   // Already responding to incidents
            PersonnelStatus.OFF_DUTY,     // Off duty but can be notified for critical incidents
          ],
        },
      },
    });

    if (availablePersonnel.length === 0) {
      logger.warn('No personnel found for incident notification (checked ON_DUTY, ON_BREAK, RESPONDING, OFF_DUTY)');
      return;
    }

    const personnelIds = availablePersonnel.map(p => p.id);

    await this.sendNotification({
      event: NotificationEvent.INCIDENT_CREATED,
      recipients: personnelIds,
      data: {
        incidentNumber: incident.incidentNumber,
        type: incident.type,
        priority: incident.priority,
        address: incident.address,
        barangay: incident.barangay?.name,
      },
      // channels: [NotificationChannel.SMS], // SMS DISABLED - using WebSocket/push notifications
    });

    logger.info(`Notified ${availablePersonnel.length} personnel of verified incident ${incident.incidentNumber} (ON_DUTY: ${availablePersonnel.filter(p => p.status === 'ON_DUTY').length}, ON_BREAK: ${availablePersonnel.filter(p => p.status === 'ON_BREAK').length}, OFF_DUTY: ${availablePersonnel.filter(p => p.status === 'OFF_DUTY').length})`);
  }

  async notifyPersonnelAssigned(incidentId: string, personnelIds: string[]): Promise<void> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) return;

    const personnel = await this.prisma.personnel.findMany({
      where: { id: { in: personnelIds } },
    });

    // Personnel have their own accounts, use their IDs directly
    const personnelContactIds = personnel.map((p) => p.id);

    await this.sendNotification({
      event: NotificationEvent.INCIDENT_ASSIGNED,
      recipients: personnelContactIds,
      data: {
        incidentNumber: incident.incidentNumber,
        type: incident.type,
        priority: incident.priority,
        address: incident.address,
      },
    });
  }

  async notifyIncidentStatusChanged(
    incidentId: string,
    oldStatus: string,
    newStatus: string,
    recipientIds: string[]
  ): Promise<void> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) return;

    await this.sendNotification({
      event: NotificationEvent.INCIDENT_STATUS_CHANGED,
      recipients: recipientIds,
      data: {
        incidentNumber: incident.incidentNumber,
        oldStatus,
        newStatus,
      },
    });
  }

  async notifyIncidentResolved(incidentId: string, recipientIds: string[]): Promise<void> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) return;

    await this.sendNotification({
      event: NotificationEvent.INCIDENT_RESOLVED,
      recipients: recipientIds,
      data: {
        incidentNumber: incident.incidentNumber,
        resolvedAt: incident.resolvedAt?.toLocaleString(),
      },
    });
  }

  async sendEmergencyAlert(title: string, message: string, location: string): Promise<void> {
    // Get all ACTIVE personnel (not INACTIVE) and admins
    // Include personnel who are AVAILABLE, ON_DUTY, or RESPONDING to emergencies
    const [personnel, admins] = await Promise.all([
      this.prisma.personnel.findMany({
        where: {
          status: {
            in: [
              PersonnelStatus.AVAILABLE,
              PersonnelStatus.ON_DUTY,
              PersonnelStatus.RESPONDING,
              PersonnelStatus.ON_SCENE,
              PersonnelStatus.ON_BREAK, // Include on break - they can respond to emergencies
              PersonnelStatus.OFF_DUTY, // Include off duty - they can respond to emergencies
            ],
          },
        },
      }),
      this.prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        },
      }),
    ]);

    const recipientIds = [
      ...personnel.map((p) => p.id),
      ...admins.map((a) => a.id),
    ];

    await this.sendNotification({
      event: NotificationEvent.EMERGENCY_ALERT,
      recipients: recipientIds,
      data: {
        title,
        message,
        location,
        timestamp: new Date().toLocaleString(),
      },
      // channels: [NotificationChannel.EMAIL, NotificationChannel.SMS], // DISABLED - using WebSocket/push
    });
  }

  async testEmailConnection(): Promise<boolean> {
    return this.emailService.verifyConnection();
  }

  async testSMSConnection(): Promise<{ configured: boolean }> {
    return {
      configured: this.smsService.isConfigured(),
    };
  }
}
