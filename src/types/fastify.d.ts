import { Server as SocketIOServer } from 'socket.io';
import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
      email: string;
      role: string;
    };
    user: {
      userId: string;
      email: string;
      role: string;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }

  interface FastifyRequest {
    user?: FastifyJWT['user'];
  }
}
