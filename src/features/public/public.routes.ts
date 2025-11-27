// src/features/public/public.routes.ts

import { FastifyInstance } from 'fastify';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { prisma } from '../../config/database';
import { validate } from '../../core/middleware/validation.middleware';
import {
  createPublicSessionSchema,
  CreatePublicSessionInput,
} from './public.schema';

export async function publicRoutes(fastify: FastifyInstance) {
  const publicService = new PublicService(prisma);
  const publicController = new PublicController(publicService);

  // console.log('[PUBLIC ROUTES] Registering public routes...');

  // ========================================
  // PUBLIC ENDPOINTS (NO AUTHENTICATION)
  // ========================================

  // Create session
  fastify.post<{ Body: CreatePublicSessionInput }>(
    '/session',
    {
      preHandler: [validate(createPublicSessionSchema)],
    },
    publicController.createSession.bind(publicController)
  );

  // Create incident (public report) - supports both JSON and multipart/form-data
  fastify.post(
    '/incidents',
    {
      bodyLimit: 10485760, // 10MB
      onRequest: async (_request, _reply) => {
        // console.log('[ROUTE] POST /incidents - Request received');
        // console.log('[ROUTE] Content-Type:', request.headers['content-type']);
      },
    },
    publicController.createIncident.bind(publicController)
  );

  // console.log('[PUBLIC ROUTES] Routes registered successfully');

  // Get active incidents
  fastify.get(
    '/incidents',
    publicController.getIncidents.bind(publicController)
  );

  // Get incident by ID
  fastify.get<{ Params: { id: string } }>(
    '/incidents/:id',
    publicController.getIncidentById.bind(publicController)
  );

  // Get barangays
  fastify.get(
    '/barangays',
    publicController.getBarangays.bind(publicController)
  );
}
