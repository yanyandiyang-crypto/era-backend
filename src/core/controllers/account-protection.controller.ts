import { FastifyRequest, FastifyReply } from 'fastify';
import { AccountProtectionService } from '../utils/account-protection.service';
import { logger } from '../utils/logger';

export class AccountProtectionController {
  constructor(private accountProtectionService: AccountProtectionService) {}

  /**
   * Get login attempt statistics (admin only)
   */
  async getLoginStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { hours = 24 } = request.query as { hours?: number };

      const stats = await this.accountProtectionService.getLoginStats(hours);

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting login stats:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to retrieve login statistics',
      });
    }
  }

  /**
   * Clean up old login attempts (admin only)
   */
  async cleanupOldAttempts(request: FastifyRequest, reply: FastifyReply) {
    try {
      const deletedCount = await this.accountProtectionService.cleanupOldAttempts();

      return reply.send({
        success: true,
        message: `Cleaned up ${deletedCount} old login attempts`,
        data: { deletedCount },
      });
    } catch (error) {
      logger.error('Error cleaning up login attempts:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to cleanup login attempts',
      });
    }
  }

  /**
   * Check account lockout status (for debugging/testing)
   */
  async checkAccountLockout(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email } = request.query as { email: string };

      if (!email) {
        return reply.status(400).send({
          success: false,
          message: 'Email parameter is required',
        });
      }

      const lockoutStatus = await this.accountProtectionService.shouldLockAccount(email);

      return reply.send({
        success: true,
        data: lockoutStatus,
      });
    } catch (error) {
      logger.error('Error checking account lockout:', error);
      return reply.status(500).send({
        success: false,
        message: 'Failed to check account lockout status',
      });
    }
  }
}