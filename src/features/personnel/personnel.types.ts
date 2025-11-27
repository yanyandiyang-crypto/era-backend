import { PersonnelRole, PersonnelStatus } from '@prisma/client';

export interface CreatePersonnelDTO {
  employeeId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: PersonnelRole;
  dateOfBirth?: Date;
  bloodType?: string;
  address?: string;
  emergencyContact?: string;
}

export interface UpdatePersonnelDTO {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: PersonnelRole;
  status?: PersonnelStatus;
  dateOfBirth?: Date;
  bloodType?: string;
  address?: string;
  emergencyContact?: string;
  isAvailable?: boolean;
  currentDuty?: string;
}

export interface PersonnelListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: PersonnelRole | string;
  status?: PersonnelStatus | string;
  isAvailable?: boolean;
}

export interface UpdatePersonnelLocationDTO {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
}
