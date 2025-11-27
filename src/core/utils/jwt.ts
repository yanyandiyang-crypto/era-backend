import jwt, { SignOptions, Algorithm } from 'jsonwebtoken';
import { env } from '../../config/environment';
import { getPrivateKey, getPublicKey } from './jwt-keys';
import { PrismaClient } from '@prisma/client';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  iss?: string;
  aud?: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  iat?: number;
  iss?: string;
  aud?: string;
}

export class JWTService {
  private static readonly ISSUER = 'era-backend';
  private static readonly AUDIENCE = 'era-frontend';
  private static readonly ALGORITHM: Algorithm = 'RS256';
  private static prisma = new PrismaClient();

  static sign(payload: AccessTokenPayload | RefreshTokenPayload, secret: string, expiresIn: string | number): string {
    return jwt.sign(payload, secret, { expiresIn, algorithm: this.ALGORITHM } as SignOptions);
  }

  static async generateAccessToken(payload: AccessTokenPayload): Promise<string> {
    const enhancedPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      iss: this.ISSUER,
      aud: this.AUDIENCE,
    };
    try {
      const privateKey = getPrivateKey();
      return this.sign(
        enhancedPayload,
        privateKey,
        env.JWT_ACCESS_EXPIRY
      );
    } catch (error) {
      // Fallback to HS256 if keys not available (dev mode)
      // eslint-disable-next-line no-console
      // console.warn('[JWT] RS256 keys not found, falling back to HS256', error);
      return jwt.sign(enhancedPayload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY } as SignOptions);
    }
  }

  static async generateRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    const enhancedPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      iss: this.ISSUER,
      aud: this.AUDIENCE,
    };

    // Store refresh token in DB for revocation
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.prisma.refreshToken.create({
      data: {
        tokenId: payload.tokenId,
        userId: payload.userId,
        expiresAt,
      },
    });

    try {
      return this.sign(
        enhancedPayload,
        getPrivateKey(),
        env.JWT_REFRESH_EXPIRY
      );
    } catch (error) {
      // Fallback to HS256 if keys not available (dev mode)
      // eslint-disable-next-line no-console
      // console.warn('[JWT] RS256 keys not found, falling back to HS256');
      return jwt.sign(enhancedPayload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRY } as SignOptions);
    }
  }

  static verify<T = unknown>(token: string, secret: string): T {
    try {
      return jwt.verify(token, secret, {
        algorithms: [this.ALGORITHM],
        issuer: this.ISSUER,
        audience: this.AUDIENCE,
      }) as T;
    } catch (error) {
      // Fallback to HS256 verification
      try {
        return jwt.verify(token, secret) as T;
      } catch (fallbackError) {
        throw new Error('Invalid or expired token');
      }
    }
  }

  static verifyAccessToken(token: string): AccessTokenPayload {
    try {
      // Try HS256 verification first (for mobile personnel tokens)
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
      }) as AccessTokenPayload;
      // eslint-disable-next-line no-console
      // console.log('[JWT] ✅ Access token verified with HS256');
      return payload;
    } catch (hs256Error) {
      // Fallback to RS256 for admin tokens
      try {
        const payload = this.verify<AccessTokenPayload>(token, getPublicKey());
        // eslint-disable-next-line no-console
        // console.log('[JWT] ✅ Access token verified with RS256');
        return payload;
      } catch (rs256Error) {
        // eslint-disable-next-line no-console
        // console.error('[JWT] ❌ Both HS256 and RS256 verification failed');
        throw new Error('Invalid or expired token');
      }
    }
  }

  static async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    let payload: RefreshTokenPayload;
    try {
      // Try HS256 verification first (for mobile personnel tokens)
      payload = jwt.verify(token, env.JWT_REFRESH_SECRET, {
        algorithms: ['HS256'],
      }) as RefreshTokenPayload;
    } catch (hs256Error) {
      // Fallback to RS256 for admin tokens
      try {
        payload = this.verify<RefreshTokenPayload>(token, getPublicKey());
      } catch (rs256Error) {
        throw new Error('Invalid or expired refresh token');
      }
    }

    // Check if token is revoked in DB
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenId: payload.tokenId },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      throw new Error('Refresh token revoked or expired');
    }

    return payload;
  }

  static async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenId },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  static async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }
}
