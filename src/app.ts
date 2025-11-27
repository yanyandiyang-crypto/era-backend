import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import { errorHandler } from './core/middleware';
import { corsPlugin, websocketPlugin, multipartPlugin, staticPlugin, rateLimitPlugin, jwtPlugin, cookiePlugin, prismaPlugin } from './plugins';
import { securityHeadersMiddleware, requestSecurityMiddleware, denyAccessMiddleware } from './core/middleware/security.middleware';
import { logger } from './core/utils/logger';
import { env } from './config/environment';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Use custom logger
  });

  // Register CORS plugin FIRST (OWASP A05: Strict origin whitelist)
  await app.register(corsPlugin);

  // Register cookie plugin for session management
  await app.register(cookiePlugin);

  // Re-enable Helmet with CORS-compatible configuration
  await app.register(helmet, {
    global: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "ws:"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow CORS
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xFrameOptions: { action: 'deny' },
    noSniff: true,
  });

  // Register JWT plugin (RS256 with fallback)
  await app.register(jwtPlugin);

  // Register security middleware before routes (skip for OPTIONS)
  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'OPTIONS') return;
    await requestSecurityMiddleware(request, reply);
  });
  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'OPTIONS') return;
    await denyAccessMiddleware(request, reply);
  });
  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'OPTIONS') return;
    await securityHeadersMiddleware(request, reply);
  });

  // DEBUG: Log all incoming requests
  app.addHook('onRequest', async (request, reply) => {
    console.log(`📥 INCOMING REQUEST: ${request.method} ${request.url}`);
  });

  await app.register(rateLimitPlugin); // Must be before routes
  await app.register(multipartPlugin); // This plugin automatically adds multipart/form-data content-type parser
  await app.register(staticPlugin);

  // Register Prisma plugin (required by websocket plugin)
  await app.register(prismaPlugin);

  // Register WebSocket plugin BEFORE routes so io is available in controllers
  await app.register(websocketPlugin);

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API routes - Import dynamically
  const { authRoutes } = await import('./features/auth/auth.routes.js');
  const { usersRoutes } = await import('./features/users/users.routes.js');
  const { personnelRoutes } = await import('./features/personnel/personnel.routes.js');
  const { barangaysRoutes } = await import('./features/barangays/barangays.routes.js');
  const { incidentsRoutes } = await import('./features/incidents/incidents.routes.js');
  const { dashboardRoutes } = await import('./features/dashboard/dashboard.routes.js');
  const { photosRoutes } = await import('./features/photos/photos.routes.js');
  const { auditRoutes } = await import('./features/audit/audit.routes.js');
  const { reportsRoutes } = await import('./features/reports/reports.routes.js');
  const { notificationsRoutes } = await import('./features/notifications/notifications.routes.js');
  const { searchRoutes } = await import('./features/search/search.routes.js');
  const { rateLimitRoutes } = await import('./features/rate-limit/rate-limit.routes.js');
  const { accountProtectionRoutes } = await import('./core/routes/account-protection.routes.js');
  const { publicRoutes } = await import('./features/public/public.routes.js');

  // Register routes with API prefix
  // Public routes (NO AUTHENTICATION REQUIRED)
  await app.register(publicRoutes, { prefix: '/api/v1/public' });

  // Protected routes (require authentication)
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(usersRoutes, { prefix: '/api/v1/users' });
  await app.register(personnelRoutes, { prefix: '/api/v1/personnel' });
  await app.register(barangaysRoutes, { prefix: '/api/v1/barangays' });
  await app.register(incidentsRoutes, { prefix: '/api/v1/incidents' });
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(photosRoutes, { prefix: '/api/v1/photos' });
  await app.register(auditRoutes, { prefix: '/api/v1/audit' });
  await app.register(reportsRoutes, { prefix: '/api/v1/reports' });
  await app.register(notificationsRoutes, { prefix: '/api/v1/notifications' });
  await app.register(searchRoutes, { prefix: '/api/v1/search' });
  await app.register(rateLimitRoutes, { prefix: '/api/v1/rate-limit' });
  await app.register(accountProtectionRoutes, { prefix: '/api/v1/admin/security' });

  // Error handler (must be last)
  app.setErrorHandler(errorHandler);

  logger.info('Fastify app built successfully');

  return app;
}
