import { buildApp } from './app';
import { env } from './config/environment';
import { logger } from './core/utils/logger';
import { prisma } from './config/database';

async function start() {
  try {
    // Build Fastify app
    const app = await buildApp();

    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Start server
    const port = parseInt(env.PORT);
    const host = env.HOST;

    await app.listen({ port, host });

    logger.info(`🚀 Server running on http://${host}:${port}`);
    logger.info(`📊 Health check: http://${host}:${port}/health`);
    logger.info(`🔌 WebSocket ready on ws://${host}:${port}`);
    logger.info(`🌍 Environment: ${env.NODE_ENV}`);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

start();
