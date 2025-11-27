import { PrismaClient, Prisma } from '@prisma/client';
import { DataEncryptionService } from '../utils/data-encryption.service';

// Sensitive fields that should be encrypted at rest
const SENSITIVE_FIELDS = {
  User: ['phone'],
  Personnel: ['phone', 'address'],
  Incident: ['reporterPhone'],
  EmergencyContact: ['phone']
} as const;

export function createEncryptionMiddleware() {
  const encryptionService = new DataEncryptionService();

  return async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) => {
    // Encrypt data before writing to database
    if (params.action === 'create' || params.action === 'update' || params.action === 'upsert') {
      const model = params.model as keyof typeof SENSITIVE_FIELDS;

      if (SENSITIVE_FIELDS[model]) {
        const sensitiveFields = SENSITIVE_FIELDS[model];

        // Encrypt sensitive fields in args.data
        if (params.args?.data) {
          params.args.data = encryptionService.encryptObjectFields(
            params.args.data as Record<string, unknown>,
            sensitiveFields as unknown as string[]
          );
        }

        // For update operations, also check where clause for sensitive fields
        if (params.action === 'update' && params.args?.where) {
          // Note: We don't encrypt where clauses as they're used for querying
        }
      }
    }

    // Execute the query
    const result = await next(params);

    // Decrypt data after reading from database
    if (params.action === 'findUnique' || params.action === 'findFirst' ||
        params.action === 'findMany' || params.action === 'create' ||
        params.action === 'update' || params.action === 'upsert') {

      const model = params.model as keyof typeof SENSITIVE_FIELDS;

      if (SENSITIVE_FIELDS[model] && result) {
        const sensitiveFields = SENSITIVE_FIELDS[model];

        if (Array.isArray(result)) {
          // Handle array results (findMany)
          return result.map(item =>
            encryptionService.decryptObjectFields(item as Record<string, unknown>, sensitiveFields as unknown as string[])
          );
        } else {
          // Handle single result
          return encryptionService.decryptObjectFields(result as Record<string, unknown>, sensitiveFields as unknown as string[]);
        }
      }
    }

    return result;
  };
}

// Helper function to apply encryption middleware to Prisma client
export function applyEncryptionMiddleware(prisma: PrismaClient) {
  prisma.$use(createEncryptionMiddleware());
}