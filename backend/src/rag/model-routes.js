const express = require('express');
const router = express.Router();
const modelSwitcher = require('./model-switcher');
const logger = require('../utils/logger');

/**
 * GET /models - Get all available models and current selection
 */
router.get('/models', async (req, res) => {
  try {
    const models = await modelSwitcher.getAvailableModels();
    res.json(models);
  } catch (error) {
    logger.error(`[model-routes] Error getting models: ${error.message}`);
    res.status(500).json({
      error: 'MODELS_FETCH_FAILED',
      message: 'Could not fetch available models',
      details: error.message
    });
  }
});

/**
 * GET /models/current - Get currently active models
 */
router.get('/models/current', (req, res) => {
  const current = modelSwitcher.getCurrentModels();
  res.json(current);
});

/**
 * POST /models/switch - Switch to a different LLM model
 * Body: { "model": "mistral:7b-instruct" }
 */
router.post('/models/switch', async (req, res) => {
  try {
    const { model } = req.body;
    
    if (!model) {
      return res.status(400).json({
        error: 'MISSING_MODEL',
        message: 'Model name is required'
      });
    }
    
    const result = modelSwitcher.switchLLMModel(model);
    
    logger.info(`[model-routes] Model switched to ${model}`);
    
    res.json({
      message: 'Model switched successfully',
      ...result
    });
    
  } catch (error) {
    logger.error(`[model-routes] Model switch failed: ${error.message}`);
    res.status(400).json({
      error: 'MODEL_SWITCH_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /models/test - Test a specific model
 * Body: { "model": "phi3:mini", "prompt": "What is AI?" }
 */
router.post('/models/test', async (req, res) => {
  try {
    const { model, prompt = "Hello, how are you?" } = req.body;
    
    if (!model) {
      return res.status(400).json({
        error: 'MISSING_MODEL',
        message: 'Model name is required'
      });
    }
    
    const result = await modelSwitcher.testModel(model, prompt);
    res.json(result);
    
  } catch (error) {
    logger.error(`[model-routes] Model test failed: ${error.message}`);
    res.status(500).json({
      error: 'MODEL_TEST_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /models/compare - Compare multiple models on the same prompt
 * Body: { "prompt": "Explain quantum computing", "models": ["qwen2:7b-instruct", "mistral:7b-instruct"] }
 */
router.post('/models/compare', async (req, res) => {
  try {
    const { prompt, models } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        error: 'MISSING_PROMPT',
        message: 'Prompt is required for comparison'
      });
    }
    
    const result = await modelSwitcher.compareModels(prompt, models);
    res.json(result);
    
  } catch (error) {
    logger.error(`[model-routes] Model comparison failed: ${error.message}`);
    res.status(500).json({
      error: 'MODEL_COMPARISON_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /models/generate - Generate text with current model
 * Body: { "prompt": "Write a poem", "options": { "temperature": 0.8 } }
 */
router.post('/models/generate', async (req, res) => {
  try {
    const { prompt, options = {} } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        error: 'MISSING_PROMPT',
        message: 'Prompt is required'
      });
    }
    
    const result = await modelSwitcher.generateWithCurrentModel(prompt, options);
    res.json(result);
    
  } catch (error) {
    logger.error(`[model-routes] Generation failed: ${error.message}`);
    res.status(500).json({
      error: 'GENERATION_FAILED',
      message: error.message
    });
  }
});

module.exports = router;

