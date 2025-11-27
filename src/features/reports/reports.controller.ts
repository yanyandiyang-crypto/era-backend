import { FastifyRequest, FastifyReply } from 'fastify';
import { ReportsService } from './reports.service';
import { GenerateReportDTO } from './reports.types';

export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  async generateReport(
    request: FastifyRequest<{ Body: GenerateReportDTO }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.userId;
    const { stream, filename } = await this.reportsService.generateReport(
      request.body,
      userId
    );

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async generateIncidentReport(
    request: FastifyRequest<{ Params: { id: string }; Querystring: { includePhotos?: string; includeTimeline?: string } }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.userId;
    const { stream, filename } = await this.reportsService.generateReport(
      {
        type: 'INCIDENT_REPORT' as any,
        incidentId: request.params.id,
        includePhotos: request.query.includePhotos === 'true',
        includeTimeline: request.query.includeTimeline === 'true',
      },
      userId
    );

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async generateIncidentSummary(
    request: FastifyRequest<{ Querystring: { fromDate?: string; toDate?: string; includeStatistics?: string } }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.userId;
    const { stream, filename } = await this.reportsService.generateReport(
      {
        type: 'INCIDENT_SUMMARY' as any,
        fromDate: request.query.fromDate,
        toDate: request.query.toDate,
        includeStatistics: request.query.includeStatistics === 'true',
      },
      userId
    );

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async generatePersonnelReport(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.userId;
    const { stream, filename } = await this.reportsService.generateReport(
      {
        type: 'PERSONNEL_REPORT' as any,
      },
      userId
    );

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async generateBarangayReport(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.userId;
    const { stream, filename } = await this.reportsService.generateReport(
      {
        type: 'BARANGAY_REPORT' as any,
      },
      userId
    );

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async generateStatisticsReport(
    request: FastifyRequest<{ Querystring: { fromDate?: string; toDate?: string } }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.userId;
    const { stream, filename } = await this.reportsService.generateReport(
      {
        type: 'STATISTICS_REPORT' as any,
        fromDate: request.query.fromDate,
        toDate: request.query.toDate,
      },
      userId
    );

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async generateActivityReport(
    request: FastifyRequest<{ Querystring: { fromDate?: string; toDate?: string } }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.userId;
    const { stream, filename } = await this.reportsService.generateReport(
      {
        type: 'ACTIVITY_REPORT' as any,
        fromDate: request.query.fromDate,
        toDate: request.query.toDate,
      },
      userId
    );

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async generateExcelReport(
    request: FastifyRequest<{ Body: GenerateReportDTO }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.userId;
    const { stream, filename } = await this.reportsService.generateExcelReport(
      request.body,
      userId
    );

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async generateIncidentSummaryExcel(
    request: FastifyRequest<{ Querystring: { fromDate?: string; toDate?: string; includeStatistics?: string; status?: string; priority?: string; type?: string; barangayId?: string; search?: string; hasPhotos?: string; hasAssignedPersonnel?: string; sortBy?: string; sortOrder?: string } }>,
    reply: FastifyReply
  ) {
    // console.log('[CONTROLLER] Excel export request received');
    // console.log('[CONTROLLER] Query params:', request.query);
    const userId = request.user!.userId;

    // Parse comma-separated filter values
    const status = request.query.status ? request.query.status.split(',') : undefined;
    const priority = request.query.priority ? request.query.priority.split(',') : undefined;
    const incidentTypes = request.query.type ? request.query.type.split(',') : undefined;
    const barangayIds = request.query.barangayId ? request.query.barangayId.split(',') : undefined;

    const { stream, filename } = await this.reportsService.generateExcelReport(
      {
        type: 'INCIDENT_SUMMARY' as any,
        fromDate: request.query.fromDate,
        toDate: request.query.toDate,
        includeStatistics: request.query.includeStatistics === 'true',
        // Add all filter parameters
        status,
        priority,
        incidentTypes,
        barangayId: barangayIds ? barangayIds : undefined,
        search: request.query.search,
        hasPhotosFilter: request.query.hasPhotos === 'true' ? true : request.query.hasPhotos === 'false' ? false : undefined,
        hasAssignedPersonnel: request.query.hasAssignedPersonnel === 'true' ? true : request.query.hasAssignedPersonnel === 'false' ? false : undefined,
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
      },
      userId
    );

    // console.log('[CONTROLLER] Sending Excel file:', filename);
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async generatePersonnelReportExcel(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.userId;
    const { stream, filename } = await this.reportsService.generateExcelReport(
      {
        type: 'PERSONNEL_REPORT' as any,
      },
      userId
    );

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async generateBarangayReportExcel(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.userId;
    const { stream, filename } = await this.reportsService.generateExcelReport(
      {
        type: 'BARANGAY_REPORT' as any,
      },
      userId
    );

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async generateStatisticsReportExcel(
    request: FastifyRequest<{ Querystring: { fromDate?: string; toDate?: string } }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.userId;
    const { stream, filename } = await this.reportsService.generateExcelReport(
      {
        type: 'STATISTICS_REPORT' as any,
        fromDate: request.query.fromDate,
        toDate: request.query.toDate,
      },
      userId
    );

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    
    return reply.send(stream);
  }

  async emailReport(
    request: FastifyRequest<{ Body: { email: string; reportType: string; fromDate?: string; toDate?: string } }>,
    reply: FastifyReply
  ) {
    const userId = request.user!.userId;
    const { email, reportType, fromDate, toDate } = request.body;

    try {
      await this.reportsService.emailReport(email, reportType, fromDate, toDate, userId);
      
      return reply.send({
        success: true,
        message: `Report will be sent to ${email}`
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: 'Failed to send email report'
      });
    }
  }
}
