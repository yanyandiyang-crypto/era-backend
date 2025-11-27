export enum SearchEntity {
  INCIDENTS = 'INCIDENTS',
  PERSONNEL = 'PERSONNEL',
  BARANGAYS = 'BARANGAYS',
  USERS = 'USERS',
  ALL = 'ALL',
}

export interface SearchQuery {
  query: string;
  entity?: SearchEntity;
  filters?: {
    status?: string;
    priority?: string;
    type?: string;
    role?: string;
    fromDate?: string;
    toDate?: string;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  page?: number;
  limit?: number;
}

export interface IncidentSearchResult {
  id: string;
  incidentNumber: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  address: string;
  reportedAt: Date;
  barangay?: {
    id: string;
    name: string;
  };
  relevanceScore?: number;
  highlights?: {
    title?: string;
    description?: string;
    address?: string;
  };
}

export interface PersonnelSearchResult {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  relevanceScore?: number;
  highlights?: {
    name?: string;
    email?: string;
  };
}

export interface BarangaySearchResult {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  contactPerson: string | null;
  contactNumber: string | null;
  relevanceScore?: number;
  highlights?: {
    name?: string;
    address?: string;
  };
}

export interface UserSearchResult {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  relevanceScore?: number;
  highlights?: {
    name?: string;
    email?: string;
  };
}

export interface GlobalSearchResult {
  incidents: IncidentSearchResult[];
  personnel: PersonnelSearchResult[];
  barangays: BarangaySearchResult[];
  users: UserSearchResult[];
  totalResults: number;
}

export interface SearchSuggestion {
  query: string;
  entity: SearchEntity;
  count: number;
}

export interface GlobalSearchQuerystring {
  query?: string;
  status?: string;
  priority?: string;
  type?: string;
  role?: string;
  fromDate?: string;
  toDate?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  page?: string;
  limit?: string;
}

export interface IncidentSearchQuerystring {
  query?: string;
  status?: string;
  priority?: string;
  type?: string;
  fromDate?: string;
  toDate?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  page?: string;
  limit?: string;
}

export interface PersonnelSearchQuerystring {
  query?: string;
  role?: string;
  status?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  page?: string;
  limit?: string;
}

export interface BarangaySearchQuerystring {
  query?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  page?: string;
  limit?: string;
}

export interface UserSearchQuerystring {
  query?: string;
  role?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  page?: string;
  limit?: string;
}
