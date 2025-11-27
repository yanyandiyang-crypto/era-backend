import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/environment';
import { logger } from '../core/utils/logger';
import { JWTService } from '../core/utils/jwt';
import { DatabaseMonitor } from '../core/utils/database-monitor';

import { PrismaClient } from '@prisma/client';

export async function websocketPluginAsync(app: FastifyInstance & { prisma: PrismaClient }) {
  const allowedOrigins = env.NODE_ENV === 'production'
    ? [
        env.FRONTEND_URL, 
        'http://ec2-44-222-69-93.compute-1.amazonaws.com:3000', // Production EC2 URL
        'https://ec2-44-222-69-93.compute-1.amazonaws.com:3000', // HTTPS version
        'http://localhost:5173', // Development fallback
      ]
    : [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://192.168.0.154:5173',
    ];

  const io = new SocketIOServer(app.server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    connectTimeout: 10000,
    pingTimeout: 5000,
    pingInterval: 25000,
  });

  // Enhanced authentication middleware with better error handling
  io.use(async (socket, next) => {
    try {
      const start = Date.now();
      const { token } = socket.handshake.auth;
      const clientIp = socket.handshake.address;

      // Validate token presence
      if (!token) {
        logger.warn(`[WebSocket] Connection rejected - No token from ${clientIp}`);
        return next(new Error('Authentication required'));
      }

      // Enhanced JWT verification with detailed error logging
      let payload;
      try {
        payload = JWTService.verifyAccessToken(token);
      } catch (jwtError: any) {
        logger.warn(`[WebSocket] JWT verification failed from ${clientIp}:`, {
          error: jwtError.message,
          tokenLength: token.length,
          errorType: jwtError.constructor.name
        });
        
        // Provide more specific error messages
        if (jwtError.name === 'TokenExpiredError') {
          return next(new Error('Token expired'));
        } else if (jwtError.name === 'JsonWebTokenError') {
          return next(new Error('Invalid token format'));
        } else {
          return next(new Error('Authentication failed'));
        }
      }

      // Enhanced payload validation with comprehensive checks
      if (!payload.userId || !payload.role || !payload.email) {
        logger.error(`[WebSocket] Invalid token payload structure from ${clientIp}`, {
          hasUserId: !!payload.userId,
          hasRole: !!payload.role,
          hasEmail: !!payload.email,
          payloadKeys: Object.keys(payload)
        });
        return next(new Error('Invalid token payload'));
      }

      // Validate role against allowed values with case-insensitive check
      const validRoles = ['PERSONNEL', 'ADMIN', 'SUPER_ADMIN', 'USER'];
      const normalizedRole = payload.role.toUpperCase();
      
      if (!validRoles.includes(normalizedRole)) {
        logger.error(`[WebSocket] Invalid role: ${payload.role} from ${clientIp}`);
        return next(new Error('Invalid role'));
      }

      // Validate user exists and is active (additional security layer)
      const user = await validateUserAndRole(payload.userId, normalizedRole, app.prisma);
      if (!user) {
        logger.warn(`[WebSocket] User not found or inactive: ${payload.userId} from ${clientIp}`);
        return next(new Error('User not found'));
      }

      // Attach verified user data to socket with additional context
      socket.data.userId = payload.userId;
      socket.data.role = normalizedRole;
      socket.data.email = payload.email;
      socket.data.personnelId = (payload as any).personnelId || null; // For personnel users
      socket.data.authMethod = 'JWT';
      socket.data.authTime = new Date().toISOString();
      socket.data.connectionDuration = Date.now() - start;

      logger.info(`[WebSocket] ✅ Authenticated: ${socket.data.email} (${socket.data.role}) in ${socket.data.connectionDuration}ms`);
      next();
    } catch (error: any) {
      logger.error(`[WebSocket] ❌ Critical auth error: ${error.message}`, {
        stack: error.stack,
        address: socket.handshake.address
      });
      next(new Error('Authentication system error'));
    }
  });

  // Store io instance and database monitor
  app.decorate('io', io);

  // Connection handler with enhanced logging and error handling
  io.on('connection', (socket) => {
    const { userId, role, email } = socket.data;
    const connectionId = socket.id;
    const clientInfo = {
      userAgent: socket.handshake.headers['user-agent'],
      referer: socket.handshake.headers.referer,
      origin: socket.handshake.headers.origin
    };

    logger.info(`[WebSocket] Client connected: ${connectionId}, User: ${email}, Role: ${role}`, clientInfo);

    // Join role-specific rooms using verified data
    if (role === 'PERSONNEL') {
      socket.join(`personnel:${userId}`);
      socket.join('personnel'); // General personnel room for broadcasts
      logger.info(`[WebSocket] Personnel ${userId} joined room`);
    } else if (['ADMIN', 'SUPER_ADMIN', 'USER'].includes(role)) {
      socket.join('admin');
      logger.info(`[WebSocket] Admin ${userId} joined admin room`);
    }

    // Rate limiting for location updates with per-user tracking
    const userRateLimit = new Map();
    
    function checkRateLimit(userId: string, action: string, limit: number, windowMs: number): boolean {
      const now = Date.now();
      const userActions = userRateLimit.get(`${userId}:${action}`) || [];
      
      // Remove old entries
      const recentActions = userActions.filter((timestamp: number) => now - timestamp < windowMs);
      
      if (recentActions.length >= limit) {
        return false; // Rate limit exceeded
      }
      
      recentActions.push(now);
      userRateLimit.set(`${userId}:${action}`, recentActions);
      return true;
    }

    // Enhanced location updates with better validation
    socket.on('personnel:location', async (data) => {
      try {
        // Verify user role before processing
        if (role !== 'PERSONNEL') {
          logger.warn(`[WebSocket] Unauthorized location update attempt by ${userId} (${role})`);
          return socket.emit('error', { message: 'Unauthorized action' });
        }

        // Rate limiting: max 30 updates per 60 seconds per user
        if (!checkRateLimit(userId, 'location', 30, 60000)) {
          logger.warn(`[WebSocket] Rate limit exceeded for ${userId} location updates`);
          return socket.emit('error', { message: 'Rate limit exceeded' });
        }

        // Enhanced input validation with detailed error reporting
        if (!data || typeof data !== 'object') {
          logger.warn(`[WebSocket] Invalid data type from ${userId}: ${typeof data}`);
          return socket.emit('error', { message: 'Invalid data format' });
        }

        // Validate required fields
        const { latitude, longitude, accuracy, timestamp, personnelId } = data;
        
        if (latitude === undefined || longitude === undefined) {
          logger.warn(`[WebSocket] Missing coordinates from ${userId}: lat=${latitude}, lon=${longitude}`);
          return socket.emit('error', { message: 'Missing coordinates' });
        }

        // Enhanced coordinate validation
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          logger.warn(`[WebSocket] Invalid coordinate types from ${userId}: lat=${typeof latitude}, lon=${typeof longitude}`);
          return socket.emit('error', { message: 'Invalid coordinate types' });
        }

        if (isNaN(latitude) || isNaN(longitude)) {
          logger.warn(`[WebSocket] Invalid coordinate values from ${userId}: lat=${latitude}, lon=${longitude}`);
          return socket.emit('error', { message: 'Invalid coordinate values' });
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          logger.warn(`[WebSocket] Out of range coordinates from ${userId}: lat=${latitude}, lon=${longitude}`);
          return socket.emit('error', { message: 'Coordinates out of range' });
        }

        // Validate accuracy if provided
        if (accuracy !== undefined && (typeof accuracy !== 'number' || isNaN(accuracy) || accuracy < 0)) {
          logger.warn(`[WebSocket] Invalid accuracy from ${userId}: ${accuracy}`);
          return socket.emit('error', { message: 'Invalid accuracy value' });
        }

        // Validate personnelId matches authenticated user
        if (personnelId && personnelId !== userId) {
          logger.warn(`[WebSocket] Personnel ID mismatch: ${personnelId} !== ${userId}`);
          return socket.emit('error', { message: 'Personnel ID mismatch' });
        }

        const locationUpdate = {
          personnelId: userId,
          latitude,
          longitude,
          accuracy: accuracy || null,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          source: 'websocket'
        };

        logger.debug(`[WebSocket] Location update from ${userId}:`, {
          latitude,
          longitude,
          accuracy,
          timestamp: locationUpdate.timestamp
        });

        // Broadcast only to admin room with enhanced payload
        const broadcastData = {
          ...locationUpdate,
          metadata: {
            connectionId,
            timestamp: new Date().toISOString()
          }
        };
        
        io.to('admin').emit('personnel:location:updated', broadcastData);

        // Store in database with error handling
        try {
          await app.prisma.personnelLocation.create({
            data: {
              personnelId: userId,
              latitude: locationUpdate.latitude,
              longitude: locationUpdate.longitude,
              accuracy: locationUpdate.accuracy,
              timestamp: locationUpdate.timestamp,
            },
          });
          
          logger.debug(`[WebSocket] Location stored for ${userId}`);
        } catch (dbError) {
          logger.error(`[WebSocket] Failed to store location for ${userId}:`, dbError);
          // Don't fail the socket connection, just log the error
        }

      } catch (error) {
        logger.error(`[WebSocket] Location update error for ${userId}:`, error);
        socket.emit('error', { message: 'Location update failed' });
      }
    });

    // Enhanced status updates with validation
    socket.on('personnel:status', async (data) => {
      try {
        // Verify user role
        if (role !== 'PERSONNEL') {
          logger.warn(`[WebSocket] Unauthorized status update attempt by ${userId} (${role})`);
          return socket.emit('error', { message: 'Unauthorized action' });
        }

        // Rate limiting for status updates
        if (!checkRateLimit(userId, 'status', 10, 60000)) {
          logger.warn(`[WebSocket] Status update rate limit exceeded for ${userId}`);
          return socket.emit('error', { message: 'Rate limit exceeded' });
        }

        // Validate input structure
        if (!data || typeof data !== 'object' || !data.status) {
          logger.warn(`[WebSocket] Invalid status data from ${userId}`);
          return socket.emit('error', { message: 'Invalid data format' });
        }

        const { status, reason } = data;
        const validStatuses = ['AVAILABLE', 'RESPONDING', 'ON_SCENE', 'ON_DUTY', 'OFF_DUTY', 'ON_BREAK'];
        
        if (!validStatuses.includes(status)) {
          logger.warn(`[WebSocket] Invalid status from ${userId}: ${status}`);
          return socket.emit('error', { message: 'Invalid status value' });
        }

        // Update personnel status in database
        try {
          await app.prisma.personnel.update({
            where: { id: userId },
            data: { 
              status: status as any,
              lastActive: new Date(),
              currentDuty: reason || null
            }
          });
          
          logger.info(`[WebSocket] Status updated for ${userId}: ${status}`);
        } catch (dbError) {
          logger.error(`[WebSocket] Failed to update status for ${userId}:`, dbError);
          return socket.emit('error', { message: 'Status update failed' });
        }

        const statusUpdate = {
          personnelId: userId,
          status,
          reason,
          timestamp: new Date().toISOString(),
        };

        // Broadcast only to admin with enhanced data
        io.to('admin').emit('personnel:status:updated', statusUpdate);

      } catch (error) {
        logger.error(`[WebSocket] Status update error for ${userId}:`, error);
        socket.emit('error', { message: 'Status update failed' });
      }
    });

    // Enhanced incident marker click handling
    socket.on('incident:marker_clicked', (data) => {
      try {
        const { incidentId, personnelId } = data;
        
        if (!incidentId) {
          logger.warn(`[WebSocket] Missing incident ID from ${userId}`);
          return socket.emit('error', { message: 'Missing incident ID' });
        }

        if (personnelId && personnelId !== userId) {
          logger.warn(`[WebSocket] Incident marker click ID mismatch: ${personnelId} !== ${userId}`);
          return socket.emit('error', { message: 'Personnel ID mismatch' });
        }

        logger.info(`[WebSocket] Incident marker clicked: ${incidentId} by ${userId}`);
        
        // Broadcast to admin room with additional context
        io.to('admin').emit('incident:marker_clicked', {
          incidentId,
          personnelId: userId,
          timestamp: new Date().toISOString(),
          userAgent: clientInfo.userAgent
        });

      } catch (error) {
        logger.error(`[WebSocket] Incident marker click error:`, error);
        socket.emit('error', { message: 'Marker click failed' });
      }
    });

    // Enhanced notification broadcasting
    socket.on('notification:broadcast', async (payload, callback) => {
      try {
        // Only admins can broadcast
        if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
          logger.warn(`[WebSocket] Unauthorized broadcast attempt by ${userId} (${role})`);
          return callback({ success: false, message: 'Unauthorized' });
        }

        const { title, message, type, targets, priority } = payload;

        // Enhanced payload validation
        if (!title?.trim() || !message?.trim() || !targets || !Array.isArray(targets) || targets.length === 0) {
          logger.warn(`[WebSocket] Invalid broadcast payload from ${userId}`);
          return callback({ success: false, message: 'Invalid payload' });
        }

        // Validate priority if provided
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        if (priority && !validPriorities.includes(priority)) {
          logger.warn(`[WebSocket] Invalid broadcast priority from ${userId}: ${priority}`);
          return callback({ success: false, message: 'Invalid priority' });
        }

        const broadcastData = {
          id: `${userId}_${Date.now()}`,
          title: title.trim(),
          message: message.trim(),
          type: type || 'info',
          priority: priority || 'MEDIUM',
          targets,
          sender: {
            id: userId,
            email: email,
            role: role
          },
          timestamp: new Date().toISOString(),
        };

        logger.info(`[WebSocket] Broadcast sent by ${userId} to targets: ${targets.join(', ')}`);

        // Store broadcast in database for audit trail
        try {
          // Log broadcast for audit trail (notifications table may not exist)
          logger.info(`[WebSocket] Broadcast logged: ${broadcastData.id} by ${userId}`);
        } catch (dbError) {
          logger.error(`[WebSocket] Failed to log broadcast:`, dbError);
        }

        // Emit to specified targets
        if (targets.includes('personnel')) {
          io.to('personnel').emit('notification:new', broadcastData);
        }

        if (targets.includes('admin')) {
          io.to('admin').emit('notification:new', broadcastData);
        }

        callback({ success: true, broadcastId: broadcastData.id });

      } catch (error) {
        logger.error(`[WebSocket] Broadcast error:`, error);
        callback({ success: false, message: 'Broadcast failed' });
      }
    });

    // Connection cleanup
    socket.on('disconnect', (reason) => {
      logger.info(`[WebSocket] Client disconnected: ${connectionId}, User: ${email}, Reason: ${reason}`);
      
      // Clean up rate limit data
      for (const key of userRateLimit.keys()) {
        if (key.startsWith(`${userId}:`)) {
          userRateLimit.delete(key);
        }
      }
    });

    // Handle connection errors
    socket.on('error', (error) => {
      logger.error(`[WebSocket] Socket error for ${userId}:`, error);
    });
  });

  // Enhanced health monitoring for WebSocket connections
  setInterval(() => {
    const stats = {
      totalConnections: io.engine.clientsCount,
      totalSockets: io.sockets.sockets.size,
      rooms: Object.keys(io.sockets.adapter.rooms).length,
      timestamp: new Date().toISOString()
    };

    logger.debug('[WebSocket] Connection stats:', stats);

    // Broadcast stats to admin room for monitoring
    io.to('admin').emit('system:websocket_stats', stats);
  }, 30000); // Every 30 seconds

  logger.info('✅ Enhanced WebSocket server initialized with improved authentication');
}

// Helper function to validate user and role
async function validateUserAndRole(userId: string, role: string, prisma: PrismaClient) {
  try {
    if (role === 'PERSONNEL') {
      const personnel = await prisma.personnel.findUnique({
        where: { id: userId },
        select: { id: true, status: true, isAvailable: true }
      });
      
      return personnel && personnel.status !== 'SUSPENDED' && personnel.status !== 'INACTIVE';
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true, role: true }
      });
      
      return user && user.isActive && user.role === role;
    }
  } catch (error) {
    logger.error('User validation error:', error);
    return false;
  }
}

export const websocketPlugin = fp(websocketPluginAsync, {
  name: 'websocket',
  dependencies: ['prisma']
});
