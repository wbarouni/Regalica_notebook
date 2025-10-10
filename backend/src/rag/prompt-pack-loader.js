const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const logger = require('../utils/logger');

/**
 * Charge tous les prompt packs depuis le répertoire prompt_bank
 * @returns {Object} - Map des prompt packs par nom
 */
function loadPromptPacks() {
  const promptPacksDir = path.join(__dirname, 'prompt_bank');
  const packs = {};

  try {
    const files = fs.readdirSync(promptPacksDir);
    
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const filePath = path.join(promptPacksDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const pack = yaml.load(content);
        
        if (pack && pack.name) {
          packs[pack.name] = pack;
          logger.debug(`[prompt-pack-loader] Loaded pack: ${pack.name}`);
        }
      }
    }
    
    logger.info(`[prompt-pack-loader] Loaded ${Object.keys(packs).length} prompt packs`);
    return packs;
    
  } catch (error) {
    logger.error(`[prompt-pack-loader] Error loading prompt packs: ${error.message}`);
    return {};
  }
}

/**
 * Détecte l'intent depuis la requête utilisateur
 * @param {string} query - Requête utilisateur
 * @param {Object} packs - Map des prompt packs
 * @returns {string} - Nom du pack sélectionné
 */
function detectIntent(query, packs) {
  const queryLower = query.toLowerCase();
  
  // Parcourir tous les packs pour trouver une correspondance d'intent
  for (const [name, pack] of Object.entries(packs)) {
    if (pack.intent) {
      const intents = pack.intent.split(',').map(i => i.trim().toLowerCase());
      
      for (const intent of intents) {
        if (queryLower.includes(intent)) {
          logger.debug(`[prompt-pack-loader] Intent detected: ${name} (keyword: ${intent})`);
          return name;
        }
      }
    }
  }
  
  // Par défaut: standard
  logger.debug(`[prompt-pack-loader] No specific intent detected, using: standard`);
  return 'standard';
}

/**
 * Formatte le contexte des chunks pour le prompt
 * @param {Array} contextChunks - Chunks de contexte
 * @returns {string} - Contexte formaté
 */
function formatContext(contextChunks) {
  const limitedChunks = contextChunks.slice(0, 8);
  let contextText = '';
  
  limitedChunks.forEach((chunk, index) => {
    const text = (chunk.text || '').trim().replace(/\s+/g, ' ');
    const snippet = text.length > 500 ? text.substring(0, 500) + '...' : text;
    contextText += `[${index + 1}] Source: ${chunk.document_title}${chunk.page_no ? ` - Page ${chunk.page_no}` : ''}\n`;
    contextText += `Contenu: ${snippet}\n\n`;
  });
  
  return contextText.trim();
}

/**
 * Rend un prompt pack avec les variables substituées
 * @param {string} packName - Nom du pack à utiliser
 * @param {string} query - Requête utilisateur
 * @param {Array} contextChunks - Chunks de contexte
 * @param {string} lang - Langue détectée
 * @returns {Object} - {system: string, user: string, modelPreference: string}
 */
function renderPromptPack(packName, query, contextChunks, lang = 'en') {
  const packs = loadPromptPacks();
  const pack = packs[packName] || packs['standard'];
  
  if (!pack) {
    logger.warn(`[prompt-pack-loader] Pack ${packName} not found, using default`);
    return null;
  }
  
  // Sélectionner les prompts pour la langue
  const prompts = pack.prompts[lang] || pack.prompts['en'];
  
  if (!prompts) {
    logger.error(`[prompt-pack-loader] No prompts found for lang ${lang} in pack ${packName}`);
    return null;
  }
  
  // Formater le contexte
  const contextFormatted = formatContext(contextChunks);
  
  // Substituer les variables
  const systemPrompt = prompts.system.trim();
  const userPrompt = prompts.user
    .replace('{context}', contextFormatted)
    .replace('{query}', query)
    .trim();
  
  logger.info(`[prompt-pack-loader] Rendered prompt pack: ${packName} (lang=${lang})`);
  
  return {
    system: systemPrompt,
    user: userPrompt,
    modelPreference: pack.model_preference || 'fast',
    packName: pack.name,
    description: pack.description
  };
}

/**
 * Sélectionne et rend automatiquement le meilleur prompt pack
 * @param {string} query - Requête utilisateur
 * @param {Array} contextChunks - Chunks de contexte
 * @param {string} lang - Langue détectée
 * @param {Object} options - {packName: string (optionnel, force un pack spécifique)}
 * @returns {Object} - Prompt rendu
 */
function selectAndRenderPromptPack(query, contextChunks, lang = 'en', options = {}) {
  const packs = loadPromptPacks();
  
  // Si un pack spécifique est demandé, l'utiliser
  const packName = options.packName || detectIntent(query, packs);
  
  return renderPromptPack(packName, query, contextChunks, lang);
}

module.exports = {
  loadPromptPacks,
  detectIntent,
  renderPromptPack,
  selectAndRenderPromptPack,
  formatContext
};
