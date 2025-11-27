import { FastifyInstance } from 'fastify';
import { BarangaysController } from './barangays.controller';
import { BarangaysService } from './barangays.service';
import { NearbyQuery, BarangayListQuery, CreateBarangayDTO, UpdateBarangayDTO } from './barangays.types';
import { prisma } from '../../config/database';
import { validate, authMiddleware, requireRole } from '../../core/middleware';
import {
  createBarangaySchema,
  updateBarangaySchema,
  barangayListQuerySchema,
  nearbyQuerySchema,
} from './barangays.schema';

export async function barangaysRoutes(app: FastifyInstance) {
  const barangaysService = new BarangaysService(prisma);
  const barangaysController = new BarangaysController(barangaysService);

  // All routes require authentication
  app.addHook('preHandler', authMiddleware);

  // Get statistics
  app.get('/stats', barangaysController.getStats.bind(barangaysController));

  // Get nearby barangays
  app.get<{ Querystring: NearbyQuery }>(
    '/nearby',
    {
      preHandler: [validate(nearbyQuerySchema, 'query')],
    },
    barangaysController.getNearby.bind(barangaysController)
  );

  // List barangays
  app.get<{ Querystring: BarangayListQuery }>(
    '/',
    {
      preHandler: [validate(barangayListQuerySchema, 'query')],
    },
    barangaysController.getBarangays.bind(barangaysController)
  );

  // Get barangay by ID
  app.get('/:id', barangaysController.getBarangayById.bind(barangaysController));

  // Create barangay (admin only)
  app.post<{ Body: CreateBarangayDTO }>(
    '/',
    {
      preHandler: [requireRole('ADMIN', 'SUPER_ADMIN'), validate(createBarangaySchema)],
    },
    barangaysController.createBarangay.bind(barangaysController)
  );

  // Update barangay (admin only)
  app.put<{ Params: { id: string }; Body: UpdateBarangayDTO }>(
    '/:id',
    {
      preHandler: [requireRole('ADMIN', 'SUPER_ADMIN'), validate(updateBarangaySchema)],
    },
    barangaysController.updateBarangay.bind(barangaysController)
  );

  // Delete barangay (admin only)
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireRole('ADMIN', 'SUPER_ADMIN')],
    },
    barangaysController.deleteBarangay.bind(barangaysController)
  );
}
