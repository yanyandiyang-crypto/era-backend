import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from './audit.service';
import { AuditLogQuery } from './audit.types';
import { SuccessResponse } from '../../types';
import { NotFoundError } from '../../core/errors';

export class AuditController {
  constructor(private auditService: AuditService) {}

  async getLogs(
    request: FastifyRequest<{ Querystring: AuditLogQuery }>,
    reply: FastifyReply
  ) {
    const result = await this.auditService.getLogs(request.query);

    const response: SuccessResponse = {
      success: true,
      data: result,
    };

    return reply.status(200).send(response);
  }

  async getLogById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const log = await this.auditService.getLogById(request.params.id);

    if (!log) {
      throw new NotFoundError('Audit log not found');
    }

    const response: SuccessResponse = {
      success: true,
      data: log,
    };

    return reply.status(200).send(response);
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.auditService.getStats();

    const response: SuccessResponse = {
      success: true,
      data: stats,
    };

    return reply.status(200).send(response);
  }

  async getUserActivity(
    request: FastifyRequest<{ Params: { userId: string }; Querystring: { days?: string } }>,
    reply: FastifyReply
  ) {
    const days = request.query.days ? parseInt(request.query.days) : 30;
    const activity = await this.auditService.getUserActivity(request.params.userId, days);

    const response: SuccessResponse = {
      success: true,
      data: activity,
    };

    return reply.status(200).send(response);
  }

  async getResourceActivity(
    request: FastifyRequest<{ Params: { resourceType: string; resourceId: string } }>,
    reply: FastifyReply
  ) {
    const { resourceType, resourceId } = request.params;
    const activity = await this.auditService.getResourceActivity(resourceType, resourceId);

    const response: SuccessResponse = {
      success: true,
      data: activity,
    };

    return reply.status(200).send(response);
  }

  async getSecurityEvents(
    request: FastifyRequest<{ Querystring: { days?: string } }>,
    reply: FastifyReply
  ) {
    const days = request.query.days ? parseInt(request.query.days) : 7;
    const events = await this.auditService.getSecurityEvents(days);

    const response: SuccessResponse = {
      success: true,
      data: events,
    };

    return reply.status(200).send(response);
  }
}
