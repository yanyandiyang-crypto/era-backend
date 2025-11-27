import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = new PrismaClient({
  // Enhanced logging configuration
  log: process.env.NODE_ENV === 'development'
    ? [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
      ]
    : ['error'],
});

// Performance monitoring for slow queries
prisma.$on('query', (e: any) => {
  if (e.duration > 5000) { // Log slow queries (>5 seconds)
    console.warn(`[SLOW QUERY] ${e.query} | Duration: ${e.duration}ms`);
  }
});

prisma.$on('error', (e: any) => {
  console.error('[DATABASE ERROR]', e);
});

// Performance monitoring
prisma.$on('query', (e) => {
  if (e.duration > 5000) { // Log slow queries (>5 seconds)
    console.warn(`[SLOW QUERY] ${e.query} | Duration: ${e.duration}ms`);
  }
});

prisma.$on('error', (e) => {
  console.error('[DATABASE ERROR]', e);
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
