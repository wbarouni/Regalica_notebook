const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const {
  listNotebooks,
  createNotebook,
  getNotebookById,
  getNotebookDocuments,
  getNotebookSession,
  saveMessage,
  bindDocument,
  deleteNotebook,
  updateNotebook
} = require('./queries');

/**
 * GET /notebooks/list
 * List all notebooks with metadata
 */
router.get('/list', async (req, res) => {
  try {
    const notebooks = await listNotebooks();
    
    res.json({
      success: true,
      notebooks,
      count: notebooks.length
    });
  } catch (error) {
    logger.error('[notebooks/routes] Error listing notebooks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list notebooks',
      message: error.message
    });
  }
});

/**
 * POST /notebooks/create
 * Create a new notebook
 * Body: { title, description? }
 */
router.post('/create', async (req, res) => {
  try {
    const { title, description } = req.body;
    
    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Title is required and must be a non-empty string'
      });
    }
    
    if (title.length > 200) {
      return res.status(400).json({
        success: false,
        error: 'Title must be less than 200 characters'
      });
    }
    
    const notebook = await createNotebook(title.trim(), description?.trim() || null);
    
    res.status(201).json({
      success: true,
      notebook
    });
  } catch (error) {
    logger.error('[notebooks/routes] Error creating notebook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create notebook',
      message: error.message
    });
  }
});

/**
 * GET /notebooks/:id
 * Get notebook metadata by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const notebook = await getNotebookById(id);
    
    if (!notebook) {
      return res.status(404).json({
        success: false,
        error: 'Notebook not found'
      });
    }
    
    res.json({
      success: true,
      notebook
    });
  } catch (error) {
    logger.error('[notebooks/routes] Error getting notebook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notebook',
      message: error.message
    });
  }
});

/**
 * GET /notebooks/:id/boot
 * Get all data needed to boot a notebook workspace
 * Returns: notebook metadata, linked documents, and last session
 */
router.get('/:id/boot', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    // Get notebook metadata
    const notebook = await getNotebookById(id);
    
    if (!notebook) {
      return res.status(404).json({
        success: false,
        error: 'Notebook not found'
      });
    }
    
    // Get documents and session in parallel
    const [documents, session] = await Promise.all([
      getNotebookDocuments(id),
      getNotebookSession(id, limit)
    ]);
    
    res.json({
      success: true,
      notebook,
      documents,
      session,
      stats: {
        document_count: documents.length,
        message_count: session.length
      }
    });
  } catch (error) {
    logger.error('[notebooks/routes] Error booting notebook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to boot notebook',
      message: error.message
    });
  }
});

/**
 * POST /notebooks/:id/save-message
 * Save a message to notebook session
 * Body: { role: 'user'|'assistant', content, citations? }
 */
router.post('/:id/save-message', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, content, citations } = req.body;
    
    // Validation
    if (!role || !['user', 'assistant'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Role must be either "user" or "assistant"'
      });
    }
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Content is required and must be a non-empty string'
      });
    }
    
    // Verify notebook exists
    const notebook = await getNotebookById(id);
    if (!notebook) {
      return res.status(404).json({
        success: false,
        error: 'Notebook not found'
      });
    }
    
    const message = await saveMessage(
      id,
      role,
      content.trim(),
      citations || []
    );
    
    res.json({
      success: true,
      message
    });
  } catch (error) {
    logger.error('[notebooks/routes] Error saving message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save message',
      message: error.message
    });
  }
});

/**
 * POST /notebooks/:id/bind-document
 * Bind a document to a notebook
 * Body: { documentId }
 */
router.post('/:id/bind-document', async (req, res) => {
  try {
    const { id } = req.params;
    const { documentId } = req.body;
    
    // Validation
    if (!documentId || typeof documentId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'documentId is required and must be a string'
      });
    }
    
    // Verify notebook exists
    const notebook = await getNotebookById(id);
    if (!notebook) {
      return res.status(404).json({
        success: false,
        error: 'Notebook not found'
      });
    }
    
    const binding = await bindDocument(id, documentId);
    
    res.json({
      success: true,
      binding,
      already_exists: binding.already_exists || false
    });
  } catch (error) {
    logger.error('[notebooks/routes] Error binding document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bind document',
      message: error.message
    });
  }
});

/**
 * PUT /notebooks/:id
 * Update notebook metadata
 * Body: { title, description }
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    
    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Title is required and must be a non-empty string'
      });
    }
    
    const notebook = await updateNotebook(id, title.trim(), description?.trim() || null);
    
    if (!notebook) {
      return res.status(404).json({
        success: false,
        error: 'Notebook not found'
      });
    }
    
    res.json({
      success: true,
      notebook
    });
  } catch (error) {
    logger.error('[notebooks/routes] Error updating notebook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notebook',
      message: error.message
    });
  }
});

/**
 * DELETE /notebooks/:id
 * Delete a notebook (cascades to sessions and document bindings)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deleted = await deleteNotebook(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Notebook not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Notebook deleted successfully'
    });
  } catch (error) {
    logger.error('[notebooks/routes] Error deleting notebook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notebook',
      message: error.message
    });
  }
});

module.exports = router;
