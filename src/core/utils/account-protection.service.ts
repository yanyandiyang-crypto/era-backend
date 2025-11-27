import { PrismaClient } from '@prisma/client';

export interface LoginAttempt {
  userId?: string;
  email: string;
  ipAddress: string;
  userAgent?: string;
  successful: boolean;
  timestamp: Date;
}

export interface RiskAssessment {
  score: number; // 0-100, higher = more risky
  factors: string[];
  recommendedAction: 'allow' | 'challenge' | 'block';
}

export class AccountProtectionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Progressive lockout: 1min → 5min → 15min → 1hr
   */
  private static readonly LOCKOUT_PROGRESSION = [
    { attempts: 3, duration: 1 * 60 * 1000 },    // 1 minute
    { attempts: 5, duration: 5 * 60 * 1000 },    // 5 minutes
    { attempts: 8, duration: 15 * 60 * 1000 },   // 15 minutes
    { attempts: 10, duration: 60 * 60 * 1000 },  // 1 hour
  ];

  /**
   * Record a login attempt
   */
  async recordLoginAttempt(attempt: LoginAttempt): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: {
        userId: attempt.userId,
        email: attempt.email,
        ipAddress: attempt.ipAddress,
        userAgent: attempt.userAgent,
        successful: attempt.successful,
        attemptedAt: attempt.timestamp,
      },
    });
  }

  /**
   * Check if account should be locked based on failed attempts
   */
  async shouldLockAccount(email: string): Promise<{ locked: boolean; unlockTime?: Date; attempts: number }> {
    const recentAttempts = await this.prisma.loginAttempt.findMany({
      where: {
        email,
        successful: false,
        attemptedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: { attemptedAt: 'desc' },
    });

    const failedAttempts = recentAttempts.length;

    // Find appropriate lockout level
    for (const level of AccountProtectionService.LOCKOUT_PROGRESSION) {
      if (failedAttempts >= level.attempts) {
        const lastAttempt = recentAttempts[0]?.attemptedAt || new Date();
        const unlockTime = new Date(lastAttempt.getTime() + level.duration);

        return {
          locked: unlockTime > new Date(),
          unlockTime,
          attempts: failedAttempts,
        };
      }
    }

    return { locked: false, attempts: failedAttempts };
  }

  /**
   * Assess login risk based on various factors
   */
  async assessLoginRisk(
    email: string,
    ipAddress: string,
    userAgent?: string,
    userId?: string
  ): Promise<RiskAssessment> {
    const factors: string[] = [];
    let score = 0;

    // Factor 1: Recent failed attempts
    const recentFailures = await this.prisma.loginAttempt.count({
      where: {
        email,
        successful: false,
        attemptedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    if (recentFailures > 0) {
      score += Math.min(recentFailures * 10, 30);
      factors.push(`${recentFailures} recent failed attempts`);
    }

    // Factor 2: Unusual IP address (compared to user's history)
    if (userId) {
      const userIPs = await this.prisma.loginAttempt.findMany({
        where: {
          userId,
          successful: true,
          attemptedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        select: { ipAddress: true },
        distinct: ['ipAddress'],
      });

      const knownIPs = userIPs.map((ua: { ipAddress: string }) => ua.ipAddress);
      const isKnownIP = knownIPs.includes(ipAddress);

      if (!isKnownIP && knownIPs.length > 0) {
        score += 25;
        factors.push('Unusual IP address');
      }
    }

    // Factor 3: Unusual user agent
    if (userId && userAgent) {
      const recentUserAgents = await this.prisma.loginAttempt.findMany({
        where: {
          userId,
          successful: true,
          attemptedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
          },
        },
        select: { userAgent: true },
        take: 10,
      });

      const knownUserAgents = recentUserAgents
        .map((ua: { userAgent: string | null }) => ua.userAgent)
        .filter(Boolean) as string[];

      const isKnownUA = knownUserAgents.some(ua =>
        this.compareUserAgents(ua, userAgent)
      );

      if (!isKnownUA && knownUserAgents.length > 2) {
        score += 15;
        factors.push('Unusual device/browser');
      }
    }

    // Factor 4: Time-based anomalies (unusual hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) { // Outside 6 AM - 10 PM
      score += 10;
      factors.push('Unusual login time');
    }

    // Factor 5: Geographic anomalies (if we had geolocation)
    // This would require IP geolocation service integration

    // Determine recommended action
    let recommendedAction: 'allow' | 'challenge' | 'block' = 'allow';
    if (score >= 70) {
      recommendedAction = 'block';
    } else if (score >= 40) {
      recommendedAction = 'challenge';
    }

    return {
      score: Math.min(score, 100),
      factors,
      recommendedAction,
    };
  }

  /**
   * Clean up old login attempts (keep last 30 days)
   */
  async cleanupOldAttempts(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.loginAttempt.deleteMany({
      where: {
        attemptedAt: { lt: thirtyDaysAgo },
      },
    });

    return result.count;
  }

  /**
   * Get login attempt statistics for monitoring
   */
  async getLoginStats(hours: number = 24): Promise<{
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    topFailingIPs: Array<{ ip: string; count: number }>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [total, successful, failed] = await Promise.all([
      this.prisma.loginAttempt.count({ where: { attemptedAt: { gte: since } } }),
      this.prisma.loginAttempt.count({ where: { attemptedAt: { gte: since }, successful: true } }),
      this.prisma.loginAttempt.count({ where: { attemptedAt: { gte: since }, successful: false } }),
    ]);

    // Get top failing IPs
    const failingIPs = await this.prisma.loginAttempt.groupBy({
      by: ['ipAddress'],
      where: {
        attemptedAt: { gte: since },
        successful: false,
      },
      _count: { ipAddress: true },
      orderBy: { _count: { ipAddress: 'desc' } },
      take: 10,
    });

    const topFailingIPs = failingIPs.map((ip: { ipAddress: string; _count: { ipAddress: number } }) => ({
      ip: ip.ipAddress,
      count: ip._count.ipAddress,
    }));

    return {
      totalAttempts: total,
      successfulAttempts: successful,
      failedAttempts: failed,
      topFailingIPs,
    };
  }

  /**
   * Compare user agents for similarity (basic implementation)
   */
  private compareUserAgents(ua1: string, ua2: string): boolean {
    // Simple comparison - check if they share common browser/OS identifiers
    const normalize = (ua: string) => ua.toLowerCase().replace(/[^a-z0-9]/g, '');

    const normalized1 = normalize(ua1);
    const normalized2 = normalize(ua2);

    // Check for common browser signatures
    const browsers = ['chrome', 'firefox', 'safari', 'edge', 'opera'];
    const commonBrowsers = browsers.filter(browser =>
      normalized1.includes(browser) && normalized2.includes(browser)
    );

    return commonBrowsers.length > 0;
  }
}