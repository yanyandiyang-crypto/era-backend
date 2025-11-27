import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger';

/**
 * Security Headers Middleware
 * Adds critical security headers to all responses
 */
export async function securityHeadersMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Security headers (CORS is handled by the CORS plugin)
  // Add explicit CORS headers as fallback for admin panel and mobile app
  const origin = request.headers.origin;
  if (origin === 'http://localhost:5173' || origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:') ||
      origin?.startsWith('https://localhost:') || origin?.startsWith('https://127.0.0.1:')) {
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, X-Requested-With, Accept');
    reply.header('Access-Control-Expose-Headers', 'Content-Type, Authorization');
  }

  // Prevent MIME type sniffing
  reply.header('X-Content-Type-Options', 'nosniff');

  // Prevent Clickjacking attacks
  reply.header('X-Frame-Options', 'DENY');

  // Enable XSS protection in older browsers
  reply.header('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Feature-Policy / Permissions-Policy
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Strict Transport Security (for HTTPS)
  if (process.env.NODE_ENV === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy
  reply.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';"
  );
}

/**
 * Request Security Validation Middleware
 * Validates requests for suspicious patterns
 */
export async function requestSecurityMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  // Check for path traversal attempts
  const pathTraversalPattern = /\.\.\//g;
  if (pathTraversalPattern.test(request.url)) {
    logger.warn(`[SECURITY] Path traversal attempt detected from ${request.ip}: ${request.url}`);
    throw new Error('Invalid request path');
  }

  // Check for SQL injection patterns in query parameters
  const sqlInjectionPattern = /(union|select|insert|update|delete|drop|create|alter|exec|execute|script|javascript|onerror|onclick)/i;
  const queryString = new URLSearchParams(request.url.split('?')[1] || '');

  for (const [key, value] of queryString.entries()) {
    if (sqlInjectionPattern.test(value)) {
      logger.warn(
        `[SECURITY] Potential SQL injection attempt in parameter '${key}' from ${request.ip}`
      );
      // Don't throw - just log and sanitize
    }
  }

  // Check for suspicious headers
  const userAgent = request.headers['user-agent'] || '';
  if (userAgent.toLowerCase().includes('sqlmap') || userAgent.toLowerCase().includes('nikto')) {
    logger.warn(`[SECURITY] Suspicious user agent detected from ${request.ip}: ${userAgent}`);
  }
}

/**
 * Deny access to sensitive files and directories
 */
export async function denyAccessMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const sensitivePatterns = [
    /^\/\.env/i,
    /^\/\.git\//i,
    /^\/\.well-known\//i,
    /^\/admin-panel\//i,
    /^\/config\//i,
    /^\/\.htaccess/i,
    /^\/web\.config/i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(request.url)) {
      logger.warn(`[SECURITY] Access attempt to sensitive resource from ${request.ip}: ${request.url}`);
      reply.status(404).send({ message: 'Not found' });
      return;
    }
  }
}
