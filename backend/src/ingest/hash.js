const crypto = require("crypto");

/**
 * Calcule le hash SHA-256 d'un buffer
 * @param {Buffer} buffer - Le buffer à hasher
 * @returns {string} Hash SHA-256 en hexadécimal
 */
const calculateSHA256 = (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

module.exports = { calculateSHA256 };
