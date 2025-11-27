import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitService } from './rate-limit.service';
import { SuccessResponse } from '../../types';

export class RateLimitController {
  constructor(private rateLimitService: RateLimitService) {}

  async getRateLimitStatus(request: FastifyRequest, reply: FastifyReply) {
    const ip = request.ip;
    const status = await this.rateLimitService.getRateLimitStatus(ip);

    const response: SuccessResponse = {
      success: true,
      data: status,
    };

    return reply.status(200).send(response);
  }

  async getRateLimitTiers(request: FastifyRequest, reply: FastifyReply) {
    const tiers = this.rateLimitService.getRateLimitTiers();

    const response: SuccessResponse = {
      success: true,
      data: tiers,
    };

    return reply.status(200).send(response);
  }

  async getRateLimitStatistics(request: FastifyRequest, reply: FastifyReply) {
    const statistics = this.rateLimitService.getStatistics();

    const response: SuccessResponse = {
      success: true,
      data: statistics,
    };

    return reply.status(200).send(response);
  }
}
