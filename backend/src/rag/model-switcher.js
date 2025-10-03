const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

// Available models registry
const AVAILABLE_MODELS = {
  llm: [
    'qwen2:7b-instruct',
    'mistral:7b-instruct', 
    'phi3:mini',
    'tinyllama:latest',
    'qwen2.5:7b',
    'phi3:latest'
  ],
  embedding: [
    'nomic-embed-text:latest'
  ]
};

// Current active models (can be changed dynamically)
let currentModels = {
  llm: config.llmModelName || 'qwen2:7b-instruct',
  embedding: 'nomic-embed-text:latest',
  reranker: config.llmModelName || 'qwen2:7b-instruct'
};

/**
 * Get all available models from Ollama
 */
async function getAvailableModels() {
  try {
    const response = await axios.get(`${config.llmApiUrl}/api/tags`, { timeout: 5000 });
    const ollamaModels = response.data.models?.map(m => m.name) || [];
    
    return {
      available: {
        llm: AVAILABLE_MODELS.llm.filter(model => ollamaModels.includes(model)),
        embedding: AVAILABLE_MODELS.embedding.filter(model => ollamaModels.includes(model)),
        all_ollama: ollamaModels
      },
      current: currentModels
    };
  } catch (error) {
    logger.error(`[model-switcher] Error fetching models: ${error.message}`);
    return {
      available: AVAILABLE_MODELS,
      current: currentModels,
      error: error.message
    };
  }
}

/**
 * Switch the active LLM model
 */
function switchLLMModel(modelName) {
  if (!AVAILABLE_MODELS.llm.includes(modelName)) {
    throw new Error(`Model ${modelName} not in available LLM models`);
  }
  
  const previousModel = currentModels.llm;
  currentModels.llm = modelName;
  currentModels.reranker = modelName; // Use same model for reranking
  
  logger.info(`[model-switcher] LLM model switched from ${previousModel} to ${modelName}`);
  return {
    previous: previousModel,
    current: modelName,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get current active models
 */
function getCurrentModels() {
  return {
    ...currentModels,
    timestamp: new Date().toISOString()
  };
}

/**
 * Test a model with a simple prompt
 */
async function testModel(modelName, prompt = "Hello, how are you?") {
  try {
    const startTime = Date.now();
    
    const response = await axios.post(`${config.llmApiUrl}/api/generate`, {
      model: modelName,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        max_tokens: 50
      }
    }, { timeout: 30000 });
    
    const responseTime = Date.now() - startTime;
    
    return {
      model: modelName,
      prompt: prompt,
      response: response.data.response?.substring(0, 200) + "...",
      response_time_ms: responseTime,
      status: "success"
    };
    
  } catch (error) {
    return {
      model: modelName,
      prompt: prompt,
      error: error.message,
      status: "error"
    };
  }
}

/**
 * Generate answer using currently selected LLM
 */
async function generateWithCurrentModel(prompt, options = {}) {
  const model = currentModels.llm;
  
  try {
    logger.info(`[model-switcher] Generating with ${model}: "${prompt.substring(0, 50)}..."`);
    
    const response = await axios.post(`${config.llmApiUrl}/api/generate`, {
      model: model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options.temperature || 0.1,
        top_p: options.top_p || 0.9,
        max_tokens: options.max_tokens || 1000,
        ...options
      }
    }, { timeout: 60000 });
    
    return {
      model: model,
      response: response.data.response,
      status: "success"
    };
    
  } catch (error) {
    logger.error(`[model-switcher] Error with ${model}: ${error.message}`);
    throw error;
  }
}

/**
 * Compare multiple models on the same prompt
 */
async function compareModels(prompt, models = null) {
  const modelsToTest = models || AVAILABLE_MODELS.llm.slice(0, 3); // Test first 3 by default
  
  logger.info(`[model-switcher] Comparing ${modelsToTest.length} models`);
  
  const results = [];
  
  for (const model of modelsToTest) {
    const result = await testModel(model, prompt);
    results.push(result);
  }
  
  return {
    prompt: prompt,
    results: results,
    comparison_time: new Date().toISOString()
  };
}

module.exports = {
  getAvailableModels,
  switchLLMModel,
  getCurrentModels,
  testModel,
  generateWithCurrentModel,
  compareModels,
  // Getters for current models
  get currentLLM() { return currentModels.llm; },
  get currentEmbedding() { return currentModels.embedding; },
  get currentReranker() { return currentModels.reranker; }
};

