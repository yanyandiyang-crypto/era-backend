import { FastifyInstance } from 'fastify';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { IncidentListQuery, CreateIncidentDTO, UpdateIncidentDTO, UpdateIncidentStatusDTO, AssignPersonnelDTO, AddIncidentUpdateDTO } from './incidents.types';
import { SubmitResolutionDTO, ConfirmResolutionDTO, UpdateResolutionDTO } from './resolution.types';
import { IncidentPriority } from '@prisma/client';
import { prisma } from '../../config/database';
import { validate, authMiddleware, requireRole } from '../../core/middleware';
import {
  createIncidentSchema,
  updateIncidentSchema,
  incidentListQuerySchema,
  assignPersonnelSchema,
  addUpdateSchema,
  updateStatusSchema,
} from './incidents.schema';
import {
  submitResolutionSchema,
  updateResolutionSchema,
  confirmResolutionSchema,
} from './resolution.schema';

export async function incidentsRoutes(app: FastifyInstance) {
  const incidentsService = new IncidentsService(prisma);
  const notificationsService = new NotificationsService(prisma);
  const incidentsController = new IncidentsController(incidentsService, notificationsService);

  // All routes require authentication
  app.addHook('preHandler', authMiddleware);

  // Get statistics for dashboard
  app.get('/statistics', incidentsController.getStats.bind(incidentsController));
  // Keep the original endpoint for backward compatibility
  app.get('/stats', incidentsController.getStats.bind(incidentsController));

  // Get bulk acknowledgments (MUST be before /:id routes)
  app.get<{ Querystring: { incidentIds: string } }>(
    '/bulk/acknowledgments',
    incidentsController.getBulkAcknowledgments.bind(incidentsController)
  );

  // List incidents
  app.get<{ Querystring: IncidentListQuery }>(
    '/',
    {
      preHandler: [validate(incidentListQuerySchema, 'query')],
    },
    incidentsController.getIncidents.bind(incidentsController)
  );

  // Get incident by ID
  app.get('/:id', incidentsController.getIncidentById.bind(incidentsController));

  // Create incident
  app.post<{ Body: CreateIncidentDTO }>(
    '/',
    {
      preHandler: [validate(createIncidentSchema)],
    },
    incidentsController.createIncident.bind(incidentsController)
  );

  // Update incident
  app.put<{ Params: { id: string }; Body: UpdateIncidentDTO }>(
    '/:id',
    {
      preHandler: [validate(updateIncidentSchema)],
    },
    incidentsController.updateIncident.bind(incidentsController)
  );

  // Update incident status
  app.patch<{ Params: { id: string }; Body: UpdateIncidentStatusDTO }>(
    '/:id/status',
    {
      preHandler: [validate(updateStatusSchema)],
    },
    incidentsController.updateStatus.bind(incidentsController)
  );

  // Assign personnel
  app.post<{ Params: { id: string }; Body: AssignPersonnelDTO }>(
    '/:id/assign',
    {
      preHandler: [requireRole('ADMIN', 'SUPER_ADMIN'), validate(assignPersonnelSchema)],
    },
    incidentsController.assignPersonnel.bind(incidentsController)
  );

  // Add update/comment
  app.post<{ Params: { id: string }; Body: AddIncidentUpdateDTO }>(
    '/:id/updates',
    {
      preHandler: [validate(addUpdateSchema)],
    },
    incidentsController.addUpdate.bind(incidentsController)
  );

  // Delete incident (admin only)
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireRole('ADMIN', 'SUPER_ADMIN')],
    },
    incidentsController.deleteIncident.bind(incidentsController)
  );

  // Acknowledge incident (personnel only)
  app.post<{ Params: { id: string }; Body: { personnelId: string } }>(
    '/:id/acknowledge',
    incidentsController.acknowledgeIncident.bind(incidentsController)
  );

  // Get incident acknowledgments
  app.get<{ Params: { id: string } }>(
    '/:id/acknowledgments',
    incidentsController.getIncidentAcknowledgments.bind(incidentsController)
  );

  // NEW: Verify incident (admin only)
  app.post<{ Params: { id: string }; Body: { priority?: IncidentPriority; notes?: string } }>(
    '/:id/verify',
    {
      preHandler: [requireRole('ADMIN', 'SUPER_ADMIN')],
    },
    incidentsController.verifyIncident.bind(incidentsController)
  );

  // NEW: Resolve incident (admin only)
  app.post<{ Params: { id: string }; Body: { resolutionNotes: string } }>(
    '/:id/resolve',
    {
      preHandler: [requireRole('ADMIN', 'SUPER_ADMIN')],
    },
    incidentsController.resolveIncident.bind(incidentsController)
  );

  // NEW: Get responders for incident
  app.get<{ Params: { id: string } }>(
    '/:id/responders',
    incidentsController.getResponders.bind(incidentsController)
  );

  // NEW: Get timeline for incident
  app.get<{ Params: { id: string } }>(
    '/:id/timeline',
    incidentsController.getTimeline.bind(incidentsController)
  );

  // NEW: Join incident response (Personnel self-assignment)
  app.post<{ Params: { id: string }; Body: { personnelId: string } }>(
    '/:id/join-response',
    incidentsController.joinIncidentResponse.bind(incidentsController)
  );

  // NEW: Leave incident response (Personnel self-unassignment)
  app.post<{ Params: { id: string }; Body: { personnelId: string } }>(
    '/:id/leave-response',
    incidentsController.leaveIncidentResponse.bind(incidentsController)
  );

  // RESOLUTION ENDPOINTS
  
  // Submit resolution (Personnel)
  app.post<{ Params: { id: string }; Body: SubmitResolutionDTO }>(
    '/:id/submit-resolution',
    {
      preHandler: [validate(submitResolutionSchema)],
    },
    incidentsController.submitResolution.bind(incidentsController)
  );

  // Get resolution
  app.get<{ Params: { id: string } }>(
    '/:id/resolution',
    incidentsController.getResolution.bind(incidentsController)
  );

  // Update resolution (Admin only)
  app.patch<{ Params: { id: string }; Body: UpdateResolutionDTO }>(
    '/:id/resolution',
    {
      preHandler: [requireRole('ADMIN', 'SUPER_ADMIN'), validate(updateResolutionSchema)],
    },
    incidentsController.updateResolution.bind(incidentsController)
  );

  // Confirm resolution (Admin only)
  app.post<{ Params: { id: string }; Body: ConfirmResolutionDTO }>(
    '/:id/confirm-resolution',
    {
      preHandler: [requireRole('ADMIN', 'SUPER_ADMIN'), validate(confirmResolutionSchema)],
    },
    incidentsController.confirmResolution.bind(incidentsController)
  );
}
