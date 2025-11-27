import { z } from 'zod';
import { NotificationChannel, NotificationEvent } from './notifications.types';

export const sendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  html: z.string().optional(),
  from: z.string().email().optional(),
});

export const sendSMSSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]),
  message: z.string().min(1).max(1600),
});

export const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  events: z.record(z.nativeEnum(NotificationEvent), z.boolean()).optional(),
});

export const sendNotificationSchema = z.object({
  event: z.nativeEnum(NotificationEvent),
  recipients: z.array(z.string().uuid()),
  data: z.any(),
  channels: z.array(z.nativeEnum(NotificationChannel)).optional(),
});
