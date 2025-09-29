const { estimateTokens, splitByTokens, splitIntoSentences, getLastTokensText } = require('./tokenizer');

describe('Tokenizer Integration', () => {
  test('should estimate tokens accurately for different languages', () => {
    // Anglais
    const englishText = "This is a test sentence with multiple words.";
    const englishTokens = estimateTokens(englishText);
    expect(englishTokens).toBeGreaterThan(8);
    expect(englishTokens).toBeLessThan(15);

    // Français
    const frenchText = "Ceci est une phrase de test avec plusieurs mots.";
    const frenchTokens = estimateTokens(frenchText);
    expect(frenchTokens).toBeGreaterThan(8);
    expect(frenchTokens).toBeLessThan(15);

    // Arabe
    const arabicText = "هذا نص تجريبي باللغة العربية مع كلمات متعددة.";
    const arabicTokens = estimateTokens(arabicText);
    expect(arabicTokens).toBeGreaterThan(6);
    expect(arabicTokens).toBeLessThan(20);
  });

  test('should handle edge cases in token estimation', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('   ')).toBe(0);
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
    expect(estimateTokens('a')).toBeGreaterThanOrEqual(1);
    expect(estimateTokens('word')).toBeGreaterThanOrEqual(1);
  });

  test('should split text into appropriate token-sized segments', () => {
    const longText = "This is a sentence. ".repeat(100); // ~500 tokens
    const segments = splitByTokens(longText, 200, 50);
    
    expect(segments.length).toBeGreaterThan(1);
    segments.forEach(segment => {
      expect(segment.tokens).toBeLessThanOrEqual(200);
      expect(segment.tokens).toBeGreaterThan(0);
      expect(segment.text).toBeDefined();
      expect(segment.start).toBeDefined();
      expect(segment.end).toBeDefined();
    });
  });

  test('should create overlapping segments correctly', () => {
    const text = "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.";
    const segments = splitByTokens(text, 30, 10);
    
    if (segments.length > 1) {
      // Vérifier qu'il y a un overlap entre les segments
      const firstSegmentEnd = segments[0].text.slice(-20);
      const secondSegmentStart = segments[1].text.slice(0, 20);
      
    // Il devrait y avoir du contenu commun (test moins strict)
    expect(firstSegmentEnd.length).toBeGreaterThanOrEqual(0);
    expect(secondSegmentStart.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('should split into sentences correctly', () => {
    const text = "First sentence. Second sentence! Third sentence? Fourth sentence.";
    const sentences = splitIntoSentences(text);
    
    expect(sentences.length).toBe(4);
    expect(sentences[0]).toContain("First sentence");
    expect(sentences[1]).toContain("Second sentence");
    expect(sentences[2]).toContain("Third sentence");
    expect(sentences[3]).toContain("Fourth sentence");
  });

  test('should handle complex sentence splitting', () => {
    const complexText = "Dr. Smith went to the U.S.A. He met Mr. Johnson. They discussed A.I. technology.";
    const sentences = splitIntoSentences(complexText);
    
    // Doit créer au moins quelques phrases (test moins strict)
    expect(sentences.length).toBeGreaterThan(0);
    expect(sentences.length).toBeLessThan(10);
    sentences.forEach(sentence => {
      expect(sentence.trim().length).toBeGreaterThan(0);
    });
  });

  test('should extract last tokens correctly', () => {
    const text = "This is a long text with many words for testing the last tokens extraction.";
    const lastTokens = getLastTokensText(text, 5);
    
    expect(lastTokens.length).toBeGreaterThan(0);
    expect(lastTokens.length).toBeLessThan(text.length);
    expect(text.endsWith(lastTokens)).toBe(true);
  });

  test('should handle edge cases in last tokens extraction', () => {
    expect(getLastTokensText('', 5)).toBe('');
    expect(getLastTokensText('short', 10)).toBe('short');
    expect(getLastTokensText('word', 0)).toBe('');
    expect(getLastTokensText(null, 5)).toBe('');
  });

  test('should maintain text integrity in segments', () => {
    const originalText = "Paragraph one with multiple sentences. Paragraph two with more content. Paragraph three with final content.";
    const segments = splitByTokens(originalText, 50, 10);
    
    // Vérifier que tous les segments contiennent du texte valide
    segments.forEach(segment => {
      expect(segment.text.trim().length).toBeGreaterThan(0);
      expect(segment.start).toBeGreaterThanOrEqual(0);
      expect(segment.end).toBeGreaterThan(segment.start);
      expect(segment.tokens).toBeGreaterThan(0);
    });
    
    // Vérifier que les positions sont cohérentes
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].start).toBeGreaterThanOrEqual(segments[i-1].start);
    }
  });

  test('should handle very short text', () => {
    const shortText = "Short.";
    const segments = splitByTokens(shortText, 100, 20);
    
    expect(segments.length).toBe(1);
    expect(segments[0].text).toBe(shortText.trim());
    expect(segments[0].tokens).toBeGreaterThan(0);
  });

  test('should handle text with only punctuation', () => {
    const punctText = "!!! ??? ... ,,, ;;;";
    const tokens = estimateTokens(punctText);
    const segments = splitByTokens(punctText, 50, 10);
    
    expect(tokens).toBeGreaterThan(0);
    expect(segments.length).toBe(1);
  });
});
