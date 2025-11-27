import { FastifyRequest, FastifyReply } from 'fastify';
import { PublicService } from './public.service';
import type {
  CreatePublicIncidentInput,
  CreatePublicSessionInput,
  GetPublicIncidentsInput,
} from './public.schema';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../../config/environment';
import { FileUploadSecurityService } from '../../core/utils/file-upload-security';

export class PublicController {
  constructor(private publicService: PublicService) {}

  /**
   * POST /api/v1/public/session
   * Create a new public session
   */
  createSession = async (
    request: FastifyRequest<{ Body: CreatePublicSessionInput }>,
    reply: FastifyReply
  ) => {
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'] || request.body.userAgent;

    const session = await this.publicService.createSession(ipAddress, userAgent);

    return reply.code(201).send({
      success: true,
      data: session,
      message: 'Session created successfully',
    });
  };

  /**
   * POST /api/v1/public/incidents
   * Create a new public incident report (with optional photos)
   */
  createIncident = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    // console.log('[CREATE INCIDENT] Request received');
    // console.log('[CREATE INCIDENT] Content-Type:', request.headers['content-type']);
    
    // Check if request is multipart - use both plugin method and content-type header
    const contentType = request.headers['content-type'] || '';
    const isMultipartByHeader = contentType.includes('multipart/form-data');
    const isMultipartByPlugin = request.isMultipart?.() || false;
    const isMultipart = isMultipartByPlugin || isMultipartByHeader;
      
      // console.log('[CREATE INCIDENT] Is multipart by header?', isMultipartByHeader);
      // console.log('[CREATE INCIDENT] Is multipart by plugin?', isMultipartByPlugin);
      // console.log('[CREATE INCIDENT] Final isMultipart?', isMultipart);
      // console.log('[CREATE INCIDENT] Has parts method?', typeof (request as any).parts);

      if (isMultipart) {
        // Handle multipart/form-data (with photos)
        // console.log('[CREATE INCIDENT] Attempting to get parts...');
        
        if (typeof (request as any).parts !== 'function') {
          // console.error('[CREATE INCIDENT] ERROR: parts() is not a function!');
          return reply.status(500).send({
            success: false,
            error: { message: 'Multipart plugin not properly configured', statusCode: 500 },
          });
        }
        
        const parts = (request as any).parts();
        // console.log('[CREATE INCIDENT] Got parts iterator');
        
        const formData: any = {};
        const photoFiles: { buffer: Buffer; filename: string; mimetype: string }[] = [];

        for await (const part of parts) {
          // console.log('[CREATE INCIDENT] Processing part:', part.type, part.fieldname || part.filename);
          if (part.type === 'file') {
            // OWASP A01/A04: Validate file uploads with magic byte verification
            const buffer = await part.toBuffer();
            
            // Validate file security before accepting
            const validation = FileUploadSecurityService.validateFileSecure(
              part.filename,
              part.mimetype,
              buffer
            );
            
            if (!validation.valid) {
              // console.error('[CREATE INCIDENT] File validation failed:', validation.error);
              return reply.status(400).send({
                success: false,
                error: { 
                  message: validation.error || 'Invalid file upload', 
                  statusCode: 400 
                },
              });
            }
            
            // Sanitize filename
            const sanitizedFilename = FileUploadSecurityService.generateSafeFilename(part.filename);
            
            photoFiles.push({
              buffer,
              filename: sanitizedFilename,
              mimetype: part.mimetype,
            });
          } else {
            // Handle form field
            formData[part.fieldname] = part.value;
          }
        }

        // console.log('[CREATE INCIDENT] Finished processing parts');
        // console.log('[CREATE INCIDENT] Form data keys:', Object.keys(formData));
        // console.log('[CREATE INCIDENT] Photo files count:', photoFiles.length);

        const { sessionToken, ...incidentData } = formData;

        // Convert string numbers to actual numbers
        incidentData.latitude = parseFloat(incidentData.latitude);
        incidentData.longitude = parseFloat(incidentData.longitude);

        // Basic validation for required fields
        if (!sessionToken) {
          return reply.status(400).send({
            success: false,
            error: { message: 'sessionToken is required', statusCode: 400 },
          });
        }
        if (!incidentData.type || !incidentData.address || !incidentData.reporterName || !incidentData.reporterPhone) {
          return reply.status(400).send({
            success: false,
            error: { message: 'Missing required fields', statusCode: 400 },
          });
        }

        // Create incident
        const incident = await this.publicService.createIncident(incidentData, sessionToken);

        // Upload photos if any
        if (photoFiles.length > 0) {
          const uploadDir = env.UPLOAD_DIR;
          await this.ensureUploadDir(uploadDir);

          for (const photoFile of photoFiles) {
            // OWASP V12.4.1: Use validated mimetype extension, not user-supplied
            const fileExt = this.getExtensionFromMimetype(photoFile.mimetype);
            const filename = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
            const filepath = path.join(uploadDir, filename);

            await fs.writeFile(filepath, photoFile.buffer);

            // Save photo to database
            await this.publicService.addPhoto(incident.id, {
              filename: photoFile.filename,
              filepath,
              url: `/uploads/${filename}`,
              mimeType: photoFile.mimetype,
              size: photoFile.buffer.length,
            });
          }
        }

        // Fetch updated incident with photos
        const updatedIncident = await this.publicService.getIncidentById(incident.id);

        return reply.code(201).send({
          success: true,
          data: updatedIncident,
          message: 'Incident reported successfully. Our team will verify and respond shortly.',
        });
      } else {
        // Handle JSON (no photos)
        const { sessionToken, ...incidentData } = request.body as CreatePublicIncidentInput;
        const incident = await this.publicService.createIncident(incidentData, sessionToken);

        return reply.code(201).send({
          success: true,
          data: incident,
          message: 'Incident reported successfully. Our team will verify and respond shortly.',
        });
      }
  };

  private async ensureUploadDir(dir: string) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  // OWASP V12.4.1: Map validated MIME types to safe extensions
  private getExtensionFromMimetype(mimetype: string): string {
    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    return mimeToExt[mimetype] || '.bin';
  }

  /**
   * GET /api/v1/public/incidents
   * Get active incidents (public view)
   */
  getIncidents = async (
    request: FastifyRequest<{ Querystring: GetPublicIncidentsInput }>,
    reply: FastifyReply
  ) => {
    const { type, limit } = request.query;
    
    // Ensure limit is a number (query params come as strings)
    const numericLimit = limit ? Number(limit) : undefined;

    const incidents = await this.publicService.getActiveIncidents(type, numericLimit);

    return reply.send({
      success: true,
      data: incidents,
    });
  };

  /**
   * GET /api/v1/public/incidents/:id
   * Get single incident (limited info)
   */
  getIncidentById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const incident = await this.publicService.getIncidentById(id);

    return reply.send({
      success: true,
      data: incident,
    });
  };

  /**
   * GET /api/v1/public/barangays
   * Get active barangays/posts
   */
  getBarangays = async (request: FastifyRequest, reply: FastifyReply) => {
    const barangays = await this.publicService.getBarangays();

    return reply.send({
      success: true,
      data: barangays,
    });
  };
}
