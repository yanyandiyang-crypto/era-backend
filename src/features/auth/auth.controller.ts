import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { LoginDTO, RefreshTokenDTO, ChangePasswordDTO } from './auth.types';
import { SuccessResponse } from '../../types';
import { env } from '../../config/environment';

export class AuthController {
  constructor(private authService: AuthService) {}

  async login(
    request: FastifyRequest<{ Body: LoginDTO }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.authService.login(
        request.body,
        request.ip,
        request.headers['user-agent']
      );

      // OWASP A05: Use httpOnly cookies for web clients to prevent XSS token theft
      const isWebClient = request.headers['user-agent']?.includes('Mozilla') || 
                          request.headers['sec-fetch-site'] !== undefined;

      if (isWebClient) {
        // Use httpOnly cookies for web clients to prevent XSS token theft
        reply.cookie('accessToken', result.accessToken, {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
          maxAge: 15 * 60, // 15 minutes in seconds
          path: '/',
        });

        reply.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
          maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
          path: '/api/v1/auth/refresh',
        });

        // Send tokens in response body as well to support mobile clients, but web will use cookies
        const response: SuccessResponse = {
          success: true,
          data: result,
          message: 'Login successful',
        };
        return reply.status(200).send(response);
      } else {
        // Mobile apps still receive tokens in response body
        const response: SuccessResponse = {
          success: true,
          data: result,
          message: 'Login successful',
        };
        return reply.status(200).send(response);
      }
    } catch (error) {
      // Return structured error to client
      return reply.status(500).send({
        success: false,
        error: { message: 'Internal server error during login' },
      });
    }
  }

  async refreshToken(
    request: FastifyRequest<{ Body: RefreshTokenDTO }>,
    reply: FastifyReply
  ) {
    // Get refresh token from cookie or body (use optional chaining to avoid crashes)
    const refreshToken = request.cookies?.refreshToken || request.body?.refreshToken;
    
    if (!refreshToken) {
      return reply.status(401).send({
        success: false,
        error: { message: 'Refresh token required', statusCode: 401 },
      });
    }

    const result = await this.authService.refreshToken(refreshToken);

    // Check if client is using cookies
    const isWebClient = request.cookies?.refreshToken !== undefined;

    if (isWebClient) {
      // Update cookies
      reply.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60,
        path: '/',
      });

      const response: SuccessResponse = {
        success: true,
        data: { user: result.user },
        message: 'Token refreshed successfully',
      };
      return reply.status(200).send(response);
    } else {
      const response: SuccessResponse = {
        success: true,
        data: result,
        message: 'Token refreshed successfully',
      };
      return reply.status(200).send(response);
    }
  }

  async logout(
    request: FastifyRequest<{ Body: { refreshToken?: string } }>,
    reply: FastifyReply
  ) {
    const refreshToken = request.cookies?.refreshToken || request.body?.refreshToken;
    
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear cookies if present
    if (request.cookies?.accessToken || request.cookies?.refreshToken) {
      reply.clearCookie('accessToken', { path: '/' });
      reply.clearCookie('refreshToken', { path: '/api/v1/auth/refresh' });
    }

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'Logout successful',
    };

    return reply.status(200).send(response);
  }

  async changePassword(
    request: FastifyRequest<{ Body: ChangePasswordDTO }>,
    reply: FastifyReply
  ) {
    // Support both userId (new tokens) and id (legacy personnel tokens)
    const userId = (request.user as any).userId || (request.user as any).id;
    await this.authService.changePassword(userId, request.body);

    const response: SuccessResponse = {
      success: true,
      data: null,
      message: 'Password changed successfully',
    };

    return reply.status(200).send(response);
  }

  async getCurrentUser(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user!.userId;
    const user = await this.authService.getCurrentUser(userId);

    const response: SuccessResponse = {
      success: true,
      data: user,
    };

    return reply.status(200).send(response);
  }

}
