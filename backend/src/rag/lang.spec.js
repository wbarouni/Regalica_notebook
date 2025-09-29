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

  test('should default to English for unsupported languages', () => {
    // Texte en allemand (non supporté)
    const germanText = "Das ist ein deutscher Text mit vielen Wörtern.";
    expect(detectLanguage(germanText)).toBe('en');
    
    // Texte en espagnol (non supporté)
    const spanishText = "Este es un texto en español con muchas palabras.";
    expect(detectLanguage(spanishText)).toBe('en');
  });

  test('should handle mixed language text', () => {
    const mixedText = "Hello bonjour مرحبا this is mixed text";
    // Le résultat peut varier selon la langue dominante détectée par franc
    const result = detectLanguage(mixedText);
    expect(['fr', 'en', 'ar']).toContain(result);
  });

  test('should be fast for short text', () => {
    const shortText = "Quick test";
    const startTime = Date.now();
    detectLanguage(shortText);
    const endTime = Date.now();
    
    // Doit être exécuté en moins de 10ms pour un texte court
    expect(endTime - startTime).toBeLessThan(10);
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
