import { IncidentStatus, IncidentPriority, IncidentType } from '@prisma/client';

export interface CreateIncidentDTO {
  title: string;
  description: string;
  type: IncidentType;
  priority: IncidentPriority;
  latitude: number;
  longitude: number;
  address: string;
  reporterName: string;
  reporterPhone: string;
  barangayId?: string;
}

export interface UpdateIncidentDTO {
  title?: string;
  description?: string;
  type?: IncidentType;
  priority?: IncidentPriority;
  status?: IncidentStatus;
  latitude?: number;
  longitude?: number;
  address?: string;
  reporterName?: string;
  reporterPhone?: string;
  barangayId?: string;
}

export interface IncidentListQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: IncidentType;
  priority?: IncidentPriority;
  status?: IncidentStatus;
  barangayId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AssignPersonnelDTO {
  personnelIds: string[];
}

export interface AddIncidentUpdateDTO {
  message: string;
  updateType: 'INFO' | 'STATUS_CHANGE' | 'PERSONNEL_ASSIGNED' | 'RESOLVED';
}

export interface UpdateIncidentStatusDTO {
  status: IncidentStatus;
  notes?: string;
  priority?: IncidentPriority;
}

export interface AcknowledgeIncidentDTO {
  personnelId: string;
}

export interface IncidentWithAckCount {
  id: string;
  incidentNumber: string;
  totalPersonnelNotified: number;
  acknowledgedCount: number;
  acknowledgmentPercentage: number;
  acknowledgedPersonnelIds: string[];
}
