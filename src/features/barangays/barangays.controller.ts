import { FastifyRequest, FastifyReply } from 'fastify';
import { BarangaysService } from './barangays.service';
import {
  CreateBarangayDTO,
  UpdateBarangayDTO,
  BarangayListQuery,
  NearbyQuery,
} from './barangays.types';
import { SuccessResponse } from '../../types';

export class BarangaysController {
  constructor(private barangaysService: BarangaysService) {}

  async createBarangay(
    request: FastifyRequest<{ Body: CreateBarangayDTO }>,
    reply: FastifyReply
  ) {
    const barangay = await this.barangaysService.createBarangay(request.body);

    const response: SuccessResponse = {
      success: true,
      data: barangay,
      message: 'Barangay created successfully',
    };

    return reply.status(201).send(response);
  }

  async getBarangays(
    request: FastifyRequest<{ Querystring: BarangayListQuery }>,
    reply: FastifyReply
  ) {
    const result = await this.barangaysService.getBarangays(request.query);

    const response: SuccessResponse = {
      success: true,
      data: result,
    };

    return reply.status(200).send(response);
  }

  async getBarangayById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const barangay = await this.barangaysService.getBarangayById(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: barangay,
    };

    return reply.status(200).send(response);
  }

  async updateBarangay(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateBarangayDTO }>,
    reply: FastifyReply
  ) {
    const barangay = await this.barangaysService.updateBarangay(
      request.params.id,
      request.body
    );

    const response: SuccessResponse = {
      success: true,
      data: barangay,
      message: 'Barangay updated successfully',
    };

    return reply.status(200).send(response);
  }

  async deleteBarangay(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    await this.barangaysService.deleteBarangay(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'Barangay deleted successfully',
    };

    return reply.status(200).send(response);
  }

  async getNearby(
    request: FastifyRequest<{ Querystring: NearbyQuery }>,
    reply: FastifyReply
  ) {
    const barangays = await this.barangaysService.getNearbyBarangays(request.query);

    const response: SuccessResponse = {
      success: true,
      data: barangays,
    };

    return reply.status(200).send(response);
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.barangaysService.getBarangayStats();

    const response: SuccessResponse = {
      success: true,
      data: stats,
    };

    return reply.status(200).send(response);
  }
}
