const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Détecte la langue d'un texte
 * @param {string} text - Texte à analyser
 * @returns {string} - Code langue (fr, en, ar)
 */
function detectLanguage(text) {
  if (!text || !text.trim()) {
    return 'en'; // Par défaut
  }

  const cleanText = text.toLowerCase().trim();
  
  // Détection simple basée sur des mots-clés et caractères
  const frenchWords = ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'est', 'dans', 'pour', 'avec', 'sur', 'par', 'que', 'qui', 'une', 'un'];
  const englishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with', 'for', 'as', 'was', 'on', 'are', 'you'];
  const arabicPattern = /[\u0600-\u06FF]/;

  // Vérifier la présence de caractères arabes
  if (arabicPattern.test(text)) {
    logger.info(`[rag/synthesize] Langue détectée: arabe`);
    return 'ar';
  }

  // Compter les mots français et anglais
  const words = cleanText.split(/\s+/);
  let frenchCount = 0;
  let englishCount = 0;

  words.forEach(word => {
    if (frenchWords.includes(word)) frenchCount++;
    if (englishWords.includes(word)) englishCount++;
  });

  // Déterminer la langue majoritaire
  let detectedLang = 'en'; // Par défaut
  if (frenchCount > englishCount && frenchCount > 0) {
    detectedLang = 'fr';
  } else if (englishCount > 0) {
    detectedLang = 'en';
  }

  logger.info(`[rag/synthesize] Langue détectée: ${detectedLang} (fr:${frenchCount}, en:${englishCount})`);
  return detectedLang;
}

/**
 * Génère un prompt structuré pour le LLM
 * @param {string} query - Requête utilisateur
 * @param {Array} contextChunks - Chunks de contexte
 * @param {string} lang - Langue détectée
 * @returns {string} - Prompt formaté
 */
function buildPrompt(query, contextChunks, lang) {
  const langInstructions = {
    fr: {
      role: "Tu es un assistant documenté qui répond aux questions en utilisant uniquement les informations fournies dans les documents.",
      instruction: "Réponds à la question en français en utilisant UNIQUEMENT les informations des documents fournis. Inclus au moins 2 citations distinctes au format [titre#page:span_start-span_end]. Si les informations sont insuffisantes ou contradictoires, réponds exactement 'NO_ANSWER'.",
      contextHeader: "Documents disponibles:",
      questionHeader: "Question:"
    },
    en: {
      role: "You are a documented assistant who answers questions using only the information provided in the documents.",
      instruction: "Answer the question in English using ONLY the information from the provided documents. Include at least 2 distinct citations in the format [title#page:span_start-span_end]. If the information is insufficient or contradictory, respond exactly 'NO_ANSWER'.",
      contextHeader: "Available documents:",
      questionHeader: "Question:"
    },
    ar: {
      role: "أنت مساعد موثق يجيب على الأسئلة باستخدام المعلومات المتوفرة في الوثائق فقط.",
      instruction: "أجب على السؤال بالعربية باستخدام المعلومات من الوثائق المقدمة فقط. اشمل على الأقل اقتباسين مختلفين بالتنسيق [title#page:span_start-span_end]. إذا كانت المعلومات غير كافية أو متناقضة، أجب بـ 'NO_ANSWER' بالضبط.",
      contextHeader: "الوثائق المتاحة:",
      questionHeader: "السؤال:"
    }
  };

  const instructions = langInstructions[lang] || langInstructions.en;

  // Construire le contexte avec les chunks
  let contextText = `${instructions.contextHeader}\n\n`;
  
  contextChunks.forEach((chunk, index) => {
    const citation = `[${chunk.document_title}#${chunk.page_no || 'p?'}:${chunk.span_start || 0}-${chunk.span_end || 0}]`;
    contextText += `${index + 1}. ${citation}\n${chunk.text}\n\n`;
  });

  // Construire le prompt final
  const prompt = `${instructions.role}

${instructions.instruction}

${contextText}

${instructions.questionHeader} ${query}

Réponse:`;

  return prompt;
}

/**
 * Génère une réponse en utilisant le LLM Ollama
 * @param {string} query - Requête utilisateur
 * @param {Array} contextChunks - Chunks de contexte
 * @param {string} lang - Langue détectée
 * @returns {Promise<Object>} - Réponse avec citations et confiance
 */
async function generateAnswer(query, contextChunks, lang = 'en') {
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
    
    // Appel à Ollama
    const response = await axios.post(`${config.llmApiUrl}/api/chat`, {
      model: config.llmModelName,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: false,
      options: {
        temperature: 0.1, // Réponses plus déterministes
        top_p: 0.9,
        max_tokens: 1000
      }
    }, {
      timeout: 60000 // 1 minute pour la génération
    });

    const generatedText = response.data.message?.content || '';
    
    if (!generatedText.trim()) {
      throw new Error('Réponse LLM vide');
    }

    // Extraire les citations du texte généré
    const citationRegex = /\[([^\]]+)#([^:]+):([^\]]+)\]/g;
    const sources = [];
    let match;
    
    while ((match = citationRegex.exec(generatedText)) !== null) {
      sources.push({
        title: match[1],
        page: match[2],
        span: match[3],
        citation: match[0]
      });
    }

    // Calculer la confiance basée sur les scores des chunks utilisés
    const avgScore = contextChunks.reduce((sum, chunk) => sum + (chunk.score_final || 0), 0) / contextChunks.length;
    const citationBonus = Math.min(sources.length / config.ragCitationsMin, 1) * 0.1;
    const confidence = Math.min(avgScore + citationBonus, 1);

    const processingTime = Date.now() - startTime;
    
    // Vérifier les critères de qualité
    const isValidAnswer = generatedText.trim() !== 'NO_ANSWER' && 
                         sources.length >= config.ragCitationsMin && 
                         confidence >= config.ragConfidenceThreshold;

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
      reasoning: isValidAnswer ? 'Réponse générée avec succès' : `Critères non respectés: citations=${sources.length}/${config.ragCitationsMin}, confiance=${confidence.toFixed(4)}/${config.ragConfidenceThreshold}`,
      processing_time_ms: processingTime,
      model_used: config.llmModelName,
      lang_detected: lang
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[rag/synthesize] Erreur génération réponse (${processingTime}ms): ${error.message}`);
    
    if (error.response) {
      logger.error(`[rag/synthesize] Réponse LLM: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }

    return {
      answer: 'NO_ANSWER',
      sources: [],
      confidence: 0,
      reasoning: `Erreur génération: ${error.message}`,
      processing_time_ms: processingTime,
      model_used: config.llmModelName,
      lang_detected: lang
    };
  }
}

module.exports = {
  detectLanguage,
  buildPrompt,
  generateAnswer
};
