/**
 * Socket.IO real-time collaboration for mind maps
 */
const logger = require('../utils/logger');
const pool = require('../db/pool');
const config = require('../config');

let io = null;

/**
 * Initialize Socket.IO server
 * @param {SocketIO} socketIoServer - Socket.IO server instance
 */
function initializeSocketIO(socketIoServer) {
  io = socketIoServer;
  
  io.on('connection', (socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id}`);
    
    // Join mind map room
    socket.on('mindmap:join', async (data) => {
      const { mindmapId, userId } = data;
      
      if (!mindmapId) {
        socket.emit('error', { message: 'Mind map ID required' });
        return;
      }
      
      // Join room
      socket.join(`mindmap:${mindmapId}`);
      socket.mindmapId = mindmapId;
      socket.userId = userId;
      
      logger.info(`[Socket.IO] User ${userId} joined mind map ${mindmapId}`);
      
      // Notify others in the room
      socket.to(`mindmap:${mindmapId}`).emit('mindmap:user_joined', {
        userId,
        socketId: socket.id
      });
      
      // Send current room info
      const room = io.sockets.adapter.rooms.get(`mindmap:${mindmapId}`);
      socket.emit('mindmap:joined', {
        mindmapId,
        activeUsers: room ? room.size : 1
      });
    });
    
    // Leave mind map room
    socket.on('mindmap:leave', () => {
      if (socket.mindmapId) {
        socket.leave(`mindmap:${socket.mindmapId}`);
        
        // Notify others
        socket.to(`mindmap:${socket.mindmapId}`).emit('mindmap:user_left', {
          userId: socket.userId,
          socketId: socket.id
        });
        
        logger.info(`[Socket.IO] User ${socket.userId} left mind map ${socket.mindmapId}`);
        socket.mindmapId = null;
      }
    });
    
    // Update node (position, label, etc.)
    socket.on('mindmap:update_node', async (data) => {
      const { mindmapId, nodeId, updates, version } = data;
      
      if (!mindmapId || !nodeId) {
        socket.emit('error', { message: 'Mind map ID and node ID required' });
        return;
      }
      
      try {
        // Update node in database
        const client = await pool.connect();
        
        try {
          // Check version for optimistic locking
          const versionCheck = await client.query(`
            SELECT version FROM ${config.dbSchema}.mindmaps WHERE id = $1
          `, [mindmapId]);
          
          const currentVersion = versionCheck.rows[0]?.version || 0;
          
          if (version && version < currentVersion) {
            // Version mismatch - conflict
            socket.emit('mindmap:conflict', {
              nodeId,
              currentVersion,
              message: 'Mind map was updated by another user'
            });
            return;
          }
          
          // Build update query
          const updateFields = [];
          const updateValues = [];
          let paramIndex = 1;
          
          if (updates.label !== undefined) {
            updateFields.push(`label = $${paramIndex++}`);
            updateValues.push(updates.label);
          }
          
          if (updates.summary !== undefined) {
            updateFields.push(`summary = $${paramIndex++}`);
            updateValues.push(updates.summary);
          }
          
          if (updates.position !== undefined) {
            updateFields.push(`position = $${paramIndex++}`);
            updateValues.push(JSON.stringify(updates.position));
          }
          
          if (updateFields.length > 0) {
            updateValues.push(nodeId);
            
            await client.query(`
              UPDATE ${config.dbSchema}.mindmap_nodes
              SET ${updateFields.join(', ')}
              WHERE id = $${paramIndex}
            `, updateValues);
            
            // Increment mind map version
            await client.query(`
              UPDATE ${config.dbSchema}.mindmaps
              SET version = version + 1, updated_at = NOW()
              WHERE id = $1
            `, [mindmapId]);
          }
          
          // Broadcast to others in the room
          socket.to(`mindmap:${mindmapId}`).emit('mindmap:node_updated', {
            nodeId,
            updates,
            version: currentVersion + 1,
            updatedBy: socket.userId,
            timestamp: new Date().toISOString()
          });
          
          // Confirm to sender
          socket.emit('mindmap:update_confirmed', {
            nodeId,
            version: currentVersion + 1
          });
          
        } finally {
          client.release();
        }
        
      } catch (error) {
        logger.error(`[Socket.IO] Node update failed: ${error.message}`);
        socket.emit('error', { message: 'Failed to update node' });
      }
    });
    
    // Add new node
    socket.on('mindmap:add_node', async (data) => {
      const { mindmapId, node } = data;
      
      if (!mindmapId || !node) {
        socket.emit('error', { message: 'Mind map ID and node data required' });
        return;
      }
      
      try {
        const client = await pool.connect();
        
        try {
          // Insert node
          const result = await client.query(`
            INSERT INTO ${config.dbSchema}.mindmap_nodes
            (mindmap_id, label, summary, citations, position, cluster_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
          `, [
            mindmapId,
            node.label,
            node.summary || null,
            JSON.stringify(node.citations || []),
            JSON.stringify(node.position || { x: 0, y: 0 }),
            node.clusterId || null
          ]);
          
          const nodeId = result.rows[0].id;
          
          // Increment version
          await client.query(`
            UPDATE ${config.dbSchema}.mindmaps
            SET version = version + 1, updated_at = NOW()
            WHERE id = $1
          `, [mindmapId]);
          
          // Broadcast to all in room (including sender)
          io.to(`mindmap:${mindmapId}`).emit('mindmap:node_added', {
            nodeId,
            node: { ...node, id: nodeId },
            addedBy: socket.userId,
            timestamp: new Date().toISOString()
          });
          
        } finally {
          client.release();
        }
        
      } catch (error) {
        logger.error(`[Socket.IO] Add node failed: ${error.message}`);
        socket.emit('error', { message: 'Failed to add node' });
      }
    });
    
    // Delete node
    socket.on('mindmap:delete_node', async (data) => {
      const { mindmapId, nodeId } = data;
      
      if (!mindmapId || !nodeId) {
        socket.emit('error', { message: 'Mind map ID and node ID required' });
        return;
      }
      
      try {
        const client = await pool.connect();
        
        try {
          // Delete node (edges will cascade)
          await client.query(`
            DELETE FROM ${config.dbSchema}.mindmap_nodes
            WHERE id = $1 AND mindmap_id = $2
          `, [nodeId, mindmapId]);
          
          // Increment version
          await client.query(`
            UPDATE ${config.dbSchema}.mindmaps
            SET version = version + 1, updated_at = NOW()
            WHERE id = $1
          `, [mindmapId]);
          
          // Broadcast to all in room
          io.to(`mindmap:${mindmapId}`).emit('mindmap:node_deleted', {
            nodeId,
            deletedBy: socket.userId,
            timestamp: new Date().toISOString()
          });
          
        } finally {
          client.release();
        }
        
      } catch (error) {
        logger.error(`[Socket.IO] Delete node failed: ${error.message}`);
        socket.emit('error', { message: 'Failed to delete node' });
      }
    });
    
    // Move node (position update)
    socket.on('mindmap:move_node', async (data) => {
      const { mindmapId, nodeId, position } = data;
      
      if (!mindmapId || !nodeId || !position) {
        return;
      }
      
      try {
        // Update position in database
        const client = await pool.connect();
        
        try {
          await client.query(`
            UPDATE ${config.dbSchema}.mindmap_nodes
            SET position = $1
            WHERE id = $2
          `, [JSON.stringify(position), nodeId]);
          
          // Broadcast to others (optimistic, no version check for positions)
          socket.to(`mindmap:${mindmapId}`).emit('mindmap:node_moved', {
            nodeId,
            position,
            movedBy: socket.userId
          });
          
        } finally {
          client.release();
        }
        
      } catch (error) {
        logger.error(`[Socket.IO] Move node failed: ${error.message}`);
      }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
      if (socket.mindmapId) {
        socket.to(`mindmap:${socket.mindmapId}`).emit('mindmap:user_left', {
          userId: socket.userId,
          socketId: socket.id
        });
      }
      
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
  
  logger.info('[Socket.IO] Server initialized');
}

/**
 * Get Socket.IO instance
 * @returns {SocketIO} Socket.IO instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

module.exports = {
  initializeSocketIO,
  getIO
};
