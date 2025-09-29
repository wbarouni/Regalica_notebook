/**
 * Compte approximativement le nombre de tokens dans un texte
 * Utilise une approximation simple : 1 token ≈ 4 caractères
 * @param {string} text - Le texte à analyser
 * @returns {number} Nombre approximatif de tokens
 */
const countTokens = (text) => {
  if (!text || typeof text !== "string") return 0;
  
  // Approximation simple : 1 token ≈ 4 caractères
  // Plus précis que de compter les mots, moins précis qu'un tokenizer réel
  return Math.ceil(text.length / 4);
};

module.exports = { countTokens };
