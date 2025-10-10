const pool = require('../db/pool');
const logger = require('../utils/logger');

/**
 * List all notebooks with metadata
 * @returns {Promise<Array>} Array of notebooks with document counts
 */
async function listNotebooks() {
  const query = `
    SELECT 
      n.id,
      n.title,
      n.description,
      n.created_at,
      n.updated_at,
      COUNT(DISTINCT nd.document_id) as document_count,
      COUNT(DISTINCT ns.id) as message_count,
      MAX(ns.created_at) as last_activity
    FROM nbk.notebooks n
    LEFT JOIN nbk.notebook_documents nd ON n.id = nd.notebook_id
    LEFT JOIN nbk.notebook_sessions ns ON n.id = ns.notebook_id
    GROUP BY n.id, n.title, n.description, n.created_at, n.updated_at
    ORDER BY n.created_at DESC
  `;
  
  try {
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    logger.error('[notebooks/queries] Error listing notebooks:', error);
    throw error;
  }
}

/**
 * Create a new notebook
 * @param {string} title - Notebook title
 * @param {string} description - Optional description
 * @returns {Promise<Object>} Created notebook
 */
async function createNotebook(title, description = null) {
  const query = `
    INSERT INTO nbk.notebooks (title, description)
    VALUES ($1, $2)
    RETURNING id, title, description, created_at, updated_at
  `;
  
  try {
    const result = await pool.query(query, [title, description]);
    logger.info(`[notebooks/queries] Created notebook: ${result.rows[0].id}`);
    return result.rows[0];
  } catch (error) {
    logger.error('[notebooks/queries] Error creating notebook:', error);
    throw error;
  }
}

/**
 * Get notebook by ID
 * @param {string} notebookId - Notebook UUID
 * @returns {Promise<Object|null>} Notebook or null if not found
 */
async function getNotebookById(notebookId) {
  const query = `
    SELECT 
      n.id,
      n.title,
      n.description,
      n.created_at,
      n.updated_at,
      COUNT(DISTINCT nd.document_id) as document_count,
      COUNT(DISTINCT ns.id) as message_count
    FROM nbk.notebooks n
    LEFT JOIN nbk.notebook_documents nd ON n.id = nd.notebook_id
    LEFT JOIN nbk.notebook_sessions ns ON n.id = ns.notebook_id
    WHERE n.id = $1
    GROUP BY n.id, n.title, n.description, n.created_at, n.updated_at
  `;
  
  try {
    const result = await pool.query(query, [notebookId]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('[notebooks/queries] Error getting notebook:', error);
    throw error;
  }
}

/**
 * Get documents linked to a notebook
 * @param {string} notebookId - Notebook UUID
 * @returns {Promise<Array>} Array of documents
 */
async function getNotebookDocuments(notebookId) {
  const query = `
    SELECT 
      d.id,
      d.title,
      d.filename,
      d.content_type,
      d.page_count,
      d.created_at,
      nd.added_at
    FROM nbk.documents d
    INNER JOIN nbk.notebook_documents nd ON d.id = nd.document_id
    WHERE nd.notebook_id = $1
    ORDER BY nd.added_at DESC
  `;
  
  try {
    const result = await pool.query(query, [notebookId]);
    return result.rows;
  } catch (error) {
    logger.error('[notebooks/queries] Error getting notebook documents:', error);
    throw error;
  }
}

/**
 * Get last N messages from notebook session
 * @param {string} notebookId - Notebook UUID
 * @param {number} limit - Number of messages to retrieve (default 10)
 * @returns {Promise<Array>} Array of messages
 */
async function getNotebookSession(notebookId, limit = 10) {
  const query = `
    SELECT 
      id,
      role,
      content,
      citations,
      created_at
    FROM nbk.notebook_sessions
    WHERE notebook_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
  
  try {
    const result = await pool.query(query, [notebookId, limit]);
    // Reverse to get chronological order (oldest first)
    return result.rows.reverse();
  } catch (error) {
    logger.error('[notebooks/queries] Error getting notebook session:', error);
    throw error;
  }
}

/**
 * Save a message to notebook session
 * @param {string} notebookId - Notebook UUID
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - Message content
 * @param {Array} citations - Optional citations array
 * @returns {Promise<Object>} Saved message
 */
async function saveMessage(notebookId, role, content, citations = []) {
  const query = `
    INSERT INTO nbk.notebook_sessions (notebook_id, role, content, citations)
    VALUES ($1, $2, $3, $4)
    RETURNING id, notebook_id, role, content, citations, created_at
  `;
  
  try {
    const result = await pool.query(query, [notebookId, role, content, JSON.stringify(citations)]);
    logger.info(`[notebooks/queries] Saved ${role} message to notebook ${notebookId}`);
    return result.rows[0];
  } catch (error) {
    logger.error('[notebooks/queries] Error saving message:', error);
    throw error;
  }
}

/**
 * Bind a document to a notebook
 * @param {string} notebookId - Notebook UUID
 * @param {string} documentId - Document UUID
 * @returns {Promise<Object>} Binding record
 */
async function bindDocument(notebookId, documentId) {
  const query = `
    INSERT INTO nbk.notebook_documents (notebook_id, document_id)
    VALUES ($1, $2)
    ON CONFLICT (notebook_id, document_id) DO NOTHING
    RETURNING id, notebook_id, document_id, added_at
  `;
  
  try {
    const result = await pool.query(query, [notebookId, documentId]);
    if (result.rows.length > 0) {
      logger.info(`[notebooks/queries] Bound document ${documentId} to notebook ${notebookId}`);
      return result.rows[0];
    }
    // Already exists
    return { notebook_id: notebookId, document_id: documentId, already_exists: true };
  } catch (error) {
    logger.error('[notebooks/queries] Error binding document:', error);
    throw error;
  }
}

/**
 * Delete a notebook (cascade deletes sessions and document bindings)
 * @param {string} notebookId - Notebook UUID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteNotebook(notebookId) {
  const query = `DELETE FROM nbk.notebooks WHERE id = $1 RETURNING id`;
  
  try {
    const result = await pool.query(query, [notebookId]);
    if (result.rows.length > 0) {
      logger.info(`[notebooks/queries] Deleted notebook ${notebookId}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('[notebooks/queries] Error deleting notebook:', error);
    throw error;
  }
}

/**
 * Update notebook metadata
 * @param {string} notebookId - Notebook UUID
 * @param {string} title - New title
 * @param {string} description - New description
 * @returns {Promise<Object>} Updated notebook
 */
async function updateNotebook(notebookId, title, description) {
  const query = `
    UPDATE nbk.notebooks
    SET title = $2, description = $3
    WHERE id = $1
    RETURNING id, title, description, created_at, updated_at
  `;
  
  try {
    const result = await pool.query(query, [notebookId, title, description]);
    if (result.rows.length > 0) {
      logger.info(`[notebooks/queries] Updated notebook ${notebookId}`);
      return result.rows[0];
    }
    return null;
  } catch (error) {
    logger.error('[notebooks/queries] Error updating notebook:', error);
    throw error;
  }
}

module.exports = {
  listNotebooks,
  createNotebook,
  getNotebookById,
  getNotebookDocuments,
  getNotebookSession,
  saveMessage,
  bindDocument,
  deleteNotebook,
  updateNotebook
};
