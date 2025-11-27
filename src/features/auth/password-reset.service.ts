import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PasswordService } from '../../core/utils/password';
import { ValidationError } from '../../core/errors';

export class PasswordResetService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Request password reset - generates secure token
   */
  async requestPasswordReset(email: string): Promise<{ resetToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // SECURITY: Don't reveal if email exists (prevents user enumeration)
    if (!user) {
      // Still return success to prevent email enumeration
      return { resetToken: '' };
    }

    // Generate cryptographically secure token
    const resetToken = randomBytes(32).toString('hex');
    const hashedToken = PasswordService.hashToken(resetToken);

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Invalidate any existing tokens
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Create new reset token
    await this.prisma.passwordResetToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt,
      },
    });

    // TODO: Send email with reset link
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { resetToken }; // Return unhashed token for email
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = PasswordService.hashToken(token);

    // Find valid, unused, non-expired token
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token: hashedToken,
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetToken) {
      throw new ValidationError('Invalid or expired reset token');
    }

    // Validate new password strength
    const validation = PasswordService.validate(newPassword);
    if (!validation.valid) {
      throw new ValidationError(validation.message!);
    }

    // Hash new password
    const hashedPassword = await PasswordService.hash(newPassword);

    // Update password and mark token as used (atomic transaction)
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      // Revoke all refresh tokens (force re-login)
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId },
        data: { isRevoked: true },
      }),
    ]);

    // TODO: Send confirmation email
    // await this.emailService.sendPasswordChangedEmail(resetToken.user.email);
  }

  /**
   * Request password reset for personnel
   */
  async requestPersonnelPasswordReset(identifier: string): Promise<{ resetToken: string }> {
    const personnel = await this.prisma.personnel.findFirst({
      where: {
        OR: [
          { employeeId: identifier },
          { email: identifier },
          { phone: identifier },
        ],
      },
    });

    // SECURITY: Don't reveal if identifier exists
    if (!personnel) {
      return { resetToken: '' };
    }

    const resetToken = randomBytes(32).toString('hex');
    const hashedToken = PasswordService.hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.personnelPasswordResetToken.updateMany({
      where: { personnelId: personnel.id, used: false },
      data: { used: true },
    });

    await this.prisma.personnelPasswordResetToken.create({
      data: {
        token: hashedToken,
        personnelId: personnel.id,
        expiresAt,
      },
    });

    return { resetToken };
  }

  /**
   * Reset personnel password using token
   */
  async resetPersonnelPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = PasswordService.hashToken(token);

    const resetToken = await this.prisma.personnelPasswordResetToken.findFirst({
      where: {
        token: hashedToken,
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { personnel: true },
    });

    if (!resetToken) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const validation = PasswordService.validate(newPassword);
    if (!validation.valid) {
      throw new ValidationError(validation.message!);
    }

    const hashedPassword = await PasswordService.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.personnel.update({
        where: { id: resetToken.personnelId },
        data: { password: hashedPassword },
      }),
      this.prisma.personnelPasswordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);
  }
}
