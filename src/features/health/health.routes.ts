import { FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseMonitor } from '../../core/utils/database-monitor';

export async function healthRoutes(fastify: any) {
  const dbMonitor = DatabaseMonitor.getInstance();

  // Database health check
  fastify.get('/health/database', {
    schema: {
      description: 'Check database health and performance metrics',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            responseTime: { type: 'number' },
            connectionPool: { type: 'object' },
            activeQueries: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const health = await dbMonitor.checkHealth();
    
    reply
      .code(health.status === 'healthy' ? 200 : 503)
      .send({
        ...health,
        timestamp: new Date().toISOString()
      });
  });

  // Database performance metrics
  fastify.get('/health/database/metrics', {
    schema: {
      description: 'Get detailed database performance metrics',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            connectionPool: { type: 'object' },
            slowQueries: { type: 'array' },
            tableSizes: { type: 'object' },
            indexUsage: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await getDatabaseMetrics();
    reply.send({
      ...metrics,
      timestamp: new Date().toISOString()
    });
  });

  // WebSocket health check
  fastify.get('/health/websocket', {
    schema: {
      description: 'Check WebSocket server health and connection status',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            totalConnections: { type: 'number' },
            totalSockets: { type: 'number' },
            rooms: { type: 'number' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const prisma = (global as any).prisma || require('../../config/database').prisma;
      const io = (fastify as any).io;
      
      if (!io) {
        return reply
          .code(503)
          .send({
            status: 'unhealthy',
            error: 'WebSocket server not initialized',
            timestamp: new Date().toISOString()
          });
      }

      const stats = {
        totalConnections: io.engine.clientsCount,
        totalSockets: io.sockets.sockets.size,
        rooms: Object.keys(io.sockets.adapter.rooms).length,
      };

      // Determine health status based on connection metrics
      let status: 'healthy' | 'degraded' | 'unhealthy';
      
      if (stats.totalConnections > 100 || stats.rooms === 0) {
        status = 'unhealthy';
      } else if (stats.totalConnections > 50) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      reply
        .code(status === 'healthy' ? 200 : 503)
        .send({
          status,
          ...stats,
          timestamp: new Date().toISOString()
        });

    } catch (error) {
      reply
        .code(503)
        .send({
          status: 'unhealthy',
          error: 'WebSocket health check failed',
          timestamp: new Date().toISOString()
        });
    }
  });

  // Overall system health check
  fastify.get('/health', {
    schema: {
      description: 'Get overall system health status',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            database: { type: 'object' },
            websocket: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [dbHealth, wsHealth] = await Promise.allSettled([
        dbMonitor.checkHealth(),
        getWebSocketHealth(fastify)
      ]);

      const database = dbHealth.status === 'fulfilled' ? dbHealth.value : {
        status: 'unhealthy',
        error: 'Database health check failed'
      };

      const websocket = wsHealth.status === 'fulfilled' ? wsHealth.value : {
        status: 'unhealthy',
        error: 'WebSocket health check failed'
      };

      // Determine overall system status
      let status: 'healthy' | 'degraded' | 'unhealthy';
      
      if (database.status === 'unhealthy' || websocket.status === 'unhealthy') {
        status = 'unhealthy';
      } else if (database.status === 'degraded' || websocket.status === 'degraded') {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      reply
        .code(status === 'healthy' ? 200 : 503)
        .send({
          status,
          database,
          websocket,
          timestamp: new Date().toISOString()
        });

    } catch (error) {
      reply
        .code(503)
        .send({
          status: 'unhealthy',
          error: 'System health check failed',
          timestamp: new Date().toISOString()
        });
    }
  });
}

async function getDatabaseMetrics() {
  try {
    const prisma = (global as any).prisma || require('../../config/database').prisma;
    
    // Get table sizes
    const tableSizes = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `;

    // Get index usage statistics
    const indexUsage = await prisma.$queryRaw`
      SELECT 
        t.tablename,
        i.indexname,
        i.indexname AS complete_index_name,
        pg_size_pretty(pg_relation_size(quote_ident(t.tablename)::regclass)) AS table_size,
        pg_size_pretty(pg_relation_size(quote_ident(i.schemaname)||'.'||quote_ident(i.indexname)::regclass)) AS index_size,
        CASE WHEN i.indisunique = true THEN 'YES' ELSE 'NO' END AS unique,
        CASE WHEN i.indisprimary = true THEN 'YES' ELSE 'NO' END AS primary
      FROM pg_tables t
      LEFT JOIN pg_index_usage_stats i ON i.tablename = t.tablename
      WHERE t.schemaname = 'public'
      ORDER BY pg_relation_size(quote_ident(t.tablename)::regclass) DESC;
    `;

    return {
      tableSizes,
      indexUsage,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting database metrics:', error);
    return {
      error: 'Unable to retrieve metrics',
      timestamp: new Date().toISOString()
    };
  }
}

async function getWebSocketHealth(fastify: any) {
  try {
    const io = fastify.io;
    
    if (!io) {
      throw new Error('WebSocket server not initialized');
    }

    const stats = {
      totalConnections: io.engine.clientsCount,
      totalSockets: io.sockets.sockets.size,
      rooms: Object.keys(io.sockets.adapter.rooms).length,
    };

    // Determine health status based on connection metrics
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (stats.totalConnections > 100 || stats.rooms === 0) {
      status = 'unhealthy';
    } else if (stats.totalConnections > 50) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      ...stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error('WebSocket health check failed');
  }
}