const config = require("../config");

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = levels[config.logLevel] ?? levels.info;

const logger = {
  error: (...args) => {
    if (currentLevel >= levels.error) console.error("[ERROR]", ...args);
  },
  warn: (...args) => {
    if (currentLevel >= levels.warn) console.warn("[WARN]", ...args);
  },
  info: (...args) => {
    if (currentLevel >= levels.info) console.info("[INFO]", ...args);
  },
  debug: (...args) => {
    if (currentLevel >= levels.debug) console.debug("[DEBUG]", ...args);
  },
};

module.exports = logger;
