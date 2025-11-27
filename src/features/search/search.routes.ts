import { FastifyInstance } from 'fastify';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { GlobalSearchQuerystring, IncidentSearchQuerystring, PersonnelSearchQuerystring, BarangaySearchQuerystring, UserSearchQuerystring } from './search.types';
import { prisma } from '../../config/database';
import { validate, authMiddleware } from '../../core/middleware';
import { searchQuerySchema } from './search.schema';

export async function searchRoutes(app: FastifyInstance) {
  const searchService = new SearchService(prisma);
  const searchController = new SearchController(searchService);

  // All routes require authentication
  app.addHook('preHandler', authMiddleware);

  // Global search (all entities)
  app.get<{ Querystring: GlobalSearchQuerystring }>(
    '/global',
    {
      preHandler: [validate(searchQuerySchema, 'query')],
    },
    searchController.globalSearch.bind(searchController)
  );

  // Search incidents
  app.get<{ Querystring: IncidentSearchQuerystring }>(
    '/incidents',
    {
      preHandler: [validate(searchQuerySchema, 'query')],
    },
    searchController.searchIncidents.bind(searchController)
  );

  // Search personnel
  app.get<{ Querystring: PersonnelSearchQuerystring }>(
    '/personnel',
    {
      preHandler: [validate(searchQuerySchema, 'query')],
    },
    searchController.searchPersonnel.bind(searchController)
  );

  // Search barangays
  app.get<{ Querystring: BarangaySearchQuerystring }>(
    '/barangays',
    {
      preHandler: [validate(searchQuerySchema, 'query')],
    },
    searchController.searchBarangays.bind(searchController)
  );

  // Search users
  app.get<{ Querystring: UserSearchQuerystring }>(
    '/users',
    {
      preHandler: [validate(searchQuerySchema, 'query')],
    },
    searchController.searchUsers.bind(searchController)
  );

  // Get search suggestions
  app.get('/suggestions', searchController.getSearchSuggestions.bind(searchController));
}
