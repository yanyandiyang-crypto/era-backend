import { PrismaClient } from '@prisma/client';
import {
  SearchQuery,
  SearchEntity,
  IncidentSearchResult,
  PersonnelSearchResult,
  BarangaySearchResult,
  UserSearchResult,
  GlobalSearchResult,
} from './search.types';
import { CONSTANTS } from '../../config/constants';
import { PaginatedResponse } from '../../types';

export class SearchService {
  constructor(private prisma: PrismaClient) {}

  async globalSearch(query: SearchQuery): Promise<GlobalSearchResult> {
    const _limit = 5; // Limit per entity for global search

    const [incidents, personnel, barangays, users] = await Promise.all([
      this.searchIncidents({ ...query, limit: _limit }),
      this.searchPersonnel({ ...query, limit: _limit }),
      this.searchBarangays({ ...query, limit: _limit }),
      this.searchUsers({ ...query, limit: _limit }),
    ]);

    return {
      incidents: incidents.data,
      personnel: personnel.data,
      barangays: barangays.data,
      users: users.data,
      totalResults:
        incidents.pagination.total +
        personnel.pagination.total +
        barangays.pagination.total +
        users.pagination.total,
    };
  }

  async searchIncidents(
    query: SearchQuery
  ): Promise<PaginatedResponse<IncidentSearchResult>> {
    const page = query.page || 1;
    const limit = query.limit || CONSTANTS.DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;
    // const searchTerm = `%${query.query}%`; // Not used in current implementation

    const where: any = {
      OR: [
        { incidentNumber: { contains: query.query, mode: 'insensitive' } },
        { title: { contains: query.query, mode: 'insensitive' } },
        { description: { contains: query.query, mode: 'insensitive' } },
        { address: { contains: query.query, mode: 'insensitive' } },
        { reporterName: { contains: query.query, mode: 'insensitive' } },
      ],
    };

    // Apply filters
    if (query.filters?.status) {
      where.status = query.filters.status;
    }

    if (query.filters?.priority) {
      where.priority = query.filters.priority;
    }

    if (query.filters?.type) {
      where.type = query.filters.type;
    }

    if (query.filters?.fromDate || query.filters?.toDate) {
      where.reportedAt = {};
      if (query.filters.fromDate) {
        where.reportedAt.gte = new Date(query.filters.fromDate);
      }
      if (query.filters.toDate) {
        where.reportedAt.lte = new Date(query.filters.toDate);
      }
    }

    const [total, incidents] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        include: {
          barangay: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: query.sort
          ? { [query.sort.field]: query.sort.order }
          : { reportedAt: 'desc' },
      }),
    ]);

    const results: IncidentSearchResult[] = incidents.map((incident) => ({
      id: incident.id,
      incidentNumber: incident.incidentNumber,
      title: incident.title,
      description: incident.description,
      type: incident.type,
      priority: incident.priority,
      status: incident.status,
      address: incident.address,
      reportedAt: incident.reportedAt,
      barangay: incident.barangay || undefined,
      highlights: this.highlightMatches(
        {
          title: incident.title,
          description: incident.description,
          address: incident.address,
        },
        query.query
      ),
    }));

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async searchPersonnel(
    query: SearchQuery
  ): Promise<PaginatedResponse<PersonnelSearchResult>> {
    const page = query.page || 1;
    const limit = query.limit || CONSTANTS.DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { employeeId: { contains: query.query, mode: 'insensitive' } },
        { firstName: { contains: query.query, mode: 'insensitive' } },
        { lastName: { contains: query.query, mode: 'insensitive' } },
        { email: { contains: query.query, mode: 'insensitive' } },
        { phone: { contains: query.query, mode: 'insensitive' } },
      ],
    };

    // Apply filters
    if (query.filters?.role) {
      where.role = query.filters.role;
    }

    if (query.filters?.status) {
      where.status = query.filters.status;
    }

    const [total, personnel] = await Promise.all([
      this.prisma.personnel.count({ where }),
      this.prisma.personnel.findMany({
        where,
        skip,
        take: limit,
        orderBy: query.sort
          ? { [query.sort.field]: query.sort.order }
          : { firstName: 'asc' },
      }),
    ]);

    const results: PersonnelSearchResult[] = personnel.map((person) => ({
      id: person.id,
      employeeId: person.employeeId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone: person.phone,
      role: person.role,
      status: person.status,
      highlights: this.highlightMatches(
        {
          name: `${person.firstName} ${person.lastName}`,
          email: person.email,
        },
        query.query
      ),
    }));

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async searchBarangays(
    query: SearchQuery
  ): Promise<PaginatedResponse<BarangaySearchResult>> {
    const page = query.page || 1;
    const limit = query.limit || CONSTANTS.DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { name: { contains: query.query, mode: 'insensitive' } },
        { code: { contains: query.query, mode: 'insensitive' } },
        { address: { contains: query.query, mode: 'insensitive' } },
        { contactPerson: { contains: query.query, mode: 'insensitive' } },
        { contactNumber: { contains: query.query, mode: 'insensitive' } },
      ],
    };

    const [total, barangays] = await Promise.all([
      this.prisma.barangay.count({ where }),
      this.prisma.barangay.findMany({
        where,
        skip,
        take: limit,
        orderBy: query.sort
          ? { [query.sort.field]: query.sort.order }
          : { name: 'asc' },
      }),
    ]);

    const results: BarangaySearchResult[] = barangays.map((barangay) => ({
      id: barangay.id,
      name: barangay.name,
      code: barangay.code,
      address: barangay.address,
      latitude: barangay.latitude,
      longitude: barangay.longitude,
      contactPerson: barangay.contactPerson,
      contactNumber: barangay.contactPhone,
      highlights: this.highlightMatches(
        {
          name: barangay.name,
          address: barangay.address || '',
        },
        query.query
      ),
    }));

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async searchUsers(query: SearchQuery): Promise<PaginatedResponse<UserSearchResult>> {
    const page = query.page || 1;
    const limit = query.limit || CONSTANTS.DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { email: { contains: query.query, mode: 'insensitive' } },
        { firstName: { contains: query.query, mode: 'insensitive' } },
        { lastName: { contains: query.query, mode: 'insensitive' } },
      ],
    };

    // Apply filters
    if (query.filters?.role) {
      where.role = query.filters.role;
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
        skip,
        take: limit,
        orderBy: query.sort
          ? { [query.sort.field]: query.sort.order }
          : { firstName: 'asc' },
      }),
    ]);

    const results: UserSearchResult[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      highlights: this.highlightMatches(
        {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        },
        query.query
      ),
    }));

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSearchSuggestions(query: string, _limit: number = 5) {
    // const searchTerm = `%${query}%`; // Not used in current implementation

    const [incidentCount, personnelCount, barangayCount, userCount] = await Promise.all(
      [
        this.prisma.incident.count({
          where: {
            OR: [
              { incidentNumber: { contains: query, mode: 'insensitive' } },
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
        }),
        this.prisma.personnel.count({
          where: {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { employeeId: { contains: query, mode: 'insensitive' } },
            ],
          },
        }),
        this.prisma.barangay.count({
          where: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { code: { contains: query, mode: 'insensitive' } },
            ],
          },
        }),
        this.prisma.user.count({
          where: {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
        }),
      ]
    );

    return [
      { query, entity: SearchEntity.INCIDENTS, count: incidentCount },
      { query, entity: SearchEntity.PERSONNEL, count: personnelCount },
      { query, entity: SearchEntity.BARANGAYS, count: barangayCount },
      { query, entity: SearchEntity.USERS, count: userCount },
    ].filter((suggestion) => suggestion.count > 0);
  }

  private highlightMatches(
    fields: { [key: string]: string },
    query: string
  ): { [key: string]: string } {
    const highlights: { [key: string]: string } = {};
    const queryLower = query.toLowerCase();

    Object.entries(fields).forEach(([key, value]) => {
      if (!value) return;

      const valueLower = value.toLowerCase();
      const index = valueLower.indexOf(queryLower);

      if (index !== -1) {
        const start = Math.max(0, index - 20);
        const end = Math.min(value.length, index + query.length + 20);
        const snippet = value.substring(start, end);
        const highlightedSnippet = snippet.replace(
          new RegExp(query, 'gi'),
          (match) => `<mark>${match}</mark>`
        );
        highlights[key] = `${start > 0 ? '...' : ''}${highlightedSnippet}${end < value.length ? '...' : ''}`;
      }
    });

    return highlights;
  }
}
