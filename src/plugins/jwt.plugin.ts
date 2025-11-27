import { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { env } from '../config/environment';
import { getPrivateKey, getPublicKey } from '../core/utils/jwt-keys';

export async function jwtPlugin(app: FastifyInstance) {
  let privateKey: string;
  let publicKey: string;
  let useRS256 = false;

  try {
    privateKey = getPrivateKey();
    publicKey = getPublicKey();
    useRS256 = true;
    // console.log('[JWT Plugin] ✅ Using RS256 with RSA keys for signing and verification');
  } catch (error) {
    // console.warn('[JWT Plugin] ⚠️ RS256 keys not found, falling back to HS256 secret');
    privateKey = env.JWT_ACCESS_SECRET;
    publicKey = env.JWT_ACCESS_SECRET;
  }

  if (useRS256) {
    // RS256 configuration with separate keys
    await app.register(fastifyJwt, {
      secret: {
        private: privateKey,
        public: publicKey
      },
      sign: {
        algorithm: 'RS256',
      },
      verify: {
        algorithms: ['RS256'],
      },
    });
  } else {
    // HS256 fallback configuration
    await app.register(fastifyJwt, {
      secret: privateKey,
      sign: {
        algorithm: 'HS256',
      },
      verify: {
        algorithms: ['HS256'],
      },
    });
  }

  // console.log('[JWT Plugin] ✅ JWT plugin registered successfully');
  // console.log('[JWT Plugin] ✅ jwtVerify and jwtSign methods should now be available');
}
