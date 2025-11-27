import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url(),
  // OWASP A02: Cryptographic Failures - Strong secret validation
  JWT_ACCESS_SECRET: z.string()
    .min(64, 'JWT_ACCESS_SECRET must be at least 64 characters (256 bits)')
    .refine(
      (val) => !/^(test|example|secret|password|admin|default)/i.test(val),
      'JWT_ACCESS_SECRET cannot use common weak words'
    ),
  JWT_REFRESH_SECRET: z.string()
    .min(64, 'JWT_REFRESH_SECRET must be at least 64 characters (256 bits)')
    .refine(
      (val) => !/^(test|example|secret|password|admin|default)/i.test(val),
      'JWT_REFRESH_SECRET cannot use common weak words'
    ),
  JWT_ACCESS_EXPIRY: z.string().default('24h'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().default('5242880'), // 5MB
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  // Email/SMTP Configuration (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // SMS/Twilio Configuration (optional)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
});

export type Environment = z.infer<typeof envSchema>;

function validateEnv(): Environment {
  try {
    const parsed = envSchema.parse(process.env);
    
    // OWASP A02: Ensure JWT secrets are different
    if (parsed.JWT_ACCESS_SECRET === parsed.JWT_REFRESH_SECRET) {
      // console.error('❌ Security Error: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
      // console.error('   Generate unique secrets with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
      process.exit(1);
    }
    
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // console.error('❌ Invalid environment variables:');
      error.errors.forEach((_err) => {
        // console.error(`   ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

export const env = validateEnv();
