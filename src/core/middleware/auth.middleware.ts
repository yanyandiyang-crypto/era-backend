/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { JWTService } from '../utils/jwt';

export async function authMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  try {
    // OWASP A05: Support both cookie (web) and Authorization header (mobile) authentication
    let token: string | undefined;
    
    // Check for httpOnly cookie first (web clients)
    if (request.cookies.accessToken) {
      token = request.cookies.accessToken;
    } else {
      // Fallback to Authorization header (mobile clients)
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or invalid authorization header');
      }
      
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
    
    if (!token) {
      throw new UnauthorizedError('Authentication token required');
    }
    
    // Verify token using our JWT service
    const payload = JWTService.verifyAccessToken(token);
    
    // Attach user to request
    request.user = payload;
    
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = request.user as any;

    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}

/**
 * OWASP A01: Horizontal Access Control - Prevent IDOR attacks
 * Ensures user can only access their own resources unless they have admin role
 */
export function requireOwnershipOrRole(...roles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = request.user as any;
    const resourceId = (request.params as any)?.id || (request.params as any)?.personnelId;

    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Allow if user has privileged role
    if (roles.includes(user.role)) {
      return;
    }

    // Allow if user owns the resource (userId matches resource ID)
    if (user.userId === resourceId || (user as any).id === resourceId) {
      return;
    }

    throw new ForbiddenError('Access denied: You can only access your own resources');
  };
}
