/**
 * Mind Map generation using clustering and RAG
 */
const axios = require('axios');
const pool = require('../db/pool');
const config = require('../config');
const logger = require('../utils/logger');
const { retrieveForQuery } = require('../rag/query');

/**
 * Extract noun phrases from text (simple approach)
 * @param {string} text - Text to extract from
 * @returns {Array<string>} Noun phrases
 */
function extractNounPhrases(text) {
  // Simple extraction: capitalize words + multi-word patterns
  const words = text.split(/\s+/);
  const phrases = [];
  
  // Single capitalized words (likely proper nouns)
  for (const word of words) {
    if (/^[A-Z][a-z]+$/.test(word) && word.length > 3) {
      phrases.push(word);
    }
  }
  
  // Multi-word phrases (2-3 words)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (bigram.length > 6 && !/^(the|and|or|but|for|with|from|into)\s/i.test(bigram)) {
      phrases.push(bigram);
    }
    
    if (i < words.length - 2) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (trigram.length > 10 && !/^(the|and|or)\s/i.test(trigram)) {
        phrases.push(trigram);
      }
    }
  }
  
  // Remove duplicates and return
  return [...new Set(phrases)];
}

/**
 * Call clusterer microservice
 * @param {Array<string>} texts - Texts to cluster
 * @returns {Object} Clustering result
 */
async function clusterTexts(texts) {
  try {
    const response = await axios.post(`${config.clustererApiUrl}/cluster`, {
      texts,
      min_cluster_size: config.minClusterSize || 5,
      min_samples: config.minSamples || 5,
      metric: config.clusterMetric || 'cosine'
    }, { timeout: 30000 });
    
    return response.data;
  } catch (error) {
    logger.error(`[MindMap] Clusterer failed: ${error.message}`);
    throw new Error(`Clustering failed: ${error.message}`);
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array<number>} a - Vector A
 * @param {Array<number>} b - Vector B
 * @returns {number} Similarity score
 */
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extract terms from chunks for connectivity analysis
 * @param {Array<Object>} chunks - Chunks to extract from
 * @returns {Set<string>} Set of significant terms
 */
function extractTerms(chunks) {
  const terms = new Set();
  
  chunks.forEach(chunk => {
    const text = chunk.text.toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 4);
    
    // Add significant words (not stopwords)
    const stopwords = new Set(['that', 'this', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should']);
    words.forEach(word => {
      if (!stopwords.has(word)) {
        terms.add(word);
      }
    });
  });
  
  return terms;
}

/**
 * Calculate set intersection
 * @param {Set} set1 - First set
 * @param {Set} set2 - Second set
 * @returns {Set} Intersection
 */
function calculateSetIntersection(set1, set2) {
  return new Set([...set1].filter(x => set2.has(x)));
}

/**
 * Calculate connectivity between clusters
 * @param {Map} clusterChunks - Map of clusterId -> chunks
 * @returns {Map} Map of clusterId -> connectivity score
 */
function calculateConnectivity(clusterChunks) {
  const connectivity = new Map();
  
  for (const [clusterId, chunks] of clusterChunks.entries()) {
    if (clusterId === -1) continue;  // Skip noise
    
    let totalConnections = 0;
    const terms = extractTerms(chunks);
    
    for (const [otherId, otherChunks] of clusterChunks.entries()) {
      if (otherId === clusterId || otherId === -1) continue;
      
      const otherTerms = extractTerms(otherChunks);
      const intersection = calculateSetIntersection(terms, otherTerms);
      totalConnections += intersection.size;
    }
    
    connectivity.set(clusterId, totalConnections);
  }
  
  return connectivity;
}

/**
 * Assign hierarchical levels to nodes (1=central, 2=branches, 3=details, 4=sub)
 * @param {Array<Object>} nodes - Nodes array
 * @param {Array<Object>} edges - Edges array
 * @param {Map} clusterChunks - Map of clusterId -> chunks
 * @returns {Array<Object>} Nodes with level assigned
 */
function assignHierarchicalLevels(nodes, edges, clusterChunks) {
  if (nodes.length === 0) return nodes;
  
  // Step 1: Calculate connectivity for each cluster
  const connectivity = calculateConnectivity(clusterChunks);
  
  // Step 2: Find central node (most connected)
  let maxConnections = 0;
  let centralNodeId = null;
  
  for (const node of nodes) {
    const connections = connectivity.get(node.clusterId) || 0;
    if (connections > maxConnections) {
      maxConnections = connections;
      centralNodeId = node.id;
    }
  }
  
  // If no clear central, pick first
  if (!centralNodeId && nodes.length > 0) {
    centralNodeId = nodes[0].id;
  }
  
  // Step 3: Assign levels using BFS from central node
  const levels = new Map();
  const queue = [{ nodeId: centralNodeId, level: 1 }];
  const visited = new Set();
  
  while (queue.length > 0) {
    const { nodeId, level } = queue.shift();
    
    if (visited.has(nodeId) || level > 4) continue;
    visited.add(nodeId);
    levels.set(nodeId, level);
    
    // Find neighbors
    const neighbors = edges
      .filter(e => e.source === nodeId || e.target === nodeId)
      .map(e => e.source === nodeId ? e.target : e.source)
      .filter(n => !visited.has(n));
    
    // Add neighbors to queue with next level
    neighbors.forEach(neighborId => {
      queue.push({ nodeId: neighborId, level: level + 1 });
    });
  }
  
  // Step 4: Assign levels to nodes (default to 2 if not reached)
  nodes.forEach(node => {
    node.level = levels.get(node.id) || 2;
  });
  
  logger.info(`[MindMap] Assigned hierarchical levels: L1=${[...levels.values()].filter(l=>l===1).length}, L2=${[...levels.values()].filter(l=>l===2).length}, L3=${[...levels.values()].filter(l=>l===3).length}, L4=${[...levels.values()].filter(l=>l===4).length}`);
  
  return nodes;
}

/**
 * Generate summary for a cluster using LLM
 * @param {Array<Object>} chunks - Chunks in cluster
 * @param {string} lang - Language
 * @returns {Object} Summary and citations
 */
async function generateClusterSummary(chunks, lang = 'en') {
  try {
    // Concatenate chunk texts
    const context = chunks.map(c => c.text).join('\n\n').substring(0, 2000);
    
    // Build prompt
    const prompt = lang === 'fr' 
      ? `Résumez les concepts clés suivants en 3-5 points concis. Citez au moins 2 sources spécifiques.\n\nContenu:\n${context}\n\nRésumé (points clés uniquement):`
      : `Summarize the key concepts below in 3-5 concise bullet points. Cite at least 2 specific sources.\n\nContent:\n${context}\n\nSummary (key points only):`;
    
    // Call LLM
    const response = await axios.post(
      `${config.llmApiUrl}/api/generate`,
      {
        model: config.llmNodeSummaryModel || config.llmModelName,
        prompt,
        temperature: 0.2,
        num_predict: 320,
        stop: ['\n\n\n']
      },
      { timeout: 60000 }  // 60s timeout pour summary
    );
    
    // Fix: Handle undefined response
    const summary = response.data?.response?.trim() || 'Concept cluster';
    
    // Extract citations from chunks
    const citations = chunks.slice(0, 3).map(chunk => ({
      docId: chunk.document_id,
      docTitle: chunk.document_title,
      page: chunk.page_no || null,
      spanStart: chunk.span_start,
      spanEnd: chunk.span_end,
      text: chunk.text.substring(0, 150)
    }));
    
    return { summary, citations };
  } catch (error) {
    logger.error(`[MindMap] Summary generation failed: ${error.message}`);
    return { 
      summary: 'Summary generation failed', 
      citations: chunks.slice(0, 2).map(c => ({
        docId: c.document_id,
        docTitle: c.document_title,
        text: c.text.substring(0, 100)
      }))
    };
  }
}

/**
 * Generate mind map from query or document
 * @param {Object} params - { query, docId, topK, lang }
 * @returns {Object} Mind map data
 */
async function generateMindMap(params) {
  const startTime = Date.now();
  const { query, docId, notebookId, topK = 50, lang = 'en' } = params;
  
  try {
    // Validation: Empêcher génération sur citations
    if (query) {
      if (query.length < 10) {
        throw new Error('Query too short for mind map generation');
      }
      if (/^\[\d+\]\s*Source:/i.test(query)) {
        throw new Error('Cannot generate mind map from citation reference');
      }
    }
    
    logger.info(`[MindMap] Generating mind map (query="${query}", docId="${docId}", notebookId="${notebookId}", topK=${topK})`);
    
    // Step 1: Retrieve chunks
    let candidates;
    if (notebookId) {
      // NEW: Get documents from notebook
      const notebookDocs = await getNotebookDocuments(notebookId);
      logger.info(`[MindMap] Notebook has ${notebookDocs.length} documents`);
      
      if (notebookDocs.length === 0) {
        throw new Error('No documents in notebook');
      }
      
      // Get chunks from these documents
      candidates = await getAllChunksFromDocuments(notebookDocs, topK);
      logger.info(`[MindMap] Retrieved ${candidates.length} chunks from notebook`);
    } else if (query) {
      const result = await retrieveForQuery(query, topK);
      candidates = result.candidates;
    } else if (docId) {
      // Get chunks for specific document
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT 
            c.id as chunk_id,
            c.document_id,
            c.text,
            c.tokens,
            c.span_start,
            c.span_end,
            c.page_no,
            d.title as document_title
          FROM ${config.dbSchema}.chunks c
          JOIN ${config.dbSchema}.documents d ON c.document_id = d.id
          WHERE c.document_id = $1
          ORDER BY c.seq
          LIMIT $2
        `, [docId, topK]);
        
        candidates = result.rows.map(row => ({
          ...row,
          score_cosine: 1.0  // All chunks equally relevant
        }));
      } finally {
        client.release();
      }
    } else {
      throw new Error('Either query or docId must be provided');
    }
    
    if (candidates.length === 0) {
      return {
        nodes: [],
        edges: [],
        meta: { message: 'No chunks found', topK, lang }
      };
    }
    
    logger.info(`[MindMap] Retrieved ${candidates.length} chunks`);
    
    // Step 2: Extract texts for clustering
    const texts = candidates.map(c => c.text);
    
    // Step 3: Cluster texts
    const clusterResult = await clusterTexts(texts);
    logger.info(`[MindMap] Clustered into ${clusterResult.n_clusters} clusters using ${clusterResult.method}`);
    
    // Step 4: Build nodes from clusters
    const nodes = [];
    const clusterChunks = new Map();
    
    for (let i = 0; i < candidates.length; i++) {
      const clusterId = clusterResult.clusters[i];
      if (!clusterChunks.has(clusterId)) {
        clusterChunks.set(clusterId, []);
      }
      clusterChunks.get(clusterId).push(candidates[i]);
    }
    
    // Generate node for each cluster
    for (const [clusterId, chunks] of clusterChunks.entries()) {
      if (clusterId === -1) continue;  // Skip noise cluster
      
      const label = clusterResult.labels[chunks[0] ? candidates.indexOf(chunks[0]) : 0] || `Cluster ${clusterId}`;
      const { summary, citations } = await generateClusterSummary(chunks, lang);
      
      nodes.push({
        id: `node-${clusterId}`,
        label,
        summary,
        citations,
        clusterId,
        chunkIds: chunks.map(c => c.chunk_id)
      });
    }
    
    logger.info(`[MindMap] Generated ${nodes.length} nodes`);
    
    // Step 5: Calculate edges (inter-cluster similarity)
    const edges = [];
    const clusterCentroids = new Map();
    
    // Calculate centroids (average of chunk embeddings - simplified)
    for (const [clusterId, chunks] of clusterChunks.entries()) {
      if (clusterId === -1) continue;
      
      // For simplicity, use average cosine scores as proxy
      const avgScore = chunks.reduce((sum, c) => sum + c.score_cosine, 0) / chunks.length;
      clusterCentroids.set(clusterId, avgScore);
    }
    
    // Calculate edges between nodes with similarity > threshold
    const clusterIds = Array.from(clusterChunks.keys()).filter(id => id !== -1);
    for (let i = 0; i < clusterIds.length; i++) {
      for (let j = i + 1; j < clusterIds.length; j++) {
        const id1 = clusterIds[i];
        const id2 = clusterIds[j];
        
        // Simple similarity based on shared terms
        const chunks1 = clusterChunks.get(id1);
        const chunks2 = clusterChunks.get(id2);
        
        const text1 = chunks1.map(c => c.text).join(' ').toLowerCase();
        const text2 = chunks2.map(c => c.text).join(' ').toLowerCase();
        
        const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 4));
        const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 4));
        
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        
        const similarity = intersection.size / union.size;
        
        if (similarity > 0.15) {  // Threshold
          edges.push({
            source: `node-${id1}`,
            target: `node-${id2}`,
            weight: similarity
          });
        }
      }
    }
    
    logger.info(`[MindMap] Generated ${edges.length} edges`);
    
    // Step 6: NEW - Assign hierarchical levels (1=central, 2=branches, 3=details, 4=sub)
    assignHierarchicalLevels(nodes, edges, clusterChunks);
    
    const totalTime = Date.now() - startTime;
    
    return {
      nodes,
      edges,
      meta: {
        query,
        docId,
        topK,
        lang,
        chunksCount: candidates.length,
        nodesCount: nodes.length,
        edgesCount: edges.length,
        clusteringMethod: clusterResult.method,
        silhouetteScore: clusterResult.silhouette_score,
        processingTimeMs: totalTime
      }
    };
    
  } catch (error) {
    logger.error(`[MindMap] Generation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Save mind map to database
 * @param {Object} mindMapData - Mind map data
 * @param {UUID} workspaceId - Workspace ID (optional)
 * @param {UUID} createdBy - User ID (optional)
 * @returns {UUID} Mind map ID
 */
async function saveMindMap(mindMapData, workspaceId = null, createdBy = null) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert mind map
    const mapResult = await client.query(`
      INSERT INTO ${config.dbSchema}.mindmaps 
      (workspace_id, title, query, doc_ids, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      workspaceId,
      mindMapData.meta.query || 'Mind Map',
      mindMapData.meta.query,
      mindMapData.meta.docId ? [mindMapData.meta.docId] : null,
      createdBy
    ]);
    
    const mindMapId = mapResult.rows[0].id;
    
    // Insert nodes
    const nodeIdMap = new Map();
    for (const node of mindMapData.nodes) {
      const nodeResult = await client.query(`
        INSERT INTO ${config.dbSchema}.mindmap_nodes
        (mindmap_id, label, summary, citations, cluster_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        mindMapId,
        node.label,
        node.summary,
        JSON.stringify(node.citations),
        node.clusterId
      ]);
      
      nodeIdMap.set(node.id, nodeResult.rows[0].id);
    }
    
    // Insert edges
    for (const edge of mindMapData.edges) {
      const sourceId = nodeIdMap.get(edge.source);
      const targetId = nodeIdMap.get(edge.target);
      
      if (sourceId && targetId) {
        await client.query(`
          INSERT INTO ${config.dbSchema}.mindmap_edges
          (mindmap_id, source, target, weight)
          VALUES ($1, $2, $3, $4)
        `, [mindMapId, sourceId, targetId, edge.weight]);
      }
    }
    
    await client.query('COMMIT');
    logger.info(`[MindMap] Saved mind map ${mindMapId} with ${mindMapData.nodes.length} nodes`);
    
    return mindMapId;
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`[MindMap] Save failed: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get documents from a notebook
 * @param {UUID} notebookId - Notebook ID
 * @returns {Promise<Array<UUID>>} Document IDs
 */
async function getNotebookDocuments(notebookId) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT document_id 
      FROM ${config.dbSchema}.notebook_documents 
      WHERE notebook_id = $1
    `, [notebookId]);
    
    return result.rows.map(r => r.document_id);
  } finally {
    client.release();
  }
}

/**
 * Get all chunks from specific documents
 * @param {Array<UUID>} documentIds - Document IDs
 * @param {number} topK - Max chunks to retrieve
 * @returns {Promise<Array>} Chunks with metadata
 */
async function getAllChunksFromDocuments(documentIds, topK = 100) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        c.id as chunk_id,
        c.document_id,
        c.text,
        c.tokens,
        c.heading_path,
        c.page_no,
        c.span_start,
        c.span_end,
        d.title as document_title
      FROM ${config.dbSchema}.chunks c
      JOIN ${config.dbSchema}.documents d ON c.document_id = d.id
      WHERE c.document_id = ANY($1::uuid[])
      ORDER BY c.seq
      LIMIT $2
    `, [documentIds, topK]);
    
    return result.rows.map(row => ({
      chunk_id: row.chunk_id,
      document_id: row.document_id,
      text: row.text,
      tokens: row.tokens,
      heading_path: row.heading_path,
      page_no: row.page_no,
      span_start: row.span_start,
      span_end: row.span_end,
      document_title: row.document_title,
      score_cosine: 1.0  // All chunks equally relevant
    }));
  } finally {
    client.release();
  }
}

module.exports = {
  generateMindMap,
  saveMindMap,
  extractNounPhrases,
  clusterTexts,
  generateClusterSummary,
  getNotebookDocuments,
  getAllChunksFromDocuments
};
