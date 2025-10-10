/**
 * Workspace management with RBAC
 */
const axios = require('axios');
const pool = require('../db/pool');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * RBAC middleware - check if user has required role
 * @param {UUID} workspaceId - Workspace ID
 * @param {UUID} userId - User ID
 * @param {string} requiredRole - Required role (admin, editor, viewer)
 * @returns {boolean} Has permission
 */
async function checkPermission(workspaceId, userId, requiredRole = 'viewer') {
  const roleHierarchy = { admin: 3, editor: 2, viewer: 1 };
  const requiredLevel = roleHierarchy[requiredRole] || 1;
  
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT role FROM ${config.dbSchema}.workspace_members
      WHERE workspace_id = $1 AND user_id = $2
    `, [workspaceId, userId]);
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const userRole = result.rows[0].role;
    const userLevel = roleHierarchy[userRole] || 0;
    
    return userLevel >= requiredLevel;
  } finally {
    client.release();
  }
}

/**
 * Parse workspace creation prompt using LLM
 * @param {string} prompt - Natural language prompt
 * @returns {Object} Parsed workspace config
 */
async function parseWorkspacePrompt(prompt) {
  try {
    const systemPrompt = `Extract workspace information from the prompt. Respond ONLY with valid JSON.
Format: {"name": "...", "description": "...", "confidential": true/false, "ends_at": "YYYY-MM-DD or null", "members": [{"email": "...", "role": "admin|editor|viewer"}]}

Examples:
- "Create workspace 'Project Alpha' for team@company.com as editor, confidential, ends March 2025" 
  → {"name": "Project Alpha", "confidential": true, "ends_at": "2025-03-31", "members": [{"email": "team@company.com", "role": "editor"}]}
- "New workspace 'Research' with john@ex.com (admin) and jane@ex.com (viewer)"
  → {"name": "Research", "confidential": false, "ends_at": null, "members": [{"email": "john@ex.com", "role": "admin"}, {"email": "jane@ex.com", "role": "viewer"}]}`;

    const fullPrompt = `${systemPrompt}\n\nPrompt: ${prompt}\n\nJSON:`;
    
    const response = await axios.post(
      `${config.llmApiUrl}/api/generate`,
      {
        model: config.llmModelName,
        prompt: fullPrompt,
        temperature: 0.1,
        num_predict: 200,
        stop: ['\n\n']
      },
      { timeout: 30000 }
    );
    
    let jsonText = response.data.response.trim();
    
    // Extract JSON if wrapped in markdown
    const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
    
    // Parse JSON
    const parsed = JSON.parse(jsonText);
    
    // Validate and set defaults
    return {
      name: parsed.name || 'Untitled Workspace',
      description: parsed.description || null,
      confidential: parsed.confidential === true,
      ends_at: parsed.ends_at || null,
      members: Array.isArray(parsed.members) ? parsed.members : []
    };
    
  } catch (error) {
    logger.error(`[Workspace] Prompt parsing failed: ${error.message}`);
    // Fallback: extract name from prompt
    const nameMatch = prompt.match(/['"](.*?)['"]/);
    return {
      name: nameMatch ? nameMatch[1] : 'New Workspace',
      description: null,
      confidential: /confidential|private|secret/i.test(prompt),
      ends_at: null,
      members: []
    };
  }
}

/**
 * Create workspace
 * @param {Object} workspaceData - Workspace configuration
 * @param {UUID} createdBy - Creator user ID
 * @returns {Object} Created workspace
 */
async function createWorkspace(workspaceData, createdBy) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Parse ends_at date if provided
    let endsAt = null;
    if (workspaceData.ends_at) {
      endsAt = new Date(workspaceData.ends_at);
      if (isNaN(endsAt.getTime())) {
        endsAt = null;
      }
    }
    
    // Create workspace
    const wsResult = await client.query(`
      INSERT INTO ${config.dbSchema}.workspaces 
      (name, description, confidential, ends_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, description, confidential, ends_at, created_at
    `, [
      workspaceData.name,
      workspaceData.description,
      workspaceData.confidential || false,
      endsAt
    ]);
    
    const workspace = wsResult.rows[0];
    
    // Add creator as admin
    await client.query(`
      INSERT INTO ${config.dbSchema}.workspace_members
      (workspace_id, user_id, role)
      VALUES ($1, $2, $3)
    `, [workspace.id, createdBy, 'admin']);
    
    // Add additional members if provided
    if (workspaceData.members && workspaceData.members.length > 0) {
      for (const member of workspaceData.members) {
        // In production, you'd resolve email to user_id
        // For now, we'll skip or use a placeholder
        if (member.user_id) {
          await client.query(`
            INSERT INTO ${config.dbSchema}.workspace_members
            (workspace_id, user_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (workspace_id, user_id) DO NOTHING
          `, [workspace.id, member.user_id, member.role || 'viewer']);
        }
      }
    }
    
    // Log creation
    await client.query(`
      INSERT INTO ${config.dbSchema}.studio_logs
      (workspace_id, event_type, severity, message, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      workspace.id,
      'workspace_created',
      'info',
      `Workspace "${workspace.name}" created`,
      JSON.stringify({ created_by: createdBy })
    ]);
    
    await client.query('COMMIT');
    
    logger.info(`[Workspace] Created workspace ${workspace.id}: "${workspace.name}"`);
    
    return workspace;
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`[Workspace] Creation failed: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get workspace details with members and metrics
 * @param {UUID} workspaceId - Workspace ID
 * @returns {Object} Workspace details
 */
async function getWorkspaceDetails(workspaceId) {
  const client = await pool.connect();
  
  try {
    // Get workspace info
    const wsResult = await client.query(`
      SELECT * FROM ${config.dbSchema}.workspaces
      WHERE id = $1
    `, [workspaceId]);
    
    if (wsResult.rows.length === 0) {
      throw new Error('Workspace not found');
    }
    
    const workspace = wsResult.rows[0];
    
    // Get members
    const membersResult = await client.query(`
      SELECT user_id, role, joined_at
      FROM ${config.dbSchema}.workspace_members
      WHERE workspace_id = $1
      ORDER BY joined_at ASC
    `, [workspaceId]);
    
    // Get documents
    const docsResult = await client.query(`
      SELECT 
        wd.document_id,
        wd.quarantined,
        wd.quarantine_reason,
        wd.added_at,
        d.title,
        d.mime,
        d.bytes
      FROM ${config.dbSchema}.workspace_docs wd
      JOIN ${config.dbSchema}.documents d ON wd.document_id = d.id
      WHERE wd.workspace_id = $1
      ORDER BY wd.added_at DESC
    `, [workspaceId]);
    
    // Get health metrics
    const totalDocs = docsResult.rows.length;
    const quarantinedDocs = docsResult.rows.filter(d => d.quarantined).length;
    
    const alertsResult = await client.query(`
      SELECT COUNT(*) as count, severity
      FROM ${config.dbSchema}.studio_logs
      WHERE workspace_id = $1 AND event_type = 'guardian_alert'
      GROUP BY severity
    `, [workspaceId]);
    
    const alerts = {};
    alertsResult.rows.forEach(row => {
      alerts[row.severity] = parseInt(row.count);
    });
    
    return {
      ...workspace,
      members: membersResult.rows,
      documents: docsResult.rows,
      metrics: {
        total_members: membersResult.rows.length,
        total_documents: totalDocs,
        quarantined_documents: quarantinedDocs,
        quarantine_rate: totalDocs > 0 ? (quarantinedDocs / totalDocs) : 0,
        guardian_alerts: alerts
      }
    };
    
  } finally {
    client.release();
  }
}

/**
 * List all workspaces (optionally for a user)
 * @param {UUID} userId - User ID (optional)
 * @returns {Array} Workspaces
 */
async function listWorkspaces(userId = null) {
  const client = await pool.connect();
  
  try {
    let query;
    let params;
    
    if (userId) {
      query = `
        SELECT DISTINCT w.*, wm.role
        FROM ${config.dbSchema}.workspaces w
        JOIN ${config.dbSchema}.workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = $1
        ORDER BY w.created_at DESC
      `;
      params = [userId];
    } else {
      query = `
        SELECT * FROM ${config.dbSchema}.workspaces
        ORDER BY created_at DESC
      `;
      params = [];
    }
    
    const result = await client.query(query, params);
    return result.rows;
    
  } finally {
    client.release();
  }
}

/**
 * Add member to workspace
 * @param {UUID} workspaceId - Workspace ID
 * @param {UUID} userId - User ID to add
 * @param {string} role - Role (admin/editor/viewer)
 * @param {UUID} addedBy - User ID adding the member
 */
async function addMember(workspaceId, userId, role, addedBy) {
  // Check if addedBy has admin permission
  const hasPermission = await checkPermission(workspaceId, addedBy, 'admin');
  if (!hasPermission) {
    throw new Error('Insufficient permissions to add members');
  }
  
  const client = await pool.connect();
  
  try {
    await client.query(`
      INSERT INTO ${config.dbSchema}.workspace_members
      (workspace_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (workspace_id, user_id) DO UPDATE
      SET role = EXCLUDED.role
    `, [workspaceId, userId, role]);
    
    logger.info(`[Workspace] Added member ${userId} to workspace ${workspaceId} as ${role}`);
    
  } finally {
    client.release();
  }
}

/**
 * Update member role
 * @param {UUID} workspaceId - Workspace ID
 * @param {UUID} userId - User ID
 * @param {string} newRole - New role
 * @param {UUID} updatedBy - User ID making the change
 */
async function updateMemberRole(workspaceId, userId, newRole, updatedBy) {
  const hasPermission = await checkPermission(workspaceId, updatedBy, 'admin');
  if (!hasPermission) {
    throw new Error('Insufficient permissions to update roles');
  }
  
  const client = await pool.connect();
  
  try {
    await client.query(`
      UPDATE ${config.dbSchema}.workspace_members
      SET role = $3
      WHERE workspace_id = $1 AND user_id = $2
    `, [workspaceId, userId, newRole]);
    
    logger.info(`[Workspace] Updated member ${userId} role to ${newRole} in workspace ${workspaceId}`);
    
  } finally {
    client.release();
  }
}

/**
 * Remove member from workspace
 * @param {UUID} workspaceId - Workspace ID
 * @param {UUID} userId - User ID to remove
 * @param {UUID} removedBy - User ID removing the member
 */
async function removeMember(workspaceId, userId, removedBy) {
  const hasPermission = await checkPermission(workspaceId, removedBy, 'admin');
  if (!hasPermission) {
    throw new Error('Insufficient permissions to remove members');
  }
  
  const client = await pool.connect();
  
  try {
    await client.query(`
      DELETE FROM ${config.dbSchema}.workspace_members
      WHERE workspace_id = $1 AND user_id = $2
    `, [workspaceId, userId]);
    
    logger.info(`[Workspace] Removed member ${userId} from workspace ${workspaceId}`);
    
  } finally {
    client.release();
  }
}

module.exports = {
  checkPermission,
  parseWorkspacePrompt,
  createWorkspace,
  getWorkspaceDetails,
  listWorkspaces,
  addMember,
  updateMemberRole,
  removeMember
};
