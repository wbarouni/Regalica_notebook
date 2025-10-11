const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { detectLanguage } = require('./lang');
const modelSwitcher = require('./model-switcher');
const { pickModel } = require('./model-router');
const { validateAnswer } = require('./schemas');
const { selectAndRenderPromptPack } = require('./prompt-pack-loader');

/**
 * System prompt JSON contraint (Phase 2)
 */
const JSON_SYSTEM_PROMPTS = {
  fr: `Tu DOIS répondre en JSON strict avec ce schéma:
{
  "answer": "texte avec citations inline [1], [2]...",
  "bullets": ["action 1", "action 2"],
  "risks": ["risque 1"],
  "citations": [
    {"doc_id":"id1","chunk_id":"cid1","title":"Doc 1","page":5}
  ]
}

RÈGLES ABSOLUES:
1. Dans "answer", insère [1], [2], [3]... inline au plus près des affirmations
2. L'ordre [n] correspond exactement à citations[n-1]
3. N'invente AUCUNE citation hors contexte RAG fourni
4. Utilise UNIQUEMENT les doc_id/chunk_id reçus
5. Format JSON valide obligatoire
6. Si impossible → {"answer":"NO_ANSWER","citations":[]}`,

  en: `You MUST respond in strict JSON with this schema:
{
  "answer": "text with inline citations [1], [2]...",
  "bullets": ["action 1", "action 2"],
  "risks": ["risk 1"],
  "citations": [
    {"doc_id":"id1","chunk_id":"cid1","title":"Doc 1","page":5}
  ]
}

ABSOLUTE RULES:
1. In "answer", insert [1], [2], [3]... inline close to claims
2. Order [n] corresponds exactly to citations[n-1]
3. NEVER invent citations outside RAG context
4. Only use doc_id/chunk_id from provided context
5. Valid JSON format mandatory
6. If impossible → {"answer":"NO_ANSWER","citations":[]}`
};

/**
 * Génère un prompt structuré pour le LLM
 * @param {string} query - Requête utilisateur
 * @param {Array} contextChunks - Chunks de contexte
 * @param {string} lang - Langue détectée
 * @param {Object} options - {format: 'json'|'text'}
 * @returns {string} - Prompt formaté
 */
function buildPrompt(query, contextChunks, lang, options = {}) {
  const langInstructions = {
    fr: {
      system: "Tu es un assistant expert qui analyse des documents et répond avec précision. Rédige des réponses détaillées et bien structurées en citant SYSTÉMATIQUEMENT tes sources avec [1], [2], [3] etc. Sois analytique et professionnel.",
      contextHeader: "DOCUMENTS DE RÉFÉRENCE:",
      questionHeader: "QUESTION:",
      instruction: "Analyse approfondie requise. Cite chaque affirmation avec [1], [2], etc. Format: réponse détaillée + sources citées."
    },
    en: {
      system: "You are an expert assistant that analyzes documents and responds with precision. Write detailed, well-structured answers SYSTEMATICALLY citing your sources with [1], [2], [3] etc. Be analytical and professional.",
      contextHeader: "REFERENCE DOCUMENTS:",
      questionHeader: "QUESTION:",
      instruction: "In-depth analysis required. Cite each statement with [1], [2], etc. Format: detailed answer + cited sources."
    },
    ar: {
      system: "أنت مساعد خبير يحلل الوثائق ويجيب بدقة. اكتب إجابات مفصلة ومنظمة مع اقتباس مصادرك بشكل منهجي [1], [2], [3] إلخ.",
      contextHeader: "وثائق المرجع:",
      questionHeader: "السؤال:",
      instruction: "تحليل متعمق مطلوب. اقتبس كل بيان بـ [1], [2], إلخ."
    }
  };

  const instructions = langInstructions[lang] || langInstructions.en;

  // Utiliser jusqu'à 8 chunks pour plus de contexte
  const limitedChunks = contextChunks.slice(0, 8);
  
  let contextText = `${instructions.contextHeader}\n\n`;
  
  limitedChunks.forEach((chunk, index) => {
    const text = (chunk.text || '').trim().replace(/\s+/g, ' ');
    const snippet = text.length > 500 ? text.substring(0, 500) + '...' : text;
    contextText += `[${index + 1}] Source: ${chunk.document_title}${chunk.page_no ? ` - Page ${chunk.page_no}` : ''}\nContenu: ${snippet}\n\n`;
  });

  return `${contextText}${instructions.questionHeader} ${query}\n\n${instructions.instruction}`;
}

/**
 * Génère une réponse en utilisant le LLM Ollama
 * @param {string} query - Requête utilisateur
 * @param {Array} contextChunks - Chunks de contexte
 * @param {string} lang - Langue détectée
 * @param {Object} options - Options {depth: 'high'|undefined}
 * @returns {Promise<Object>} - Réponse avec citations et confiance
 */
async function generateAnswer(query, contextChunks, lang = 'en', options = {}) {
  if (!query || !query.trim()) {
    throw new Error('Requête vide');
  }

  if (!contextChunks || !Array.isArray(contextChunks) || contextChunks.length === 0) {
    logger.warn('[rag/synthesize] Aucun contexte fourni');
    return {
      answer: 'NO_ANSWER',
      sources: [],
      confidence: 0,
      reasoning: 'Aucun contexte disponible'
    };
  }

  const startTime = Date.now();

  try {
    logger.info(`[rag/synthesize] Génération réponse pour "${query.substring(0, 100)}..." (${contextChunks.length} chunks, lang=${lang})`);

    // Construire le prompt
    const prompt = buildPrompt(query, contextChunks, lang);
    
    // Sélectionner le modèle selon heuristiques (Phase 1: Multi-model routing)
    const selectedModel = pickModel(query, contextChunks, { depth: options.depth });
    
    logger.info(`[rag/synthesize] Model selected: ${selectedModel}`);
    
    const langInstructions = {
      fr: { system: "Tu es un assistant d'analyse de documents. Tu DOIS OBLIGATOIREMENT utiliser UNIQUEMENT les documents fournis ci-dessous pour répondre. NE DIS JAMAIS que tu n'as pas de document - les documents sont TOUJOURS fournis dans le contexte. Réponds en français et cite SYSTÉMATIQUEMENT tes sources avec [1], [2], [3], etc." },
      en: { system: "You are a document analysis assistant. You MUST use ONLY the documents provided below to answer. NEVER say you don't have documents - documents are ALWAYS provided in the context. Answer in English and ALWAYS cite sources with [1], [2], [3], etc." },
      ar: { system: "أنت مساعد تحليل الوثائق. يجب عليك استخدام الوثائق المقدمة أدناه فقط للإجابة. لا تقل أبداً أنه ليس لديك وثائق - الوثائق مقدمة دائماً في السياق. أجب بالعربية واقتبس دائماً المصادر بأرقام [1], [2], [3], إلخ." }
    };
    const instructions = langInstructions[lang] || langInstructions.en;
    
    const response = await axios.post(`${config.llmApiUrl}/api/chat`, {
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: instructions.system
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: false,
      options: {
        temperature: 0.2,
        top_p: 0.95,
        num_predict: 120,  // Réponses plus courtes et rapides
        num_ctx: 1024,     // Réduit pour plus de vitesse
        stop: ['\n\n\n', 'Sources:', 'Références:']
      }
    }, {
      timeout: 30000 // 30 secondes max
    });

    const generatedText = response.data.message?.content || '';
    
    if (!generatedText.trim()) {
      throw new Error('Réponse LLM vide');
    }

    // Extraire les citations numériques [1], [2], etc.
    const numericCitationRegex = /\[(\d+)\]/g;
    const citedIndices = new Set();
    let match;
    
    while ((match = numericCitationRegex.exec(generatedText)) !== null) {
      const index = parseInt(match[1]) - 1; // Convertir en index 0-based
      if (index >= 0 && index < contextChunks.length) {
        citedIndices.add(index);
      }
    }
    
    // Créer les sources à partir des chunks cités
    const sources = Array.from(citedIndices).map(index => {
      const chunk = contextChunks[index];
      return {
        index: index + 1,
        chunk_id: chunk.chunk_id,
        document_id: chunk.document_id,
        title: chunk.document_title,
        page: chunk.page_no || '?',
        span_start: chunk.span_start || 0,
        span_end: chunk.span_end || 0,
        text: chunk.text,
        score: chunk.score_final || chunk.score_cosine || 0,
        citation: `[${index + 1}]`
      };
    });

    // Calcul de confiance simplifié
    const avgScore = contextChunks.reduce((sum, chunk) => sum + (chunk.score_final || 0), 0) / contextChunks.length;
    const citationBonus = sources.length >= 1 ? 0.1 : 0;
    const confidence = Math.min(avgScore + citationBonus, 1);

    const processingTime = Date.now() - startTime;
    
    // Validation très permissive
    const hasNoAnswer = generatedText.trim() === 'NO_ANSWER';
    const hasMinLength = generatedText.trim().length >= 20;
    
    // Accepter même sans citations si la réponse est substantielle
    const isValidAnswer = !hasNoAnswer && hasMinLength;

    const finalAnswer = isValidAnswer ? generatedText.trim() : 'NO_ANSWER';
    const finalSources = isValidAnswer ? sources : [];
    const finalConfidence = isValidAnswer ? confidence : 0;

    logger.info(`[rag/synthesize] Réponse générée en ${processingTime}ms`);
    logger.info(`[rag/synthesize] Citations trouvées: ${sources.length}, confiance: ${confidence.toFixed(4)}`);
    logger.info(`[rag/synthesize] Réponse valide: ${isValidAnswer}`);

    return {
      answer: finalAnswer,
      sources: finalSources,
      confidence: finalConfidence,
      reasoning: isValidAnswer ? 'OK' : `Manque: citations=${sources.length}, longueur=${generatedText.length}`,
      processing_time_ms: processingTime,
      model_used: selectedModel,
      lang_detected: lang
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/synthesize] Erreur génération réponse (${processingTime}ms): ${error.message}`);
    
    if (error.response) {
      logger.error(`[rag/synthesize] Réponse LLM: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }

    // En cas d'erreur, on ne peut pas utiliser selectedModel car il peut ne pas être défini
    return {
      answer: 'NO_ANSWER',
      sources: [],
      confidence: 0,
      reasoning: `Erreur génération: ${error.message}`,
      processing_time_ms: processingTime,
      model_used: 'error',
      lang_detected: lang
    };
  }
}

/**
 * Génère une réponse en format JSON avec validation Zod (Phase 2)
 * @param {string} query - Requête utilisateur
 * @param {Array} contextChunks - Chunks de contexte
 * @param {string} lang - Langue détectée
 * @param {Object} options - Options {depth, schemaType: 'full'|'minimal'}
 * @returns {Promise<Object>} - Réponse JSON validée ou fallback text
 */
async function generateAnswerJSON(query, contextChunks, lang = 'en', options = {}) {
  if (!query || !query.trim()) {
    throw new Error('Requête vide');
  }

  if (!contextChunks || !Array.isArray(contextChunks) || contextChunks.length === 0) {
    logger.warn('[rag/synthesize] Aucun contexte fourni');
    return {
      answer: 'NO_ANSWER',
      sources: [],
      confidence: 0,
      reasoning: 'Aucun contexte disponible',
      format: 'json',
      validated: false
    };
  }

  const startTime = Date.now();
  const schemaType = options.schemaType || 'full';

  try {
    logger.info(`[rag/synthesize] Génération JSON pour "${query.substring(0, 100)}..." (schema=${schemaType})`);

    // Construire contexte avec métadonnées pour citations JSON
    const limitedChunks = contextChunks.slice(0, 8);
    let contextText = 'DOCUMENTS:\n\n';
    
    limitedChunks.forEach((chunk, index) => {
      const text = (chunk.text || '').trim().replace(/\s+/g, ' ');
      const snippet = text.length > 500 ? text.substring(0, 500) + '...' : text;
      contextText += `[${index + 1}] doc_id="${chunk.document_id}", chunk_id="${chunk.chunk_id}", title="${chunk.document_title}", page=${chunk.page_no || '?'}\n`;
      contextText += `Content: ${snippet}\n\n`;
    });

    // Sélectionner le modèle
    const selectedModel = pickModel(query, contextChunks, { depth: options.depth });
    logger.info(`[rag/synthesize] Model selected: ${selectedModel} (JSON mode)`);

    // System prompt JSON selon langue
    const jsonSystemPrompt = JSON_SYSTEM_PROMPTS[lang] || JSON_SYSTEM_PROMPTS.en;

    const response = await axios.post(`${config.llmApiUrl}/api/chat`, {
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: jsonSystemPrompt
        },
        {
          role: 'user',
          content: `${contextText}\nQUESTION: ${query}\n\nRéponds en JSON strict selon le schéma.`
        }
      ],
      stream: false,
      format: 'json',  // Force JSON mode in Ollama
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 200  // Réduit pour JSON plus rapide
      }
    }, {
      timeout: 40000 // 40 secondes pour JSON
    });

    const generatedText = response.data.message?.content || '';
    
    if (!generatedText.trim()) {
      throw new Error('Réponse LLM vide');
    }

    // Parser JSON
    let parsedJSON;
    try {
      parsedJSON = JSON.parse(generatedText);
    } catch (parseError) {
      logger.warn(`[rag/synthesize] JSON parse failed, fallback to text mode: ${parseError.message}`);
      // Fallback: mode texte
      return await generateAnswer(query, contextChunks, lang, options);
    }

    // Valider avec Zod
    const validation = validateAnswer(parsedJSON, schemaType);
    
    if (!validation.success) {
      logger.warn(`[rag/synthesize] Zod validation failed: ${validation.error}`);
      logger.debug(`[rag/synthesize] Validation details: ${JSON.stringify(validation.details)}`);
      // Fallback: mode texte
      return await generateAnswer(query, contextChunks, lang, options);
    }

    const validatedData = validation.data;
    const processingTime = Date.now() - startTime;

    // Mapper citations JSON vers format sources
    const sources = (validatedData.citations || []).map((citation, index) => {
      // Trouver le chunk correspondant
      const chunk = contextChunks.find(c => c.chunk_id === citation.chunk_id);
      return {
        index: index + 1,
        chunk_id: citation.chunk_id,
        document_id: citation.doc_id,
        title: citation.title || chunk?.document_title || 'Unknown',
        page: citation.page || chunk?.page_no || '?',
        span_start: chunk?.span_start || 0,
        span_end: chunk?.span_end || 0,
        text: chunk?.text || '',
        score: chunk?.score_final || chunk?.score_cosine || 0,
        citation: `[${index + 1}]`
      };
    });

    const avgScore = contextChunks.reduce((sum, chunk) => sum + (chunk.score_final || 0), 0) / contextChunks.length;
    const citationBonus = sources.length >= 1 ? 0.15 : 0;
    const confidence = Math.min(avgScore + citationBonus, 1);

    logger.info(`[rag/synthesize] JSON validé en ${processingTime}ms, ${sources.length} citations`);

    return {
      answer: validatedData.answer,
      bullets: validatedData.bullets || [],
      risks: validatedData.risks || [],
      sources,
      confidence,
      reasoning: 'JSON validated',
      processing_time_ms: processingTime,
      model_used: selectedModel,
      lang_detected: lang,
      format: 'json',
      validated: true
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/synthesize] Erreur JSON mode (${processingTime}ms): ${error.message}`);
    
    // Fallback ultime: mode texte
    logger.info('[rag/synthesize] Fallback to text mode');
    return await generateAnswer(query, contextChunks, lang, options);
  }
}

/**
 * Génère une réponse en utilisant les prompt packs (Phase 3)
 * @param {string} query - Requête utilisateur
 * @param {Array} contextChunks - Chunks de contexte
 * @param {string} lang - Langue détectée
 * @param {Object} options - Options {depth, packName, format}
 * @returns {Promise<Object>} - Réponse avec prompt pack info
 */
async function generateAnswerWithPromptPack(query, contextChunks, lang = 'en', options = {}) {
  if (!query || !query.trim()) {
    throw new Error('Requête vide');
  }

  if (!contextChunks || !Array.isArray(contextChunks) || contextChunks.length === 0) {
    logger.warn('[rag/synthesize] Aucun contexte fourni');
    return {
      answer: 'NO_ANSWER',
      sources: [],
      confidence: 0,
      reasoning: 'Aucun contexte disponible'
    };
  }

  const startTime = Date.now();

  try {
    // Phase 3: Sélectionner et rendre le prompt pack
    const promptPack = selectAndRenderPromptPack(query, contextChunks, lang, { 
      packName: options.packName 
    });

    if (!promptPack) {
      logger.warn('[rag/synthesize] Prompt pack failed, using default prompt');
      return await generateAnswer(query, contextChunks, lang, options);
    }

    logger.info(`[rag/synthesize] Using prompt pack: ${promptPack.packName}`);

    // Sélectionner le modèle (prompt pack peut suggérer, mais router décide)
    const selectedModel = pickModel(query, contextChunks, { depth: options.depth });
    
    logger.info(`[rag/synthesize] Model selected: ${selectedModel} (pack preference: ${promptPack.modelPreference})`);

    const response = await axios.post(`${config.llmApiUrl}/api/chat`, {
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: promptPack.system
        },
        {
          role: 'user',
          content: promptPack.user
        }
      ],
      stream: false,
      options: {
        temperature: 0.2,
        top_p: 0.95,
        num_predict: 150  // Réduit pour prompt packs
      }
    }, {
      timeout: 35000 // 35 secondes
    });

    const generatedText = response.data.message?.content || '';
    
    if (!generatedText.trim()) {
      throw new Error('Réponse LLM vide');
    }

    // Extraire les citations
    const numericCitationRegex = /\[(\d+)\]/g;
    const citedIndices = new Set();
    let match;
    
    while ((match = numericCitationRegex.exec(generatedText)) !== null) {
      const index = parseInt(match[1]) - 1;
      if (index >= 0 && index < contextChunks.length) {
        citedIndices.add(index);
      }
    }
    
    const sources = Array.from(citedIndices).map(index => {
      const chunk = contextChunks[index];
      return {
        index: index + 1,
        chunk_id: chunk.chunk_id,
        document_id: chunk.document_id,
        title: chunk.document_title,
        page: chunk.page_no || '?',
        span_start: chunk.span_start || 0,
        span_end: chunk.span_end || 0,
        text: chunk.text,
        score: chunk.score_final || chunk.score_cosine || 0,
        citation: `[${index + 1}]`
      };
    });

    const avgScore = contextChunks.reduce((sum, chunk) => sum + (chunk.score_final || 0), 0) / contextChunks.length;
    const citationBonus = sources.length >= 1 ? 0.1 : 0;
    const confidence = Math.min(avgScore + citationBonus, 1);

    const processingTime = Date.now() - startTime;
    
    const hasNoAnswer = generatedText.trim() === 'NO_ANSWER';
    const hasMinLength = generatedText.trim().length >= 20;
    const isValidAnswer = !hasNoAnswer && hasMinLength;

    const finalAnswer = isValidAnswer ? generatedText.trim() : 'NO_ANSWER';
    const finalSources = isValidAnswer ? sources : [];
    const finalConfidence = isValidAnswer ? confidence : 0;

    logger.info(`[rag/synthesize] Réponse générée avec prompt pack en ${processingTime}ms`);
    logger.info(`[rag/synthesize] Pack: ${promptPack.packName}, citations: ${sources.length}`);

    return {
      answer: finalAnswer,
      sources: finalSources,
      confidence: finalConfidence,
      reasoning: isValidAnswer ? 'OK' : `Manque: citations=${sources.length}, longueur=${generatedText.length}`,
      processing_time_ms: processingTime,
      model_used: selectedModel,
      lang_detected: lang,
      prompt_pack: promptPack.packName,
      prompt_pack_description: promptPack.description
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/synthesize] Erreur avec prompt pack (${processingTime}ms): ${error.message}`);
    
    // Fallback vers mode standard
    return await generateAnswer(query, contextChunks, lang, options);
  }
}

module.exports = {
  detectLanguage,
  buildPrompt,
  generateAnswer,
  generateAnswerJSON,
  generateAnswerWithPromptPack
};
