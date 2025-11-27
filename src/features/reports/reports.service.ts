/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
import { GenerateReportDTO, ReportType } from './reports.types';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { NotFoundError } from '../../core/errors';
import * as XLSX from 'xlsx';

export class ReportsService {
  constructor(private prisma: PrismaClient) {}

  private fmtDate(d: any): string {
    if (!d) return 'N/A';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleString();
  }

  async generateReport(
    data: GenerateReportDTO,
    userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    switch (data.type) {
      case ReportType.INCIDENT_REPORT:
        return this.generateIncidentReport(data, userId);
      case ReportType.INCIDENT_SUMMARY:
        return this.generateIncidentSummary(data, userId);
      case ReportType.PERSONNEL_REPORT:
        return this.generatePersonnelReport(data, userId);
      case ReportType.BARANGAY_REPORT:
        return this.generateBarangayReport(data, userId);
      case ReportType.STATISTICS_REPORT:
        return this.generateStatisticsReport(data, userId);
      case ReportType.ACTIVITY_REPORT:
        return this.generateActivityReport(data, userId);
      default:
        throw new Error('Invalid report type');
    }
  }

  private async generateIncidentReport(
    data: GenerateReportDTO,
    _userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    if (!data.incidentId) {
      throw new Error('Incident ID is required for incident report');
    }

    const incident = await this.prisma.incident.findUnique({
      where: { id: data.incidentId },
      include: {
        barangay: true,
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignments: {
          include: {
            personnel: {
              select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        updates: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        photos: data.includePhotos
          ? {
              select: {
                filename: true,
                caption: true,
                uploadedAt: true,
              },
            }
          : false,
        resolution: {
          include: {
            submittedByPersonnel: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
              },
            },
            confirmedByAdmin: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        responders: {
          include: {
            personnel: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        timeline: {
          orderBy: {
            timestamp: 'asc',
          },
        },
        verifiedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        resolvedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        primaryResponder: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        publicSession: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    const doc = new PDFDocument({ margin: 50 });
    const stream = new Readable();
    stream._read = () => {};

    // Local alias for the class date formatter
    const fmt = this.fmtDate.bind(this);

    doc.on('data', (chunk) => stream.push(chunk));
    doc.on('end', () => stream.push(null));

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('INCIDENT REPORT', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).font('Helvetica').text(`Incident Number: ${incident.incidentNumber}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // 5W1H Analysis Header
    doc.fontSize(16).font('Helvetica-Bold').text('5W1H INCIDENT ANALYSIS', { align: 'center' });
    doc.moveDown();

    // WHAT - What happened?
    doc.fontSize(14).font('Helvetica-Bold').text('WHAT - What happened?');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Incident Type: ${incident.type}`);
    doc.text(`Title: ${incident.title}`);
    doc.text(`Priority Level: ${incident.priority}`);
    doc.text(`Description: ${incident.description}`, { align: 'justify' });
    doc.moveDown();

    // WHERE - Where did it happen?
    doc.fontSize(14).font('Helvetica-Bold').text('WHERE - Where did it happen?');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Address: ${incident.address}`);
    if (incident.landmark) {
      doc.text(`Landmark: ${incident.landmark}`);
    }
    if (incident.barangay) {
      doc.text(`Barangay: ${incident.barangay.name}`);
    }
    doc.text(`Coordinates: ${incident.latitude}, ${incident.longitude}`);
    doc.moveDown();

    // WHEN - When did it happen? (All Timestamps)
    doc.fontSize(14).font('Helvetica-Bold').text('WHEN - Timeline & Timestamps');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Reported At: ${fmt(incident.reportedAt)}`);
    if (incident.verifiedAt) {
      doc.text(`Verified At: ${fmt(incident.verifiedAt)}`);
    }
    if (incident.acknowledgedAt) {
      doc.text(`Acknowledged At: ${fmt(incident.acknowledgedAt)}`);
    }
    if (incident.dispatchedAt) {
      doc.text(`Dispatched At: ${fmt(incident.dispatchedAt)}`);
    }
    if (incident.respondingAt) {
      doc.text(`Responding Started At: ${fmt(incident.respondingAt)}`);
    }
    if (incident.estimatedArrival) {
      doc.text(`Estimated Arrival: ${fmt(incident.estimatedArrival)}`);
    }
    if (incident.actualArrival) {
      doc.text(`Actual Arrival: ${fmt(incident.actualArrival)}`);
    }
    if (incident.resolvedAt) {
      doc.text(`Resolved At: ${fmt(incident.resolvedAt)}`);
    }
    if (incident.closedAt) {
      doc.text(`Closed At: ${fmt(incident.closedAt)}`);
    }
    if (incident.responseTime) {
      doc.text(`Response Time: ${incident.responseTime} minutes`);
    }
    doc.moveDown();

    // WHO - Who was involved? (Comprehensive)
    doc.fontSize(14).font('Helvetica-Bold').text('WHO - People Involved');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    // Reporter Information
    doc.font('Helvetica-Bold').text('Reporter:');
    doc.font('Helvetica');
    doc.text(`  Name: ${incident.reporterName}`);
    doc.text(`  Phone: ${incident.reporterPhone}`);
    if (incident.reporterEmail) {
      doc.text(`  Email: ${incident.reporterEmail}`);
    }
    doc.moveDown(0.3);
    
    // System User Info
    if (incident.createdBy) {
      doc.font('Helvetica-Bold').text('Created By:');
      doc.font('Helvetica');
      doc.text(`  ${incident.createdBy.firstName} ${incident.createdBy.lastName}`);
      doc.moveDown(0.3);
    } else if (incident.isPublicReport) {
      doc.font('Helvetica-Bold').text('Source:');
      doc.font('Helvetica');
      doc.text(`  Public Report (Session: ${incident.publicSessionId || 'N/A'})`);
      doc.moveDown(0.3);
    }
    
    // Verification Info
    if (incident.verifiedBy) {
      doc.font('Helvetica-Bold').text('Verified By:');
      doc.font('Helvetica');
      doc.text(`  ${incident.verifiedBy.firstName} ${incident.verifiedBy.lastName}`);
      doc.moveDown(0.3);
    }
    
    // Primary Responder
    if (incident.primaryResponder) {
      doc.font('Helvetica-Bold').text('Primary Responder:');
      doc.font('Helvetica');
      doc.text(`  ${incident.primaryResponder.firstName} ${incident.primaryResponder.lastName} (${incident.primaryResponder.role})`);
      doc.moveDown(0.3);
    }
    
    // All Responders
    if (incident.responders && incident.responders.length > 0) {
      doc.font('Helvetica-Bold').text('All Responders:');
      doc.font('Helvetica');
      incident.responders.forEach((responder: any) => {
        doc.text(`  - ${responder.personnel.firstName} ${responder.personnel.lastName} (${responder.personnel.role})`);
      });
      doc.moveDown(0.3);
    }
    
    // Assigned Personnel (Legacy)
    if (incident.assignments && incident.assignments.length > 0) {
      doc.font('Helvetica-Bold').text('Assigned Personnel:');
      doc.font('Helvetica');
      incident.assignments.forEach((assignment) => {
        doc.text(
          `  - ${assignment.personnel.firstName} ${assignment.personnel.lastName} (${assignment.personnel.role})`
        );
      });
      doc.moveDown(0.3);
    }
    
    // Resolution Submitter
    if (incident.resolvedBy) {
      doc.font('Helvetica-Bold').text('Resolved By:');
      doc.font('Helvetica');
      doc.text(`  ${incident.resolvedBy.firstName} ${incident.resolvedBy.lastName}`);
    }
    doc.moveDown();

    // HOW - How is it being handled?
    doc.fontSize(14).font('Helvetica-Bold').text('HOW - How is it being handled?');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Current Status: ${incident.status}`);
    doc.text(`Resolution Method: ${incident.status === 'RESOLVED' ? 'Resolved by assigned personnel' : 'In progress'}`);
    if (incident.resolutionNotes) {
      doc.text(`Notes: ${incident.resolutionNotes}`);
    }
    doc.moveDown();

    // WHY - Why did it happen? (Analysis)
    doc.fontSize(14).font('Helvetica-Bold').text('WHY - Analysis & Context');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('Incident Analysis:', { continued: false });
    doc.text(`${incident.description}`, { align: 'justify' });
    doc.moveDown();

    // RESOLUTION REPORT (5W1H from Personnel)
    if (incident.resolution) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('RESOLUTION REPORT (5W1H)', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(10).font('Helvetica-Bold').text('Submitted By:');
      doc.font('Helvetica').text(
        `${incident.resolution.submittedByPersonnel.firstName} ${incident.resolution.submittedByPersonnel.lastName} (${incident.resolution.submittedByPersonnel.role})`
      );
      doc.text(`Submitted At: ${fmt(incident.resolution.submittedAt)}`);
      
      if (incident.resolution.confirmedByAdmin) {
        doc.text(`Confirmed By: ${incident.resolution.confirmedByAdmin.firstName} ${incident.resolution.confirmedByAdmin.lastName}`);
        if (incident.resolution.confirmedAt) {
          doc.text(`Confirmed At: ${fmt(incident.resolution.confirmedAt)}`);
        }
      }
      doc.moveDown();
      
      doc.fontSize(12).font('Helvetica-Bold').text('WHAT happened:');
      doc.fontSize(10).font('Helvetica').text(incident.resolution.what, { align: 'justify' });
      doc.moveDown(0.5);
      
      doc.fontSize(12).font('Helvetica-Bold').text('WHEN did it happen:');
      doc.fontSize(10).font('Helvetica').text(incident.resolution.when, { align: 'justify' });
      doc.moveDown(0.5);
      
      doc.fontSize(12).font('Helvetica-Bold').text('WHERE did it happen:');
      doc.fontSize(10).font('Helvetica').text(incident.resolution.where, { align: 'justify' });
      doc.moveDown(0.5);
      
      doc.fontSize(12).font('Helvetica-Bold').text('WHO was involved:');
      doc.fontSize(10).font('Helvetica').text(incident.resolution.who, { align: 'justify' });
      doc.moveDown(0.5);
      
      doc.fontSize(12).font('Helvetica-Bold').text('WHY did it happen:');
      doc.fontSize(10).font('Helvetica').text(incident.resolution.why, { align: 'justify' });
      doc.moveDown(0.5);
      
      doc.fontSize(12).font('Helvetica-Bold').text('HOW was it resolved (Outcome):');
      doc.fontSize(10).font('Helvetica').text(incident.resolution.how);
      doc.moveDown(0.5);
      
      if (incident.resolution.notes) {
        doc.fontSize(12).font('Helvetica-Bold').text('Additional Notes:');
        doc.fontSize(10).font('Helvetica').text(incident.resolution.notes, { align: 'justify' });
        doc.moveDown(0.5);
      }
      
      if (incident.resolution.adminNotes) {
        doc.fontSize(12).font('Helvetica-Bold').text('Admin Notes:');
        doc.fontSize(10).font('Helvetica').text(incident.resolution.adminNotes, { align: 'justify' });
        doc.moveDown(0.5);
      }
      
      doc.moveDown();
    }

    // Status Timeline
    if (incident.timeline && incident.timeline.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Status Timeline');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      incident.timeline.forEach((event: any) => {
        doc.text(
          `[${fmt(event.timestamp)}] ${event.status}${event.notes ? ': ' + event.notes : ''}`,
          { indent: 20 }
        );
      });
      doc.moveDown();
    }

    // Updates Timeline
    if (data.includeTimeline && incident.updates && incident.updates.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Updates Timeline');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      incident.updates.forEach((update) => {
        doc.text(
          `[${fmt(update.createdAt)}] ${update.user ? update.user.firstName + ' ' + update.user.lastName : 'System'}: ${update.message}`,
          { indent: 20 }
        );
      });
      doc.moveDown();
    }

    // Photos
    if (data.includePhotos && incident.photos && incident.photos.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Attached Photos');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      incident.photos.forEach((photo: any) => {
        doc.text(`- ${photo.filename}`);
        if (photo.caption) {
          doc.text(`  Caption: ${photo.caption}`, { indent: 20 });
        }
        doc.text(`  Uploaded: ${fmt(photo.uploadedAt)}`, { indent: 20 });
      });
      doc.moveDown();
    }

    // Footer
    doc.fontSize(8).font('Helvetica').text('--- End of Report ---', { align: 'center' });

    doc.end();

    const filename = `incident-report-${incident.incidentNumber}-${Date.now()}.pdf`;
    return { stream, filename };
  }

  private async generateIncidentSummary(
    data: GenerateReportDTO,
    _userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    const fromDate = data.fromDate ? new Date(data.fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = data.toDate ? new Date(data.toDate) : new Date();

    // console.log('[PDF SUMMARY] Generating incident summary PDF');
    // console.log('[PDF SUMMARY] Date range:', fromDate, 'to', toDate);

    const incidents = await this.prisma.incident.findMany({
      where: {
        reportedAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        barangay: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            assignments: true,
            responders: true,
          },
        },
        resolution: {
          select: {
            how: true,
            submittedAt: true,
            what: true,
            when: true,
            where: true,
            who: true,
            why: true,
            notes: true,
            submittedByPersonnel: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        primaryResponder: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        verifiedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { reportedAt: 'desc' },
    });

    // console.log('[PDF SUMMARY] Found incidents:', incidents.length);

    const doc = new PDFDocument({ margin: 50 });
    const stream = new Readable();
    stream._read = () => {};

    doc.on('data', (chunk) => stream.push(chunk));
    doc.on('end', () => stream.push(null));

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('INCIDENT SUMMARY REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica');
    doc.text(`Period: ${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Total Incidents: ${incidents.length}`);
    // console.log('[PDF SUMMARY] Building PDF with', incidents.length, 'incidents');
    doc.moveDown();

    // Statistics
    if (data.includeStatistics) {
      doc.fontSize(14).font('Helvetica-Bold').text('Statistics');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      const byStatus = incidents.reduce((acc: any, inc) => {
        acc[inc.status] = (acc[inc.status] || 0) + 1;
        return acc;
      }, {});

      const byPriority = incidents.reduce((acc: any, inc) => {
        acc[inc.priority] = (acc[inc.priority] || 0) + 1;
        return acc;
      }, {});

      const byType = incidents.reduce((acc: any, inc) => {
        acc[inc.type] = (acc[inc.type] || 0) + 1;
        return acc;
      }, {});

      doc.text('By Status:');
      Object.entries(byStatus).forEach(([status, count]) => {
        doc.text(`  ${status}: ${count}`, { indent: 20 });
      });
      doc.moveDown(0.5);

      doc.text('By Priority:');
      Object.entries(byPriority).forEach(([priority, count]) => {
        doc.text(`  ${priority}: ${count}`, { indent: 20 });
      });
      doc.moveDown(0.5);

      doc.text('By Type:');
      Object.entries(byType).forEach(([type, count]) => {
        doc.text(`  ${type}: ${count}`, { indent: 20 });
      });
      doc.moveDown();
    }

    // Incidents List - Simplified 5W1H Format (matching Excel)
    doc.fontSize(14).font('Helvetica-Bold').text('Incident Reports (5W1H Format)');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');

    incidents.forEach((incident, index) => {
      if (index > 0 && index % 3 === 0) {
        doc.addPage();
        doc.fontSize(9).font('Helvetica');
      }

      // Header
      doc.font('Helvetica-Bold').fontSize(10).text(`${incident.incidentNumber} - ${incident.title}`);
      doc.fontSize(9).font('Helvetica').text(`Status: ${incident.status} | Priority: ${incident.priority}`, { indent: 10 });
      doc.moveDown(0.3);
      
      // === REPORT 5W1H ===
      doc.font('Helvetica-Bold').text('REPORT - Initial Incident Details:', { indent: 10 });
      doc.font('Helvetica');
      const _desc = (incident.description || '');
      doc.text(`  WHAT: ${incident.type} - ${_desc.substring(0, 100)}${_desc.length > 100 ? '...' : ''}`, { indent: 10 });
      const _reportedAt = this.fmtDate(incident.reportedAt);
      doc.text(`  WHEN: ${_reportedAt}`, { indent: 10 });
      doc.text(`  WHERE: ${incident.address}, ${incident.barangay?.name || 'N/A'}`, { indent: 10 });
      doc.text(`  WHO: ${incident.reporterName} (${incident.reporterPhone})`, { indent: 10 });
      doc.text(`  WHY: ${_desc.substring(0, 80)}${_desc.length > 80 ? '...' : ''}`, { indent: 10 });
      doc.text(`  HOW: Reported via ${incident.isPublicReport ? 'Public System' : 'Admin Dashboard'}`, { indent: 10 });
      doc.moveDown(0.3);
      
      // === RESOLUTION 5W1H ===
      if (incident.resolution) {
        doc.font('Helvetica-Bold').text('RESOLUTION - How It Was Resolved:', { indent: 10 });
        doc.font('Helvetica');
        const _resWhat = (incident.resolution.what || '');
        doc.text(`  WHAT: ${_resWhat.substring(0, 100)}${_resWhat.length > 100 ? '...' : ''}`, { indent: 10 });
        const _resWhen = incident.resolution.when ? (typeof incident.resolution.when === 'string' ? incident.resolution.when : this.fmtDate(incident.resolution.when)) : 'N/A';
        doc.text(`  WHEN: ${_resWhen}`, { indent: 10 });
        const _resWhere = (incident.resolution.where || '');
        doc.text(`  WHERE: ${_resWhere.substring(0, 80)}${_resWhere.length > 80 ? '...' : ''}`, { indent: 10 });
        const _resWho = (incident.resolution.who || '');
        doc.text(`  WHO: ${_resWho.substring(0, 80)}${_resWho.length > 80 ? '...' : ''}`, { indent: 10 });
        const _resWhy = (incident.resolution.why || '');
        doc.text(`  WHY: ${_resWhy.substring(0, 80)}${_resWhy.length > 80 ? '...' : ''}`, { indent: 10 });
        doc.text(`  HOW: ${incident.resolution.how}`, { indent: 10 });
        if (incident.resolution.notes) {
          const _resNotes = (incident.resolution.notes || '');
          doc.text(`  Notes: ${_resNotes.substring(0, 100)}${_resNotes.length > 100 ? '...' : ''}`, { indent: 10 });
        }
        doc.moveDown(0.3);
      } else {
        doc.font('Helvetica-Bold').text('RESOLUTION: Not yet resolved', { indent: 10 });
        doc.moveDown(0.3);
      }
      
      // Personnel & Timestamps
      doc.font('Helvetica').fontSize(8);
      if (incident.primaryResponder) {
        doc.text(`Responder: ${incident.primaryResponder.firstName} ${incident.primaryResponder.lastName} (${incident.primaryResponder.role})`, { indent: 10 });
      }
      if (incident.resolution?.submittedByPersonnel) {
        doc.text(`Submitted By: ${incident.resolution.submittedByPersonnel.firstName} ${incident.resolution.submittedByPersonnel.lastName}`, { indent: 10 });
      }
      if (incident.responseTime) {
        doc.text(`Response Time: ${incident.responseTime} minutes`, { indent: 10 });
      }
      if (incident.resolvedAt) {
        const _resolvedAt = this.fmtDate(incident.resolvedAt);
        doc.text(`Resolved At: ${_resolvedAt}`, { indent: 10 });
      }
      
      doc.fontSize(9);
      doc.moveDown(0.5);
      // draw a light separator line
      try {
        doc.save();
        doc.strokeColor('#cccccc');
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.restore();
      } catch (err) {
        // if drawing the line fails, continue without breaking the report
        // console.warn('[REPORTS] Failed to draw separator line:', err);
      }
      doc.moveDown(0.5);
    });

    doc.end();

    const filename = `incident-summary-${Date.now()}.pdf`;
    return { stream, filename };
  }

  private async generatePersonnelReport(
    _data: GenerateReportDTO,
    _userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    const personnel = await this.prisma.personnel.findMany({
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    const doc = new PDFDocument({ margin: 50 });
    const stream = new Readable();
    stream._read = () => {};

    doc.on('data', (chunk) => stream.push(chunk));
    doc.on('end', () => stream.push(null));

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('PERSONNEL REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica');
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Total Personnel: ${personnel.length}`);
    doc.moveDown();

    // Statistics
    const byRole = personnel.reduce((acc: any, p) => {
      acc[p.role] = (acc[p.role] || 0) + 1;
      return acc;
    }, {});

    const byStatus = personnel.reduce((acc: any, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});

    doc.fontSize(14).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('By Role:');
    Object.entries(byRole).forEach(([role, count]) => {
      doc.text(`  ${role}: ${count}`, { indent: 20 });
    });
    doc.moveDown(0.5);

    doc.text('By Status:');
    Object.entries(byStatus).forEach(([status, count]) => {
      doc.text(`  ${status}: ${count}`, { indent: 20 });
    });
    doc.moveDown();

    // Personnel List
    doc.fontSize(14).font('Helvetica-Bold').text('Personnel Details');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');

    personnel.forEach((person, index) => {
      if (index > 0 && index % 20 === 0) {
        doc.addPage();
      }

      doc.font('Helvetica-Bold').text(`${person.employeeId}`, { continued: true });
      doc.font('Helvetica').text(` - ${person.firstName} ${person.lastName}`);
      doc.text(`  Role: ${person.role} | Status: ${person.status}`, { indent: 20 });
      doc.text(`  Phone: ${person.phone}`, { indent: 20 });
      doc.text(`  Email: ${person.email}`, { indent: 20 });
      doc.text(`  Assignments: ${person._count.assignments}`, { indent: 20 });
      doc.text(`  Available: ${person.isAvailable ? 'Yes' : 'No'}`, { indent: 20 });
      doc.moveDown(0.3);
    });

    doc.end();

    const filename = `personnel-report-${Date.now()}.pdf`;
    return { stream, filename };
  }

  private async generateBarangayReport(
    _data: GenerateReportDTO,
    _userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    const barangays = await this.prisma.barangay.findMany({
      include: {
        _count: {
          select: {
            incidents: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const doc = new PDFDocument({ margin: 50 });
    const stream = new Readable();
    stream._read = () => {};

    doc.on('data', (chunk) => stream.push(chunk));
    doc.on('end', () => stream.push(null));

    doc.fontSize(20).font('Helvetica-Bold').text('BARANGAY REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica');
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Total Barangays: ${barangays.length}`);
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').text('Barangay Details');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    barangays.forEach((barangay) => {
      doc.font('Helvetica-Bold').text(barangay.name);
      if (barangay.code) doc.text(`  Code: ${barangay.code}`, { indent: 20 });
      doc.text(`  Location: ${barangay.latitude}, ${barangay.longitude}`, { indent: 20 });
      if (barangay.address) doc.text(`  Address: ${barangay.address}`, { indent: 20 });
      if (barangay.contactPerson)
        doc.text(`  Contact: ${barangay.contactPerson}`, { indent: 20 });
      if (barangay.contactPhone) doc.text(`  Phone: ${barangay.contactPhone}`, { indent: 20 });
      doc.text(`  Total Incidents: ${barangay._count.incidents}`, { indent: 20 });
      doc.text(`  Status: ${barangay.isActive ? 'Active' : 'Inactive'}`, { indent: 20 });
      doc.moveDown();
    });

    doc.end();

    const filename = `barangay-report-${Date.now()}.pdf`;
    return { stream, filename };
  }

  private async generateStatisticsReport(
    data: GenerateReportDTO,
    _userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    const fromDate = data.fromDate ? new Date(data.fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = data.toDate ? new Date(data.toDate) : new Date();

    const [incidents, personnel, barangays] = await Promise.all([
      this.prisma.incident.findMany({
        where: {
          reportedAt: { gte: fromDate, lte: toDate },
        },
      }),
      this.prisma.personnel.findMany(),
      this.prisma.barangay.findMany(),
    ]);

    const doc = new PDFDocument({ margin: 50 });
    const stream = new Readable();
    stream._read = () => {};

    doc.on('data', (chunk) => stream.push(chunk));
    doc.on('end', () => stream.push(null));

    doc.fontSize(20).font('Helvetica-Bold').text('STATISTICS REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica');
    doc.text(`Period: ${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // Overall Statistics
    doc.fontSize(16).font('Helvetica-Bold').text('Overall Statistics');
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Incidents: ${incidents.length}`);
    doc.text(`Total Personnel: ${personnel.length}`);
    doc.text(`Total Barangays: ${barangays.length}`);
    doc.moveDown();

    // Incident Statistics
    doc.fontSize(14).font('Helvetica-Bold').text('Incident Breakdown');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    const byStatus = incidents.reduce((acc: Record<string, number>, inc) => {
      acc[inc.status] = (acc[inc.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    doc.text('By Status:');
    Object.entries(byStatus).forEach(([status, count]) => {
      const percentage = ((count as number / incidents.length) * 100).toFixed(1);
      doc.text(`  ${status}: ${count} (${percentage}%)`, { indent: 20 });
    });
    doc.moveDown();

    const byPriority = incidents.reduce((acc: Record<string, number>, inc) => {
      acc[inc.priority] = (acc[inc.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    doc.text('By Priority:');
    Object.entries(byPriority).forEach(([priority, count]) => {
      const percentage = ((count as number / incidents.length) * 100).toFixed(1);
      doc.text(`  ${priority}: ${count} (${percentage}%)`, { indent: 20 });
    });
    doc.moveDown();

    const byType = incidents.reduce((acc: Record<string, number>, inc) => {
      acc[inc.type] = (acc[inc.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    doc.text('By Type:');
    Object.entries(byType).forEach(([type, count]) => {
      const percentage = ((count as number / incidents.length) * 100).toFixed(1);
      doc.text(`  ${type}: ${count} (${percentage}%)`, { indent: 20 });
    });
    doc.moveDown();

    // Personnel Statistics
    doc.fontSize(14).font('Helvetica-Bold').text('Personnel Breakdown');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    const personnelByRole = personnel.reduce((acc: any, p) => {
      acc[p.role] = (acc[p.role] || 0) + 1;
      return acc;
    }, {});

    Object.entries(personnelByRole).forEach(([role, count]) => {
      const percentage = ((count as number / personnel.length) * 100).toFixed(1);
      doc.text(`${role}: ${count} (${percentage}%)`);
    });

    doc.end();

    const filename = `statistics-report-${Date.now()}.pdf`;
    return { stream, filename };
  }

  private async generateActivityReport(
    data: GenerateReportDTO,
    _userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    const fromDate = data.fromDate ? new Date(data.fromDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = data.toDate ? new Date(data.toDate) : new Date();

    const logs = await this.prisma.auditLog.findMany({
      where: {
        timestamp: { gte: fromDate, lte: toDate },
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    const doc = new PDFDocument({ margin: 50 });
    const stream = new Readable();
    stream._read = () => {};

    doc.on('data', (chunk) => stream.push(chunk));
    doc.on('end', () => stream.push(null));

    doc.fontSize(20).font('Helvetica-Bold').text('ACTIVITY REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica');
    doc.text(`Period: ${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Total Activities: ${logs.length}`);
    doc.moveDown();

    // Activity Summary
    const byAction = logs.reduce((acc: any, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    doc.fontSize(14).font('Helvetica-Bold').text('Activity Summary');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    Object.entries(byAction)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([action, count]) => {
        doc.text(`${action}: ${count}`);
      });
    doc.moveDown();

    // Recent Activities
    doc.fontSize(14).font('Helvetica-Bold').text('Recent Activities');
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica');

    logs.slice(0, 100).forEach((log, index) => {
      if (index > 0 && index % 30 === 0) {
        doc.addPage();
      }

      const userName = log.user
        ? `${log.user.firstName} ${log.user.lastName}`
        : 'System';
      const _resId = log.resourceId ? String(log.resourceId) : '';
      doc.text(
        `[${this.fmtDate(log.timestamp)}] ${userName}: ${log.action} - ${log.resourceType}${_resId ? ' (' + _resId.substring(0, 8) + '...)' : ''}`,
      );
    });

    doc.end();

    const filename = `activity-report-${Date.now()}.pdf`;
    return { stream, filename };
  }

  async generateExcelReport(
    data: GenerateReportDTO,
    userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    switch (data.type) {
      case ReportType.INCIDENT_SUMMARY:
        return this.generateIncidentSummaryExcel(data, userId);
      case ReportType.PERSONNEL_REPORT:
        return this.generatePersonnelReportExcel(data, userId);
      case ReportType.BARANGAY_REPORT:
        return this.generateBarangayReportExcel(data, userId);
      case ReportType.STATISTICS_REPORT:
        return this.generateStatisticsReportExcel(data, userId);
      default:
        throw new Error('Excel export not supported for this report type');
    }
  }

  private async generateIncidentSummaryExcel(
    data: GenerateReportDTO,
    _userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    const fromDate = data.fromDate ? new Date(data.fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = data.toDate ? new Date(data.toDate) : new Date();

    // console.log('[EXCEL EXPORT] Generating incident summary Excel');
    // console.log('[EXCEL EXPORT] Date range:', fromDate, 'to', toDate);
    // console.log('[EXCEL EXPORT] Filters received:', data);

    // Build where clause including all filters
    const whereClause: any = {
      reportedAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    // Add status filter if provided
    if (data.status && (data.status as string[]).length > 0) {
      whereClause.status = { in: data.status };
    }

    // Add priority filter if provided
    if (data.priority && (data.priority as string[]).length > 0) {
      whereClause.priority = { in: data.priority };
    }

    // Add type filter if provided
    if (data.incidentTypes && data.incidentTypes.length > 0) {
      whereClause.type = { in: data.incidentTypes };
    }

    // Add barangay filter if provided
    if (data.barangayId && (data.barangayId as string[]).length > 0) {
      whereClause.barangayId = { in: data.barangayId };
    }

    // Add search filter if provided
    if (data.search && data.search.trim()) {
      const searchTerm = data.search.trim();
      whereClause.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { address: { contains: searchTerm, mode: 'insensitive' } },
        { reporterName: { contains: searchTerm, mode: 'insensitive' } },
        { reporterPhone: { contains: searchTerm, mode: 'insensitive' } },
        { incidentNumber: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Add boolean filters if provided
    if (data.hasPhotosFilter === true) {
      whereClause.photos = { some: {} };
    } else if (data.hasPhotosFilter === false) {
      whereClause.photos = { none: {} };
    }

    if (data.hasAssignedPersonnel === true) {
      whereClause.OR = whereClause.OR || [];
      whereClause.OR.push({ assignments: { some: {} } });
      whereClause.OR.push({ responders: { some: {} } });
    } else if (data.hasAssignedPersonnel === false) {
      whereClause.assignments = { none: {} };
      whereClause.responders = { none: {} };
    }

    // console.log('[EXCEL EXPORT] Final where clause:', whereClause);

    const incidents = await this.prisma.incident.findMany({
      where: whereClause,
      include: {
        barangay: {
          select: {
            name: true,
          },
        },
        assignments: {
          include: {
            personnel: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        resolution: {
          select: {
            how: true,
            submittedAt: true,
            what: true,
            when: true,
            where: true,
            who: true,
            why: true,
            notes: true,
            submittedByPersonnel: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
              },
            },
            confirmedByAdmin: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        responders: {
          include: {
            personnel: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        timeline: {
          orderBy: {
            timestamp: 'asc',
          },
        },
        verifiedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        resolvedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        primaryResponder: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        publicSession: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { reportedAt: 'desc' },
    });

    // console.log('[EXCEL EXPORT] Found incidents:', incidents.length);

    // console.log('[EXCEL EXPORT] Found incidents:', incidents.length);

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    
    // Simplified Excel data with 5W1H for REPORT and RESOLUTION
    const excelData = incidents.map(incident => {
      // console.log('[EXCEL EXPORT] Processing incident:', incident.incidentNumber);
      return {
        // BASIC INFO
        'Incident Number': incident.incidentNumber,
        'Status': incident.status,
        'Priority': incident.priority,
        
        // 5W1H - INCIDENT REPORT
        'REPORT - What (Type)': incident.type,
        'REPORT - What (Description)': incident.description,
        'REPORT - When (Date)': this.fmtDate(incident.reportedAt),
        'REPORT - Where (Location)': `${incident.address} - ${incident.barangay?.name || 'N/A'}`,
        'REPORT - Who (Reporter)': `${incident.reporterName} (${incident.reporterPhone})`,
        'REPORT - Why (Reason)': incident.title,
        'REPORT - How (Priority)': incident.priority,
        
        // 5W1H - RESOLUTION (if resolved)
        'RESOLUTION - What Happened': incident.resolution?.what || 'N/A',
        'RESOLUTION - When': incident.resolution?.when || 'N/A',
        'RESOLUTION - Where': incident.resolution?.where || 'N/A',
        'RESOLUTION - Who Involved': incident.resolution?.who || 'N/A',
        'RESOLUTION - Why': incident.resolution?.why || 'N/A',
        'RESOLUTION - How (Outcome)': incident.resolution?.how || 'N/A',
        'RESOLUTION - Notes': incident.resolution?.notes || 'N/A',
        
        // PERSONNEL
        'Primary Responder': incident.primaryResponder ? `${incident.primaryResponder.firstName} ${incident.primaryResponder.lastName}` : 'N/A',
        'Submitted By': incident.resolution?.submittedByPersonnel ? `${incident.resolution.submittedByPersonnel.firstName} ${incident.resolution.submittedByPersonnel.lastName}` : 'N/A',
        
        // TIMESTAMPS
        'Reported At': this.fmtDate(incident.reportedAt),
        'Resolved At': incident.resolvedAt ? this.fmtDate(incident.resolvedAt) : 'N/A',
        'Response Time (min)': incident.responseTime || 'N/A',
      };
    });

    // console.log('[EXCEL EXPORT] Prepared excel data rows:', excelData.length);

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths - simplified
    const colWidths = [
      { wch: 15 }, // Incident Number
      { wch: 18 }, // Status
      { wch: 12 }, // Priority
      // REPORT 5W1H
      { wch: 15 }, // What Type
      { wch: 50 }, // What Description
      { wch: 20 }, // When
      { wch: 40 }, // Where
      { wch: 25 }, // Who
      { wch: 30 }, // Why
      { wch: 12 }, // How
      // RESOLUTION 5W1H
      { wch: 40 }, // What Happened
      { wch: 30 }, // When
      { wch: 30 }, // Where
      { wch: 30 }, // Who
      { wch: 40 }, // Why
      { wch: 20 }, // How
      { wch: 40 }, // Notes
      // PERSONNEL
      { wch: 25 }, // Primary Responder
      { wch: 25 }, // Submitted By
      // TIMESTAMPS
      { wch: 20 }, // Reported At
      { wch: 20 }, // Resolved At
      { wch: 15 }, // Response Time
    ];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Incidents');

    // console.log('[EXCEL EXPORT] Workbook created with worksheet');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // console.log('[EXCEL EXPORT] Buffer size:', buffer.length, 'bytes');
    
    // Create readable stream
    const stream = new Readable();
    stream._read = () => {};
    stream.push(buffer);
    stream.push(null);

    const filename = `incident-summary-${Date.now()}.xlsx`;
    // console.log('[EXCEL EXPORT] Returning file:', filename);
    return { stream, filename };
  }

  private async generatePersonnelReportExcel(
    _data: GenerateReportDTO,
    _userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    const personnel = await this.prisma.personnel.findMany({
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    const workbook = XLSX.utils.book_new();
    
    const excelData = personnel.map(person => ({
      'Employee ID': person.employeeId,
      'First Name': person.firstName,
      'Last Name': person.lastName,
      'Role': person.role,
      'Status': person.status,
      'Phone': person.phone,
      'Email': person.email,
      'Available': person.isAvailable ? 'Yes' : 'No',
      'Total Assignments': person._count.assignments,
      'Created At': this.fmtDate(person.createdAt),
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    const colWidths = [
      { wch: 15 }, // Employee ID
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 20 }, // Role
      { wch: 15 }, // Status
      { wch: 15 }, // Phone
      { wch: 25 }, // Email
      { wch: 10 }, // Available
      { wch: 15 }, // Total Assignments
      { wch: 20 }, // Created At
    ];
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Personnel');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    const stream = new Readable();
    stream._read = () => {};
    stream.push(buffer);
    stream.push(null);

    const filename = `personnel-report-${Date.now()}.xlsx`;
    return { stream, filename };
  }

  private async generateBarangayReportExcel(
    _data: GenerateReportDTO,
    _userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    const barangays = await this.prisma.barangay.findMany({
      include: {
        _count: {
          select: {
            incidents: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const workbook = XLSX.utils.book_new();
    
    const excelData = barangays.map(barangay => ({
      'Name': barangay.name,
      'Code': barangay.code || '',
      'Address': barangay.address || '',
      'Latitude': barangay.latitude,
      'Longitude': barangay.longitude,
      'Contact Person': barangay.contactPerson || '',
      'Contact Phone': barangay.contactPhone || '',
      'Total Incidents': barangay._count.incidents,
      'Status': barangay.isActive ? 'Active' : 'Inactive',
      'Created At': this.fmtDate(barangay.createdAt),
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    const colWidths = [
      { wch: 25 }, // Name
      { wch: 10 }, // Code
      { wch: 40 }, // Address
      { wch: 12 }, // Latitude
      { wch: 12 }, // Longitude
      { wch: 20 }, // Contact Person
      { wch: 15 }, // Contact Phone
      { wch: 15 }, // Total Incidents
      { wch: 10 }, // Status
      { wch: 20 }, // Created At
    ];
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Barangays');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    const stream = new Readable();
    stream._read = () => {};
    stream.push(buffer);
    stream.push(null);

    const filename = `barangay-report-${Date.now()}.xlsx`;
    return { stream, filename };
  }

  private async generateStatisticsReportExcel(
    data: GenerateReportDTO,
    _userId: string
  ): Promise<{ stream: Readable; filename: string }> {
    const fromDate = data.fromDate ? new Date(data.fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = data.toDate ? new Date(data.toDate) : new Date();

    const [incidents, personnel, barangays] = await Promise.all([
      this.prisma.incident.findMany({
        where: {
          reportedAt: { gte: fromDate, lte: toDate },
        },
      }),
      this.prisma.personnel.findMany(),
      this.prisma.barangay.findMany(),
    ]);

    const workbook = XLSX.utils.book_new();

    // Overall Statistics
    const overallStats = [
      { Metric: 'Total Incidents', Value: incidents.length },
      { Metric: 'Total Personnel', Value: personnel.length },
      { Metric: 'Total Barangays', Value: barangays.length },
    ];

    // Status Statistics
    const statusStats = Object.entries(
      incidents.reduce((acc: Record<string, number>, inc) => {
        acc[inc.status] = (acc[inc.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([status, count]) => ({
      Status: status,
      Count: count,
      Percentage: ((count as number / incidents.length) * 100).toFixed(1) + '%'
    }));

    // Priority Statistics
    const priorityStats = Object.entries(
      incidents.reduce((acc: Record<string, number>, inc) => {
        acc[inc.priority] = (acc[inc.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([priority, count]) => ({
      Priority: priority,
      Count: count,
      Percentage: ((count as number / incidents.length) * 100).toFixed(1) + '%'
    }));

    // Type Statistics
    const typeStats = Object.entries(
      incidents.reduce((acc: Record<string, number>, inc) => {
        acc[inc.type] = (acc[inc.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    ).map(([type, count]) => ({
      Type: type,
      Count: count,
      Percentage: ((count as number / incidents.length) * 100).toFixed(1) + '%'
    }));

    // Create worksheets
    const overallWs = XLSX.utils.json_to_sheet(overallStats);
    const statusWs = XLSX.utils.json_to_sheet(statusStats);
    const priorityWs = XLSX.utils.json_to_sheet(priorityStats);
    const typeWs = XLSX.utils.json_to_sheet(typeStats);

    // Add worksheets to workbook
    XLSX.utils.book_append_sheet(workbook, overallWs, 'Overall Statistics');
    XLSX.utils.book_append_sheet(workbook, statusWs, 'By Status');
    XLSX.utils.book_append_sheet(workbook, priorityWs, 'By Priority');
    XLSX.utils.book_append_sheet(workbook, typeWs, 'By Type');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    const stream = new Readable();
    stream._read = () => {};
    stream.push(buffer);
    stream.push(null);

    const filename = `statistics-report-${Date.now()}.xlsx`;
    return { stream, filename };
  }

  async emailReport(
    _email: string,
    _reportType: string,
    _fromDate?: string,
    _toDate?: string,
    _userId?: string
  ): Promise<void> {
    // This is a placeholder implementation
    // In a real application, you would:
    // 1. Generate the requested report
    // 2. Use nodemailer to send the report as an attachment
    // 3. Log the email activity
    
    // console.log('Email report requested:', { email, reportType, fromDate, toDate, userId });
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // For now, we'll just log that the email would be sent
    // In production, implement actual email sending with nodemailer
    // console.log(`Report ${reportType} would be sent to ${email}`);
  }
}
