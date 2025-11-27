import { NotificationEvent } from './notifications.types';

interface TemplateData {
  [key: string]: any;
}

export class NotificationTemplates {
  static getEmailTemplate(event: NotificationEvent, data: TemplateData): { subject: string; body: string; html: string } {
    switch (event) {
      case NotificationEvent.INCIDENT_CREATED:
        return {
          subject: `New Incident Reported: ${data.incidentNumber}`,
          body: `A new incident has been reported.\n\nIncident Number: ${data.incidentNumber}\nType: ${data.type}\nPriority: ${data.priority}\nLocation: ${data.address}\n\nPlease check the system for more details.`,
          html: `
            <h2>New Incident Reported</h2>
            <p>A new incident has been reported and requires attention.</p>
            <table>
              <tr><td><strong>Incident Number:</strong></td><td>${data.incidentNumber}</td></tr>
              <tr><td><strong>Type:</strong></td><td>${data.type}</td></tr>
              <tr><td><strong>Priority:</strong></td><td>${data.priority}</td></tr>
              <tr><td><strong>Location:</strong></td><td>${data.address}</td></tr>
            </table>
            <p>Please check the ERA system for more details.</p>
          `,
        };

      case NotificationEvent.INCIDENT_ASSIGNED:
        return {
          subject: `You've been assigned to incident ${data.incidentNumber}`,
          body: `You have been assigned to respond to an incident.\n\nIncident Number: ${data.incidentNumber}\nType: ${data.type}\nPriority: ${data.priority}\nLocation: ${data.address}\n\nPlease acknowledge and respond as soon as possible.`,
          html: `
            <h2>New Assignment</h2>
            <p>You have been assigned to respond to an incident.</p>
            <table>
              <tr><td><strong>Incident Number:</strong></td><td>${data.incidentNumber}</td></tr>
              <tr><td><strong>Type:</strong></td><td>${data.type}</td></tr>
              <tr><td><strong>Priority:</strong></td><td>${data.priority}</td></tr>
              <tr><td><strong>Location:</strong></td><td>${data.address}</td></tr>
            </table>
            <p><strong>Please acknowledge and respond as soon as possible.</strong></p>
          `,
        };

      case NotificationEvent.INCIDENT_STATUS_CHANGED:
        return {
          subject: `Incident ${data.incidentNumber} status updated to ${data.newStatus}`,
          body: `Incident status has been updated.\n\nIncident Number: ${data.incidentNumber}\nPrevious Status: ${data.oldStatus}\nNew Status: ${data.newStatus}\n\nCheck the system for updates.`,
          html: `
            <h2>Incident Status Updated</h2>
            <p>The status of incident <strong>${data.incidentNumber}</strong> has been updated.</p>
            <p>Previous Status: <span style="color: #666;">${data.oldStatus}</span></p>
            <p>New Status: <span style="color: #007bff; font-weight: bold;">${data.newStatus}</span></p>
            <p>Check the ERA system for more updates.</p>
          `,
        };

      case NotificationEvent.INCIDENT_RESOLVED:
        return {
          subject: `Incident ${data.incidentNumber} has been resolved`,
          body: `The incident has been successfully resolved.\n\nIncident Number: ${data.incidentNumber}\nResolved At: ${data.resolvedAt}\n\nThank you for your response.`,
          html: `
            <h2>Incident Resolved</h2>
            <p>The incident <strong>${data.incidentNumber}</strong> has been successfully resolved.</p>
            <p>Resolved At: ${data.resolvedAt}</p>
            <p><em>Thank you for your prompt response and service.</em></p>
          `,
        };

      case NotificationEvent.EMERGENCY_ALERT:
        return {
          subject: `🚨 EMERGENCY ALERT: ${data.title}`,
          body: `EMERGENCY ALERT\n\n${data.message}\n\nLocation: ${data.location}\nTime: ${data.timestamp}\n\nImmediate action required!`,
          html: `
            <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 5px;">
              <h1>🚨 EMERGENCY ALERT</h1>
              <h2>${data.title}</h2>
              <p style="font-size: 16px;">${data.message}</p>
              <p><strong>Location:</strong> ${data.location}</p>
              <p><strong>Time:</strong> ${data.timestamp}</p>
              <p style="font-size: 18px; font-weight: bold;">IMMEDIATE ACTION REQUIRED!</p>
            </div>
          `,
        };

      default:
        return {
          subject: `ERA System Notification`,
          body: `You have a new notification from the ERA system.\n\nEvent: ${event}\n\nPlease check the system for details.`,
          html: `
            <h2>System Notification</h2>
            <p>You have a new notification from the ERA system.</p>
            <p><strong>Event:</strong> ${event}</p>
            <p>Please check the system for more details.</p>
          `,
        };
    }
  }

  static getSMSTemplate(event: NotificationEvent, data: TemplateData): string {
    switch (event) {
      case NotificationEvent.INCIDENT_CREATED:
        return `ERA: New incident ${data.incidentNumber} - ${data.type} - ${data.priority} priority at ${data.address}`;

      case NotificationEvent.INCIDENT_ASSIGNED:
        return `ERA: You're assigned to ${data.incidentNumber} - ${data.type} at ${data.address}. Respond ASAP.`;

      case NotificationEvent.INCIDENT_STATUS_CHANGED:
        return `ERA: Incident ${data.incidentNumber} status changed to ${data.newStatus}`;

      case NotificationEvent.INCIDENT_RESOLVED:
        return `ERA: Incident ${data.incidentNumber} has been resolved. Thank you.`;

      case NotificationEvent.EMERGENCY_ALERT:
        return `🚨 ERA EMERGENCY: ${data.title} - ${data.location}. ${data.message}`;

      default:
        return `ERA: You have a new notification. Event: ${event}`;
    }
  }
}
