import { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { env } from '../config/environment';
import path from 'path';

export async function staticPlugin(app: FastifyInstance) {
  // Add CORS headers for static file requests
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/uploads/')) {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  });

  await app.register(fastifyStatic, {
    root: path.resolve(env.UPLOAD_DIR),
    prefix: '/uploads/',
  });
}
