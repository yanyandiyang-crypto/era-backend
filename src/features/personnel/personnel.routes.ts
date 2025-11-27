import { FastifyInstance } from 'fastify';
import { PersonnelController } from './personnel.controller';
import { PersonnelService } from './personnel.service';
import { PersonnelListQuery, CreatePersonnelDTO, UpdatePersonnelDTO, UpdatePersonnelLocationDTO } from './personnel.types';
import { prisma } from '../../config/database';
import { validate, authMiddleware, requireRole } from '../../core/middleware';
import { requireOwnershipOrRole } from '../../core/middleware/auth.middleware';
import * as schemas from './personnel.schema';
import { NotificationsService } from '../notifications/notifications.service';

export async function personnelRoutes(app: FastifyInstance) {
  const personnelService = new PersonnelService(prisma);
  const notificationsService = new NotificationsService(prisma);
  const personnelController = new PersonnelController(personnelService, notificationsService);

  // ========================================
  // MOBILE APP AUTH ENDPOINTS (NO AUTH REQUIRED)
  // ========================================

  // Personnel login
  app.post('/auth/login', personnelController.login.bind(personnelController));

  // Personnel refresh token
  app.post('/auth/refresh', personnelController.refreshToken.bind(personnelController));

  // Personnel change password
  app.post('/auth/change-password', {
    preHandler: [authMiddleware, validate(schemas.changePasswordSchema)],
  }, personnelController.changePassword.bind(personnelController));

  // Personnel logout
  app.post('/auth/logout', {
    preHandler: [authMiddleware],
  }, personnelController.logout.bind(personnelController));

  // ========================================
  // MOBILE APP ENDPOINTS (AUTH REQUIRED)
  // ========================================

  // Get personnel profile (for mobile app)
  app.get<{ Params: { id: string } }>('/:id/profile', {
    preHandler: [authMiddleware, requireOwnershipOrRole('ADMIN', 'SUPER_ADMIN')],
  }, personnelController.getProfile.bind(personnelController));

  // Update personnel status (for mobile app)
  app.patch<{ Params: { id: string }; Body: { status: string } }>('/:id/status', {
    preHandler: [authMiddleware, requireOwnershipOrRole('ADMIN', 'SUPER_ADMIN')],
  }, personnelController.updateStatus.bind(personnelController));

  // Upload personnel photo (for mobile app)
  app.post<{ Params: { id: string } }>('/:id/photo', {
    preHandler: [authMiddleware, requireOwnershipOrRole('ADMIN', 'SUPER_ADMIN')],
  }, personnelController.uploadPhoto.bind(personnelController));

  // Update own profile (for mobile app - personnel can update their own profile)
  app.put<{ Params: { id: string }; Body: UpdatePersonnelDTO }>('/:id/profile', {
    preHandler: [authMiddleware, requireOwnershipOrRole('ADMIN', 'SUPER_ADMIN')],
  }, personnelController.updateOwnProfile.bind(personnelController));

  // Reset password (admin only)
  app.post<{ Params: { id: string }; Body: { newPassword: string } }>('/:id/reset-password', {
    preHandler: [authMiddleware],
  }, personnelController.resetPassword.bind(personnelController));

  // Get assigned incidents (for mobile app)
  app.get<{ Params: { id: string } }>('/:id/incidents/assigned', {
    preHandler: [authMiddleware, requireOwnershipOrRole('ADMIN', 'SUPER_ADMIN')],
  }, personnelController.getAssignedIncidents.bind(personnelController));

  // Get incident history (for mobile app)
  app.get<{ Params: { id: string } }>('/:id/incidents/history', {
    preHandler: [authMiddleware, requireOwnershipOrRole('ADMIN', 'SUPER_ADMIN')],
  }, personnelController.getIncidentHistory.bind(personnelController));

  // ========================================
  // ADMIN ENDPOINTS (ALL REQUIRE AUTH)
  // ========================================

  // Broadcast alert (admin only)
  app.post<{ Body: { title: string; message: string; location: string } }>(
    '/alerts/broadcast',
    {
      preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
    },
    personnelController.broadcastAlert.bind(personnelController)
  );

  // Stats
  app.get('/stats', {
    preHandler: [authMiddleware],
  }, personnelController.getStats.bind(personnelController));

  // List personnel
  app.get<{ Querystring: PersonnelListQuery }>(
    '/',
    {
      preHandler: [authMiddleware, validate(schemas.personnelListQuerySchema, 'query')],
    },
    personnelController.getPersonnel.bind(personnelController)
  );

  // Get personnel by ID
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [authMiddleware],
  }, personnelController.getPersonnelById.bind(personnelController));

  // Create personnel (admin only)
  app.post<{ Body: CreatePersonnelDTO }>(
    '/',
    {
      preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'), validate(schemas.createPersonnelSchema)],
    },
    personnelController.createPersonnel.bind(personnelController)
  );

  // Update personnel (admin only)
  app.put<{ Params: { id: string }; Body: UpdatePersonnelDTO }>(
    '/:id',
    {
      preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'), validate(schemas.updatePersonnelSchema)],
    },
    personnelController.updatePersonnel.bind(personnelController)
  );

  // Suspend personnel (admin only)
  app.patch<{ Params: { id: string } }>(
    '/:id/suspend',
    {
      preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
    },
    personnelController.suspendPersonnel.bind(personnelController)
  );

  // Activate personnel (admin only)
  app.patch<{ Params: { id: string } }>(
    '/:id/activate',
    {
      preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
    },
    personnelController.activatePersonnel.bind(personnelController)
  );

  // Delete personnel (admin only)
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
    },
    personnelController.deletePersonnel.bind(personnelController)
  );

  // Location endpoints
  app.post<{ Params: { id: string }; Body: UpdatePersonnelLocationDTO }>(
    '/:id/location',
    {
      preHandler: [authMiddleware, requireOwnershipOrRole('ADMIN', 'SUPER_ADMIN'), validate(schemas.updateLocationSchema)],
    },
    personnelController.updateLocation.bind(personnelController)
  );

  app.get<{ Params: { id: string } }>('/:id/location', {
    preHandler: [authMiddleware, requireOwnershipOrRole('ADMIN', 'SUPER_ADMIN')],
  }, personnelController.getLocation.bind(personnelController));

  // Location history
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>('/:id/location-history', {
    preHandler: [authMiddleware, requireOwnershipOrRole('ADMIN', 'SUPER_ADMIN')],
  }, personnelController.getLocationHistory.bind(personnelController));

  // Assignment history
  app.get<{ Params: { id: string } }>('/:id/assignment-history', {
    preHandler: [authMiddleware, requireOwnershipOrRole('ADMIN', 'SUPER_ADMIN')],
  }, personnelController.getAssignmentHistory.bind(personnelController));
}
