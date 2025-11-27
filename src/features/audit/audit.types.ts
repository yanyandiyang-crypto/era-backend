export enum AuditAction {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',

  // Users
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',

  // Personnel
  PERSONNEL_CREATED = 'PERSONNEL_CREATED',
  PERSONNEL_UPDATED = 'PERSONNEL_UPDATED',
  PERSONNEL_DELETED = 'PERSONNEL_DELETED',
  PERSONNEL_SUSPENDED = 'PERSONNEL_SUSPENDED',
  PERSONNEL_ACTIVATED = 'PERSONNEL_ACTIVATED',
  LOCATION_UPDATED = 'LOCATION_UPDATED',

  // Barangays
  BARANGAY_CREATED = 'BARANGAY_CREATED',
  BARANGAY_UPDATED = 'BARANGAY_UPDATED',
  BARANGAY_DELETED = 'BARANGAY_DELETED',

  // Incidents
  INCIDENT_CREATED = 'INCIDENT_CREATED',
  INCIDENT_UPDATED = 'INCIDENT_UPDATED',
  INCIDENT_DELETED = 'INCIDENT_DELETED',
  INCIDENT_STATUS_CHANGED = 'INCIDENT_STATUS_CHANGED',
  PERSONNEL_ASSIGNED = 'PERSONNEL_ASSIGNED',
  INCIDENT_UPDATE_ADDED = 'INCIDENT_UPDATE_ADDED',

  // Photos
  PHOTO_UPLOADED = 'PHOTO_UPLOADED',
  PHOTO_DELETED = 'PHOTO_DELETED',
  PHOTO_CAPTION_UPDATED = 'PHOTO_CAPTION_UPDATED',

  // System
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
}

export interface CreateAuditLogDTO {
  userId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  userId?: string;
  action?: AuditAction;
  resourceType?: string;
  resourceId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AuditLogResponse {
  id: string;
  userId: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
}
