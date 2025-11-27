import { FastifyRequest, FastifyReply } from 'fastify';
import { IncidentsService } from './incidents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TimelineService } from './timeline.service';
import {
    CreateIncidentDTO,
    UpdateIncidentDTO,
    IncidentListQuery,
    AssignPersonnelDTO,
    AddIncidentUpdateDTO,
    UpdateIncidentStatusDTO,
    AcknowledgeIncidentDTO,
} from './incidents.types';
import { IncidentPriority } from '@prisma/client';
import { SubmitResolutionDTO, ConfirmResolutionDTO, UpdateResolutionDTO } from './resolution.types';
import { SuccessResponse } from '../../types';

export class IncidentsController {
    constructor(
        private incidentsService: IncidentsService,
        private notificationsService: NotificationsService
    ) { }

    async createIncident(
        request: FastifyRequest<{ Body: CreateIncidentDTO }>,
        reply: FastifyReply
    ) {
        const userId = request.user!.userId;
        const incident = await this.incidentsService.createIncident(request.body, userId);

        // Automatically notify available personnel of new incident
        try {
            await this.notificationsService.notifyAvailablePersonnelOfIncident(incident.id);
        } catch (error) {
            // Log error but don't fail the incident creation
            // console.error('Failed to notify personnel of new incident:', error);
        }

        // Emit WebSocket event
        console.log('🆕 INCIDENT CREATED - DEBUG:');
        console.log('  - Incident ID:', incident.id);
        console.log('  - Incident Number:', incident.incidentNumber);
        console.log('  - Socket.IO available:', !!request.server.io);

        if (request.server.io) {
            console.log('  - Emitting incident:created event...');
            request.server.io.emit('incident:created', incident);
            console.log('✅ WebSocket event emitted');
        }

        const response: SuccessResponse = {
            success: true,
            data: incident,
            message: 'Incident created successfully',
        };

        return reply.status(201).send(response);
    }

    async getIncidents(
        request: FastifyRequest<{ Querystring: IncidentListQuery }>,
        reply: FastifyReply
    ) {
        const result = await this.incidentsService.getIncidents(request.query);

        const response: SuccessResponse = {
            success: true,
            data: result,
        };

        return reply.status(200).send(response);
    }

    async getIncidentById(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        const incident = await this.incidentsService.getIncidentById(request.params.id);

        const response: SuccessResponse = {
            success: true,
            data: incident,
        };

        return reply.status(200).send(response);
    }

    async updateIncident(
        request: FastifyRequest<{ Params: { id: string }; Body: UpdateIncidentDTO }>,
        reply: FastifyReply
    ) {
        const userId = request.user!.userId;
        const incident = await this.incidentsService.updateIncident(
            request.params.id,
            request.body,
            userId
        );

        // Emit WebSocket event
        if (request.server.io) {
            request.server.io.emit('incident:updated', incident);
        }

        const response: SuccessResponse = {
            success: true,
            data: incident,
            message: 'Incident updated successfully',
        };

        return reply.status(200).send(response);
    }

    async updateStatus(
        request: FastifyRequest<{ Params: { id: string }; Body: UpdateIncidentStatusDTO }>,
        reply: FastifyReply
    ) {
        const userId = request.user!.userId;
        const incident = await this.incidentsService.updateStatus(
            request.params.id,
            request.body,
            userId
        );

        // Emit WebSocket event
        if (request.server.io) {
            request.server.io.emit('incident:status-changed', {
                id: incident.id,
                status: incident.status,
                incidentNumber: incident.incidentNumber,
            });
        }

        const response: SuccessResponse = {
            success: true,
            data: incident,
            message: 'Incident status updated successfully',
        };

        return reply.status(200).send(response);
    }

    async assignPersonnel(
        request: FastifyRequest<{ Params: { id: string }; Body: AssignPersonnelDTO }>,
        reply: FastifyReply
    ) {
        const userId = request.user!.userId;
        const result = await this.incidentsService.assignPersonnel(
            request.params.id,
            request.body,
            userId
        );

        // Emit WebSocket event
        if (request.server.io) {
            request.server.io.emit('incident:personnel-assigned', {
                incidentId: request.params.id,
                personnelIds: request.body.personnelIds,
            });
        }

        const response: SuccessResponse = {
            success: true,
            data: result,
            message: 'Personnel assigned successfully',
        };

        return reply.status(200).send(response);
    }

    async addUpdate(
        request: FastifyRequest<{ Params: { id: string }; Body: AddIncidentUpdateDTO }>,
        reply: FastifyReply
    ) {
        const userId = request.user!.userId;
        const update = await this.incidentsService.addUpdate(
            request.params.id,
            request.body,
            userId
        );

        // Emit WebSocket event
        if (request.server.io) {
            request.server.io.emit('incident:update-added', {
                incidentId: request.params.id,
                update,
            });
        }

        const response: SuccessResponse = {
            success: true,
            data: update,
            message: 'Update added successfully',
        };

        return reply.status(201).send(response);
    }

    async deleteIncident(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        await this.incidentsService.deleteIncident(request.params.id);

        // Emit WebSocket event
        if (request.server.io) {
            request.server.io.emit('incident:deleted', { id: request.params.id });
        }

        const response: SuccessResponse = {
            success: true,
            data: null,
            message: 'Incident deleted successfully',
        };

        return reply.status(200).send(response);
    }

    async getStats(request: FastifyRequest, reply: FastifyReply) {
        const stats = await this.incidentsService.getIncidentStats();

        const response: SuccessResponse = {
            success: true,
            data: stats,
        };

        return reply.status(200).send(response);
    }

    async acknowledgeIncident(
        request: FastifyRequest<{ Params: { id: string }; Body: AcknowledgeIncidentDTO }>,
        reply: FastifyReply
    ) {
        const result = await this.incidentsService.acknowledgeIncident(
            request.params.id,
            request.body.personnelId
        );

        // Emit WebSocket event for real-time updates
        if (request.server.io) {
            const ackStats = await this.incidentsService.getIncidentAcknowledgments(request.params.id);
            request.server.io.emit('incident:acknowledged', {
                incidentId: request.params.id,
                personnelId: request.body.personnelId,
                acknowledgedCount: ackStats.acknowledgedCount,
                totalPersonnelNotified: ackStats.totalPersonnelNotified,
                acknowledgmentPercentage: ackStats.acknowledgmentPercentage,
            });
        }

        const response: SuccessResponse = {
            success: true,
            data: result,
            message: 'Incident acknowledged successfully',
        };

        return reply.status(200).send(response);
    }

    async getIncidentAcknowledgments(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        const result = await this.incidentsService.getIncidentAcknowledgments(request.params.id);

        const response: SuccessResponse = {
            success: true,
            data: result,
        };

        return reply.status(200).send(response);
    }

    async getBulkAcknowledgments(
        request: FastifyRequest<{ Querystring: { incidentIds: string } }>,
        reply: FastifyReply
    ) {
        const incidentIds = request.query.incidentIds.split(',');
        const result = await this.incidentsService.getBulkIncidentAcknowledgments(incidentIds);

        const response: SuccessResponse = {
            success: true,
            data: result,
        };

        return reply.status(200).send(response);
    }

    /**
     * Verify an incident (Admin only)
     * POST /incidents/:id/verify
     */
    async verifyIncident(
        request: FastifyRequest<{
            Params: { id: string };
            Body: { priority?: IncidentPriority; notes?: string }
        }>,
        reply: FastifyReply
    ) {
        console.log('🚨🚨🚨 VERIFY INCIDENT CALLED - ID:', request.params.id);
        const userId = request.user!.userId;
        const { priority, notes } = request.body || {};

        const incident = await this.incidentsService.verifyIncident(
            request.params.id,
            userId,
            priority,
            notes
        );

        console.log('✅ Incident verified:', incident.incidentNumber);

        // Emit WebSocket event to personnel room
        if (request.server.io) {
            const payload = {
                incident,
                timestamp: new Date().toISOString(),
            };

            request.log.info(`📡 Emitting incident:verified to personnel room for incident ${incident.incidentNumber}`);
            request.server.io.to('personnel').emit('incident:verified', payload);

            // Also emit push notification event (for in-app notifications)
            const pushNotification = {
                title: `🚨 VERIFIED: ${incident.incidentNumber}`,
                message: `${incident.type} at ${incident.address}. Priority: ${incident.priority}. Respond immediately!`,
                type: 'alert',
                targets: ['personnel'],
                incidentId: incident.id,
                priority: incident.priority,
            };

            console.log('🔔 === PUSH NOTIFICATION DEBUG ===');
            console.log('Event:', 'notification:new');
            console.log('Room:', 'personnel');
            console.log('Payload:', JSON.stringify(pushNotification, null, 2));
            console.log('Socket.IO instance:', !!request.server.io);
            console.log('Connected clients:', request.server.io.sockets.sockets.size);
            console.log('Personnel room size:', request.server.io.sockets.adapter.rooms.get('personnel')?.size || 0);

            request.log.info(`🔔 Emitting notification:new to personnel for incident ${incident.incidentNumber}`);
            request.server.io.to('personnel').emit('notification:new', pushNotification);

            console.log('✅ notification:new emitted');

            // Also emit to specific incident room if anyone is watching
            request.server.io.to(`incident:${incident.id}`).emit('incident:updated', incident);
        } else {
            console.log('❌ Socket.IO NOT AVAILABLE');
            request.log.warn('⚠️ WebSocket server not available for incident:verified emission');
        }

        const response: SuccessResponse = {
            success: true,
            message: 'Incident verified successfully',
            data: incident,
        };

        return reply.status(200).send(response);
    }

    /**
     * Resolve an incident (Admin only)
     * POST /incidents/:id/resolve
     */
    async resolveIncident(
        request: FastifyRequest<{
            Params: { id: string };
            Body: { resolutionNotes: string }
        }>,
        reply: FastifyReply
    ) {
        const userId = request.user!.userId;
        const { resolutionNotes } = request.body;

        const incident = await this.incidentsService.resolveIncident(
            request.params.id,
            userId,
            resolutionNotes
        );

        // Emit WebSocket event
        if (request.server.io) {
            request.server.io.emit('incident:resolved', {
                incidentId: incident.incidentId,
                incident,
            });
        }

        const response: SuccessResponse = {
            success: true,
            message: 'Incident resolved successfully',
            data: incident,
        };

        return reply.status(200).send(response);
    }

    /**
     * Get responders for an incident
     * GET /incidents/:id/responders
     */
    async getResponders(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        const responders = await this.incidentsService.getResponders(
            request.params.id
        );

        const response: SuccessResponse = {
            success: true,
            data: responders,
        };

        return reply.status(200).send(response);
    }

    /**
     * Get timeline for an incident
     * GET /incidents/:id/timeline
     */
    async getTimeline(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        const timelineService = new TimelineService(this.incidentsService['prisma']);

        const timeline = await timelineService.getTimeline(request.params.id);

        const response: SuccessResponse = {
            success: true,
            data: timeline,
        };

        return reply.status(200).send(response);
    }

    /**
     * Join incident response (Personnel self-assignment)
     * POST /incidents/:id/join-response
     */
    async joinIncidentResponse(
        request: FastifyRequest<{ Params: { id: string }; Body: { personnelId: string } }>,
        reply: FastifyReply
    ) {
        const { id } = request.params;
        const { personnelId } = request.body;

        const result = await this.incidentsService.joinIncidentResponse(id, personnelId);

        // Emit WebSocket event for real-time updates
        if (request.server.io) {
            request.server.io.emit('incident:responder-joined', {
                incidentId: id,
                personnelId,
                totalResponders: result.totalResponders,
                isPrimaryResponder: result.isPrimaryResponder,
            });
        }

        const response: SuccessResponse = {
            success: true,
            data: result,
            message: result.isPrimaryResponder ? 'Started incident response' : 'Joined incident response',
        };

        return reply.status(200).send(response);
    }

    /**
     * Leave incident response (Personnel self-unassignment)
     * POST /incidents/:id/leave-response
     */
    async leaveIncidentResponse(
        request: FastifyRequest<{ Params: { id: string }; Body: { personnelId: string } }>,
        reply: FastifyReply
    ) {
        const { id } = request.params;
        const { personnelId } = request.body;

        const result = await this.incidentsService.leaveIncidentResponse(id, personnelId);

        // Emit WebSocket event
        if (request.server.io) {
            request.server.io.emit('incident:responder-left', {
                incidentId: id,
                personnelId,
            });
        }

        const response: SuccessResponse = {
            success: true,
            data: result,
            message: 'Left incident response successfully',
        };

        return reply.status(200).send(response);
    }

    /**
     * Submit incident resolution (Personnel)
     * POST /incidents/:id/submit-resolution
     */
    async submitResolution(
        request: FastifyRequest<{ Params: { id: string }; Body: SubmitResolutionDTO }>,
        reply: FastifyReply
    ) {
        const { id } = request.params;

        const resolution = await this.incidentsService.submitResolution(id, request.body);

        // Emit WebSocket event
        if (request.server.io) {
            request.server.io.emit('incident:resolution-submitted', {
                incidentId: id,
                personnelId: request.body.personnelId,
            });
        }

        const response: SuccessResponse = {
            success: true,
            data: resolution,
            message: 'Resolution submitted successfully - awaiting admin confirmation',
        };

        return reply.status(201).send(response);
    }

    /**
     * Get incident resolution
     * GET /incidents/:id/resolution
     */
    async getResolution(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        const { id } = request.params;

        const resolution = await this.incidentsService.getResolution(id);

        const response: SuccessResponse = {
            success: true,
            data: resolution,
        };

        return reply.status(200).send(response);
    }

    /**
     * Update incident resolution (Admin)
     * PATCH /incidents/:id/resolution
     */
    async updateResolution(
        request: FastifyRequest<{ Params: { id: string }; Body: UpdateResolutionDTO }>,
        reply: FastifyReply
    ) {
        const { id } = request.params;

        const resolution = await this.incidentsService.updateResolution(id, request.body);

        const response: SuccessResponse = {
            success: true,
            data: resolution,
            message: 'Resolution updated successfully',
        };

        return reply.status(200).send(response);
    }

    /**
     * Confirm incident resolution (Admin)
     * POST /incidents/:id/confirm-resolution
     */
    async confirmResolution(
        request: FastifyRequest<{ Params: { id: string }; Body: ConfirmResolutionDTO }>,
        reply: FastifyReply
    ) {
        const { id } = request.params;
        const userId = request.user!.userId;

        const resolution = await this.incidentsService.confirmResolution(id, userId, request.body);

        // Emit WebSocket event
        if (request.server.io) {
            request.server.io.emit('incident:resolved', {
                incidentId: id,
                resolvedBy: userId,
            });
        }

        const response: SuccessResponse = {
            success: true,
            data: resolution,
            message: 'Incident resolved successfully',
        };

        return reply.status(200).send(response);
    }
}