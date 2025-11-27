import path from 'path';
import crypto from 'crypto';

/**
 * File Upload Security Service
 * Validates and secures file uploads with magic byte verification
 */
export class FileUploadSecurityService {
  // Allowed MIME types for incident photos
  private static readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  // Allowed file extensions
  private static readonly ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

  // Maximum file size (5MB)
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024;

  // Maximum files per upload
  private static readonly MAX_FILES = 10;

  // Magic bytes for file type verification
  private static readonly MAGIC_BYTES: Record<string, number[][]> = {
    'image/jpeg': [
      [0xFF, 0xD8, 0xFF], // JPEG
    ],
    'image/png': [
      [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
    ],
    'image/webp': [
      [0x52, 0x49, 0x46, 0x46], // WEBP (RIFF)
    ],
    'image/gif': [
      [0x47, 0x49, 0x46, 0x38], // GIF
    ],
  };

  /**
   * Validate file upload
   */
  static validateFile(
    filename: string,
    mimetype: string,
    filesize: number
  ): { valid: boolean; error?: string } {
    // Check filename
    if (!filename || filename.length === 0) {
      return { valid: false, error: 'Filename is required' };
    }

    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return { valid: false, error: 'Invalid filename' };
    }

    // Check extension
    const ext = path.extname(filename).toLowerCase();
    if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `File extension ${ext} is not allowed. Allowed: ${this.ALLOWED_EXTENSIONS.join(', ')}`,
      };
    }

    // Check MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(mimetype)) {
      return { valid: false, error: `MIME type ${mimetype} is not allowed` };
    }

    // Check file size
    if (filesize > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    // Check for suspicious patterns in filename
    if (this.hasSuspiciousPatterns(filename)) {
      return { valid: false, error: 'Filename contains suspicious patterns' };
    }

    return { valid: true };
  }

  /**
   * Enhanced validation with magic byte verification
   */
  static validateFileSecure(
    filename: string,
    mimetype: string,
    buffer: Buffer
  ): { valid: boolean; error?: string } {
    // Basic validations first
    const basicValidation = this.validateFile(filename, mimetype, buffer.length);
    if (!basicValidation.valid) {
      return basicValidation;
    }

    // Verify magic bytes match claimed MIME type
    if (!this.verifyMagicBytes(buffer, mimetype)) {
      return {
        valid: false,
        error: `File signature does not match claimed type: ${mimetype}`,
      };
    }

    // Check file is not suspiciously small
    if (buffer.length < 100) {
      return { valid: false, error: 'File too small to be valid image' };
    }

    // Scan for malicious content in metadata
    const metadataScan = this.scanImageMetadata(buffer);
    if (!metadataScan.safe) {
      return { valid: false, error: metadataScan.reason || 'Suspicious content detected' };
    }

    return { valid: true };
  }

  /**
   * Verify magic bytes match expected format
   */
  private static verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const expectedBytes = this.MAGIC_BYTES[mimeType];
    if (!expectedBytes) return false;

    return expectedBytes.some((bytes) => {
      for (let i = 0; i < bytes.length; i++) {
        if (buffer[i] !== bytes[i]) return false;
      }
      return true;
    });
  }

  /**
   * Scan for malicious content in image metadata
   */
  private static scanImageMetadata(buffer: Buffer): { safe: boolean; reason?: string } {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
    
    // Check for suspicious patterns
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // onclick, onerror, etc.
      /<iframe/i,
      /eval\(/i,
      /<\?php/i,
      /<\?=/i,
      /<%/i, // ASP/JSP
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return { safe: false, reason: `Suspicious content pattern detected` };
      }
    }

    return { safe: true };
  }

  /**
   * Validate multiple files
   */
  static validateFiles(
    files: Array<{ filename: string; mimetype: string; filesize: number }>
  ): { valid: boolean; error?: string } {
    if (files.length > this.MAX_FILES) {
      return { valid: false, error: `Maximum ${this.MAX_FILES} files allowed per upload` };
    }

    for (const file of files) {
      const result = this.validateFile(file.filename, file.mimetype, file.filesize);
      if (!result.valid) {
        return result;
      }
    }

    return { valid: true };
  }

  /**
   * Check for suspicious patterns
   */
  private static hasSuspiciousPatterns(filename: string): boolean {
    const suspiciousPatterns = [
      /\.exe$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.com$/i,
      /\.pif$/i,
      /\.scr$/i,
      /\.dll$/i,
      /\.app$/i,
      /\.deb$/i,
      /\.zip$/i,
      /\.rar$/i,
      /\.7z$/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(filename));
  }

  /**
   * Generate safe filename with cryptographically secure random
   */
  static generateSafeFilename(originalFilename: string): string {
    const ext = path.extname(originalFilename).toLowerCase();
    const safeExt = this.ALLOWED_EXTENSIONS.includes(ext) ? ext : '.jpg';
    const timestamp = Date.now();
    const randomName = crypto.randomBytes(16).toString('hex');
    return `${timestamp}-${randomName}${safeExt}`;
  }

  /**
   * Validate directory path (prevent traversal attacks)
   */
  static validateDirectoryPath(uploadDir: string, filePath: string): boolean {
    const realPath = path.resolve(filePath);
    const realUploadDir = path.resolve(uploadDir);
    
    // Ensure file is within upload directory
    return realPath.startsWith(realUploadDir);
  }
}
