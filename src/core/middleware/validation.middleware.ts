import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const data = request[source];
      request[source] = schema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors into a more user-friendly structure
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        throw new ValidationError('Validation failed. Please check your input.', formattedErrors);
      }
      throw error;
    }
  };
}
