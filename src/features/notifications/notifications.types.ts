export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

export enum NotificationEvent {
  INCIDENT_CREATED = 'INCIDENT_CREATED',
  INCIDENT_UPDATED = 'INCIDENT_UPDATED',
  INCIDENT_ASSIGNED = 'INCIDENT_ASSIGNED',
  INCIDENT_STATUS_CHANGED = 'INCIDENT_STATUS_CHANGED',
  INCIDENT_RESOLVED = 'INCIDENT_RESOLVED',
  PERSONNEL_ASSIGNED = 'PERSONNEL_ASSIGNED',
  PERSONNEL_AVAILABLE = 'PERSONNEL_AVAILABLE',
  EMERGENCY_ALERT = 'EMERGENCY_ALERT',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export interface SendEmailDTO {
  to: string | string[];
  subject: string;
  body: string;
  html?: string;
  from?: string;
}

export interface SendSMSDTO {
  to: string | string[];
  message: string;
}

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  events: {
    [key in NotificationEvent]?: boolean;
  };
}

export interface UpdatePreferencesDTO {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  events?: {
    [key in NotificationEvent]?: boolean;
  };
}

export interface NotificationTemplate {
  event: NotificationEvent;
  subject: string;
  body: string;
  html?: string;
  smsTemplate?: string;
}

export interface SendNotificationDTO {
  event: NotificationEvent;
  recipients: string[]; // User IDs
  data: any;
  channels?: NotificationChannel[];
}

export interface NotificationLog {
  id: string;
  userId: string;
  event: NotificationEvent;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  message: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  error?: string;
  sentAt?: Date;
  createdAt: Date;
}
