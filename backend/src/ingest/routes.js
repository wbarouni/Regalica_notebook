const express = require("express");
const multer = require("multer");
const pool = require("../db/pool");
const config = require("../config");
const logger = require("../utils/logger");
const { AppError } = require("../utils/errors");
const { calculateSHA256 } = require("./hash");
const { extractText } = require("./extract");
const { normalizeText } = require("./normalize");
const { chunkSections } = require("./chunk");
const { generateEmbeddings } = require("./embed");

const router = express.Router();

// Configuration multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadMb * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (config.allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(`Type de fichier non supporté: ${file.mimetype}`, 400, "UNSUPPORTED_MIME"));
    }
  }
});

/**
 * POST /ingest/upload - Upload et ingestion d'un document
 */
router.post("/upload", upload.single("file"), async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      throw new AppError("Aucun fichier fourni", 400, "NO_FILE");
    }

    const { buffer, originalname, mimetype, size } = req.file;
    const sha256 = calculateSHA256(buffer);

    logger.info(`Starting ingestion: ${originalname} (${mimetype}, ${size} bytes)`);

    // Vérifier si le document existe déjà
    const existingDoc = await checkExistingDocument(sha256);
    if (existingDoc) {
      logger.info(`Document already exists: ${existingDoc.id}`);
      return res.json({
        document: existingDoc,
        stats: { duplicate: true }
      });
    }

    // Pipeline d'ingestion
    const extractionResult = await extractText(buffer, mimetype, originalname);
    const sections = normalizeText(extractionResult.rawText);
    const chunks = chunkSections(sections);
    
    // Transaction pour persister tout
    const result = await persistDocument({
      title: originalname,
      mime: mimetype,
      bytes: size,
      sha256,
      extractionResult,
      chunks
    });

    const totalTime = Date.now() - startTime;
    logger.info(`Ingestion completed for ${originalname} in ${totalTime}ms`);

    res.json({
      document: result.document,
      stats: {
        pages: result.pagesCount,
        chunks: result.chunksCount,
        embed_ms_total: result.embedTime
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /ingest/:docId/chunks - Récupérer les chunks d'un document
 */
router.get("/:docId/chunks", async (req, res, next) => {
  try {
    const { docId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;

    const client = await pool.connect();
    try {
      // Compter le total
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM ${config.dbSchema}.chunks WHERE document_id = $1`,
        [docId]
      );
      const total = parseInt(countResult.rows[0].total);

      // Récupérer les chunks
      const chunksResult = await client.query(`
        SELECT id, seq, heading_path, tokens, span_start, span_end, page_no, text
        FROM ${config.dbSchema}.chunks 
        WHERE document_id = $1 
        ORDER BY seq 
        LIMIT $2 OFFSET $3
      `, [docId, pageSize, offset]);

      res.json({
        chunks: chunksResult.rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    next(error);
  }
});

/**
 * GET /docs - Liste paginée des documents
 */
router.get("/docs", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;

    const client = await pool.connect();
    try {
      // Compter le total
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM ${config.dbSchema}.documents`
      );
      const total = parseInt(countResult.rows[0].total);

      // Récupérer les documents avec le nombre de chunks
      const docsResult = await client.query(`
        SELECT 
          d.id, d.title, d.mime, d.bytes, d.created_at,
          COUNT(c.id) as chunks_count
        FROM ${config.dbSchema}.documents d
        LEFT JOIN ${config.dbSchema}.chunks c ON d.id = c.document_id
        GROUP BY d.id, d.title, d.mime, d.bytes, d.created_at
        ORDER BY d.created_at DESC
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]);

      res.json({
        documents: docsResult.rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    next(error);
  }
});

/**
 * Vérifie si un document existe déjà par son SHA-256
 */
const checkExistingDocument = async (sha256) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, title, mime, bytes, created_at FROM ${config.dbSchema}.documents WHERE sha256 = $1`,
      [sha256]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

/**
 * Persiste un document et ses chunks en base
 */
const persistDocument = async ({ title, mime, bytes, sha256, extractionResult, chunks }) => {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    // 1. Insérer le document
    const docResult = await client.query(`
      INSERT INTO ${config.dbSchema}.documents (title, mime, bytes, sha256)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, mime, bytes, created_at
    `, [title, mime, bytes, sha256]);
    
    const document = docResult.rows[0];
    const documentId = document.id;

    // 2. Insérer les pages si disponibles
    let pagesCount = 0;
    if (extractionResult.pages) {
      for (const page of extractionResult.pages) {
        await client.query(`
          INSERT INTO ${config.dbSchema}.pages (document_id, page_no, text, bbox_json)
          VALUES ($1, $2, $3, $4)
        `, [documentId, page.page_no, page.text, page.bbox_json]);
      }
      pagesCount = extractionResult.pages.length;
    }

    // 3. Insérer les chunks
    const chunkIds = [];
    for (const chunk of chunks) {
      const chunkResult = await client.query(`
        INSERT INTO ${config.dbSchema}.chunks 
        (document_id, seq, text, tokens, heading_path, span_start, span_end, page_no)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        documentId, 
        chunk.seq, 
        chunk.text, 
        chunk.tokens, 
        chunk.heading_path, 
        chunk.span_start, 
        chunk.span_end, 
        chunk.page_no
      ]);
      chunkIds.push(chunkResult.rows[0].id);
    }

    // 4. Générer et insérer les embeddings
    const embedStart = Date.now();
    const chunksWithIds = chunks.map((chunk, index) => ({
      ...chunk,
      id: chunkIds[index]
    }));
    
    const embeddingResult = await generateEmbeddings(chunksWithIds);
    
    for (const embedding of embeddingResult.embeddings) {
      await client.query(`
        INSERT INTO ${config.dbSchema}.embeddings (chunk_id, model, dim, vec)
        VALUES ($1, $2, $3, $4)
      `, [embedding.chunk_id, embeddingResult.model_info.name, embedding.dim, JSON.stringify(embedding.vector)]);
    }
    
    const embedTime = Date.now() - embedStart;

    await client.query("COMMIT");

    return {
      document,
      pagesCount,
      chunksCount: chunks.length,
      embedTime
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = router;
