/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyRequest, FastifyReply } from 'fastify';
import { PhotosService } from './photos.service';
import { UpdatePhotoCaptionDTO } from './photos.types';
import { SuccessResponse } from '../../types';
import { promises as fs } from 'fs';
import path from 'path';
import { env } from '../../config/environment';
import { FileUploadSecurityService } from '../../core/utils/file-upload-security';
import { SecurityAuditService } from '../../core/utils/security-audit';

export class PhotosController {
  constructor(private photosService: PhotosService) {}

  async uploadPhoto(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request.user as any).userId;

    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: {
            message: 'No file uploaded',
            statusCode: 400,
          },
        });
      }

      // Get form fields
      const fields = data.fields as any;
      const incidentId = fields.incidentId?.value as string;
      const caption = fields.caption?.value as string | undefined;

      if (!incidentId) {
        return reply.status(400).send({
          success: false,
          error: {
            message: 'incidentId is required',
            statusCode: 400,
          },
        });
      }

      // Get buffer and file size
      const buffer = await data.toBuffer();
      
      // Validate file security with magic byte verification
      const validation = FileUploadSecurityService.validateFileSecure(
        data.filename,
        data.mimetype,
        buffer
      );

      if (!validation.valid) {
        await SecurityAuditService.logFileUpload(userId, request.ip, data.filename, false, validation.error);
        return reply.status(400).send({
          success: false,
          error: {
            message: validation.error || 'File validation failed',
            statusCode: 400,
          },
        });
      }

      // Save file
      const uploadDir = env.UPLOAD_DIR;
      await this.ensureUploadDir(uploadDir);

      // Generate safe filename
      const safeFilename = FileUploadSecurityService.generateSafeFilename(data.filename);
      const filepath = path.join(uploadDir, safeFilename);

      // Validate path to prevent directory traversal
      if (!FileUploadSecurityService.validateDirectoryPath(uploadDir, filepath)) {
        await SecurityAuditService.logFileUpload(userId, request.ip, data.filename, false, undefined);
        return reply.status(400).send({
          success: false,
          error: {
            message: 'Invalid file path',
            statusCode: 400,
          },
        });
      }

      await fs.writeFile(filepath, buffer);

      // Upload to database
      const photo = await this.photosService.uploadPhoto(
        incidentId,
        {
          filename: safeFilename,
          filepath,
          mimetype: data.mimetype,
          filesize: buffer.length,
        },
        caption,
        userId
      );

      // Log successful upload
      await SecurityAuditService.logFileUpload(userId, request.ip, safeFilename, true, undefined);

      // Emit WebSocket event
      if (request.server.io) {
        request.server.io.emit('photo:uploaded', {
          incidentId,
          photo,
        });
      }

      const response: SuccessResponse = {
        success: true,
        data: photo,
        message: 'Photo uploaded successfully',
      };

      return reply.status(201).send(response);
    } catch (error) {
      await SecurityAuditService.logFileUpload(userId, request.ip, 'unknown', false, undefined);
      throw error;
    }
  }

  async getIncidentPhotos(
    request: FastifyRequest<{ Params: { incidentId: string } }>,
    reply: FastifyReply
  ) {
    const photos = await this.photosService.getIncidentPhotos(request.params.incidentId);

    const response: SuccessResponse = {
      success: true,
      data: photos,
    };

    return reply.status(200).send(response);
  }

  async getPhotoById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const photo = await this.photosService.getPhotoById(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: photo,
    };

    return reply.status(200).send(response);
  }

  async getPhotoFile(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const { filepath, mimeType } = await this.photosService.getPhotoFile(request.params.id);

    return reply.type(mimeType).sendFile(path.basename(filepath), path.dirname(filepath));
  }

  async updateCaption(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdatePhotoCaptionDTO }>,
    reply: FastifyReply
  ) {
    const userId = (request.user as any).userId;
    const photo = await this.photosService.updateCaption(
      request.params.id,
      request.body,
      userId
    );

    const response: SuccessResponse = {
      success: true,
      data: photo,
      message: 'Caption updated successfully',
    };

    return reply.status(200).send(response);
  }

  async deletePhoto(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const userId = (request.user as any).userId;
    await this.photosService.deletePhoto(request.params.id, userId);

    // Emit WebSocket event
    if (request.server.io) {
      request.server.io.emit('photo:deleted', {
        photoId: request.params.id,
      });
    }

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'Photo deleted successfully',
    };

    return reply.status(200).send(response);
  }

  private async ensureUploadDir(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}
