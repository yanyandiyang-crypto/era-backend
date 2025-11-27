import { FastifyInstance } from 'fastify';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserListQuery, CreateUserDTO, UpdateUserDTO } from './users.types';
import { prisma } from '../../config/database';
import { validate, authMiddleware, requireRole } from '../../core/middleware';
import { createUserSchema, updateUserSchema, userListQuerySchema } from './users.schema';

export async function usersRoutes(app: FastifyInstance) {
  const usersService = new UsersService(prisma);
  const usersController = new UsersController(usersService);

  // All user routes require authentication and admin role
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', requireRole('ADMIN', 'SUPER_ADMIN'));

  // Get user statistics
  app.get('/stats', usersController.getUserStats.bind(usersController));

  // Get all users
  app.get<{ Querystring: UserListQuery }>(
    '/',
    {
      preHandler: [validate(userListQuerySchema, 'query')],
    },
    usersController.getUsers.bind(usersController)
  );

  // Get user by ID
  app.get('/:id', usersController.getUserById.bind(usersController));

  // Create user
  app.post<{ Body: CreateUserDTO }>(
    '/',
    {
      preHandler: [validate(createUserSchema)],
    },
    usersController.createUser.bind(usersController)
  );

  // Update user
  app.put<{ Params: { id: string }; Body: UpdateUserDTO }>(
    '/:id',
    {
      preHandler: [validate(updateUserSchema)],
    },
    usersController.updateUser.bind(usersController)
  );

  // Delete user
  app.delete('/:id', usersController.deleteUser.bind(usersController));
}
