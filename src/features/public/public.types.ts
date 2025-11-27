// src/features/public/public.types.ts

import { IncidentType, IncidentPriority } from '@prisma/client';

export interface CreatePublicIncidentDTO {
  type: IncidentType;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  reporterName: string;
  reporterPhone: string;
  landmark?: string;
}

export interface PublicSessionDTO {
  sessionToken: string;
  expiresAt: Date;
}

export interface PublicIncidentResponse {
  id: string;
  incidentNumber: string;
  type: IncidentType;
  priority: IncidentPriority;
  status: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  landmark?: string;
  reportedAt: Date;
  photos?: {
    id: string;
    url: string;
  }[];
}

export interface PublicBarangayResponse {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  address: string;
  contactPhone?: string;
  emergencyContacts?: any; // JSON field from Prisma
  operatingHours?: string;
}
