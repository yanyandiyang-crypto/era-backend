import { FastifyRequest, FastifyReply } from 'fastify';
import { UsersService } from './users.service';
import { CreateUserDTO, UpdateUserDTO, UserListQuery } from './users.types';
import { SuccessResponse } from '../../types';

export class UsersController {
  constructor(private usersService: UsersService) {}

  async createUser(
    request: FastifyRequest<{ Body: CreateUserDTO }>,
    reply: FastifyReply
  ) {
    const user = await this.usersService.createUser(request.body);

    const response: SuccessResponse = {
      success: true,
      data: user,
      message: 'User created successfully',
    };

    return reply.status(201).send(response);
  }

  async getUsers(
    request: FastifyRequest<{ Querystring: UserListQuery }>,
    reply: FastifyReply
  ) {
    const result = await this.usersService.getUsers(request.query);

    const response: SuccessResponse = {
      success: true,
      data: result,
    };

    return reply.status(200).send(response);
  }

  async getUserById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const user = await this.usersService.getUserById(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: user,
    };

    return reply.status(200).send(response);
  }

  async updateUser(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateUserDTO }>,
    reply: FastifyReply
  ) {
    const user = await this.usersService.updateUser(request.params.id, request.body);

    const response: SuccessResponse = {
      success: true,
      data: user,
      message: 'User updated successfully',
    };

    return reply.status(200).send(response);
  }

  async deleteUser(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    await this.usersService.deleteUser(request.params.id);

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'User deleted successfully',
    };

    return reply.status(200).send(response);
  }

  async getUserStats(request: FastifyRequest, reply: FastifyReply) {
    const stats = await this.usersService.getUserStats();

    const response: SuccessResponse = {
      success: true,
      data: stats,
    };

    return reply.status(200).send(response);
  }
}
