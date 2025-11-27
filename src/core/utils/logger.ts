import { env } from '../../config/environment';

class Logger {
  private isDevelopment = env.NODE_ENV === 'development';

  info(message: string, ...args: any[]) {
    console.log(`[INFO] ${message}`, ...args);
  }

  error(message: string, error?: any) {
    console.error(`[ERROR] ${message}`, error);
  }

  warn(_message: string, ..._args: any[]) {
    // console.warn(`[WARN] ${message}`, ...args);
  }

  debug(_message: string, ..._args: any[]) {
    if (this.isDevelopment) {
      // console.log(`[DEBUG] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
