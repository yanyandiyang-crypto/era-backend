import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export class DatabaseMonitor {
  private static instance: DatabaseMonitor;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  static getInstance(): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor();
    }
    return DatabaseMonitor.instance;
  }

  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    connectionPool?: any;
    activeQueries: number;
  }> {
    const start = Date.now();
    
    try {
      // Test basic connectivity
      const prisma = (global as any).prisma || require('../../config/database').prisma;
      await prisma.$queryRaw`SELECT 1 as health_check`;
      
      // Get connection pool stats
      const poolStats = await this.getConnectionPoolStats(prisma);
      
      // Get active queries count
      const activeQueries = await this.getActiveQueriesCount(prisma);
      
      const responseTime = Date.now() - start;
      
      // Determine health status
      let status: 'healthy' | 'degraded' | 'unhealthy';
      
      if (responseTime > 5000 || activeQueries > 20) {
        status = 'unhealthy';
      } else if (responseTime > 2000 || activeQueries > 10) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      // Log health status
      if (status !== 'healthy') {
        logger.warn('Database health degraded', { 
          status, 
          responseTime, 
          activeQueries,
          poolStats 
        });
      }
      
      return {
        status,
        responseTime,
        connectionPool: poolStats,
        activeQueries
      };
      
    } catch (error) {
      logger.error('Database health check failed', error);
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        activeQueries: 0
      };
    }
  }

  private async getConnectionPoolStats(prisma: PrismaClient) {
    try {
      // Get connection pool information
      const result = await prisma.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database();
      `;
      return result;
    } catch (error) {
      return { error: 'Unable to get pool stats' };
    }
  }

  private async getActiveQueriesCount(prisma: PrismaClient) {
    try {
      const result: any = await prisma.$queryRaw`
        SELECT count(*) as count
        FROM pg_stat_activity
        WHERE state = 'active'
        AND query NOT LIKE '%pg_stat_activity%';
      `;
      return Number(result[0]?.count || 0);
    } catch (error) {
      return 0;
    }
  }

  startHealthMonitoring(intervalMs: number = 60000) { // Check every minute
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        if (health.status === 'unhealthy') {
          logger.error('Database is unhealthy, triggering alert');
          // Here you could trigger external alerting systems
        }
      } catch (error) {
        logger.error('Health monitoring error:', error);
      }
    }, intervalMs);
    
    logger.info('Database health monitoring started');
  }

  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}