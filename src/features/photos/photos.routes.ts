import { FastifyInstance } from 'fastify';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { UpdatePhotoCaptionDTO } from './photos.types';
import { prisma } from '../../config/database';
import { validate, authMiddleware } from '../../core/middleware';
import { updateCaptionSchema } from './photos.schema';

export async function photosRoutes(app: FastifyInstance) {
  const photosService = new PhotosService(prisma);
  const photosController = new PhotosController(photosService);

  // All routes require authentication
  app.addHook('preHandler', authMiddleware);

  // Upload photo (multipart/form-data)
  app.post('/upload', photosController.uploadPhoto.bind(photosController));

  // Get photos for an incident
  app.get(
    '/incident/:incidentId',
    photosController.getIncidentPhotos.bind(photosController)
  );

  // Get photo details
  app.get('/:id', photosController.getPhotoById.bind(photosController));

  // Get photo file (actual image)
  app.get('/:id/file', photosController.getPhotoFile.bind(photosController));

  // Update photo caption
  app.patch<{ Params: { id: string }; Body: UpdatePhotoCaptionDTO }>(
    '/:id/caption',
    {
      preHandler: [validate(updateCaptionSchema)],
    },
    photosController.updateCaption.bind(photosController)
  );

  // Delete photo
  app.delete('/:id', photosController.deletePhoto.bind(photosController));
}
