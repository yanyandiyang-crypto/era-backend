/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-useless-escape */
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import { z } from 'zod';

// Initialize DOMPurify with JSDOM for server-side use
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

/**
 * XSS Protection and Input Sanitization Service
 * Sanitizes user input using DOMPurify to prevent XSS attacks
 */
export class SanitizationService {
  /**
   * Sanitize HTML with DOMPurify (allows specific tags)
   */
  static sanitizeHtml(dirty: string, allowedTags: string[] = []): string {
    const config = {
      ALLOWED_TAGS: allowedTags.length > 0 ? allowedTags : [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
      RETURN_TRUSTED_TYPE: false,
    };

    return purify.sanitize(dirty, config);
  }

  /**
   * Sanitize a string value (removes all HTML)
   */
  static sanitizeString(value: string | null | undefined): string {
    if (!value) return '';
    
    // Remove ALL HTML, including malicious variants
    const cleaned = purify.sanitize(value, {
      ALLOWED_TAGS: [],
      KEEP_CONTENT: true,
    });

    // Additional safety: normalize Unicode and trim
    return cleaned.normalize('NFKC').trim();
  }

  /**
   * Sanitize an object (recursively)
   */
  static sanitizeObject<T extends Record<string, any>>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in sanitized) {
      if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
        const value = (sanitized as any)[key];

        if (typeof value === 'string') {
          (sanitized as any)[key] = this.sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
          (sanitized as any)[key] = this.sanitizeObject(value);
        }
      }
    }

    return sanitized as T;
  }

  /**
   * Validate email format (more secure than simple regex)
   */
  static validateEmail(email: string): boolean {
    const emailSchema = z.string().email().max(254);
    try {
      emailSchema.parse(email);
      // Additional checks
      if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize filename to prevent path traversal
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/\0/g, '') // Remove null bytes
      .replace(/\.\./g, '') // Remove directory traversal
      .replace(/[/\\]/g, '') // Remove path separators
      .slice(-255); // Limit length
  }

  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phone: string): boolean {
    // Allow international format: +1234567890 or similar
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\\.]?[0-9]{1,9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Sanitize phone number
   */
  static sanitizePhoneNumber(phone: string): string | null {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Validate format
    if (!/^\+?[\d]{7,15}$/.test(cleaned)) {
      return null;
    }
    
    return cleaned;
  }

  /**
   * Validate URL format
   */
  static validateURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize incident descriptions (allow some formatting)
   */
  static sanitizeIncidentDescription(description: string): string {
    return purify.sanitize(description, {
      ALLOWED_TAGS: ['b', 'i', 'u', 'p', 'br'],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  }

  /**
   * Sanitize SQL LIKE patterns
   */
  static sanitizeLikePattern(pattern: string): string {
    // Escape special SQL LIKE characters
    return pattern
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[');
  }

  /**
   * Check for dangerous patterns in strings
   */
  static hasDangerousPatterns(value: string): boolean {
    const dangerousPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // Event handlers
      /eval\s*\(/gi,
      /expression\s*\(/gi,
    ];

    return dangerousPatterns.some((pattern) => pattern.test(value));
  }
}
