const { detectLanguage } = require('./lang');

describe('Language Detection', () => {
  test('should detect French text', () => {
    const frenchText = "Bonjour, ceci est un test en français avec plusieurs mots.";
    expect(detectLanguage(frenchText)).toBe('fr');
  });

  test('should detect English text', () => {
    const englishText = "This is a quick check to verify the language detection works properly.";
    expect(detectLanguage(englishText)).toBe('en');
  });

  test('should detect Arabic text', () => {
    const arabicText = "مرحبا كيف الحال هذا نص تجريبي باللغة العربية";
    expect(detectLanguage(arabicText)).toBe('ar');
  });

  test('should default to English for empty text', () => {
    expect(detectLanguage('')).toBe('en');
    expect(detectLanguage(null)).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
    expect(detectLanguage('   ')).toBe('en');
  });

  test('should default to English for very short ambiguous text', () => {
    expect(detectLanguage('a')).toBe('en');
    expect(detectLanguage('ok')).toBe('en');
    expect(detectLanguage('123')).toBe('en');
  });

  test('should support extended languages', () => {
    // Texte en allemand (maintenant supporté)
    const germanText = "Das ist ein deutscher Text mit vielen Wörtern und Sätzen.";
    expect(detectLanguage(germanText)).toBe('de');
    
    // Texte en espagnol (maintenant supporté)
    const spanishText = "Este es un texto en español con muchas palabras y frases.";
    expect(detectLanguage(spanishText)).toBe('es');
    
    // Texte en italien (peut fallback vers 'en' si franc ne détecte pas)
    const italianText = "Questo è un testo italiano con molte parole e frasi.";
    const italianResult = detectLanguage(italianText);
    expect(['it', 'en']).toContain(italianResult);
  });

  test('should handle mixed language text', () => {
    const mixedText = "Hello bonjour مرحبا this is mixed text";
    // Le résultat peut varier selon la langue dominante détectée par franc
    const result = detectLanguage(mixedText);
    expect(['fr', 'en', 'ar']).toContain(result);
  });

  test('should detect short French text with heuristics', () => {
    expect(detectLanguage('Ça va')).toBe('fr'); // Accent détecté
    expect(detectLanguage('très bien')).toBe('fr'); // Accent détecté
    expect(detectLanguage('le chat')).toBe('fr'); // Mots français détectés
    expect(detectLanguage('Bonjour le monde')).toBe('fr'); // Mots français détectés
    expect(detectLanguage('dans la maison')).toBe('fr'); // Mots français détectés
  });

  test('should detect short English text with heuristics', () => {
    expect(detectLanguage('Hello')).toBe('en');
    expect(detectLanguage('Thank you')).toBe('en');
    expect(detectLanguage('the cat')).toBe('en');
    expect(detectLanguage('very good')).toBe('en');
  });

  test('should detect short Arabic text with Unicode', () => {
    expect(detectLanguage('مرحبا')).toBe('ar');
    expect(detectLanguage('شكرا')).toBe('ar');
    expect(detectLanguage('القط')).toBe('ar');
  });

  test('should be fast for short text', () => {
    const shortText = "Quick test";
    const startTime = Date.now();
    detectLanguage(shortText);
    const endTime = Date.now();
    
    // Doit être exécuté en moins de 50ms pour un texte court
    expect(endTime - startTime).toBeLessThan(50);
  });

  test('should handle special characters and numbers', () => {
    const textWithSpecialChars = "Test 123 @#$ %^& special characters!";
    expect(detectLanguage(textWithSpecialChars)).toBe('en');
  });

  test('should handle long text efficiently', () => {
    const longText = "This is a very long English text that contains many words and sentences. ".repeat(100);
    const result = detectLanguage(longText);
    expect(result).toBe('en');
  });
});
