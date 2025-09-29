const { franc } = require('franc');
const langs = require('langs');

/**
 * Détection robuste de langue avec franc et langs
 * Retourne toujours un code ISO 639-1 valide (fr, en, ar) ou 'en' par défaut
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') {
    return 'en';
  }

  const cleanText = text.trim();
  
  if (cleanText.length === 0) {
    return 'en';
  }

  // Heuristiques pour textes très courts (< 20 caractères)
  if (cleanText.length < 20) {
    // Détection de caractères arabes
    if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(cleanText)) {
      return 'ar';
    }
    // Détection de caractères français spécifiques
    if (/[àâäéèêëïîôöùûüÿç]/i.test(cleanText)) {
      return 'fr';
    }
    // Mots français courants
    if (/\b(le|la|les|de|du|des|et|ou|à|dans|pour|avec|sur|par|ce|cette|ces|un|une)\b/i.test(cleanText)) {
      return 'fr';
    }
    // Mots anglais courants
    if (/\b(the|and|or|to|in|for|with|on|by|at|is|are|was|were|this|that|these|those)\b/i.test(cleanText)) {
      return 'en';
    }
    return 'en'; // Fallback pour textes courts ambigus
  }

  try {
    // Utiliser franc pour textes plus longs
    const detected = franc(cleanText, { minLength: 10 });
    
    // Si franc ne peut pas détecter (retourne 'und'), utiliser heuristiques
    if (!detected || detected === 'und') {
      // Heuristiques avancées pour textes ambigus
      if (/[\u0600-\u06FF]/.test(cleanText)) return 'ar';
      
      const frenchWords = (cleanText.match(/\b(le|la|les|de|du|des|et|ou|à|dans|pour|avec|sur|par|ce|cette|ces|un|une|qui|que|dont|où|si|mais|donc|car|ainsi|alors|aussi|encore|déjà|très|plus|moins|bien|mal|tout|tous|toute|toutes)\b/gi) || []).length;
      const englishWords = (cleanText.match(/\b(the|and|or|to|in|for|with|on|by|at|is|are|was|were|this|that|these|those|which|what|when|where|why|how|if|but|so|because|also|very|more|less|good|bad|all|some|any|each|every|other|another)\b/gi) || []).length;
      
      if (frenchWords > englishWords && frenchWords > 0) return 'fr';
      if (englishWords > 0) return 'en';
      
      return 'en';
    }

    // Gestion spéciale pour les codes arabes multiples
    if (['arb', 'ara', 'arz', 'apc', 'acm', 'ajp', 'ary', 'aeb'].includes(detected)) {
      return 'ar';
    }

    // Mapper avec langs vers ISO 639-1
    const langInfo = langs.where('3', detected);
    if (!langInfo || !langInfo['1']) {
      return 'en';
    }

    const iso639_1 = langInfo['1'];
    
    // Langues supportées étendues
    const supportedLanguages = ['fr', 'en', 'ar', 'es', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'nl', 'sv', 'da', 'no', 'fi'];
    if (supportedLanguages.includes(iso639_1)) {
      return iso639_1;
    }

    // Fallback pour langues non supportées
    return 'en';
  } catch (error) {
    console.warn('Language detection failed:', error.message);
    return 'en';
  }
}

module.exports = {
  detectLanguage
};
