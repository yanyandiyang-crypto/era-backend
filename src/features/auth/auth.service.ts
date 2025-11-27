import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../../core/utils/password';
import { JWTService, AccessTokenPayload, RefreshTokenPayload } from '../../core/utils/jwt';
import { UnauthorizedError, ValidationError } from '../../core/errors';
import { LoginDTO, LoginResponse, RefreshTokenResponse, ChangePasswordDTO } from './auth.types';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit.types';
import { AccountProtectionService } from '../../core/utils/account-protection.service';

export class AuthService {
  private accountProtectionService: AccountProtectionService;

  constructor(private prisma: PrismaClient) {
    this.accountProtectionService = new AccountProtectionService(prisma);
  }

  
  async login(data: LoginDTO, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      // Log failed login attempt
      const auditService = new AuditService(this.prisma);
      await auditService.createLog({
        action: AuditAction.LOGIN_FAILED,
        resourceType: 'AUTH',
        resourceId: data.email,
        details: {
          email: data.email,
          reason: 'User not found',
        },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if account should be locked based on progressive lockout
    const lockoutStatus = await this.accountProtectionService.shouldLockAccount(user.email);
    if (lockoutStatus.locked) {
      const minutesLeft = lockoutStatus.unlockTime
        ? Math.ceil((lockoutStatus.unlockTime.getTime() - Date.now()) / 60000)
        : 0;

      // Record failed attempt (even though we're blocking)
      await this.accountProtectionService.recordLoginAttempt({
        email: user.email,
        ipAddress: ipAddress || 'unknown',
        userAgent,
        successful: false,
        timestamp: new Date(),
      });

      const auditService = new AuditService(this.prisma);
      await auditService.createLog({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        resourceType: 'AUTH',
        resourceId: user.id,
        details: {
          email: user.email,
          reason: 'Account locked (progressive lockout)',
          attempts: lockoutStatus.attempts,
          minutesRemaining: minutesLeft,
        },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedError(`Account locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`);
    }

    // Check if user is active
    if (!user.isActive) {
      // Log failed login attempt
      const auditService = new AuditService(this.prisma);
      await auditService.createLog({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        resourceType: 'AUTH',
        resourceId: user.id,
        details: {
          email: user.email,
          reason: 'Account disabled',
        },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedError('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await PasswordService.compare(data.password, user.password);

    if (!isPasswordValid) {
      // Record failed login attempt
      await this.accountProtectionService.recordLoginAttempt({
        email: user.email,
        ipAddress: ipAddress || 'unknown',
        userAgent,
        successful: false,
        timestamp: new Date(),
      });

      // Log failed login attempt
      const auditService = new AuditService(this.prisma);
      await auditService.createLog({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        resourceType: 'AUTH',
        resourceId: user.id,
        details: {
          email: user.email,
          reason: 'Invalid password',
        },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Record successful login attempt
    await this.accountProtectionService.recordLoginAttempt({
      userId: user.id,
      email: user.email,
      ipAddress: ipAddress || 'unknown',
      userAgent,
      successful: true,
      timestamp: new Date(),
    });

    // Reset legacy failed attempts fields (for backward compatibility)
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastFailedLogin: null,
        },
      });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate tokens
    const accessTokenPayload: AccessTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const refreshTokenPayload: RefreshTokenPayload = {
      userId: user.id,
      tokenId: randomBytes(16).toString('hex'),
    };

    const accessToken = await JWTService.generateAccessToken(accessTokenPayload);
    const refreshToken = await JWTService.generateRefreshToken(refreshTokenPayload);

    // Log successful login
    const auditService = new AuditService(this.prisma);
    await auditService.createLog({
      userId: user.id,
      action: AuditAction.LOGIN,
      resourceType: 'AUTH',
      resourceId: user.id,
      details: {
        email: user.email,
        role: user.role,
      },
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      // Verify refresh token
      const payload = await JWTService.verifyRefreshToken(refreshToken);

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Generate new tokens
      const accessTokenPayload: AccessTokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const newRefreshTokenPayload: RefreshTokenPayload = {
        userId: user.id,
        tokenId: randomBytes(16).toString('hex'),
      };

      const newAccessToken = await JWTService.generateAccessToken(accessTokenPayload);
      const newRefreshToken = await JWTService.generateRefreshToken(newRefreshTokenPayload);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await JWTService.verifyRefreshToken(refreshToken);
      await JWTService.revokeRefreshToken(payload.tokenId);
    } catch (error) {
      // Token might already be invalid, but we don't throw error for logout
      // console.warn('[AUTH] Logout with invalid token:', error);
    }
  }

  async changePassword(userId: string, data: ChangePasswordDTO): Promise<void> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await PasswordService.compare(
      data.currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      throw new ValidationError('Current password is incorrect');
    }

    // Validate new password strength
    const passwordValidation = PasswordService.validate(data.newPassword);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.errors.join(', '));
    }

    // Hash new password
    const hashedPassword = await PasswordService.hash(data.newPassword);

    // OWASP A07/V3.3.2: Update password and revoke all refresh tokens
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all refresh tokens to force re-login on all devices
    await JWTService.revokeAllUserRefreshTokens(userId);

    // Log security event
    const auditService = new AuditService(this.prisma);
    await auditService.createLog({
      userId,
      action: AuditAction.PASSWORD_CHANGED,
      resourceType: 'USER',
      resourceId: userId,
      details: {
        message: 'Password changed - all sessions invalidated',
        tokensRevoked: true,
      },
    });
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return user;
  }
}
