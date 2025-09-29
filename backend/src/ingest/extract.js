const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { convert } = require("html-to-text");
const logger = require("../utils/logger");

/**
 * Extrait le texte d'un fichier selon son type MIME
 * @param {Buffer} buffer - Le buffer du fichier
 * @param {string} mime - Le type MIME du fichier
 * @param {string} filename - Le nom du fichier
 * @returns {Promise<{rawText: string, pages?: Array, meta: Object}>}
 */
const extractText = async (buffer, mime, filename) => {
  const startTime = Date.now();
  
  try {
    switch (mime) {
      case "application/pdf":
        return await extractPDF(buffer);
      
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return await extractDOCX(buffer);
      
      case "text/html":
        return await extractHTML(buffer);
      
      case "text/plain":
        return await extractTXT(buffer);
      
      default:
        throw new Error(`Unsupported MIME type: ${mime}`);
    }
  } catch (error) {
    logger.error(`Extraction failed for ${filename} (${mime}):`, error.message);
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    logger.debug(`Extraction completed for ${filename} in ${duration}ms`);
  }
};

/**
 * Extrait le texte d'un PDF avec informations de pages
 */
const extractPDF = async (buffer) => {
  const data = await pdfParse(buffer);
  
  const pages = [];
  if (data.numpages > 0) {
    // Approximation : diviser le texte par le nombre de pages
    const textPerPage = Math.ceil(data.text.length / data.numpages);
    
    for (let i = 0; i < data.numpages; i++) {
      const start = i * textPerPage;
      const end = Math.min(start + textPerPage, data.text.length);
      pages.push({
        page_no: i + 1,
        text: data.text.substring(start, end).trim(),
        bbox_json: null
      });
    }
  }
  
  return {
    rawText: data.text,
    pages: pages.length > 0 ? pages : undefined,
    meta: {
      pages: data.numpages,
      info: data.info
    }
  };
};

/**
 * Extrait le texte d'un document DOCX
 */
const extractDOCX = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  
  return {
    rawText: result.value,
    meta: {
      messages: result.messages
    }
  };
};

/**
 * Extrait le texte d'un fichier HTML
 */
const extractHTML = async (buffer) => {
  const html = buffer.toString("utf-8");
  const text = convert(html, {
    wordwrap: false,
    preserveNewlines: true,
    selectors: [
      { selector: "h1", options: { uppercase: false } },
      { selector: "h2", options: { uppercase: false } },
      { selector: "h3", options: { uppercase: false } },
      { selector: "h4", options: { uppercase: false } },
      { selector: "h5", options: { uppercase: false } },
      { selector: "h6", options: { uppercase: false } }
    ]
  });
  
  return {
    rawText: text,
    meta: {
      originalLength: html.length
    }
  };
};

/**
 * Extrait le texte d'un fichier TXT
 */
const extractTXT = async (buffer) => {
  const text = buffer.toString("utf-8");
  
  return {
    rawText: text,
    meta: {
      encoding: "utf-8"
    }
  };
};

module.exports = { extractText };
