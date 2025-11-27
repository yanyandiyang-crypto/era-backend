import { FastifyRequest, FastifyReply } from 'fastify';
import { SearchService } from './search.service';
import { 
  SearchQuery, 
  SearchEntity,
  GlobalSearchQuerystring,
  IncidentSearchQuerystring,
  PersonnelSearchQuerystring,
  BarangaySearchQuerystring,
  UserSearchQuerystring
} from './search.types';
import { SuccessResponse } from '../../types';

export class SearchController {
  constructor(private searchService: SearchService) {}

  async globalSearch(
    request: FastifyRequest<{ Querystring: GlobalSearchQuerystring }>,
    reply: FastifyReply
  ) {
    const query: SearchQuery = {
      query: request.query.query || '',
      entity: SearchEntity.ALL,
      filters: {
        status: request.query.status,
        priority: request.query.priority,
        type: request.query.type,
        role: request.query.role,
        fromDate: request.query.fromDate,
        toDate: request.query.toDate,
      },
      page: request.query.page ? parseInt(request.query.page) : 1,
      limit: request.query.limit ? parseInt(request.query.limit) : 10,
    };

    const results = await this.searchService.globalSearch(query);

    const response: SuccessResponse = {
      success: true,
      data: results,
    };

    return reply.status(200).send(response);
  }

  async searchIncidents(
    request: FastifyRequest<{ Querystring: IncidentSearchQuerystring }>,
    reply: FastifyReply
  ) {
    const query: SearchQuery = {
      query: request.query.query || '',
      filters: {
        status: request.query.status,
        priority: request.query.priority,
        type: request.query.type,
        fromDate: request.query.fromDate,
        toDate: request.query.toDate,
      },
      sort: request.query.sortField
        ? {
            field: request.query.sortField,
            order: request.query.sortOrder || 'desc',
          }
        : undefined,
      page: request.query.page ? parseInt(request.query.page) : 1,
      limit: request.query.limit ? parseInt(request.query.limit) : 20,
    };

    const results = await this.searchService.searchIncidents(query);

    const response: SuccessResponse = {
      success: true,
      data: results,
    };

    return reply.status(200).send(response);
  }

  async searchPersonnel(
    request: FastifyRequest<{ Querystring: PersonnelSearchQuerystring }>,
    reply: FastifyReply
  ) {
    const query: SearchQuery = {
      query: request.query.query || '',
      filters: {
        role: request.query.role,
        status: request.query.status,
      },
      sort: request.query.sortField
        ? {
            field: request.query.sortField,
            order: request.query.sortOrder || 'asc',
          }
        : undefined,
      page: request.query.page ? parseInt(request.query.page) : 1,
      limit: request.query.limit ? parseInt(request.query.limit) : 20,
    };

    const results = await this.searchService.searchPersonnel(query);

    const response: SuccessResponse = {
      success: true,
      data: results,
    };

    return reply.status(200).send(response);
  }

  async searchBarangays(
    request: FastifyRequest<{ Querystring: BarangaySearchQuerystring }>,
    reply: FastifyReply
  ) {
    const query: SearchQuery = {
      query: request.query.query || '',
      sort: request.query.sortField
        ? {
            field: request.query.sortField,
            order: request.query.sortOrder || 'asc',
          }
        : undefined,
      page: request.query.page ? parseInt(request.query.page) : 1,
      limit: request.query.limit ? parseInt(request.query.limit) : 20,
    };

    const results = await this.searchService.searchBarangays(query);

    const response: SuccessResponse = {
      success: true,
      data: results,
    };

    return reply.status(200).send(response);
  }

  async searchUsers(
    request: FastifyRequest<{ Querystring: UserSearchQuerystring }>,
    reply: FastifyReply
  ) {
    const query: SearchQuery = {
      query: request.query.query || '',
      filters: {
        role: request.query.role,
      },
      sort: request.query.sortField
        ? {
            field: request.query.sortField,
            order: request.query.sortOrder || 'asc',
          }
        : undefined,
      page: request.query.page ? parseInt(request.query.page) : 1,
      limit: request.query.limit ? parseInt(request.query.limit) : 20,
    };

    const results = await this.searchService.searchUsers(query);

    const response: SuccessResponse = {
      success: true,
      data: results,
    };

    return reply.status(200).send(response);
  }

  async getSearchSuggestions(
    request: FastifyRequest<{ Querystring: { query: string; limit?: string } }>,
    reply: FastifyReply
  ) {
    const limit = request.query.limit ? parseInt(request.query.limit) : 5;
    const suggestions = await this.searchService.getSearchSuggestions(
      request.query.query,
      limit
    );

    const response: SuccessResponse = {
      success: true,
      data: suggestions,
    };

    return reply.status(200).send(response);
  }
}
