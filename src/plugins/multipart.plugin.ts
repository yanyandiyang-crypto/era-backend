import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import fp from 'fastify-plugin';
import { env } from '../config/environment';

async function multipartPluginCore(app: FastifyInstance) {
  // console.log('[MULTIPART] Registering multipart plugin with config:', { maxFileSize: env.MAX_FILE_SIZE, maxFiles: 10 });
  
  await app.register(multipart, {
    limits: {
      fileSize: parseInt(env.MAX_FILE_SIZE), // 5MB default
      files: 10, // Allow up to 10 files per upload
    },
    attachFieldsToBody: false, // Don't attach fields to body (we'll parse manually)
  });
  
  // console.log('[MULTIPART] Plugin registered successfully');
}

// Export as non-encapsulated plugin so it's available to all routes
export const multipartPlugin = fp(multipartPluginCore, {
  name: 'multipart-plugin',
  fastify: '4.x'
});
