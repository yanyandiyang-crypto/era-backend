import { FastifyRequest, FastifyReply } from 'fastify';
import { DashboardService } from './dashboard.service';
import { TimeRangeQuery } from './dashboard.types';
import { SuccessResponse } from '../../types';

export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  async getOverview(request: FastifyRequest, reply: FastifyReply) {
    const overview = await this.dashboardService.getOverview();

    const response: SuccessResponse = {
      success: true,
      data: overview,
    };

    return reply.status(200).send(response);
  }

  async getIncidentTrends(
    request: FastifyRequest<{ Querystring: TimeRangeQuery }>,
    reply: FastifyReply
  ) {
    const trends = await this.dashboardService.getIncidentTrends(request.query);

    const response: SuccessResponse = {
      success: true,
      data: trends,
    };

    return reply.status(200).send(response);
  }

  async getHeatMap(request: FastifyRequest, reply: FastifyReply) {
    const heatmap = await this.dashboardService.getHeatMapData();

    const response: SuccessResponse = {
      success: true,
      data: heatmap,
    };

    return reply.status(200).send(response);
  }

  async getTopBarangays(request: FastifyRequest, reply: FastifyReply) {
    const barangays = await this.dashboardService.getTopBarangays();

    const response: SuccessResponse = {
      success: true,
      data: barangays,
    };

    return reply.status(200).send(response);
  }

  async getTopPersonnel(request: FastifyRequest, reply: FastifyReply) {
    const personnel = await this.dashboardService.getTopPersonnel();

    const response: SuccessResponse = {
      success: true,
      data: personnel,
    };

    return reply.status(200).send(response);
  }

  async getRecentActivity(request: FastifyRequest, reply: FastifyReply) {
    const activity = await this.dashboardService.getRecentActivity();

    const response: SuccessResponse = {
      success: true,
      data: activity,
    };

    return reply.status(200).send(response);
  }

  async getPerformanceMetrics(request: FastifyRequest, reply: FastifyReply) {
    const metrics = await this.dashboardService.getPerformanceMetrics();

    const response: SuccessResponse = {
      success: true,
      data: metrics,
    };

    return reply.status(200).send(response);
  }
}
