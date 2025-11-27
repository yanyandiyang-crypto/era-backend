import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../core/errors';
import { PhotoResponse, UpdatePhotoCaptionDTO } from './photos.types';
import { promises as fs } from 'fs';
import { env } from '../../config/environment';

export class PhotosService {
  constructor(private prisma: PrismaClient) {}

  async uploadPhoto(
    incidentId: string,
    file: {
      filename: string;
      filepath: string;
      mimetype: string;
      filesize: number;
    },
    caption: string | undefined,
    userId: string
  ): Promise<PhotoResponse> {
    // Check if incident exists
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      // Clean up uploaded file
      await this.deleteFile(file.filepath);
      throw new NotFoundError('Incident not found');
    }

    // Validate file type
    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validMimeTypes.includes(file.mimetype)) {
      await this.deleteFile(file.filepath);
      throw new ValidationError(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed'
      );
    }

    // Validate file size (from constants)
    const maxSize = parseInt(env.MAX_FILE_SIZE);
    if (file.filesize > maxSize) {
      await this.deleteFile(file.filepath);
      throw new ValidationError(
        `File size too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`
      );
    }

    // Create photo record
    const photo = await this.prisma.incidentPhoto.create({
      data: {
        incidentId,
        filename: file.filename,
        filepath: file.filepath,
        url: `/uploads/${file.filename}`, // Public URL
        size: file.filesize,
        mimeType: file.mimetype,
        caption: caption || null,
        uploadedById: userId,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create incident update
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId,
        userId,
        message: `Photo uploaded: ${file.filename}`,
        updateType: 'INFO',
      },
    });

    return this.formatPhotoResponse(photo);
  }

  async getIncidentPhotos(incidentId: string): Promise<PhotoResponse[]> {
    // Check if incident exists
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new NotFoundError('Incident not found');
    }

    const photos = await this.prisma.incidentPhoto.findMany({
      where: { incidentId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return photos.map((photo) => this.formatPhotoResponse(photo));
  }

  async getPhotoById(id: string): Promise<PhotoResponse> {
    const photo = await this.prisma.incidentPhoto.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    return this.formatPhotoResponse(photo);
  }

  async updateCaption(id: string, data: UpdatePhotoCaptionDTO, userId: string) {
    const photo = await this.prisma.incidentPhoto.findUnique({
      where: { id },
    });

    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    const updated = await this.prisma.incidentPhoto.update({
      where: { id },
      data: { caption: data.caption },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create incident update
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId: photo.incidentId,
        userId,
        message: `Photo caption updated: ${photo.filename}`,
        updateType: 'INFO',
      },
    });

    return this.formatPhotoResponse(updated);
  }

  async deletePhoto(id: string, userId: string): Promise<void> {
    const photo = await this.prisma.incidentPhoto.findUnique({
      where: { id },
    });

    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    // Delete file from filesystem
    await this.deleteFile(photo.filepath);

    // Delete database record
    await this.prisma.incidentPhoto.delete({
      where: { id },
    });

    // Create incident update
    await this.prisma.incidentUpdate.create({
      data: {
        incidentId: photo.incidentId,
        userId,
        message: `Photo deleted: ${photo.filename}`,
        updateType: 'INFO',
      },
    });
  }

  async getPhotoFile(id: string): Promise<{ filepath: string; mimeType: string }> {
    const photo = await this.prisma.incidentPhoto.findUnique({
      where: { id },
      select: {
        filepath: true,
        mimeType: true,
      },
    });

    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    // Check if file exists
    try {
      await fs.access(photo.filepath);
    } catch (error) {
      throw new NotFoundError('Photo file not found on server');
    }

    return photo;
  }

  private formatPhotoResponse(photo: any): PhotoResponse {
    return {
      id: photo.id,
      incidentId: photo.incidentId,
      filename: photo.filename,
      filepath: photo.filepath,
      filesize: photo.filesize,
      mimetype: photo.mimetype,
      caption: photo.caption,
      url: `/api/v1/photos/${photo.id}/file`,
      uploadedAt: photo.uploadedAt,
      uploadedBy: photo.uploadedBy,
    };
  }

  private async deleteFile(filepath: string): Promise<void> {
    try {
      await fs.unlink(filepath);
    } catch (error) {
      // File might not exist, ignore error
    }
  }
}
