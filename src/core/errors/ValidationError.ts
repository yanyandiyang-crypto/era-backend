import { AppError } from './AppError';

export class ValidationError extends AppError {
  constructor(
    message: string = 'Validation failed',
    public errors?: any
  ) {
    super(message, 400);
    this.errors = errors;
  }
}
