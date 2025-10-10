/**
 * Studio API routes - Mind Maps, Workspaces, Guardian
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

const mindmap = require('./mindmap');
const workspaces = require('./workspaces');
const guardian = require('./guardian');
const contextRoutes = require('./context-routes');

// ============================================
// Mind Map Routes
// ============================================

// Mount context routes (node context API)
router.use('/mindmap', contextRoutes);

/**
 * GET /studio/mindmap - Generate mind map
 * Query params: query, docId, topK, lang
 */
router.get('/mindmap', async (req, res) => {
  try {
    const { query, docId, notebookId, topK, lang } = req.query;
    
    if (!query && !docId && !notebookId) {
      return res.status(400).json({ error: 'Either query, docId, or notebookId is required' });
    }
    
    const mindMapData = await mindmap.generateMindMap({
      query,
      docId,
      notebookId,
      topK: topK ? parseInt(topK) : 50,
      lang: lang || 'en'
    });
    
    res.json(mindMapData);
    
  } catch (error) {
    logger.error(`[Studio] Mind map generation failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /studio/mindmap/generate - Generate mind map (alternative POST route)
 * Body: { query, docId, notebookId, topK, lang }
 */
router.post('/mindmap/generate', async (req, res) => {
  try {
    const { query, docId, notebookId, topK, lang } = req.body;
    
    if (!query && !docId && !notebookId) {
      return res.status(400).json({ error: 'Either query, docId, or notebookId is required' });
    }
    
    const mindMapData = await mindmap.generateMindMap({
      query,
      docId,
      notebookId,
      topK: topK || 50,
      lang: lang || 'en'
    });
    
    res.json(mindMapData);
    
  } catch (error) {
    logger.error(`[Studio] Mind map generation failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /studio/mindmap - Save mind map
 * Body: { mindMapData, workspaceId, createdBy }
 */
router.post('/mindmap', async (req, res) => {
  try {
    const { mindMapData, workspaceId, createdBy } = req.body;
    
    if (!mindMapData) {
      return res.status(400).json({ error: 'Mind map data required' });
    }
    
    const mindMapId = await mindmap.saveMindMap(mindMapData, workspaceId, createdBy);
    
    res.json({ mindMapId, message: 'Mind map saved successfully' });
    
  } catch (error) {
    logger.error(`[Studio] Mind map save failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Workspace Routes
// ============================================

/**
 * GET /studio/workspaces - List workspaces
 * Query params: userId (optional)
 */
router.get('/workspaces', async (req, res) => {
  try {
    const { userId } = req.query;
    const workspacesList = await workspaces.listWorkspaces(userId);
    
    res.json({ workspaces: workspacesList });
    
  } catch (error) {
    logger.error(`[Studio] List workspaces failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /studio/workspaces/create - Create workspace from prompt
 * Body: { prompt, createdBy }
 */
router.post('/workspaces/create', async (req, res) => {
  try {
    const { prompt, createdBy } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }
    
    // Parse prompt using LLM
    const workspaceData = await workspaces.parseWorkspacePrompt(prompt);
    
    // Create workspace
    const workspace = await workspaces.createWorkspace(
      workspaceData,
      createdBy || '00000000-0000-0000-0000-000000000000'  // Placeholder
    );
    
    res.json({
      workspace,
      parsed: workspaceData,
      message: 'Workspace created successfully'
    });
    
  } catch (error) {
    logger.error(`[Studio] Workspace creation failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /studio/workspaces/:id - Get workspace details
 */
router.get('/workspaces/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workspaceDetails = await workspaces.getWorkspaceDetails(id);
    
    res.json(workspaceDetails);
    
  } catch (error) {
    logger.error(`[Studio] Get workspace failed: ${error.message}`);
    res.status(error.message === 'Workspace not found' ? 404 : 500).json({
      error: error.message
    });
  }
});

/**
 * POST /studio/workspaces/:id/members - Add member
 * Body: { userId, role, addedBy }
 */
router.post('/workspaces/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role, addedBy } = req.body;
    
    if (!userId || !role || !addedBy) {
      return res.status(400).json({ error: 'userId, role, and addedBy required' });
    }
    
    await workspaces.addMember(id, userId, role, addedBy);
    
    res.json({ message: 'Member added successfully' });
    
  } catch (error) {
    logger.error(`[Studio] Add member failed: ${error.message}`);
    res.status(error.message.includes('permission') ? 403 : 500).json({
      error: error.message
    });
  }
});

/**
 * PUT /studio/workspaces/:id/members/:userId - Update member role
 * Body: { newRole, updatedBy }
 */
router.put('/workspaces/:id/members/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { newRole, updatedBy } = req.body;
    
    if (!newRole || !updatedBy) {
      return res.status(400).json({ error: 'newRole and updatedBy required' });
    }
    
    await workspaces.updateMemberRole(id, userId, newRole, updatedBy);
    
    res.json({ message: 'Member role updated successfully' });
    
  } catch (error) {
    logger.error(`[Studio] Update member role failed: ${error.message}`);
    res.status(error.message.includes('permission') ? 403 : 500).json({
      error: error.message
    });
  }
});

/**
 * DELETE /studio/workspaces/:id/members/:userId - Remove member
 * Query params: removedBy
 */
router.delete('/workspaces/:id/members/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { removedBy } = req.query;
    
    if (!removedBy) {
      return res.status(400).json({ error: 'removedBy query parameter required' });
    }
    
    await workspaces.removeMember(id, userId, removedBy);
    
    res.json({ message: 'Member removed successfully' });
    
  } catch (error) {
    logger.error(`[Studio] Remove member failed: ${error.message}`);
    res.status(error.message.includes('permission') ? 403 : 500).json({
      error: error.message
    });
  }
});

// ============================================
// Guardian Routes
// ============================================

/**
 * POST /studio/guardian/scan - Scan text for PII/secrets
 * Body: { text }
 */
router.post('/guardian/scan', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text required' });
    }
    
    const scanResult = guardian.scanDocument(text);
    
    res.json(scanResult);
    
  } catch (error) {
    logger.error(`[Studio] Guardian scan failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /studio/guardian/quarantined/:workspaceId - Get quarantined documents
 */
router.get('/guardian/quarantined/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const quarantined = await guardian.getQuarantinedDocuments(workspaceId);
    
    res.json({ documents: quarantined });
    
  } catch (error) {
    logger.error(`[Studio] Get quarantined docs failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /studio/guardian/patterns - Get Guardian patterns
 */
router.get('/guardian/patterns', (req, res) => {
  res.json({ patterns: guardian.PATTERNS });
});

// ============================================
// Health & Info
// ============================================

/**
 * GET /studio/health - Studio health check
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    features: {
      mindmap: true,
      workspaces: true,
      guardian: true,
      realtime: true
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
