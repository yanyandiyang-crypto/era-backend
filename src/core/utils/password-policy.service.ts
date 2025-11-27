import { PrismaClient } from '@prisma/client';

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  preventCommonPasswords: boolean;
  preventSequential: boolean;
  preventRepeated: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number; // 0-100
}

export class PasswordPolicyService {
  private static readonly COMMON_PASSWORDS = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
    'qwerty123', 'admin123', 'root', 'user', 'guest', 'test', 'demo'
  ];

  private static readonly SEQUENTIAL_PATTERNS = [
    '123456', 'abcdef', 'qwerty', 'asdfgh', 'zxcvbn', '098765'
  ];

  static readonly DEFAULT_POLICY: PasswordPolicy = {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    preventCommonPasswords: true,
    preventSequential: true,
    preventRepeated: true,
  };

  /**
   * Validate password against policy
   */
  static validatePassword(password: string, policy: PasswordPolicy = this.DEFAULT_POLICY): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    } else {
      score += Math.min(password.length * 2, 30); // Max 30 points for length
    }

    // Character requirements
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (policy.requireUppercase) {
      score += 15;
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (policy.requireLowercase) {
      score += 15;
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else if (policy.requireNumbers) {
      score += 15;
    }

    if (policy.requireSymbols && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else if (policy.requireSymbols) {
      score += 15;
    }

    // Dictionary attack prevention
    if (policy.preventCommonPasswords) {
      const lowerPassword = password.toLowerCase();
      if (this.COMMON_PASSWORDS.some(common => lowerPassword.includes(common))) {
        errors.push('Password contains common words that are easily guessed');
      } else {
        score += 10;
      }
    }

    // Sequential pattern prevention
    if (policy.preventSequential) {
      const lowerPassword = password.toLowerCase();
      if (this.SEQUENTIAL_PATTERNS.some(seq => lowerPassword.includes(seq))) {
        errors.push('Password contains sequential characters that are easily guessed');
      } else {
        score += 10;
      }
    }

    // Repeated character prevention
    if (policy.preventRepeated) {
      const repeatedChars = /(.)\1{2,}/.test(password); // 3+ repeated chars
      if (repeatedChars) {
        errors.push('Password contains too many repeated characters');
      } else {
        score += 5;
      }
    }

    // Calculate strength
    let strength: 'weak' | 'medium' | 'strong' | 'very-strong';
    if (score < 40) strength = 'weak';
    else if (score < 70) strength = 'medium';
    else if (score < 90) strength = 'strong';
    else strength = 'very-strong';

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score: Math.min(score, 100),
    };
  }

  /**
   * Check if password was used recently (password history)
   */
  static async checkPasswordHistory(
    userId: string,
    newPassword: string,
    prisma: PrismaClient,
    historyCount: number = 5
  ): Promise<boolean> {
    // Get user's recent password changes
    const recentChanges = await prisma.passwordChange.findMany({
      where: { userId },
      orderBy: { changedAt: 'desc' },
      take: historyCount,
      select: { oldPasswordHash: true },
    });

    // Check against password history
    for (const change of recentChanges) {
      try {
        // Note: In production, you'd want to use a more sophisticated comparison
        // This is a simplified version for demonstration
        const isReused = await this.compareWithHistory(newPassword, change.oldPasswordHash);
        if (isReused) {
          return false; // Password was reused
        }
      } catch (error) {
        // If comparison fails, assume it's not a reuse
        continue;
      }
    }

    return true; // Password not in recent history
  }

  /**
   * Compare new password with historical password hash
   * In production, you'd use proper password hashing comparison
   */
  private static async compareWithHistory(_newPassword: string, _oldHash: string): Promise<boolean> {
    // This is a simplified implementation
    // In production, you'd hash the new password and compare with stored hashes
    // For now, we'll do a basic check
    return false; // Placeholder - implement proper password history checking
  }

  /**
   * Generate password strength feedback
   */
  static getPasswordFeedback(result: PasswordValidationResult): string {
    const feedback: string[] = [];

    if (result.strength === 'weak') {
      feedback.push('Consider using a longer password with mixed characters');
    } else if (result.strength === 'medium') {
      feedback.push('Good start! Add more variety for better security');
    } else if (result.strength === 'strong') {
      feedback.push('Strong password! Consider making it even longer');
    } else {
      feedback.push('Excellent password strength!');
    }

    if (result.errors.length > 0) {
      feedback.push(`Issues to fix: ${result.errors.join(', ')}`);
    }

    return feedback.join(' ');
  }
}