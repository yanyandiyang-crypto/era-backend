export interface EmergencyContactDTO {
  name: string;
  phone: string;
  type: 'EMERGENCY' | 'BARANGAY_HALL' | 'POLICE' | 'FIRE' | 'MEDICAL' | 'OTHER';
  isPrimary?: boolean;
}

export interface CreateBarangayDTO {
  name: string;
  code?: string;
  description?: string;
  latitude: number;
  longitude: number;
  address: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  emergencyContacts?: EmergencyContactDTO[];
  operatingHours?: string;
  landmarks?: string;
}

export interface UpdateBarangayDTO {
  name?: string;
  code?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  isActive?: boolean;
  emergencyContacts?: EmergencyContactDTO[];
  operatingHours?: string;
  landmarks?: string;
}

export interface BarangayListQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface NearbyQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
}
