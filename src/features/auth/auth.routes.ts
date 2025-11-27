import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDTO, RefreshTokenDTO, ChangePasswordDTO } from './auth.types';
import { prisma } from '../../config/database';
import { validate, authMiddleware } from '../../core/middleware';
import { loginSchema, refreshTokenSchema, logoutSchema, changePasswordSchema } from './auth.schema';

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(prisma);
  const authController = new AuthController(authService);

  // Public routes
  // OWASP A07: Rate limit authentication to prevent brute force attacks
  app.post<{ Body: LoginDTO }>(
    '/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          errorResponseBuilder: (request, context) => ({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'Too many login attempts. Please try again in 15 minutes.',
            retryAfter: Math.ceil(context.ttl / 1000), // seconds
          }),
        },
      },
      preHandler: [validate(loginSchema)],
    },
    authController.login.bind(authController)
  );

  app.post<{ Body: RefreshTokenDTO }>(
    '/refresh',
    // Allow refresh token to come from cookie OR body. Validation is skipped here
    // because the client may send the token as a cookie (web client) or in the
    // request body (mobile / programmatic clients). The controller handles
    // presence checks and will return 401 when missing/invalid.
    {},
    authController.refreshToken.bind(authController)
  );

  // Protected routes
  app.post<{ Body: { refreshToken?: string } }>(
    '/logout',
    {
      preHandler: [authMiddleware, validate(logoutSchema)],
    },
    authController.logout.bind(authController)
  );

  app.get(
    '/me',
    {
      preHandler: [authMiddleware],
    },
    authController.getCurrentUser.bind(authController)
  );

  app.post<{ Body: ChangePasswordDTO }>(
    '/change-password',
    {
      preHandler: [authMiddleware, validate(changePasswordSchema)],
    },
    authController.changePassword.bind(authController)
  );
}
