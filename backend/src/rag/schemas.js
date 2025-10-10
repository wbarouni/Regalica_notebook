const { z } = require('zod');

/**
 * Schémas de validation Zod pour les réponses JSON du LLM
 * Phase 2: JSON Constraint + Anti-hallucination
 */

// IDs flexibles (hex, ulid, uuid, etc.)
const Id = z.string().min(1).max(64);

/**
 * Schéma Citation
 */
const CitationSchema = z.object({
  doc_id: Id,
  chunk_id: Id,
  title: z.string().optional(),
  url: z.string().optional(),
  page: z.number().optional()
});

/**
 * Schéma Réponse complète (défaut)
 */
const AnswerSchema = z.object({
  answer: z.string().min(1).max(1200),
  bullets: z.array(z.string().max(240)).max(5).default([]),
  risks: z.array(z.string().max(200)).max(3).default([]),
  citations: z.array(CitationSchema).min(1)
});

/**
 * Schéma Réponse minimale (pour résumés ultra-courts)
 */
const AnswerMinimalSchema = z.object({
  answer: z.string().min(1).max(600),
  citations: z.array(CitationSchema).min(1)
});

/**
 * Valide une réponse JSON contre le schéma
 * @param {Object} data - Données JSON à valider
 * @param {string} schemaType - 'full' ou 'minimal'
 * @returns {Object} - {success: boolean, data?: Object, error?: string}
 */
function validateAnswer(data, schemaType = 'full') {
  try {
    const schema = schemaType === 'minimal' ? AnswerMinimalSchema : AnswerSchema;
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      details: error.errors || []
    };
  }
}

module.exports = { 
  AnswerSchema, 
  AnswerMinimalSchema, 
  CitationSchema,
  validateAnswer
};
