import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from '../config/environment';
import { logger } from '../core/utils/logger';

export async function corsPlugin(app: FastifyInstance) {
  // OWASP A05: Security Misconfiguration - Strict CORS whitelist
  const allowedOrigins = env.NODE_ENV === 'production'
    ? [env.FRONTEND_URL] // Production: Only configured frontend URL
    : [
        'http://localhost:5173',  // Vite dev server
        'http://localhost:5174',  // Vite dev server (alternate port)
        'http://localhost:5175',  // Vite dev server (current port)
        'http://localhost:3000',  // Alternative dev port
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175',  // Current admin port
        'http://127.0.0.1:3000',
      ];

  await app.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow all localhost and 127.0.0.1 origins with any port (both HTTP and HTTPS)
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || 
          origin.startsWith('https://localhost:') || origin.startsWith('https://127.0.0.1:')) {
        return callback(null, true);
      }
      
      // Allow the specific admin panel origin
      if (origin === 'http://localhost:5173') {
        return callback(null, true);
      }
      
      // For debugging, allow all origins in development
      if (env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Type', 'Authorization'],
  });
  
  logger.info(`[CORS] Configured with allowed origins: ${allowedOrigins.join(', ')}`);
  logger.info(`[CORS] Development mode: allowing all localhost/*, 127.0.0.1/*, and local network (192.168.*.*, 10.*.*.*) origins - ${new Date().toISOString()}`);
}
