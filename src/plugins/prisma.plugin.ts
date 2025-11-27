import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { logger } from '../core/utils/logger';
import { applyEncryptionMiddleware } from '../core/middleware/encryption.middleware';

// Extend Fastify instance type
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export async function prismaPluginAsync(app: FastifyInstance) {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Apply encryption middleware for data protection
  applyEncryptionMiddleware(prisma);
  logger.info('Data encryption middleware applied');

  // Test the connection
  await prisma.$connect();
  logger.info('Database connected successfully');

  // Decorate Fastify instance with Prisma client
  app.decorate('prisma', prisma);

  // Close connection when app closes
  app.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
    logger.info('Database disconnected');
  });
}

export const prismaPlugin = fp(prismaPluginAsync, {
  name: 'prisma'
});
