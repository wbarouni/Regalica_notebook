const logger = require("../utils/logger");

/**
 * Normalise le texte brut en sections structurées avec heading_path
 * @param {string} rawText - Le texte brut extrait
 * @returns {Array<{text: string, heading_path: string[], span_start: number, span_end: number}>}
 */
const normalizeText = (rawText) => {
  if (!rawText || typeof rawText !== "string") {
    return [];
  }

  const sections = [];
  const lines = rawText.split("\n");
  let currentHeadingPath = [];
  let currentSection = "";
  let spanStart = 0;
  let currentSpanStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const originalLine = lines[i];
    
    // Détecter les titres (patterns simples)
    const headingMatch = detectHeading(line);
    
    if (headingMatch) {
      // Sauvegarder la section précédente si elle existe
      if (currentSection.trim()) {
        sections.push({
          text: currentSection.trim(),
          heading_path: [...currentHeadingPath],
          span_start: currentSpanStart,
          span_end: spanStart - 1
        });
      }
      
      // Mettre à jour le heading path
      updateHeadingPath(currentHeadingPath, headingMatch.level, headingMatch.title);
      
      // Commencer une nouvelle section
      currentSection = "";
      currentSpanStart = spanStart;
    } else {
      // Ajouter la ligne à la section courante
      if (line) {
        currentSection += (currentSection ? "\n" : "") + line;
      }
    }
    
    spanStart += originalLine.length + 1; // +1 pour le \n
  }
  
  // Ajouter la dernière section
  if (currentSection.trim()) {
    sections.push({
      text: currentSection.trim(),
      heading_path: [...currentHeadingPath],
      span_start: currentSpanStart,
      span_end: spanStart - 1
    });
  }
  
  logger.debug(`Normalized text into ${sections.length} sections`);
  return sections;
};

/**
 * Détecte si une ligne est un titre
 * @param {string} line - La ligne à analyser
 * @returns {Object|null} {level: number, title: string} ou null
 */
const detectHeading = (line) => {
  if (!line) return null;
  
  // Pattern 1: Markdown headers (# ## ### etc.)
  const markdownMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (markdownMatch) {
    return {
      level: markdownMatch[1].length,
      title: markdownMatch[2].trim()
    };
  }
  
  // Pattern 2: Lignes courtes en majuscules (probablement des titres)
  if (line.length < 100 && line === line.toUpperCase() && line.length > 3) {
    return {
      level: 1,
      title: line
    };
  }
  
  // Pattern 3: Lignes se terminant par :
  if (line.endsWith(":") && line.length < 80 && !line.includes(".")) {
    return {
      level: 2,
      title: line.slice(0, -1)
    };
  }
  
  return null;
};

/**
 * Met à jour le chemin de titres
 * @param {string[]} headingPath - Le chemin actuel
 * @param {number} level - Le niveau du nouveau titre
 * @param {string} title - Le titre
 */
const updateHeadingPath = (headingPath, level, title) => {
  // Ajuster la longueur du path selon le niveau
  headingPath.length = level - 1;
  headingPath.push(title);
};

module.exports = { normalizeText };
