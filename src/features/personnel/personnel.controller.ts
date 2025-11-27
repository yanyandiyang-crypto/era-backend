import { FastifyRequest, FastifyReply } from 'fastify';
import { PersonnelService } from './personnel.service';
import {
  CreatePersonnelDTO,
  UpdatePersonnelDTO,
  PersonnelListQuery,
  UpdatePersonnelLocationDTO,
} from './personnel.types';
import { ChangePasswordDTO } from '../auth/auth.types';
import { SuccessResponse } from '../../types';

import { NotificationsService } from '../notifications/notifications.service';

export class PersonnelController {
  constructor(
    private personnelService: PersonnelService,
    private notificationsService: NotificationsService
  ) { }

  // ========================================
  // MOBILE APP AUTH METHODS
  // ========================================

  async login(
    request: FastifyRequest<{ Body: { emailOrPhone?: string; employeeId?: string; password: string } }>,
    reply: FastifyReply
  ) {
    const { emailOrPhone, employeeId, password } = request.body;
    // Support both emailOrPhone (mobile) and employeeId (direct)
    const identifier = emailOrPhone || employeeId;

    if (!identifier) {
      return reply.status(400).send({
        success: false,
        message: 'Email, phone, or employee ID is required',
      });
    }

    const result = await this.personnelService.login(identifier, password);

    const response: SuccessResponse = {
      success: true,
      data: result,
      message: 'Login successful',
    };

    return reply.status(200).send(response);
  }

  async refreshToken(
    request: FastifyRequest<{ Body: { refreshToken: string } }>,
    reply: FastifyReply
  ) {
    const { refreshToken } = request.body;
    const result = await this.personnelService.refreshToken(refreshToken);

    const response: SuccessResponse = {
      success: true,
      data: result,
      message: 'Token refreshed successfully',
    };

    return reply.status(200).send(response);
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    // Token is already invalidated by middleware if needed
    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'Logout successful',
    };

    return reply.status(200).send(response);
  }

  async changePassword(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    // Extract personnel ID from JWT token (supports both userId and id claims)
    const personnelId = (request.user as any)?.userId || (request.user as any)?.id;

    if (!personnelId) {
      return reply.status(401).send({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { currentPassword, newPassword } = request.body as ChangePasswordDTO;
    await this.personnelService.changePassword(personnelId, currentPassword, newPassword);

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'Password changed successfully',
    };

    return reply.status(200).send(response);
  }

  // ========================================
  // MOBILE APP METHODS
  // ========================================

  async getProfile(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const personnel = await this.personnelService.getPersonnelById(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: personnel,
    };

    return reply.status(200).send(response);
  }

  async updateStatus(
    request: FastifyRequest<{ Params: { id: string }; Body: { status: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const { status } = request.body;

    const personnel = await this.personnelService.updatePersonnelStatus(id, status);

    // Emit WebSocket event for real-time map updates
    if (request.server.io) {
      request.server.io.emit('personnel:status', {
        personnelId: id,
        status: status,
      });
    }

    const response: SuccessResponse = {
      success: true,
      data: personnel,
      message: 'Status updated successfully',
    };

    return reply.status(200).send(response);
  }

  async uploadPhoto(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const photoUrl = await this.personnelService.uploadPersonnelPhoto(id, request);

    const response: SuccessResponse = {
      success: true,
      data: { url: photoUrl },
      message: 'Photo uploaded successfully',
    };

    return reply.status(200).send(response);
  }

  async getAssignedIncidents(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const incidents = await this.personnelService.getAssignedIncidents(id);

    const response: SuccessResponse = {
      success: true,
      data: incidents,
    };

    return reply.status(200).send(response);
  }

  async getIncidentHistory(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const incidents = await this.personnelService.getIncidentHistory(id);

    const response: SuccessResponse = {
      success: true,
      data: incidents,
    };

    return reply.status(200).send(response);
  }

  // ========================================
  // ADMIN METHODS
  // ========================================

  async createPersonnel(
    request: FastifyRequest<{ Body: CreatePersonnelDTO }>,
    reply: FastifyReply
  ) {
    const personnel = await this.personnelService.createPersonnel(request.body);

    const response: SuccessResponse = {
      success: true,
      data: personnel,
      message: 'Personnel created successfully',
    };

    return reply.status(201).send(response);
  }

  async getPersonnel(
    request: FastifyRequest<{ Querystring: PersonnelListQuery }>,
    reply: FastifyReply
  ) {
    const result = await this.personnelService.getPersonnel(request.query);

    const response: SuccessResponse = {
      success: true,
      data: result,
    };

    return reply.status(200).send(response);
  }

  async getPersonnelById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const personnel = await this.personnelService.getPersonnelById(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: personnel,
    };

    return reply.status(200).send(response);
  }

  async updatePersonnel(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdatePersonnelDTO }>,
    reply: FastifyReply
  ) {
    const personnel = await this.personnelService.updatePersonnel(
      request.params.id,
      request.body
    );

    const response: SuccessResponse = {
      success: true,
      data: personnel,
      message: 'Personnel updated successfully',
    };

    return reply.status(200).send(response);
  }

  async updateOwnProfile(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdatePersonnelDTO }>,
    reply: FastifyReply
  ) {
    // Extract personnel ID from JWT token
    const personnelId = (request.user as any)?.userId || (request.user as any)?.id;

    if (!personnelId) {
      return reply.status(401).send({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Ensure personnel can only update their own profile
    if (personnelId !== request.params.id) {
      return reply.status(403).send({
        success: false,
        message: 'You can only update your own profile',
      });
    }

    // Filter out fields that personnel shouldn't be able to update themselves
    const allowedFields: (keyof UpdatePersonnelDTO)[] = [
      'firstName',
      'lastName',
      'phone',
      'dateOfBirth',
      'bloodType',
      'address',
      'emergencyContact'
    ];

    const filteredUpdate: Partial<UpdatePersonnelDTO> = {};
    for (const field of allowedFields) {
      if (request.body[field] !== undefined) {
        (filteredUpdate as any)[field] = request.body[field];
      }
    }

    const personnel = await this.personnelService.updatePersonnel(
      request.params.id,
      filteredUpdate
    );

    const response: SuccessResponse = {
      success: true,
      data: personnel,
      message: 'Profile updated successfully',
    };

    return reply.status(200).send(response);
  }

  async suspendPersonnel(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const personnel = await this.personnelService.suspendPersonnel(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: personnel,
      message: 'Personnel suspended successfully',
    };

    return reply.status(200).send(response);
  }

  async activatePersonnel(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const personnel = await this.personnelService.activatePersonnel(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: personnel,
      message: 'Personnel activated successfully',
    };

    return reply.status(200).send(response);
  }

  async deletePersonnel(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    await this.personnelService.deletePersonnel(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'Personnel deleted successfully',
    };

    return reply.status(200).send(response);
  }

  async updateLocation(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdatePersonnelLocationDTO }>,
    reply: FastifyReply
  ) {
    const location = await this.personnelService.updateLocation(
      request.params.id,
      request.body
    );

    const response: SuccessResponse = {
      success: true,
      data: location,
      message: 'Location updated successfully',
    };

    return reply.status(200).send(response);
  }

  async getLocation(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const location = await this.personnelService.getPersonnelLocation(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: location,
    };

    return reply.status(200).send(response);
  }

  async getLocationHistory(
    request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string } }>,
    reply: FastifyReply
  ) {
    const limit = request.query.limit ? parseInt(request.query.limit) : 10;
    const locations = await this.personnelService.getPersonnelLocationHistory(
      request.params.id,
      limit
    );

    const response: SuccessResponse = {
      success: true,
      data: locations,
    };

    return reply.status(200).send(response);
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.personnelService.getPersonnelStats();

    const response: SuccessResponse = {
      success: true,
      data: stats,
    };

    return reply.status(200).send(response);
  }

  async getAssignmentHistory(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const history = await this.personnelService.getAssignmentHistory(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: history,
    };

    return reply.status(200).send(response);
  }

  async resetPassword(
    request: FastifyRequest<{ Params: { id: string }; Body: { newPassword: string } }>,
    reply: FastifyReply
  ) {
    const { id } = request.params;
    const { newPassword } = request.body;

    await this.personnelService.resetPassword(id, newPassword);

    const response: SuccessResponse = {
      success: true,
      data: { message: 'Password reset successfully' },
      message: 'Password reset successfully',
    };

    return reply.status(200).send(response);
  }

  async broadcastAlert(
    request: FastifyRequest<{ Body: { title: string; message: string; location: string } }>,
    reply: FastifyReply
  ) {
    const { title, message, location } = request.body;

    await this.notificationsService.sendEmergencyAlert(title, message, location);

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'Alert broadcasted successfully',
    };

    return reply.status(200).send(response);
  }
}
