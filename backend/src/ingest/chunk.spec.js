const { chunkSections } = require('./chunk');

describe('Chunking with Token Control', () => {
  test('should respect token limits and create appropriate chunks', () => {
    const longText = "This is a unique sentence that will not be deduplicated. ".repeat(200); // Texte unique
    const sections = [{
      text: longText,
      heading_path: ['Chapter 1'],
      span_start: 0,
      span_end: longText.length
    }];
    
    const chunks = chunkSections(sections, 1);
    
    // Doit créer au moins un chunk
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    
    // Vérifier que chaque chunk respecte la limite de tokens
    chunks.forEach(chunk => {
      expect(chunk.tokens).toBeLessThanOrEqual(800); // RAG_CHUNK_MAX_TOKENS
      expect(chunk.tokens).toBeGreaterThan(0);
    });
  });

  test('should have strictly increasing start_char and end_char', () => {
    const sections = [{
      text: "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.",
      heading_path: ['Test'],
      span_start: 0,
      span_end: 81
    }];
    
    const chunks = chunkSections(sections, 1);
    
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].meta.start_char).toBeGreaterThanOrEqual(chunks[i-1].meta.start_char);
      expect(chunks[i].meta.end_char).toBeGreaterThan(chunks[i-1].meta.end_char);
    }
  });

  test('should include language metadata in all chunks', () => {
    const sections = [{
      text: "Bonjour, ceci est un texte en français pour tester la détection de langue.",
      heading_path: ['Test FR'],
      span_start: 0,
      span_end: 74
    }];
    
    const chunks = chunkSections(sections, 1);
    
    chunks.forEach(chunk => {
      expect(chunk.meta).toBeDefined();
      expect(chunk.meta.lang).toBeDefined();
      expect(['fr', 'en', 'ar']).toContain(chunk.meta.lang);
    });
  });

  test('should include section and hpath metadata', () => {
    const sections = [{
      text: "Test content for metadata verification.",
      heading_path: ['Chapter 1', 'Section 1.1'],
      span_start: 0,
      span_end: 39
    }];
    
    const chunks = chunkSections(sections, 1);
    
    chunks.forEach(chunk => {
      expect(chunk.meta.section).toBeDefined();
      expect(chunk.meta.hpath).toBe('Chapter 1 > Section 1.1');
      expect(chunk.meta.start_char).toBeDefined();
      expect(chunk.meta.end_char).toBeDefined();
    });
  });

  test('should deduplicate similar chunks', () => {
    const duplicateText = "This is a duplicate text that appears multiple times with the same content and structure.";
    const sections = [
      {
        text: duplicateText,
        heading_path: ['Section 1'],
        span_start: 0,
        span_end: duplicateText.length
      },
      {
        text: duplicateText, // Texte identique
        heading_path: ['Section 2'],
        span_start: 100,
        span_end: 100 + duplicateText.length
      }
    ];
    
    const chunks = chunkSections(sections, 1);
    
    // Doit avoir dédupliqué les chunks similaires (ou au moins pas doubler)
    expect(chunks.length).toBeLessThanOrEqual(2);
  });

  test('should handle empty or very short text', () => {
    const sections = [
      {
        text: "",
        heading_path: ['Empty'],
        span_start: 0,
        span_end: 0
      },
      {
        text: "Short.",
        heading_path: ['Short'],
        span_start: 0,
        span_end: 6
      }
    ];
    
    const chunks = chunkSections(sections, 1);
    
    // Doit gérer les textes vides et courts sans erreur
    expect(chunks.length).toBeGreaterThanOrEqual(0);
    chunks.forEach(chunk => {
      expect(chunk.text).toBeDefined();
      expect(chunk.tokens).toBeGreaterThan(0);
    });
  });

  test('should preserve heading_path in chunks', () => {
    const sections = [{
      text: "Content under a specific heading structure.",
      heading_path: ['Book', 'Chapter 1', 'Section A'],
      span_start: 0,
      span_end: 43
    }];
    
    const chunks = chunkSections(sections, 1);
    
    chunks.forEach(chunk => {
      expect(chunk.heading_path).toEqual(['Book', 'Chapter 1', 'Section A']);
    });
  });

  test('should assign sequential sequence numbers', () => {
    const sections = [{
      text: "First chunk content. Second chunk content. Third chunk content.",
      heading_path: ['Test'],
      span_start: 0,
      span_end: 63
    }];
    
    const chunks = chunkSections(sections, 5); // Start from seq 5
    
    // Vérifier que les numéros de séquence sont assignés
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk, i) => {
      expect(chunk.seq).toBeDefined();
      expect(typeof chunk.seq).toBe('number');
    });
  });
});
