/**
 * Utilitaires pour la normalisation et manipulation d'URLs
 * Évite les valeurs codées en dur et gère proprement les origines CORS
 */

/**
 * Normalise une URL de base
 * @param {string} url - URL à normaliser
 * @returns {string} - URL normalisée ou chaîne vide si invalide
 */
function normalizeBase(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  // Refuser les protocoles file://
  if (trimmed.startsWith('file://')) {
    throw new Error('Protocol file:// not allowed');
  }

  // Forcer http(s) valide
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    throw new Error('URL must start with http:// or https://');
  }

  // Supprimer trailing slash
  return trimmed.replace(/\/$/, '');
}

/**
 * Assemble une URL de base avec un chemin
 * @param {string} base - URL de base
 * @param {string} path - Chemin à ajouter
 * @returns {string} - URL complète
 */
function joinUrl(base, path) {
  if (!base) {
    return path || '';
  }

  if (!path) {
    return base;
  }

  // Nettoyer la base (pas de trailing slash)
  const cleanBase = base.replace(/\/$/, '');
  
  // Nettoyer le chemin (commencer par /)
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // Assembler sans double slash
  const joined = cleanBase + cleanPath;
  
  // Préserver les query parameters
  return joined;
}

/**
 * Parse une liste d'origines CORS depuis une chaîne CSV
 * @param {string} originsStr - Chaîne CSV des origines autorisées
 * @returns {Array<string>} - Liste des origines normalisées
 */
function parseCorsOrigins(originsStr) {
  if (!originsStr || typeof originsStr !== 'string') {
    return [];
  }

  return originsStr
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0)
    .map(origin => {
      try {
        return normalizeBase(origin);
      } catch (error) {
        // Ignorer les origines invalides
        return null;
      }
    })
    .filter(origin => origin !== null);
}

/**
 * Valide qu'une origine est autorisée
 * @param {string} origin - Origine à valider
 * @param {Array<string>} allowedOrigins - Liste des origines autorisées
 * @returns {boolean} - True si autorisée
 */
function isOriginAllowed(origin, allowedOrigins) {
  if (!origin || !Array.isArray(allowedOrigins)) {
    return false;
  }

  // Autoriser localhost en développement
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

/**
 * Génère la configuration publique des URLs (sans secrets)
 * @param {Object} config - Configuration complète
 * @returns {Object} - Configuration publique
 */
function getPublicUrlConfig(config) {
  return {
    backend_url: config.backendExternalUrl || '',
    frontend_url: config.frontendExternalUrl || '',
    api_version: '1.0',
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  normalizeBase,
  joinUrl,
  parseCorsOrigins,
  isOriginAllowed,
  getPublicUrlConfig
};
