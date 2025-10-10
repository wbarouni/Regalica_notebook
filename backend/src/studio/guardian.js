/**
 * Guardian - PII/Secrets detection for document quarantine
 */
const logger = require('../utils/logger');
const pool = require('../db/pool');
const config = require('../config');

// Guardian regex patterns (generic + finance)
const PATTERNS = {
  // Generic patterns
  email: {
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    severity: 'warning',
    description: 'Email address detected'
  },
  phone_intl: {
    regex: /\b\+?[0-9]{1,3}[-.\s()]?[0-9]{2,14}\b/g,
    severity: 'warning',
    description: 'Phone number detected'
  },
  ipv4: {
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    severity: 'info',
    description: 'IPv4 address detected'
  },
  jwt: {
    regex: /\beyJ[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+\.?[0-9A-Za-z_-]*\b/g,
    severity: 'critical',
    description: 'JWT token detected'
  },
  api_key_generic: {
    regex: /\b(?:sk|key|token|secret)[=_:-]\s*[A-Za-z0-9_\-]{16,}\b/gi,
    severity: 'critical',
    description: 'API key or secret detected'
  },
  credit_card: {
    regex: /\b(?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|3(?:0[0-5]|[68]\d)\d{11}|6(?:011|5\d{2})\d{12})\b/g,
    severity: 'critical',
    description: 'Credit card number detected (Luhn check recommended)'
  },
  
  // Finance/Compliance patterns
  iban: {
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
    severity: 'critical',
    description: 'IBAN detected'
  },
  swift_bic: {
    regex: /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/g,
    severity: 'warning',
    description: 'SWIFT/BIC code detected'
  },
  tnd_rib: {
    regex: /\b\d{20,24}\b/g,
    severity: 'warning',
    description: 'TND RIB (20-24 digits) detected'
  },
  cin_id: {
    regex: /\b(?:CIN|ID|Matricule)[:\s]+\d{6,12}\b/gi,
    severity: 'warning',
    description: 'CIN/ID number detected'
  }
};

/**
 * Scan document text for PII/secrets
 * @param {string} text - Document text to scan
 * @param {Object} options - Scan options
 * @returns {Object} Scan result with matches
 */
function scanDocument(text, options = {}) {
  const patterns = options.patterns || PATTERNS;
  const matches = [];
  let hasSecrets = false;
  
  for (const [patternName, patternConfig] of Object.entries(patterns)) {
    const regex = new RegExp(patternConfig.regex.source, patternConfig.regex.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        pattern: patternName,
        value: match[0],
        index: match.index,
        severity: patternConfig.severity,
        description: patternConfig.description
      });
      
      if (patternConfig.severity === 'critical') {
        hasSecrets = true;
      }
    }
  }
  
  return {
    hasSecrets,
    hasPII: matches.length > 0,
    matches,
    summary: {
      total: matches.length,
      critical: matches.filter(m => m.severity === 'critical').length,
      warning: matches.filter(m => m.severity === 'warning').length,
      info: matches.filter(m => m.severity === 'info').length
    }
  };
}

/**
 * Log Guardian alert to studio_logs
 * @param {UUID} workspaceId - Workspace ID
 * @param {UUID} documentId - Document ID
 * @param {Object} scanResult - Scan result
 */
async function logAlert(workspaceId, documentId, scanResult) {
  const client = await pool.connect();
  
  try {
    const severity = scanResult.hasSecrets ? 'critical' : 'warning';
    const message = `Guardian detected ${scanResult.summary.total} potential PII/secret matches`;
    
    await client.query(`
      INSERT INTO ${config.dbSchema}.studio_logs 
      (workspace_id, document_id, event_type, severity, message, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      workspaceId,
      documentId,
      'guardian_alert',
      severity,
      message,
      JSON.stringify({
        summary: scanResult.summary,
        patterns: scanResult.matches.map(m => ({
          pattern: m.pattern,
          severity: m.severity,
          description: m.description
        }))
      })
    ]);
    
    logger.info(`[Guardian] Logged alert for document ${documentId}: ${message}`);
  } catch (error) {
    logger.error(`[Guardian] Failed to log alert: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Quarantine a document
 * @param {UUID} workspaceId - Workspace ID
 * @param {UUID} documentId - Document ID
 * @param {string} reason - Quarantine reason
 */
async function quarantineDocument(workspaceId, documentId, reason) {
  const client = await pool.connect();
  
  try {
    await client.query(`
      UPDATE ${config.dbSchema}.workspace_docs
      SET quarantined = true, quarantine_reason = $3
      WHERE workspace_id = $1 AND document_id = $2
    `, [workspaceId, documentId, reason]);
    
    logger.warn(`[Guardian] Quarantined document ${documentId} in workspace ${workspaceId}: ${reason}`);
  } catch (error) {
    logger.error(`[Guardian] Failed to quarantine document: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Hook for ingestion pipeline
 * @param {UUID} workspaceId - Workspace ID (optional)
 * @param {UUID} documentId - Document ID
 * @param {string} text - Document text
 */
async function onDocumentIngested(workspaceId, documentId, text) {
  try {
    logger.info(`[Guardian] Scanning document ${documentId}...`);
    
    const scanResult = scanDocument(text);
    
    if (scanResult.hasPII) {
      logger.warn(`[Guardian] Document ${documentId} contains ${scanResult.summary.total} PII/secret matches`);
      
      // Log alert if workspace exists
      if (workspaceId) {
        await logAlert(workspaceId, documentId, scanResult);
        
        // Quarantine if critical secrets found
        if (scanResult.hasSecrets) {
          const reason = `Contains ${scanResult.summary.critical} critical secret(s): ${
            scanResult.matches
              .filter(m => m.severity === 'critical')
              .map(m => m.pattern)
              .join(', ')
          }`;
          
          await quarantineDocument(workspaceId, documentId, reason);
        }
      }
      
      return {
        shouldQuarantine: scanResult.hasSecrets,
        scanResult
      };
    }
    
    logger.info(`[Guardian] Document ${documentId} passed scan (no PII detected)`);
    return { shouldQuarantine: false, scanResult };
    
  } catch (error) {
    logger.error(`[Guardian] Scan failed for document ${documentId}: ${error.message}`);
    return { shouldQuarantine: false, error: error.message };
  }
}

/**
 * Get quarantined documents for a workspace
 * @param {UUID} workspaceId - Workspace ID
 * @returns {Array} Quarantined documents
 */
async function getQuarantinedDocuments(workspaceId) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        wd.document_id,
        wd.quarantine_reason,
        wd.added_at,
        d.title,
        d.mime,
        d.bytes
      FROM ${config.dbSchema}.workspace_docs wd
      JOIN ${config.dbSchema}.documents d ON wd.document_id = d.id
      WHERE wd.workspace_id = $1 AND wd.quarantined = true
      ORDER BY wd.added_at DESC
    `, [workspaceId]);
    
    return result.rows;
  } finally {
    client.release();
  }
}

module.exports = {
  PATTERNS,
  scanDocument,
  logAlert,
  quarantineDocument,
  onDocumentIngested,
  getQuarantinedDocuments
};
