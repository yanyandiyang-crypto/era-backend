import { FastifyInstance } from 'fastify';
import { AccountProtectionController } from '../controllers/account-protection.controller';
import { AccountProtectionService } from '../utils/account-protection.service';
import { requireRole } from '../middleware/auth.middleware';

export async function accountProtectionRoutes(fastify: FastifyInstance) {
  const accountProtectionService = new AccountProtectionService(fastify.prisma);
  const accountProtectionController = new AccountProtectionController(accountProtectionService);

  // All routes require admin authentication
  fastify.addHook('preHandler', requireRole('SUPER_ADMIN'));

  // GET /api/admin/security/login-stats - Get login attempt statistics
  fastify.get('/login-stats', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          hours: { type: 'number', default: 24, minimum: 1, maximum: 168 }, // Max 1 week
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalAttempts: { type: 'number' },
                successfulAttempts: { type: 'number' },
                failedAttempts: { type: 'number' },
                topFailingIPs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      ip: { type: 'string' },
                      count: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, accountProtectionController.getLoginStats.bind(accountProtectionController));

  // POST /api/admin/security/cleanup-attempts - Clean up old login attempts
  fastify.post('/cleanup-attempts', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                deletedCount: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, accountProtectionController.cleanupOldAttempts.bind(accountProtectionController));

  // GET /api/admin/security/check-lockout - Check account lockout status (for debugging)
  fastify.get('/check-lockout', {
    schema: {
      querystring: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                locked: { type: 'boolean' },
                unlockTime: { type: 'string', format: 'date-time' },
                attempts: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, accountProtectionController.checkAccountLockout.bind(accountProtectionController));
}