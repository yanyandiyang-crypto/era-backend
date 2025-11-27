import { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import fp from 'fastify-plugin';
import { env } from '../config/environment';

async function cookiePluginFn(app: FastifyInstance) {
  // OWASP A05: Configure secure cookie handling
  await app.register(cookie, {
    secret: env.JWT_ACCESS_SECRET, // Sign cookies to prevent tampering
  });
  
  // eslint-disable-next-line no-console
  // console.log('[Cookie Plugin] Registered successfully');
}

export const cookiePlugin = fp(cookiePluginFn);
