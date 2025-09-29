const { franc } = require('franc');
const langs = require('langs');

/**
 * Détection robuste de langue avec franc et langs
 * Retourne toujours un code ISO 639-1 valide (fr, en, ar) ou 'en' par défaut
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return 'en';
  }

  const cleanText = text.trim();
  
  // Utiliser franc avec minLength: 3 pour les textes courts
  const detected = franc(cleanText, { minLength: 3 });
  
  // Si franc ne peut pas détecter (retourne 'und'), utiliser 'en' par défaut
  if (!detected || detected === 'und') {
    return 'en';
  }

  // Gestion spéciale pour les codes arabes
  if (detected === 'arb' || detected === 'ara') {
    return 'ar';
  }

  // Mapper avec langs vers les langues supportées
  const langInfo = langs.where('3', detected);
  if (!langInfo || !langInfo['1']) {
    return 'en';
  }

  const iso639_1 = langInfo['1'];
  
  // Mapper vers les langues supportées: fr, en, ar
  const supportedLanguages = ['fr', 'en', 'ar'];
  if (supportedLanguages.includes(iso639_1)) {
    return iso639_1;
  }

  // Par défaut, retourner 'en' pour toute langue non supportée
  return 'en';
}

module.exports = {
  detectLanguage
};
