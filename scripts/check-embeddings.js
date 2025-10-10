const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'notebook',
  user: 'postgres',
  password: 'postgres'
});

async function checkEmbeddings() {
  const client = await pool.connect();
  try {
    // Check chunks count
    const chunksResult = await client.query('SELECT COUNT(*) as count FROM nbk.chunks');
    console.log(`✓ Total chunks: ${chunksResult.rows[0].count}`);
    
    // Check embeddings count
    const embeddingsResult = await client.query('SELECT COUNT(*) as count FROM nbk.embeddings');
    console.log(`✓ Total embeddings: ${embeddingsResult.rows[0].count}`);
    
    // Check if all chunks have embeddings
    const missingResult = await client.query(`
      SELECT COUNT(*) as missing 
      FROM nbk.chunks c 
      LEFT JOIN nbk.embeddings e ON c.id = e.chunk_id 
      WHERE e.id IS NULL
    `);
    console.log(`✓ Chunks missing embeddings: ${missingResult.rows[0].missing}`);
    
    // Check embedding dimensions
    const dimResult = await client.query('SELECT DISTINCT dim FROM nbk.embeddings');
    console.log(`✓ Embedding dimensions: ${dimResult.rows.map(r => r.dim).join(', ')}`);
    
    // Sample embedding to verify it's not zeros
    const sampleResult = await client.query(`
      SELECT vec, dim, model FROM nbk.embeddings LIMIT 1
    `);
    if (sampleResult.rows.length > 0) {
      const vec = JSON.parse(sampleResult.rows[0].vec);
      const nonZeroCount = vec.filter(v => v !== 0).length;
      console.log(`✓ Sample embedding model: ${sampleResult.rows[0].model}`);
      console.log(`✓ Sample embedding non-zero values: ${nonZeroCount}/${vec.length}`);
      console.log(`✓ Sample embedding first 5 values: [${vec.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkEmbeddings();
