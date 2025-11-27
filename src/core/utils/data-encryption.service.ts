import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';

export class DataEncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  private encryptionKey: Buffer;

  constructor() {
    // Use environment variable for encryption key, fallback to derived key
    const keySource = process.env.DATA_ENCRYPTION_KEY || 'era-emergency-response-system-2025';
    this.encryptionKey = scryptSync(keySource, 'salt', DataEncryptionService.KEY_LENGTH);
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plainText: string): string {
    if (!plainText || plainText.trim() === '') {
      return plainText; // Don't encrypt empty values
    }

    const iv = randomBytes(DataEncryptionService.IV_LENGTH);
    const cipher = createCipheriv(DataEncryptionService.ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.includes(':')) {
      return encryptedText; // Return as-is if not encrypted
    }

    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        return encryptedText; // Not encrypted format
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = createDecipheriv(DataEncryptionService.ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // If decryption fails, return original (might be unencrypted legacy data)
      console.warn('Failed to decrypt data, returning as-is:', error);
      return encryptedText;
    }
  }

  /**
   * Encrypt object fields in-place
   */
  encryptObjectFields<T extends Record<string, unknown>>(
    obj: T,
    fieldsToEncrypt: (keyof T)[]
  ): T {
    const result = { ...obj };

    for (const field of fieldsToEncrypt) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.encrypt(result[field] as string) as T[keyof T];
      }
    }

    return result;
  }

  /**
   * Decrypt object fields in-place
   */
  decryptObjectFields<T extends Record<string, unknown>>(
    obj: T,
    fieldsToDecrypt: (keyof T)[]
  ): T {
    const result = { ...obj };

    for (const field of fieldsToDecrypt) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.decrypt(result[field] as string) as T[keyof T];
      }
    }

    return result;
  }

  /**
   * Check if data appears to be encrypted
   */
  isEncrypted(data: string): boolean {
    return data.includes(':') && data.split(':').length === 3;
  }

  /**
   * Hash sensitive data for searching (one-way)
   * Use for fields that need to be searchable but not decryptable
   */
  hashForSearch(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
}

// Sensitive data fields that should be encrypted
export const SENSITIVE_FIELDS = {
  USER: ['phone'] as const,
  PERSONNEL: ['phone', 'address'] as const,
  EMERGENCY_CONTACT: ['contactPhone'] as const,
  INCIDENT: ['reporterPhone', 'address'] as const,
  PUBLIC_SESSION: ['phone'] as const,
} as const;

// Global encryption service instance
export const dataEncryption = new DataEncryptionService();