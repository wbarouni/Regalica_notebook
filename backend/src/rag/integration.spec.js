const { detectLanguage } = require('./lang');
const { estimateTokens, splitByTokens } = require('./tokenizer');
const { truncatePreservingCitations } = require('./rerank');

describe('RAG Pipeline Integration', () => {
  test('should process multilingual content through full pipeline', () => {
    const testCases = [
      {
        text: "This is an English document with multiple sentences. It contains various information.",
        expectedLang: 'en'
      },
      {
        text: "Ceci est un document français avec plusieurs phrases. Il contient diverses informations.",
        expectedLang: 'fr'
      },
      {
        text: "هذا مستند باللغة العربية يحتوي على جمل متعددة ومعلومات مختلفة.",
        expectedLang: 'ar'
      }
    ];

    testCases.forEach(({ text, expectedLang }) => {
      // Étape 1: Détection de langue
      const detectedLang = detectLanguage(text);
      expect(detectedLang).toBe(expectedLang);

      // Étape 2: Estimation de tokens
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);

      // Étape 3: Segmentation si nécessaire
      const segments = splitByTokens(text, 50, 10);
      expect(segments.length).toBeGreaterThanOrEqual(1);

      // Étape 4: Vérification de la cohérence
      segments.forEach(segment => {
        expect(segment.tokens).toBeLessThanOrEqual(50);
        expect(segment.text.trim().length).toBeGreaterThan(0);
      });
    });
  });

  test('should handle documents with citations correctly', () => {
    const textWithCitations = `
      This is a research document [Source1#page:1-10] with multiple citations.
      It references various sources [Source2#page:15-20] throughout the text.
      The final citation [Source3#page:25-30] appears at the end.
    `;

    // Détection de langue
    const lang = detectLanguage(textWithCitations);
    expect(lang).toBe('en');

    // Segmentation préservant les citations
    const segments = splitByTokens(textWithCitations, 30, 5);
    
    segments.forEach(segment => {
      // Vérifier que les citations ne sont pas coupées lors de la troncature
      const truncated = truncatePreservingCitations(segment.text, 100);
      
      // Compter les crochets ouvrants et fermants
      const openBrackets = (truncated.match(/\[/g) || []).length;
      const closeBrackets = (truncated.match(/\]/g) || []).length;
      
      // Si il y a des citations, elles doivent être complètes
      if (openBrackets > 0) {
        expect(openBrackets).toBeLessThanOrEqual(closeBrackets);
      }
    });
  });

  test('should maintain performance targets', () => {
    const mediumText = "Performance test sentence. ".repeat(50); // ~150 tokens
    
    // Test de performance pour la détection de langue
    const langStart = Date.now();
    const lang = detectLanguage(mediumText);
    const langTime = Date.now() - langStart;
    
    expect(langTime).toBeLessThan(50); // < 50ms
    expect(lang).toBeDefined();

    // Test de performance pour l'estimation de tokens
    const tokenStart = Date.now();
    const tokens = estimateTokens(mediumText);
    const tokenTime = Date.now() - tokenStart;
    
    expect(tokenTime).toBeLessThan(20); // < 20ms
    expect(tokens).toBeGreaterThan(100);

    // Test de performance pour la segmentation
    const segmentStart = Date.now();
    const segments = splitByTokens(mediumText, 50, 10);
    const segmentTime = Date.now() - segmentStart;
    
    expect(segmentTime).toBeLessThan(50); // < 50ms
    expect(segments.length).toBeGreaterThan(1);
  });

  test('should handle edge cases in pipeline', () => {
    const edgeCases = [
      '', // Texte vide
      '   ', // Espaces seulement
      'a', // Un seul caractère
      '!@#$%^&*()', // Ponctuation seulement
      'Word', // Un seul mot
      'A'.repeat(1000), // Texte très répétitif
    ];

    edgeCases.forEach(text => {
      // Toutes les fonctions doivent gérer ces cas sans erreur
      expect(() => {
        const lang = detectLanguage(text);
        const tokens = estimateTokens(text);
        const segments = splitByTokens(text, 50, 10);
        const truncated = truncatePreservingCitations(text, 100);
      }).not.toThrow();
    });
  });

  test('should preserve metadata through chunking pipeline', () => {
    const sampleSection = {
      text: "This is a sample section with enough content to be split into multiple chunks. ".repeat(20),
      heading_path: ['Chapter 1', 'Section 1.1'],
      span_start: 0,
      span_end: 1000
    };

    // Simuler le processus de chunking
    const lang = detectLanguage(sampleSection.text);
    const segments = splitByTokens(sampleSection.text, 100, 20);

    segments.forEach((segment, index) => {
      // Créer un chunk simulé
      const chunk = {
        seq: index + 1,
        text: segment.text,
        tokens: segment.tokens,
        heading_path: sampleSection.heading_path,
        span_start: sampleSection.span_start + segment.start,
        span_end: sampleSection.span_start + segment.end,
        page_no: 1,
        meta: {
          lang,
          section: sampleSection.heading_path[sampleSection.heading_path.length - 1],
          hpath: sampleSection.heading_path.join(' > '),
          start_char: sampleSection.span_start + segment.start,
          end_char: sampleSection.span_start + segment.end
        }
      };

      // Vérifier que toutes les métadonnées sont présentes
      expect(chunk.meta.lang).toBe(lang);
      expect(chunk.meta.section).toBe('Section 1.1');
      expect(chunk.meta.hpath).toBe('Chapter 1 > Section 1.1');
      expect(chunk.meta.start_char).toBeGreaterThanOrEqual(0);
      expect(chunk.meta.end_char).toBeGreaterThan(chunk.meta.start_char);
    });
  });

  test('should handle overlapping segments correctly', () => {
    const text = "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.";
    const segments = splitByTokens(text, 20, 5);

    if (segments.length > 1) {
      for (let i = 1; i < segments.length; i++) {
        const prevSegment = segments[i - 1];
        const currentSegment = segments[i];

        // Vérifier que les segments se chevauchent logiquement
        expect(currentSegment.start).toBeLessThan(prevSegment.end);
        
        // Vérifier que le texte d'overlap existe
        const overlapStart = Math.max(prevSegment.start, currentSegment.start);
        const overlapEnd = Math.min(prevSegment.end, currentSegment.end);
        
        if (overlapEnd > overlapStart) {
          const overlapText = text.substring(overlapStart, overlapEnd);
          expect(overlapText.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('should validate token estimation accuracy', () => {
    const testTexts = [
      "Short text.",
      "Medium length text with several words and punctuation marks.",
      "Very long text with many sentences and complex punctuation. ".repeat(10),
      "Text with numbers 123 and symbols @#$% mixed in.",
      "Texte français avec des accents éàùç et des mots composés."
    ];

    testTexts.forEach(text => {
      const tokens = estimateTokens(text);
      const words = text.split(/\s+/).filter(w => w.length > 0).length;
      
      // L'estimation doit être raisonnable par rapport au nombre de mots
      expect(tokens).toBeGreaterThanOrEqual(words * 0.5); // Au moins 0.5 token par mot
      expect(tokens).toBeLessThanOrEqual(words * 3); // Au plus 3 tokens par mot
    });
  });
});
